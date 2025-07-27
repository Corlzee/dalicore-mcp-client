
import { spawn } from 'child_process';

const server = spawn('node', ['/home/konverts/projects2/Commander-Keen/dist/index.js']);

const command = {
  "command": "list_processes",
  "args": {}
};

server.stdin.write(JSON.stringify(command) + '\n');

server.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

server.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

