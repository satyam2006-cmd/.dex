#!/usr/bin/env node

import { executeCommand, getCommand } from '../commands/index.js';
import { getApps } from '../storage/db.js';
import { VERSION } from '../core/version.js';

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
    console.log(`.dex CLI v${VERSION}`);
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
    // Fallback 1: Check if it's a registered DEX web app (e.g. `.dex github`)
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
      // Fallback 2: Check if it's a scanned OS application (e.g. `.dex discord` or `.dex word`)
      const { launchOsApp, launchSystemCommand } = await import('../core/osApps.js');
      const osResult = await launchOsApp(cmdName);
      if (osResult.success) {
        console.log(`Launching OS App "${osResult.app.name}"...`);
        return;
      }

      // Fallback 3: Try running it as a direct system command (e.g. `.dex notepad` or `.dex calc`)
      const success = await launchSystemCommand(cmdName, cmdArgs);
      if (success) {
        return;
      }

      // If all fallbacks fail
      console.error(`Command, Web App, or OS Program "${cmdName}" not recognized.`);
      console.error(`Type ".dex help" to see available commands.`);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
