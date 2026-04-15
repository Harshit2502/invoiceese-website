const http = require('http');
const data = JSON.stringify({ from: '917666522600', text: 'Hi' });
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/whatsapp/incoming',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log(body);
  });
});
req.on('error', (err) => console.error('err', err));
req.write(data);
req.end();
