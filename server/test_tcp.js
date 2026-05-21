const net = require('net');

function test(host, port) {
  const socket = new net.Socket();
  console.log(`Connecting to ${host}:${port}...`);
  socket.setTimeout(2000);
  socket.on('connect', () => {
    console.log(`✅ Connected successfully to ${host}:${port}`);
    socket.destroy();
  })
  .on('error', (err) => {
    console.error(`❌ Connection failed to ${host}:${port}:`, err.message);
  })
  .on('timeout', () => {
    console.error(`❌ Connection timeout to ${host}:${port}`);
    socket.destroy();
  });
  socket.connect(port, host);
}

test('127.0.0.1', 5435);
test('localhost', 5435);
