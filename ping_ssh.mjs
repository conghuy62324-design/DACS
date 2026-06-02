import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

console.log('Testing SSH to 160.191.243.77 with password...');
ssh.connect({
  host: '160.191.243.77',
  username: 'root',
  password: process.env.VPS_PASSWORD || '',
  readyTimeout: 15000,
  tryKeyboard: true,
}).then(async () => {
  console.log("Connected! Syncing all modified files...");

  const remoteDir = '/var/www/dacs';

  // 1. API Routes
  await ssh.execCommand(`mkdir -p ${remoteDir}/app/api/orders`);
  await ssh.execCommand(`mkdir -p ${remoteDir}/app/api/inventory`);
  await ssh.execCommand(`mkdir -p ${remoteDir}/app/api/auth/login`);
  await ssh.execCommand(`mkdir -p ${remoteDir}/app/api/accounts`);

  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\api\\orders\\route.ts', `${remoteDir}/app/api/orders/route.ts`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\api\\inventory\\route.ts', `${remoteDir}/app/api/inventory/route.ts`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\api\\auth\\login\\route.ts', `${remoteDir}/app/api/auth/login/route.ts`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\api\\accounts\\route.ts', `${remoteDir}/app/api/accounts/route.ts`);

  // 2. Library files
  await ssh.execCommand(`mkdir -p ${remoteDir}/lib`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\lib\\admin-store.ts', `${remoteDir}/lib/admin-store.ts`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\lib\\mysql.ts', `${remoteDir}/lib/mysql.ts`);

  // 3. Frontend pages
  await ssh.execCommand(`mkdir -p ${remoteDir}/app/admin`);
  await ssh.execCommand(`mkdir -p ${remoteDir}/app`);
  await ssh.execCommand(`mkdir -p ${remoteDir}/app\\staff`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\admin\\page.tsx', `${remoteDir}/app/admin/page.tsx`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\page.tsx', `${remoteDir}/app/page.tsx`);
  await ssh.putFile('C:\\Users\\os\\Downloads\\DACS\\DACS\\app\\staff\\page.tsx', `${remoteDir}/app/staff/page.tsx`);

  console.log("All files synced! Running build on VPS...");
  const buildRes = await ssh.execCommand('npm run build', { cwd: remoteDir });
  console.log('Build Output:', buildRes.stdout);

  if (buildRes.code !== 0) {
    console.error('Build FAILED:', buildRes.stderr);
    console.error('Build warnings:', buildRes.code);
  } else {
    console.log("Build SUCCESS! Copying static assets...");
    await ssh.execCommand('cp -r public .next/standalone/ 2>/dev/null || true', { cwd: remoteDir });
    await ssh.execCommand('mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/ 2>/dev/null || true', { cwd: remoteDir });

    console.log("Restarting PM2...");
    await ssh.execCommand('pm2 restart all');
    console.log("Deployment complete!");
  }

  process.exit(0);
}).catch(err => {
  console.error("SSH FAILED:", err);
  process.exit(1);
});
