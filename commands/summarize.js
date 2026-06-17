import { getWeeklySummary } from '../storage/db.js';
import { style } from './utils.js';

export default {
  name: 'summarize',
  description: 'Show a weekly launch activity summary',
  async execute() {
    const summary = getWeeklySummary();
    
    console.log(`
${style.bold}${style.cyan}Weekly Usage Summary${style.reset}
--------------------
Total Launches: ${summary.totalLaunches}
`);

    console.log(`${style.bold}Launches by Day:${style.reset}`);
    const days = Object.keys(summary.byDay);
    days.reverse();
    
    const maxLaunches = Math.max(...Object.values(summary.byDay), 1);
    
    days.forEach(day => {
      const val = summary.byDay[day];
      const barsCount = Math.round((val / maxLaunches) * 10);
      const bars = '█'.repeat(barsCount).padEnd(10, ' ');
      console.log("  " + day + ": " + style.cyan + bars + style.reset + " " + val);
    });
    
    console.log(`\n${style.bold}Most Active Apps:${style.reset}`);
    const sortedApps = Object.entries(summary.byApp)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
      
    if (sortedApps.length === 0) {
      console.log('  No launches recorded this week.');
    } else {
      sortedApps.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item[0]}: ${item[1]} launch${item[1] !== 1 ? 'es' : ''}`);
      });
    }
    console.log();
  }
};
