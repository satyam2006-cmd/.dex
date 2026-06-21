#!/usr/bin/env node

import { executeCommand, getCommand } from '../commands/index.js';
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
    const query = [cmdName, ...cmdArgs].join(' ');
    const { findLaunchCandidate, interactiveSelect, launch, printResults } = await import('../core/searchEngine.js');
    const { exact, results } = await findLaunchCandidate(query);

    try {
      if (exact) {
        console.log(`Launching ${exact.name}...`);
        const success = await launch(exact);
        if (success) return;
      } else if (results.length > 0 && process.stdin.isTTY && process.stdout.isTTY) {
        printResults(results.slice(0, 4));
        const selected = await interactiveSelect(query, { message: 'Select app' });
        if (selected) {
          console.log(`Launching ${selected.name}...`);
          const success = await launch(selected);
          if (success) return;
        } else {
          console.log('Cancelled.');
          return;
        }
      }

      // Final fallback: direct system command, preserving old behavior for tools like `.dex calc`.
      const { launchSystemCommand } = await import('../core/osApps.js');
      const success = await launchSystemCommand(cmdName, cmdArgs);
      if (success) return;

      console.error(`Command, Web App, Workspace, Snapshot, Profile, or OS Program "${query}" not recognized.`);
      console.error(`Type ".dex help" to see available commands.`);
      process.exit(1);
    } catch (err) {
      console.error(`Error:`, err.message || err);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
