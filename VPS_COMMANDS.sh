#!/bin/bash
# 1. Cài đặt các hệ thống cần thiết (NodeJS 20, PM2, MySQL, NGINX)
dnf install -y curl wget git nginx mysql-server
systemctl start mysqld
systemctl enable mysqld
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
npm install -g pm2

# 2. Tải toàn bộ source code từ kho lưu trữ Git về thẳng VPS
rm -rf /var/www/dacs
git clone https://github.com/conghuy62324-design/DACS.git /var/www/dacs
cd /var/www/dacs

# 3. Tạo cơ sở dữ liệu và Nhập (Import) file hch_restaurant.sql
mysql -u root -e "CREATE DATABASE IF NOT EXISTS hch_restaurant;"
mysql -u root hch_restaurant < hch_restaurant.sql

# 4. Tạo bộ nhớ ảo SWAP 2GB để phòng tránh lỗi treo máy khi Build (OOM) và cài đặt npm
fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

npm install
export NODE_OPTIONS=--max_old_space_size=512
npm run build

# Chép bộ nhớ đệm CSS và ảnh tĩnh vào thư mục standalone theo chuẩn Next.js
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# 5. Khởi chạy dự án ngầm thông qua PM2
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 6. Cấu hình Máy chủ Web NGINX để chuyển hướng Port 80 ra ngoài mạng
sed -i 's/default_server//g' /etc/nginx/nginx.conf

cat << 'EOF' > /etc/nginx/conf.d/dacs.conf
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $http_host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
systemctl restart nginx
systemctl enable nginx

echo "🚀 HOÀN TẤT! BẠN CÓ THỂ TRUY CẬP WEBSITE TẠI: http://160.191.243.56"
