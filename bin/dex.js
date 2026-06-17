#!/usr/bin/env node

import { executeCommand, getCommand } from '../commands/index.js';
import { getApps } from '../storage/db.js';

async function main() {
  process.title = '.dex';
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b]2;.dex\x07');
  }

  const args = process.argv.slice(2);

  // If no arguments, start the interactive REPL shell
  if (args.length === 0) {
    const { startRepl } = await import('../shell/repl.js');
    await startRepl();
    return;
  }

  // Version flag
  if (args.includes('-v') || args.includes('--version')) {
    console.log('.DEX CLI v1.0.1');
    return;
  }

  // Help flags
  if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    await executeCommand('help');
    return;
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  const cmd = getCommand(cmdName);
  if (cmd) {
    try {
      await executeCommand(cmdName, cmdArgs);
    } catch (err) {
      console.error(`Error:`, err.message || err);
      process.exit(1);
    }
  } else {
    // Fallback: Check if it's an app name (e.g. `.dex github`)
    const app = getApps().find(
      a => a.id === cmdName.toLowerCase() || a.name.toLowerCase() === cmdName.toLowerCase()
    );
    if (app) {
      try {
        await executeCommand('launch', [app.id]);
      } catch (err) {
        console.error(`Error:`, err.message || err);
        process.exit(1);
      }
    } else {
      console.error(`Command or App "${cmdName}" not recognized.`);
      console.error(`Type ".dex help" to see available commands or registered apps.`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
