import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('🔌 Connecting...');
    await ssh.connect({
      host: '160.191.243.56',
      username: 'root',
      password: 'Huy0405Huy2004',
      readyTimeout: 30000,
    });
    console.log('✅ Connected');

    const local = 'C:/Users/os/Downloads/DACS/DACS';
    const remote = '/var/www/dacs';
    const stand = '/var/www/dacs/.next/standalone';

    // Step 1: Full stop + clean
    console.log('🛑 Stopping all processes...');
    await ssh.execCommand('pm2 delete all 2>/dev/null; pkill -9 node 2>/dev/null; sleep 2; echo stopped', { execTimeout: 15000 });
    console.log('Killed');

    // Step 2: Upload source
    console.log('📤 Upload source...');
    await ssh.putDirectory(local, remote, {
      recursive: true, concurrency: 10,
      validate: (p) => {
        const parts = p.split('/');
        const b = parts[parts.length - 1];
        return b !== 'node_modules' && b !== '.git' && !p.includes('.env');
      }
    });
    console.log('Uploaded');

    // Step 3: Full clean + rebuild
    console.log('🧹 Full clean...');
    await ssh.execCommand(`cd ${remote} && rm -rf .next && echo cleaned`, { execTimeout: 15000 });

    console.log('🔨 Building...');
    const buildR = await ssh.execCommand(
      `cd ${remote} && npm run build 2>&1`,
      { cwd: remote, execTimeout: 320000 }
    );
    console.log(buildR.stdout.substring(0, 500));
    if (buildR.code !== 0) {
      console.error('BUILD FAILED:', buildR.stderr.substring(0, 200));
      process.exit(1);
    }

    // Step 4: Write ecosystem config
    const eco = Buffer.from(
      'module.exports={apps:[{name:"hch-restaurant",script:"server.js",instances:1,exec_mode:"fork",env:{NODE_ENV:"production",PORT:3000}}]};'
    ).toString('base64');
    await ssh.execCommand(
      `echo "${eco}" | base64 -d > ${stand}/ecosystem.config.js`,
      { execTimeout: 10000 }
    );

    // Step 5: Copy entire .next to standalone/.next
    console.log('📁 Syncing .next to standalone...');
    await ssh.execCommand(
      `rm -rf ${stand}/.next && cp -r ${remote}/.next ${stand}/.next && echo synced`,
      { execTimeout: 60000 }
    );

    // Step 6: Start PM2
    console.log('🚀 Starting PM2...');
    await ssh.execCommand(
      `cd ${stand} && pm2 start ecosystem.config.js 2>&1`,
      { cwd: stand, execTimeout: 15000 }
    );

    await new Promise(r => setTimeout(r, 7000));

    // Step 7: Verify
    const httpR = await ssh.execCommand(
      'curl -sk https://127.0.0.1/ -o /dev/null -w "%{http_code}"',
      { execTimeout: 10000 }
    );
    console.log('HTTP status:', httpR.stdout.trim());

    const cssR = await ssh.execCommand(
      'curl -sk https://127.0.0.1/ | grep -o "_next/static/[^\"]*\.css" | head -1',
      { execTimeout: 10000 }
    );
    console.log('CSS ref:', cssR.stdout.trim());

    if (cssR.stdout.trim()) {
      const cssStatus = await ssh.execCommand(
        `curl -sk "https://127.0.0.1${cssR.stdout.trim()}" -o /dev/null -w "%{http_code}"`,
        { execTimeout: 10000 }
      );
      console.log('CSS HTTP:', cssStatus.stdout.trim());
    }

    const styledR = await ssh.execCommand(
      'curl -sk https://127.0.0.1/ | grep -c "bg-zinc"',
      { execTimeout: 10000 }
    );
    console.log('bg-zinc count:', styledR.stdout.trim());

    console.log('✅ DONE! https://hchrestaurant.shop');
    ssh.dispose();
    process.exit(0);
  } catch (e) {
    console.error('❌ FATAL:', e.message);
    ssh.dispose();
    process.exit(1);
  }
}

run();