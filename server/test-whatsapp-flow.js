const http = require('http');
const sender = '917666522600';
const steps = ['Hi', 'Acme Corporation', '27XXXXX5678X1Z9', 'Website Design and Development', '50000', 'Yes', '1'];

const send = (text) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ from: sender, text });
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
        try {
          const parsed = JSON.parse(body);
          const reply = parsed.reply || parsed.text;
          resolve(reply);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

(async () => {
  for (const text of steps) {
    const reply = await send(text);
    console.log('> ', text);
    console.log('< ', reply);
    console.log('----------------------------------------');
  }
})();
