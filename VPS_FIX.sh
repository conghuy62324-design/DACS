#!/bin/bash
echo "1. Đang sửa lỗi mất hình ảnh và CSS..."
cd /var/www/dacs
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
pm2 restart all

echo "2. Đang cấu hình Máy chủ Web đón tên miền hchrestaurant.shop..."
cat << 'EOF' > /etc/nginx/conf.d/dacs.conf
server {
    listen 80;
    server_name 160.191.243.56 hchrestaurant.shop www.hchrestaurant.shop;

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

echo "🚀 HOÀN TẤT LẮP ĐẶT TÊN MIỀN VÀ SỬA CSS!"
