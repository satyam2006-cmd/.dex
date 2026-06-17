import readline from 'readline/promises';
import { getSuggestions, deleteApp } from '../storage/db.js';
import { removeDesktopShortcut } from '../core/shortcut.js';
import { style } from './utils.js';

export default {
  name: 'clean',
  description: 'Interactively remove unused apps (30+ days)',
  async execute(args, context = {}) {
    const suggestions = getSuggestions();
    if (suggestions.length === 0) {
      console.log('Your library is clean! All apps have been launched within the last 30 days.');
      return;
    }
    
    console.log(`${style.bold}The following apps haven't been used in 30 days:${style.reset}`);
    suggestions.forEach((app, idx) => {
      console.log(`${idx + 1}. ${app.name}`);
    });
    
    let answer = '';
    const questionText = '\nWould you like to remove them? (Y/N): ';
    
    if (context.rl) {
      answer = await context.rl.question(questionText);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      answer = await rl.question(questionText);
      rl.close();
    }
    
    if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
      let count = 0;
      for (const app of suggestions) {
        deleteApp(app.id);
        removeDesktopShortcut(app.name);
        count++;
      }
      console.log(`${style.green}Successfully removed ${count} apps and their shortcuts.${style.reset}`);
    } else {
      console.log('Clean operation cancelled.');
    }
  }
};
