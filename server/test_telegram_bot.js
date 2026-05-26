const express = require('express');
const fetch = require('node-fetch');
const telegramRouter = require('./routes/telegram');
const db = require('./db');

const app = express();
app.use(express.json());
app.use('/api/telegram', telegramRouter);

const PORT = 6789;
const BASE_URL = `http://localhost:${PORT}/api/telegram`;

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${message}`);
};

const sendIncoming = async (chatId, text) => {
  const res = await fetch(`${BASE_URL}/incoming`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, text }),
  });
  assert(res.status === 200, `incoming message returned 200: "${text}"`);
  return await res.json();
};

const runTests = async () => {
  const chatId = 'test-chat-id-123';
  
  // Clean db state for test-chat-id-123
  if (db.conversations) {
    db.conversations = db.conversations.filter(c => String(c.telegram_chat_id) !== chatId);
  }
  const user = db.users.find(u => u.id === 'demo-user-1');
  if (user) {
    user.telegram_chat_id = null; // Unlink if previously linked
  }

  console.log('\n--- 1. Testing Unlinked User Onboarding ---');
  let res = await sendIncoming(chatId, 'hello');
  assert(res.reply && res.reply.includes('Welcome to InvoiceEase'), 'Prompts unlinked user to link account');

  console.log('\n--- 2. Testing Account Linking ---');
  res = await sendIncoming(chatId, '917666522600');
  assert(res.reply && res.reply.includes('linked'), 'Successfully links account by phone entry');
  assert(res.replyMarkup && res.replyMarkup.keyboard, 'Onboarding success contains reply keyboard');

  console.log('\n--- 3. Testing One-shot Invoice Generation (English) ---');
  res = await sendIncoming(chatId, 'Invoice for Acme Corp, ₹50,000, Website Design');
  console.log('Result text:\n', res.text);
  assert(res.text && res.text.includes('Premium Document Generated'), 'Correct document generated receipt header');
  assert(res.text && res.text.includes('Client Name:* Acme Corp'), 'Parsed client name Acme Corp');
  assert(res.text && res.text.includes('Total Amount:* *₹59,000.00*'), 'Parsed amount and calculated 18% GST correctly');
  assert(res.text && res.text.includes('Website Design'), 'Parsed service description Website Design');

  console.log('\n--- 4. Testing One-shot Quotation Generation (Hindi) ---');
  res = await sendIncoming(chatId, 'Sharma ji ke liye quotation banao, 35 hazaar, Consulting Services');
  assert(res.text && res.text.includes('Document Type:* Quotation'), 'Correctly identifies document type Quotation');
  assert(res.text && res.text.includes('Client Name:* Sharma ji'), 'Parsed client name Sharma ji');
  assert(res.text && res.text.includes('Total Amount:* *₹35,000.00*'), 'Calculated 0% GST (since quotation is pre-tax estimates)');

  console.log('\n--- 5. Testing Interactive Wizard Flow (Invoice) ---');
  // Step 1: Trigger invoice creation wizard
  res = await sendIncoming(chatId, '/newinvoice');
  assert(res.reply && res.reply.includes('Step 1:'), 'Prompts for Step 1 client name');

  // Step 2: Client Name
  res = await sendIncoming(chatId, 'Acme Inc');
  assert(res.reply && res.reply.includes('Step 2:'), 'Prompts for Step 2 service description');
  assert(res.reply && res.reply.includes('Acme Inc'), 'Remembers client name in header');

  // Step 3: Item Description
  res = await sendIncoming(chatId, 'SEO Optimization');
  assert(res.reply && res.reply.includes('Step 3:'), 'Prompts for Step 3 quantity');

  // Step 4: Quantity
  res = await sendIncoming(chatId, '2');
  assert(res.reply && res.reply.includes('Step 4:'), 'Prompts for Step 4 unit price');

  // Step 5: Unit Price
  res = await sendIncoming(chatId, '10000');
  assert(res.reply && res.reply.includes('another item'), 'Asks if want to add another item');
  assert(res.replyMarkup && res.replyMarkup.keyboard, 'Yes/No buttons provided');

  // Step 6: Do not add another item
  res = await sendIncoming(chatId, '🛑 No, finish items');
  assert(res.reply && res.reply.includes('Step 5:'), 'Prompts for Step 5 GST Rate');
  assert(res.replyMarkup && res.replyMarkup.keyboard, 'GST rate buttons provided');

  // Step 7: GST Rate
  res = await sendIncoming(chatId, '18%');
  assert(res.reply && res.reply.includes('Step 6:'), 'Prompts for Step 6 Notes');

  // Step 8: Notes
  res = await sendIncoming(chatId, 'skip');
  assert(res.reply && res.reply.includes('Step 7:'), 'Prompts for Step 7 Template (since user has pro plan)');
  assert(res.replyMarkup && res.replyMarkup.keyboard, 'Template buttons provided');

  // Step 9: Template selection & generation
  res = await sendIncoming(chatId, 'modern');
  assert(res.text && res.text.includes('Premium Document Generated'), 'Finishes wizard and outputs final receipt');
  assert(res.text && res.text.includes('Client Name:* Acme Inc'), 'Final document client name is correct');
  assert(res.text && res.text.includes('Total Amount:* *₹23,600.00*'), 'Final amount is correct (20000 + 18% GST)');
  
  console.log('\n🌟 ALL TELEGRAM BOT TESTS PASSED SUCCESSFULLY! 🌟\n');
};

const server = app.listen(PORT, async () => {
  console.log(`Test server booted on port ${PORT}`);
  try {
    await runTests();
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
