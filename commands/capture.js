import { checkCaptureExtension, getCaptureExtensionPath } from '../core/tabCaptureBridge.js';
import snapshotCmd from './snapshot.js';
import { style } from './utils.js';

export default {
  name: 'capture',
  description: 'Capture live browser tabs through the .dex browser extension',
  async execute(args, context = {}) {
    const sub = args[0]?.toLowerCase();
    if (sub === 'install' || sub === '--install') {
      console.log(`${style.bold}.dex Capture Bridge${style.reset}`);
      console.log('Load this bundled extension once in Chrome, Edge, or Brave:');
      console.log(`  ${getCaptureExtensionPath()}`);
      console.log('');
      console.log('Open chrome://extensions, enable Developer mode, then choose "Load unpacked".');
      return;
    }

    if (sub === 'status') {
      try {
        await checkCaptureExtension();
        console.log(`${style.green}.dex Capture Bridge is connected.${style.reset}`);
      } catch (err) {
        console.log(`${style.yellow}${err.message}${style.reset}`);
        console.log('Run: capture install');
      }
      return;
    }

    let name = args[0];
    if (!name && context.rl) {
      name = (await context.rl.question('Snapshot name: ')).trim();
    }

    if (!name) {
      console.log(`${style.red}Error: Please specify a snapshot name. Example: capture coding${style.reset}`);
      return;
    }

    await snapshotCmd.execute(['save', name, '--extension-only']);
  }
};
