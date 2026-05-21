const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
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
    req.write(body);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
    req.end();
  });
}

async function main() {
  try {
    console.log('Logging in...');
    const loginRes = await post('http://localhost:5000/api/auth/login', {
      email: 'harshit@example.com',
      password: 'password123'
    });
    console.log('Login Response Status:', loginRes.status);
    if (loginRes.status !== 200) {
      console.error('Login failed:', loginRes.body);
      return;
    }
    const token = loginRes.body.token;
    console.log('Token received successfully.');

    console.log('\nFetching purchases...');
    const purchasesRes = await get('http://localhost:5000/api/purchases', token);
    console.log('Purchases Response Status:', purchasesRes.status);
    console.log('Purchases:', JSON.stringify(purchasesRes.body, null, 2));

    console.log('\nFetching invoices...');
    const invoicesRes = await get('http://localhost:5000/api/invoices', token);
    console.log('Invoices Response Status:', invoicesRes.status);
    console.log('Invoices Count:', invoicesRes.body.invoices ? invoicesRes.body.invoices.length : 0);
  } catch (err) {
    console.error(err);
  }
}

main();
