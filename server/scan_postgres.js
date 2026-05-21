const { Client } = require('pg');

const ports = [5432, 5433];
const passwords = [
  'postgres',
  'admin',
  'root',
  '1234',
  '123456',
  'password',
  '',
  'harshit',
  'harshit2502',
  'invoiceease',
  'Harshit',
  'Harshit@2502'
];

async function scan() {
  for (const port of ports) {
    console.log(`\nScanning Port ${port}...`);
    for (const password of passwords) {
      const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres', // Connect to default postgres db first
        password: password,
        port: port,
      });

      try {
        await client.connect();
        console.log(`✅ Success! Port: ${port}, Password: "${password}"`);
        await client.end();
        return; // Stop if we found one!
      } catch (err) {
        // Log only if it is NOT a password/SASL issue to see if server is active
        if (!err.message.includes('password authentication failed') && !err.message.includes('client password must be a string')) {
          console.log(`Port ${port} error:`, err.message);
          break; // If server is down on this port, skip password scanning for this port
        } else {
          console.log(`❌ Failed: Port: ${port}, Password: "${password}" - ${err.message}`);
        }
      }
    }
  }
  console.log('\nScan complete. No success.');
}

scan().catch(console.error);
