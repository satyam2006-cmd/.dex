import { style } from './utils.js';
import { VERSION } from '../core/version.js';

export default {
  name: 'help',
  description: 'Show help menu and available commands',
  async execute() {
    console.log(`
${style.bold}${style.cyan}.dex CLI & Shell v${VERSION}${style.reset} - Manage web apps, native apps, and workspaces from the terminal

${style.bold}Note: When running outside the REPL shell, prefix commands with ".dex" (e.g. ".dex create <url>").${style.reset}

${style.bold}Usage:${style.reset}
  .dex                      Starts the interactive REPL shell (when run with no args)
  .dex <command> [args]     Run a command directly from the system command line

${style.bold}Core Commands:${style.reset}
  ${style.green}help${style.reset}                    Show this help menu
  ${style.green}clear / cls${style.reset}             Clear the terminal screen (REPL shell only)
  ${style.green}exit / quit${style.reset}             Exit the REPL shell (REPL shell only)
  ${style.green}launch <app-names...>${style.reset}   Launch specified registered app(s)
    ${style.dim}-os, --os <name>         Launch an installed Windows app, e.g. launch -os vscode${style.reset}
  ${style.green}create <url> [name]${style.reset}     Create a desktop app shortcut from a URL
    ${style.dim}--hidden                Camouflage the shortcut in Windows Explorer${style.reset}
    ${style.dim}--icon <path_or_url>    Provide a custom PNG, JPG, ICO, or download link${style.reset}
    ${style.dim}-w, --workspace <name>  Assign app to a workspace on creation${style.reset}
  ${style.green}update <app-id>${style.reset}         Update app URL, name, hidden status, or workspaces
    ${style.dim}--url <url>             Update the Web URL${style.reset}
    ${style.dim}--name <name>           Update the display name${style.reset}
    ${style.dim}--hidden <true|false>   Toggle camouflaged status${style.reset}
    ${style.dim}--unlock                Make a camouflaged app visible in Explorer again${style.reset}
    ${style.dim}--workspace <name>      Re-assign workspaces (comma-separated)${style.reset}
  ${style.green}list${style.reset}                    List all registered apps
    ${style.dim}--all, -a               Show all apps including hidden ones${style.reset}
    ${style.dim}--hidden                Show only hidden/camouflaged apps${style.reset}
  ${style.green}search <query>${style.reset}            Search registered apps by name
  ${style.green}remove <app-name>${style.reset}         Delete app metadata and its desktop shortcut
  ${style.green}info <app-name>${style.reset}           Show detailed information about an app

${style.bold}Workspaces & Productivity:${style.reset}
  ${style.green}capture <name>${style.reset}              Capture live browser tabs using the .dex extension
  ${style.green}capture install${style.reset}             Show the bundled extension path to load once
  ${style.green}capture status${style.reset}              Check whether the extension is connected
  ${style.green}snapshot save <name>${style.reset}        Save open browser tabs and apps in use
  ${style.green}snapshot restore <name>${style.reset}     Restore a saved session snapshot
  ${style.green}workspace <subcommand>${style.reset}      Manage workspaces, snapshots, and tab imports
    ${style.dim}list                        List all workspaces and their apps${style.reset}
    ${style.dim}create -w <name>            Create a new empty workspace${style.reset}
    ${style.dim}delete -w <name>            Delete an existing workspace${style.reset}
    ${style.dim}rename -w <old> <new>       Rename a workspace${style.reset}
    ${style.dim}add -w <ws> <app>           Add an app to a workspace${style.reset}
    ${style.dim}remove -w <ws> <app>        Remove an app from a workspace${style.reset}
    ${style.dim}launch -w <name>            Launch all apps in a workspace${style.reset}
    ${style.dim}snapshot save -w <name>     Save current open browser tabs and VS Code folders${style.reset}
    ${style.dim}snapshot restore -w <name>  Restore the saved snapshot${style.reset}
    ${style.dim}import -w <name> <browser>  Import active browser tabs (chrome|edge|brave|opera)${style.reset}

${style.bold}Analytics & Utility:${style.reset}
  ${style.green}recent${style.reset}                  Show recently launched apps
  ${style.green}stats${style.reset}                   Show overall launch statistics
  ${style.green}export <file.json>${style.reset}        Export apps database to JSON file
  ${style.green}import <file.json>${style.reset}        Import apps database from JSON file
  ${style.green}suggest${style.reset}                 Show suggestions for unused apps (30+ days)
  ${style.green}clean${style.reset}                   Interactively remove unused apps
  ${style.green}summarize${style.reset}               Show a weekly launch activity summary
`);
  }
};
