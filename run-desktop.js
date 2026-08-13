const { spawn } = require('child_process');
const path = require('path');

console.log("Starting Reach Desktop Companion App...");

// Start Electron in root folder
const electronScript = path.join(__dirname, 'node_modules', 'electron', 'cli.js');
console.log(`Starting Electron: node "${electronScript}"`);

const electronProcess = spawn('node', [electronScript, '.'], {
  cwd: __dirname,
  stdio: 'inherit'
});

electronProcess.on('close', (code) => {
  console.log(`Electron closed with code ${code}.`);
  process.exit(code);
});
