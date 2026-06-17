import { getStats } from '../storage/db.js';

export default {
  name: 'stats',
  description: 'Show overall launch statistics',
  async execute() {
    const stats = getStats();
    console.log(`
Total Apps: ${stats.totalApps}
Total Launches: ${stats.totalLaunches}
Most Used: ${stats.mostUsedName}
Least Used: ${stats.leastUsedName}
`);
  }
};
