import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('🔌 Connecting to VPS...');
    await ssh.connect({
      host: '160.191.243.56',
      username: 'root',
      password: 'Huy0405Huy2004',
      tryKeyboard: true,
      readyTimeout: 20000,
    });
    console.log('✅ Connected!');

    const remoteDir = '/var/www/dacs';

    // Upload page.tsx (restaurant menu + cart)
    await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\page.tsx', `${remoteDir}/app/page.tsx`);
    console.log('📤 app/page.tsx uploaded');

    // Upload kitchen/page.tsx
    await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\kitchen\\page.tsx', `${remoteDir}/app/kitchen/page.tsx`);
    console.log('📤 app/kitchen/page.tsx uploaded');

    // Build
    console.log('🔨 Building on VPS...');
    const r = await ssh.execCommand('npm run build', { cwd: remoteDir, execTimeout: 300000 });
    console.log('Build:', r.stdout.substring(0, 400));
    if (r.code !== 0) { console.error('FAILED', r.stderr.substring(0, 300)); process.exit(1); }
    console.log('✅ Build OK!');

    // Restart
    await ssh.execCommand('pm2 restart all');
    console.log('🔄 PM2 restarted!');

    console.log('\n🎉 Done! http://160.191.243.56');
    ssh.dispose();
    process.exit(0);
  } catch (e) {
    console.error('❌', e.message);
    ssh.dispose();
    process.exit(1);
  }
}

run();