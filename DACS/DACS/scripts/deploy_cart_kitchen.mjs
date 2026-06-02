import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('ðŸ”Œ Connecting to VPS...');
    await ssh.connect({
      host: '160.191.243.77',
      username: 'root',
      password: process.env.VPS_PASSWORD || '',
      tryKeyboard: true,
      readyTimeout: 20000,
    });
    console.log('âœ… Connected!');

    const remoteDir = '/var/www/dacs';

    // Upload page.tsx (restaurant menu + cart)
    await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\page.tsx', `${remoteDir}/app/page.tsx`);
    console.log('ðŸ“¤ app/page.tsx uploaded');

    // Upload kitchen/page.tsx
    await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\kitchen\\page.tsx', `${remoteDir}/app/kitchen/page.tsx`);
    console.log('ðŸ“¤ app/kitchen/page.tsx uploaded');

    // Build
    console.log('ðŸ”¨ Building on VPS...');
    const r = await ssh.execCommand('npm run build', { cwd: remoteDir, execTimeout: 300000 });
    console.log('Build:', r.stdout.substring(0, 400));
    if (r.code !== 0) { console.error('FAILED', r.stderr.substring(0, 300)); process.exit(1); }
    console.log('âœ… Build OK!');

    // Restart
    await ssh.execCommand('pm2 restart all');
    console.log('ðŸ”„ PM2 restarted!');

    console.log('\nðŸŽ‰ Done! http://160.191.243.77');
    ssh.dispose();
    process.exit(0);
  } catch (e) {
    console.error('âŒ', e.message);
    ssh.dispose();
    process.exit(1);
  }
}

run();