import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

const localRoot = 'C:/Users/os/Downloads/DACS/DACS';
const remoteRoot = '/var/www/dacs';
const standalone = `${remoteRoot}/.next/standalone`;
const host = process.env.VPS_HOST || '160.191.243.77';
const password = process.env.VPS_PASSWORD;

const files = [
  'app/admin/page.tsx',
  'app/api/orders/route.ts',
  'app/kitchen/page.tsx',
  'app/page.tsx',
  'app/pay/[id]/page.tsx',
  'app/staff/page.tsx',
  'app/orders/page.tsx',
];

async function exec(command, cwd = remoteRoot, timeout = 300000) {
  const result = await ssh.execCommand(command, { cwd, execTimeout: timeout });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (output.trim()) console.log(output.slice(-4000));
  if (result.code !== 0) throw new Error(`Command failed (${result.code}): ${command}`);
  return output;
}

async function run() {
  if (!password) throw new Error('VPS_PASSWORD is required');

  await ssh.connect({
    host,
    username: 'root',
    password,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  });

  console.log(`Connected to ${host}`);

  for (const file of files) {
    const remoteFile = `${remoteRoot}/${file}`;
    const remoteDir = remoteFile.split('/').slice(0, -1).join('/');
    await exec(`mkdir -p '${remoteDir}'`, '/root', 30000);
    await ssh.putFile(`${localRoot}/${file}`, remoteFile);
    console.log(`Uploaded ${file}`);
  }

  await exec('npm install', remoteRoot, 300000);
  await exec('rm -rf .next', remoteRoot, 60000);
  await exec('NODE_OPTIONS=--max_old_space_size=768 npm run build', remoteRoot, 420000);
  await exec(`mkdir -p ${standalone}/.next`, remoteRoot, 30000);
  await exec(`rm -rf ${standalone}/.next/static ${standalone}/public`, remoteRoot, 30000);
  await exec(`cp -R ${remoteRoot}/.next/static ${standalone}/.next/static`, remoteRoot, 60000);
  await exec(`cp -R ${remoteRoot}/public ${standalone}/public`, remoteRoot, 60000);
  await exec(`pm2 reload hch-restaurant || pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js`, remoteRoot, 60000);

  await new Promise(resolve => setTimeout(resolve, 5000));
  const localStatus = await exec('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000', '/root', 30000);
  const siteStatus = await exec('curl -sk -o /dev/null -w "%{http_code}" https://hchrestaurant.shop', '/root', 30000);

  console.log(`Local HTTP ${localStatus.trim()}`);
  console.log(`Site HTTP ${siteStatus.trim()}`);
}

run()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => ssh.dispose());
