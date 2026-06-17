import { getSuggestions } from '../storage/db.js';
import { style } from './utils.js';

export default {
  name: 'suggest',
  description: 'Show suggestions for unused apps (30+ days)',
  async execute() {
    const suggestions = getSuggestions();
    if (suggestions.length === 0) {
      console.log('No suggestions! All apps have been launched within the last 30 days.');
      return;
    }
    
    console.log(`${style.bold}Apps not used in 30 days:${style.reset}`);
    suggestions.forEach((app, idx) => {
      console.log(`${idx + 1}. ${app.name}`);
    });
  }
};
