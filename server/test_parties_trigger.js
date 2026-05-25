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

    const uniquePartyName = 'Unique Client Corp ' + Date.now();
    console.log(`\n🏢 Testing party name: "${uniquePartyName}"`);

    // Step 1: Check if party already exists (should not)
    console.log('🔍 Checking recurring clients list...');
    const getRes1 = await request('http://localhost:5000/api/invoices/clients', 'GET', null, token);
    const existsBefore = getRes1.body.clients.some(c => c.name.toLowerCase() === uniquePartyName.toLowerCase());
    console.log(`Exists before any invoices? ${existsBefore ? '❌ YES (Error)' : '✅ NO'}`);

    // Step 2: Create first invoice (Occurrence = 1)
    console.log('\n📄 Creating FIRST sales invoice for this party...');
    const invoice1 = {
      clientName: uniquePartyName,
      clientGst: '27AAAAA1111A1Z1',
      clientAddress: '123 Business Rd, Mumbai',
      clientMobile: '9876543210',
      clientState: 'Maharashtra',
      clientStateCode: '27',
      items: [{ description: 'Test Item', quantity: 1, unitPrice: 1000 }]
    };
    const createRes1 = await request('http://localhost:5000/api/invoices', 'POST', invoice1, token);
    console.log('First Invoice Create Status:', createRes1.status);

    // Step 3: Check if party exists now (should not, since count is only 1)
    console.log('🔍 Checking recurring clients list (Occurrence = 1)...');
    const getRes2 = await request('http://localhost:5000/api/invoices/clients', 'GET', null, token);
    const existsAfterOne = getRes2.body.clients.some(c => c.name.toLowerCase() === uniquePartyName.toLowerCase());
    console.log(`Stored in database after 1 invoice? ${existsAfterOne ? '❌ YES (Stored too early)' : '✅ NO'}`);

    // Step 4: Create second invoice (Occurrence = 2)
    console.log('\n📄 Creating SECOND sales invoice for this party...');
    const invoice2 = {
      clientName: uniquePartyName,
      clientGst: '27AAAAA1111A1Z1',
      clientAddress: '123 Business Rd, Mumbai',
      clientMobile: '9876543210',
      clientState: 'Maharashtra',
      clientStateCode: '27',
      items: [{ description: 'Test Item', quantity: 1, unitPrice: 1000 }]
    };
    const createRes2 = await request('http://localhost:5000/api/invoices', 'POST', invoice2, token);
    console.log('Second Invoice Create Status:', createRes2.status);

    // Step 5: Check if party exists now (SHOULD BE stored automatically!)
    console.log('🔍 Checking recurring clients list (Occurrence = 2)...');
    const getRes3 = await request('http://localhost:5000/api/invoices/clients', 'GET', null, token);
    const savedContact = getRes3.body.clients.find(c => c.name.toLowerCase() === uniquePartyName.toLowerCase());
    
    if (savedContact) {
      console.log('✅ YES! Contact stored in database automatically:');
      console.log(JSON.stringify(savedContact, null, 2));
    } else {
      console.error('❌ NO! Contact was not stored automatically.');
    }

  } catch (err) {
    console.error('Test run failed:', err);
  }
}

main();
