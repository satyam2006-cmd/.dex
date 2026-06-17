import { getApps } from '../storage/db.js';
import { style } from './utils.js';

export default {
  name: 'list',
  description: 'List all registered apps',
  async execute(args) {
    const showAll = args.includes('--all') || args.includes('-a');
    const showOnlyHidden = args.includes('--hidden');
    
    const apps = getApps();
    if (apps.length === 0) {
      console.log('No apps registered yet. Create one with: .dex create <url>');
      return;
    }

    let filteredApps = apps;
    if (showOnlyHidden) {
      filteredApps = apps.filter(app => app.hidden);
    } else if (!showAll) {
      filteredApps = apps.filter(app => !app.hidden);
    }

    if (filteredApps.length === 0) {
      console.log('No matching apps to display.');
      return;
    }
    
    console.log(`${style.bold}Registered Apps:${style.reset}`);
    filteredApps.forEach((app, idx) => {
      const disguiseText = app.hidden ? ` ${style.dim}(hidden/disguised)${style.reset}` : '';
      console.log(`${idx + 1}. ${app.name}${disguiseText}`);
    });
  }
};
