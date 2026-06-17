import { getApps } from '../storage/db.js';
import { style } from './utils.js';

export default {
  name: 'search',
  description: 'Search registered apps by name',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify search query.${style.reset}`);
      return;
    }
    
    const query = args[0].toLowerCase();
    const apps = getApps();
    const matches = apps.filter(app => app.name.toLowerCase().includes(query) || app.id.includes(query));
    
    if (matches.length === 0) {
      console.log('No matching apps found.');
      return;
    }
    
    matches.forEach(app => {
      const disguiseText = app.hidden ? ` (hidden)` : '';
      console.log(app.name + disguiseText);
    });
  }
};
