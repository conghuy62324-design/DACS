import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();
const local = 'C:/Users/os/Downloads/DACS/DACS';
const remote = '/var/www/dacs';
const standalone = '/var/www/dacs/.next/standalone';

async function cmd(c, t = 20000) {
  const r = await ssh.execCommand(c, { execTimeout: t });
  return r.stdout + r.stderr;
}

async function run() {
  try {
    console.log('🔌 Connecting...');
    await ssh.connect({ host: '160.191.243.56', username: 'root', password: 'Huy0405Huy2004', readyTimeout: 30000 });
    console.log('✅ Connected');

    console.log('📤 Upload files...');
    await ssh.putDirectory(local, remote, {
      recursive: true, concurrency: 10,
      validate: (p) => {
        const parts = p.split('/');
        const b = parts[parts.length - 1];
        return b !== 'node_modules' && b !== '.git' && !p.includes('.env');
      }
    });
    console.log('✅ Uploaded');

    console.log('🧹 Clean .next...');
    await cmd(`cd ${remote} && rm -rf .next && echo cleaned`);

    console.log('🔨 Build...');
    const b = await cmd(`cd ${remote} && npm run build 2>&1`, 300000);
    console.log(b.substring(0, 500));

    console.log('📁 Copy static to standalone...');
    await cmd(`mkdir -p ${standalone}/.next && cp -r ${remote}/.next/static ${standalone}/.next/ 2>/dev/null && echo static copied`);

    console.log('🚀 Restart PM2...');
    await cmd(`pm2 delete all 2>/dev/null; pkill -9 node 2>/dev/null; sleep 1 && echo killed`);
    await cmd(`cd ${standalone} && pm2 start ecosystem.config.js 2>&1`, 15000);

    await new Promise(r => setTimeout(r, 5000));
    const h = await cmd('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000', 10000);
    console.log('HTTP:', h.trim());
    console.log('🎉 Done! https://hchrestaurant.shop');
    ssh.dispose(); process.exit(0);
  } catch (e) {
    console.error('❌', e.message);
    ssh.dispose(); process.exit(1);
  }
}
run();