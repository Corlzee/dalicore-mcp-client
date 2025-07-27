

import net from 'net';

const client = new net.Socket();

const command = {
  "command": "list_sessions",
  "args": {}
};

client.connect(8080, '127.0.0.1', () => {
  console.log('Connected');
  client.write(JSON.stringify(command) + '\n');
});

client.on('data', (data) => {
  console.log('Received: ' + data);
  client.destroy(); // kill client after server's response
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', (err) => {
    console.error('Error: ', err.message);
});

