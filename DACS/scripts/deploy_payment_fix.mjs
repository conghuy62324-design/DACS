import { NodeSSH } from 'node-ssh';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths on the local machine — use absolute paths
const localAdminPage = 'C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\admin\\page.tsx';
const localPaymentMethodsApi = 'C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\api\\payment-methods\\route.ts';
const localStorageApi = 'C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\api\\storage.ts';
const localPaymentClient = 'C:\\Users\\os\\Downloads\\DACS\\DACS\\lib\\payment-client.ts';

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('🔌 Connecting to VPS (160.191.243.56)...');
    await ssh.connect({
      host: '160.191.243.56',
      username: 'root',
      password: 'Huy0405Huy2004',
      readyTimeout: 20000,
      tryKeyboard: true,
    });
    console.log('✅ Connected to VPS!');

    const remoteDir = '/var/www/dacs';

    // 1. Create remote directories
    console.log('📁 Creating directories on VPS...');
    await ssh.execCommand(`mkdir -p ${remoteDir}/app/admin`, { cwd: '/root' });
    await ssh.execCommand(`mkdir -p ${remoteDir}/app/api/payment-methods`, { cwd: '/root' });
    await ssh.execCommand(`mkdir -p ${remoteDir}/app/api`, { cwd: '/root' });
    await ssh.execCommand(`mkdir -p ${remoteDir}/lib`, { cwd: '/root' });
    console.log('✅ Directories ready.');

    // 2. Upload changed files
    console.log('📤 Uploading app/admin/page.tsx (main admin page with payment panel)...');
    await ssh.putFile(localAdminPage, `${remoteDir}/app/admin/page.tsx`);

    console.log('📤 Uploading app/api/payment-methods/route.ts...');
    await ssh.putFile(localPaymentMethodsApi, `${remoteDir}/app/api/payment-methods/route.ts`);

    console.log('📤 Uploading app/api/storage.ts...');
    await ssh.putFile(localStorageApi, `${remoteDir}/app/api/storage.ts`);

    console.log('📤 Uploading lib/payment-client.ts...');
    await ssh.putFile(localPaymentClient, `${remoteDir}/lib/payment-client.ts`);

    // 3. Build on VPS
    console.log('🔨 Running Next.js build on VPS...');
    const buildRes = await ssh.execCommand('npm run build', { cwd: remoteDir, execTimeout: 300000 });
    console.log('📦 Build output:', buildRes.stdout.substring(0, 500));
    if (buildRes.stderr && buildRes.stderr.trim()) {
      console.warn('⚠️ Build warnings/stderr:', buildRes.stderr.substring(0, 300));
    }

    if (buildRes.code !== 0) {
      console.error('❌ Build FAILED with code:', buildRes.code);
      process.exit(1);
    }
    console.log('✅ Build SUCCESS!');

    // 4. Copy static assets
    console.log('📦 Copying static assets...');
    await ssh.execCommand('cp -r public/.next/standalone/ 2>/dev/null || true', { cwd: remoteDir });
    await ssh.execCommand('mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ 2>/dev/null || true', { cwd: remoteDir });

    // 5. Restart PM2
    console.log('🔄 Restarting PM2...');
    await ssh.execCommand('pm2 restart all');
    console.log('✅ PM2 restarted!');

    console.log('\n🎉==================================');
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('🌐 Website: http://160.191.243.56');
    console.log('🎉==================================\n');

    ssh.dispose();
    process.exit(0);

  } catch (error) {
    console.error('❌ Deploy Error:', error.message || error);
    ssh.dispose();
    process.exit(1);
  }
}

run();
