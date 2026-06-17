import { getRecent } from '../storage/db.js';
import { formatRelativeTime } from './utils.js';

export default {
  name: 'recent',
  description: 'Show recently launched apps',
  async execute() {
    const recentApps = getRecent();
    if (recentApps.length === 0) {
      console.log('No recently launched apps.');
      return;
    }
    
    recentApps.forEach(app => {
      const paddedName = app.name.padEnd(15);
      const relTime = formatRelativeTime(app.lastOpened);
      console.log(`${paddedName} ${relTime}`);
    });
  }
};
