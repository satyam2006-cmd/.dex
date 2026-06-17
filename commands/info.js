import { getApp } from '../storage/db.js';
import { style, formatRelativeTime } from './utils.js';

export default {
  name: 'info',
  description: 'Show detailed information about an app',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify app name. Usage: .dex info <app>${style.reset}`);
      return;
    }
    
    const app = getApp(args[0]);
    if (!app) {
      console.log(`${style.red}App "${args[0]}" not found.${style.reset}`);
      return;
    }
    
    const formattedCreated = new Date(app.created).toISOString().split('T')[0];
    const formattedLastOpened = formatRelativeTime(app.lastOpened);
    
    console.log(`
Name: ${app.name}
URL: ${app.url}
Created: ${formattedCreated}
Last Opened: ${formattedLastOpened}
Launches: ${app.launches}
Category: ${app.category}
Hidden: ${app.hidden ? 'Yes' : 'No'}
`);
  }
};
