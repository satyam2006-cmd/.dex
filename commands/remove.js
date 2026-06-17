import readline from 'readline/promises';
import { getApp, deleteApp } from '../storage/db.js';
import { removeDesktopShortcut } from '../core/shortcut.js';
import { style } from './utils.js';

export default {
  name: 'remove',
  description: 'Delete app metadata and desktop shortcut',
  async execute(args, context = {}) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify app name. Usage: .dex remove <app>${style.reset}`);
      return;
    }
    
    const appName = args[0];
    const app = getApp(appName);
    if (!app) {
      console.log(`${style.red}App "${appName}" not found.${style.reset}`);
      return;
    }
    
    let answer = '';
    const questionText = `Are you sure you want to remove ${app.name}? (Y/N): `;
    
    if (context.rl) {
      answer = await context.rl.question(questionText);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      answer = await rl.question(questionText);
      rl.close();
    }
    
    if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
      deleteApp(app.id);
      removeDesktopShortcut(app.name);
      console.log(`${style.green}App "${app.name}" and its shortcut deleted successfully.${style.reset}`);
    } else {
      console.log('Removal cancelled.');
    }
  }
};
