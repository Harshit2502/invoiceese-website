const http = require('http');
const { v4: uuidv4 } = require('uuid');

function request(url, method, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = data ? JSON.stringify(data) : '';
    const headers = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: method,
      headers: headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch(e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Format YYYY-MM-DD
function getFormattedDate(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  try {
    console.log('🔑 Logging in...');
    const loginRes = await request('http://localhost:5000/api/auth/login', 'POST', {
      email: 'harshit@example.com',
      password: 'password123'
    });
    
    if (loginRes.status !== 200) {
      console.error('❌ Login failed:', loginRes.body);
      return;
    }
    const token = loginRes.body.token;
    console.log('✅ Logged in.');

    // Step 1: Create a sales invoice
    console.log('\n📄 Creating a sales invoice...');
    const invoiceData = {
      clientName: 'Reminder Test Corp',
      clientGst: '27AAAAA1111A1Z1',
      clientAddress: '456 Reminder Way, Pune',
      clientMobile: '07666522600', // Test WhatsApp routing mobile
      clientState: 'Maharashtra',
      clientStateCode: '27',
      items: [{ description: 'Overdue Consulting', quantity: 1, unitPrice: 5000 }],
      dueDate: getFormattedDate(-1) // Overdue by 1 day
    };
    
    const createRes = await request('http://localhost:5000/api/invoices', 'POST', invoiceData, token);
    if (createRes.status !== 201) {
      console.error('❌ Failed to create invoice:', createRes.body);
      return;
    }
    const invoice = createRes.body.invoice || createRes.body;
    const invoiceId = invoice.id;
    console.log(`✅ Invoice created: ID = ${invoiceId}, Number = ${invoice.invoiceNumber}, Due Date = ${invoice.dueDate}`);

    // Step 2: Retrieve default reminder configuration
    console.log('\n🔍 Retrieving default reminder configuration...');
    const getReminderRes = await request(`http://localhost:5000/api/invoices/${invoiceId}/reminder`, 'GET', null, token);
    if (getReminderRes.status !== 200) {
      console.error('❌ Failed to fetch reminder config:', getReminderRes.body);
      return;
    }
    console.log('Default Config:', getReminderRes.body.config);
    console.log('Logs (should be empty):', getReminderRes.body.logs);

    // Step 3: Update reminder configuration
    console.log('\n⚙️ Updating reminder configuration schedule...');
    const newConfig = {
      remindOnDays: [1, 2, 3], // Remind on day 1, 2, and 3 after due date
      channels: ['email', 'whatsapp']
    };
    const updateConfigRes = await request(`http://localhost:5000/api/invoices/${invoiceId}/reminder`, 'POST', newConfig, token);
    if (updateConfigRes.status !== 200) {
      console.error('❌ Failed to update reminder config:', updateConfigRes.body);
      return;
    }
    console.log('✅ Configuration updated successfully:', updateConfigRes.body.config);

    // Step 4: Update the due date to make it exactly overdue by 1 day relative to today
    // Our configuration triggers on day 1 after due date
    const overdueDueDate = getFormattedDate(-1);
    console.log(`\n📅 Updating due date to exactly yesterday: ${overdueDueDate}`);
    const updateDueDateRes = await request(`http://localhost:5000/api/invoices/${invoiceId}/status`, 'PATCH', {
      dueDate: overdueDueDate
    }, token);
    if (updateDueDateRes.status !== 200) {
      console.error('❌ Failed to update due date:', updateDueDateRes.body);
      return;
    }
    console.log(`✅ Due date updated: ${updateDueDateRes.body.invoice.dueDate}`);

    // Step 5: Trigger bulk reminders manually
    console.log('\n🔔 Triggering bulk reminders...');
    const triggerRes = await request('http://localhost:5000/api/invoices/reminders/bulk', 'POST', null, token);
    if (triggerRes.status !== 200) {
      console.error('❌ Failed to trigger bulk reminders:', triggerRes.body);
      return;
    }
    console.log('✅ Bulk trigger request processed:', triggerRes.body);

    // Step 6: Verify logs and last_sent_at update
    console.log('\n🔍 Verifying logs and lastSentAt timestamp updates...');
    const verifyRes = await request(`http://localhost:5000/api/invoices/${invoiceId}/reminder`, 'GET', null, token);
    if (verifyRes.status !== 200) {
      console.error('❌ Failed to verify reminder logs:', verifyRes.body);
      return;
    }
    
    console.log('Updated Config LastSentAt:', verifyRes.body.config.lastSentAt);
    console.log('Sent Logs timeline:');
    verifyRes.body.logs.forEach(log => {
      console.log(`- [${log.sentAt}] Channel: ${log.channel}, Sent To: ${log.sentTo}, Status: ${log.status}`);
    });

    if (verifyRes.body.logs.length > 0) {
      console.log('\n🎉 ALL PAYMENT REMINDER TESTS PASSED SUCCESSFULLY! ✅');
    } else {
      console.error('\n❌ TEST FAILED: No logs were created. Check scheduler conditions.');
    }

  } catch (err) {
    console.error('Test run failed:', err);
  }
}

main();
