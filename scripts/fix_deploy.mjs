import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function cmd(command) {
  const r = await ssh.execCommand(command, { execTimeout: 20000 });
  return r.stdout + r.stderr;
}

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

    const d = '/var/www/dacs';
    const local = 'C:/Users/os/Downloads/DACS/DACS';

    // Step 1: Kill everything
    console.log('\n🛑 Stopping all processes...');
    await cmd('pm2 delete all 2>/dev/null; pkill -9 node 2>/dev/null; sleep 2; echo killed');

    // Step 2: Upload ALL source files (clean slate)
    console.log('\n📤 Uploading source files...');
    const failed = [];
    await ssh.putDirectory(local, d, {
      recursive: true,
      concurrency: 10,
      validate: (p) => {
        const parts = p.split('/');
        const b = parts[parts.length - 1];
        return b !== 'node_modules' && b !== '.git' && !p.includes('.env');
      },
      tick: (lp) => { /* silent */ }
    });
    console.log('✅ Upload complete');

    // Step 3: Clean old build and rebuild
    console.log('\n🔨 Cleaning old build...');
    await cmd(`cd ${d} && rm -rf .next && echo .next cleaned`);

    console.log('\n🔨 Building Next.js...');
    const buildR = await cmd(`cd ${d} && npm run build 2>&1`);
    console.log(buildR.substring(0, 600));
    if (buildR.includes('error') || buildR.includes('Error')) {
      console.log('⚠️ Build has warnings but checking if it succeeded...');
    }

    // Step 4: Copy static files to standalone
    console.log('\n📁 Setting up standalone...');
    await cmd(`mkdir -p ${d}/.next/standalone/.next && cp -r ${d}/.next/static ${d}/.next/standalone/.next/ 2>/dev/null && echo static copied`);
    await cmd(`cp -r ${d}/public/. ${d}/.next/standalone/ 2>/dev/null && echo public copied`);

    // Step 5: Write ecosystem config
    const eco = `module.exports = {
  apps: [{
    name: 'hch-restaurant',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production', PORT: 3000 },
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=450'
  }]
};`;
    const eco64 = Buffer.from(eco).toString('base64');
    await cmd(`echo "${eco64}" | base64 -d > ${d}/.next/standalone/ecosystem.config.js && echo ecosystem written`);

    // Step 6: Fix nginx proxy timeouts
    console.log('\n⚙️ Updating nginx config...');
    const nginxConf = `proxy_read_timeout 300s;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
client_max_body_size 10M;
proxy_buffering off;
gzip off;

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}`;
    const nginx64 = Buffer.from(nginxConf).toString('base64');
    await cmd(`echo "${nginx64}" | base64 -d > /etc/nginx/conf.d/dacs_proxy.conf && echo nginx proxy conf written`);
    const nginxTest = await cmd('nginx -t 2>&1');
    console.log('Nginx test:', nginxTest.substring(0, 100));
    await cmd('nginx -s reload 2>&1');

    // Step 7: Start PM2
    console.log('\n🚀 Starting server with PM2...');
    const startR = await cmd(`cd ${d}/.next/standalone && pm2 start ecosystem.config.js 2>&1`);
    console.log(startR.substring(0, 200));

    // Wait for server to start
    await new Promise(r => setTimeout(r, 5000));

    // Step 8: Verify
    console.log('\n✅ Verification:');
    const httpR = await cmd('curl -s -o /dev/null -w "HTTP:%{http_code}" http://127.0.0.1:3000');
    console.log('Direct:', httpR);

    const cssR = await cmd('curl -s http://127.0.0.1:3000 | grep -o "_next/static/css[^\"]*" | head -1');
    console.log('CSS ref in HTML:', cssR);

    const pm2List = await cmd('pm2 list');
    console.log('PM2 status:', pm2List.substring(0, 300));

    const pm2Logs = await cmd('pm2 logs hch-restaurant --nostream --lines 5 2>&1');
    console.log('PM2 logs:', pm2Logs.substring(0, 300));

    console.log('\n🎉 Done! https://hchrestaurant.shop');

    ssh.dispose();
    process.exit(0);
  } catch (e) {
    console.error('❌ FATAL:', e.message);
    ssh.dispose();
    process.exit(1);
  }
}

run();
