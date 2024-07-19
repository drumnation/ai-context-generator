const { spawn } = require('child_process');

function runCommand(command, args) {
  const process = spawn(command, args, { shell: true });
  process.stdout.on('data', (data) => console.log(data.toString()));
  process.stderr.on('data', (data) => console.error(data.toString()));
  return process;
}

runCommand('npm', ['run', 'watch']);
runCommand('npm', ['run', 'watch-webview']);

console.log('Watching for changes...');