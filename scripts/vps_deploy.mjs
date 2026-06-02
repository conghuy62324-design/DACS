import { NodeSSH } from 'node-ssh';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const ssh = new NodeSSH();

async function run() {
  try {
    console.log("Connecting to VPS (160.191.243.77)...");
    await ssh.connect({
      host: '160.191.243.77',
      username: 'root',
      privateKeyPath: 'c:\\Users\\os\\Downloads\\DACS\\DACS\\vps_key',
      readyTimeout: 99999,
      keepaliveInterval: 10000
    });
    console.log("Connected to VPS securely.");

    const remoteDir = '/var/www/dacs';

    console.log("1. Setting up system dependencies (Node.js, PM2, NGINX, MySQL)...");
    await execCommand('pkill -9 dnf || true');
    await execCommand('rm -f /var/lib/rpm/.rpm.lock || true');
    await execCommand('rm -f /var/lib/dnf/rpmdb_lock.pid || true');
    await execCommand('dnf install -y curl wget git nginx mysql-server');
    await execCommand('systemctl start mysqld || true');
    await execCommand('systemctl enable mysqld || true');
    
    await execCommand('curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -');
    await execCommand('dnf install -y nodejs');
    await execCommand('npm install -g pm2');

    console.log("2. Uploading Database SQL dump...");
    const dbSqlPath = 'C:\\Users\\os\\Downloads\\hch_restaurant.sql';
    await ssh.putFile(dbSqlPath, '/root/hch_restaurant.sql');
    console.log("-> Database SQL uploaded to /root/hch_restaurant.sql");

    console.log("3. Configuring Database (Before Build)...");
    await execCommand('mysql -u root -e "CREATE DATABASE IF NOT EXISTS hch_restaurant;"');
    await execCommand('mysql -u root hch_restaurant < /root/hch_restaurant.sql');

    console.log("4. Creating project directory...");
    await execCommand(`mkdir -p ${remoteDir}`);

    console.log("5. Uploading source files (Skipping if already there)...");
    const failed = [];
    const successful = [];
    await ssh.putDirectory(projectRoot, remoteDir, {
      recursive: true,
      concurrency: 10,
      validate: function(itemPath) {
        const baseName = path.basename(itemPath);
        return baseName !== 'node_modules' && baseName !== '.next' && baseName !== '.git' && !itemPath.includes('.env');
      },
      tick: function(localPath, remotePath, error) {
        if (error) failed.push(localPath);
        else successful.push(localPath);
      }
    });
    console.log(`-> Upload complete. Success: ${successful.length}, Failed: ${failed.length}`);

    console.log("6. Uploading production environment file...");
    await ssh.putFile(path.join(projectRoot, '.env.production'), `${remoteDir}/.env.production`);

    console.log("7. Installing dependencies and building on VPS...");
    // Force install dependencies
    await execCommand('npm install', remoteDir);
    
    console.log("-> Creating 2GB Swap Memory to prevent OOM...");
    await execCommand('fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048');
    await execCommand('chmod 600 /swapfile');
    await execCommand('mkswap /swapfile || true');
    await execCommand('swapon /swapfile || true');

    // Build Next.js with restricted memory to prevent OOM
    console.log("-> Running Next.js Build...");
    await execCommand('export NODE_OPTIONS=--max_old_space_size=512 && npm run build', remoteDir);
    await execCommand('mkdir -p .next/standalone/.next', remoteDir);
    await execCommand('rm -rf .next/standalone/.next/static .next/standalone/public', remoteDir);
    await execCommand('cp -R .next/static .next/standalone/.next/static', remoteDir);
    await execCommand('cp -R public .next/standalone/public', remoteDir);

    console.log("8. Starting application with PM2...");
    await execCommand('pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js', remoteDir);

    console.log("9. Configuring NGINX...");
    const nginxConf = `
server {
    listen 80;
    server_name 160.191.243.77;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name hchrestaurant.shop www.hchrestaurant.shop;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name hchrestaurant.shop www.hchrestaurant.shop;

    ssl_certificate /etc/letsencrypt/live/hchrestaurant.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hchrestaurant.shop/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
    `.trim();
    // Use base64 to avoid quote escaping issues
    const nginxBase64 = Buffer.from(nginxConf).toString('base64');
    await execCommand(`echo "${nginxBase64}" | base64 -d > /etc/nginx/conf.d/dacs.conf`);
    await execCommand('systemctl restart nginx || true');
    await execCommand('systemctl enable nginx || true');

    console.log("\n=========================");
    console.log("âœ… DEPLOYMENT FINISHED!");
    console.log("You can now verify the website at https://hchrestaurant.shop");
    console.log("=========================\n");

    ssh.dispose();

  } catch (error) {
    console.error("Deploy Error:", error);
    ssh.dispose();
  }
}

async function execCommand(command, cwd = '/root') {
  console.log(`[VPS] Running: ${command}`);
  const result = await ssh.execCommand(command, { cwd });
  if (result.stdout && !result.stdout.includes('added') && !command.includes('base64')) {
      console.log(`[STDOUT] ${result.stdout.substring(0, 200)}...`);
  }
  if (result.stderr && !result.stderr.includes('npm notice')) {
      console.error(`[STDERR] ${result.stderr.substring(0, 200)}...`);
  }
  if (result.code !== 0) throw new Error(`Command failed with code ${result.code}: ${command}`);
}

run();
