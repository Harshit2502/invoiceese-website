const cron = require('node-cron');
const db = require('../db');
let pgFunctions = null;
try {
  pgFunctions = require('../db-postgres');
} catch (e) {
  // Ignored
}
const { sendWhatsAppMessage } = require('./whatsapp');
const { sendPaymentReminderEmail } = require('./email');
const { createPaymentLink } = require('./razorpay');

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

// Helper to format dates consistently in local YYYY-MM-DD format
const getLocalDateString = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const processInvoicesReminders = async (merchantId = null) => {
  console.log(`[Reminders] Starting scheduler run at ${new Date().toISOString()} (Merchant filter: ${merchantId || 'none'})`);
  
  let invoices = [];
  let usersMap = {};

  if (USE_POSTGRES && pgFunctions) {
    try {
      // Query unpaid/partial documents of type sales_invoice
      let query = `
        SELECT d.*, u.email as user_email, u.whatsapp as user_whatsapp, u.business_name as user_business_name,
               u.default_due_days, u.default_remind_on_days, u.default_reminder_channels
        FROM documents d
        JOIN users u ON d.user_id = u.id
        WHERE d.doc_type = 'sales_invoice' 
          AND d.payment_status != 'paid' 
          AND d.status != 'paid'
      `;
      const params = [];
      if (merchantId) {
        query += ` AND d.user_id = $1`;
        params.push(merchantId);
      }
      const rows = await pgFunctions.dbQuery(query, params);
      invoices = rows.map(pgFunctions.mapDocToInvoice);
      
      // Store user details for each invoice
      for (const row of rows) {
        usersMap[row.user_id] = {
          id: row.user_id,
          email: row.user_email,
          whatsapp: row.user_whatsapp,
          businessName: row.user_business_name,
          defaultDueDays: row.default_due_days,
          defaultRemindOnDays: row.default_remind_on_days,
          defaultReminderChannels: row.default_reminder_channels
        };
      }
    } catch (err) {
      console.error('[Reminders] Error querying postgres invoices:', err.message);
      return;
    }
  } else {
    // In-memory fallback
    invoices = db.invoices.filter(inv => {
      const matchStatus = inv.status !== 'paid' && inv.paymentStatus !== 'paid';
      const matchMerchant = merchantId ? inv.userId === merchantId : true;
      return matchStatus && matchMerchant;
    });

    for (const inv of invoices) {
      if (!usersMap[inv.userId]) {
        const u = db.users.find(x => x.id === inv.userId);
        if (u) {
          usersMap[inv.userId] = u;
        }
      }
    }
  }

  console.log(`[Reminders] Found ${invoices.length} outstanding invoices to evaluate.`);

  const today = new Date();
  today.setHours(0,0,0,0);

  for (const inv of invoices) {
    const user = usersMap[inv.userId];
    if (!user) continue;

    try {
      // Get reminder config
      let config = null;
      if (USE_POSTGRES && pgFunctions) {
        config = await pgFunctions.getPaymentReminder(inv.id);
        if (!config) {
          // Initialize with user defaults or global defaults
          const remindOnDays = user.defaultRemindOnDays || [1, 3, 7, 14];
          const channels = user.defaultReminderChannels || ['email'];
          config = await pgFunctions.upsertPaymentReminder(inv.id, { remindOnDays, channels });
        }
      } else {
        // In-memory reminder config
        config = db.paymentReminders.find(c => c.invoiceId === inv.id);
        if (!config) {
          config = {
            invoiceId: inv.id,
            remindOnDays: user.defaultRemindOnDays || [1, 3, 7, 14],
            channels: user.defaultReminderChannels || ['email'],
            lastSentAt: null
          };
          db.paymentReminders.push(config);
        }
      }

      // Check if reminders are due
      if (!inv.dueDate) {
        console.log(`[Reminders] Invoice #${inv.invoiceNumber} has no due date. Skipping.`);
        continue;
      }

      const invDueDate = new Date(inv.dueDate);
      invDueDate.setHours(0,0,0,0);
      const diffTime = today - invDueDate;
      const dayDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // check if dayDiff is in config.remindOnDays
      const isDue = config.remindOnDays.includes(dayDiff);
      if (!isDue) {
        console.log(`[Reminders] Invoice #${inv.invoiceNumber} due in ${-dayDiff} days or day diff ${dayDiff} is not in schedule [${config.remindOnDays}]. Skipping.`);
        continue;
      }

      // Avoid duplicate sends
      if (config.lastSentAt) {
        const lastSentDate = getLocalDateString(config.lastSentAt);
        const todayDate = getLocalDateString(today);
        if (lastSentDate === todayDate) {
          console.log(`[Reminders] Invoice #${inv.invoiceNumber} already had a reminder sent today. Skipping.`);
          continue;
        }
      }

      // Create Razorpay payment link
      let paymentUrl = '';
      try {
        paymentUrl = await createPaymentLink(inv);
      } catch (payErr) {
        console.error(`[Reminders] Failed to generate payment link for Invoice #${inv.invoiceNumber}:`, payErr.message);
        continue;
      }

      console.log(`[Reminders] Sending reminder for Invoice #${inv.invoiceNumber} via channels: ${config.channels}`);

      // Send reminders per channel
      for (const channel of config.channels) {
        let sentStatus = 'success';
        let errMsg = null;
        let sentTo = '';

        if (channel === 'email') {
          // If invoice client email is not defined in table schema, use fallback
          sentTo = inv.clientEmail || `${inv.clientName.replace(/\s+/g, '').toLowerCase()}@example.com`;
          try {
            await sendPaymentReminderEmail(
              sentTo,
              inv.clientName,
              inv.invoiceNumber,
              inv.totalAmount || inv.amount,
              getLocalDateString(inv.dueDate),
              paymentUrl
            );
          } catch (err) {
            sentStatus = 'failed';
            errMsg = err.message;
            console.error(`[Reminders] Email failed:`, err.message);
          }
        } else if (channel === 'whatsapp') {
          sentTo = inv.clientMobile || user.whatsapp || '';
          if (sentTo) {
            // Keep message under 160 characters
            const msg = `Reminder: Invoice #${inv.invoiceNumber} of ₹${inv.totalAmount || inv.amount} is due on ${getLocalDateString(inv.dueDate)}. Pay now: ${paymentUrl}`;
            try {
              await sendWhatsAppMessage(sentTo, msg);
            } catch (err) {
              sentStatus = 'failed';
              errMsg = err.message;
              console.error(`[Reminders] WhatsApp failed:`, err.message);
            }
          } else {
            sentStatus = 'failed';
            errMsg = 'No mobile number configured';
          }
        }

        // Log the reminder send
        if (USE_POSTGRES && pgFunctions) {
          await pgFunctions.logReminder(inv.id, channel, sentTo, sentStatus, errMsg);
        } else {
          db.reminderLogs.push({
            id: String(Date.now()),
            invoiceId: inv.id,
            channel,
            sentTo,
            status: sentStatus,
            errorMessage: errMsg,
            sentAt: new Date().toISOString()
          });
        }
      }

      // Update last sent time
      if (USE_POSTGRES && pgFunctions) {
        await pgFunctions.updatePaymentReminderLastSent(inv.id);
      } else {
        config.lastSentAt = new Date().toISOString();
      }

    } catch (itemErr) {
      console.error(`[Reminders] Error processing Invoice #${inv.invoiceNumber}:`, itemErr.message);
    }
  }

  console.log(`[Reminders] Scheduler run finished.`);
};

const startReminderScheduler = () => {
  // Cron schedule: Daily at 9 AM IST.
  // "Asia/Kolkata" timezone offset is UTC +5:30.
  // 9:00 AM IST is 3:30 AM UTC.
  console.log('[Reminders] Initializing daily cron scheduler at 09:00 AM IST');
  cron.schedule('0 9 * * *', () => {
    processInvoicesReminders().catch(err => {
      console.error('[Reminders] Scheduled run error:', err.message);
    });
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
};

module.exports = {
  startReminderScheduler,
  processInvoicesReminders
};
