#!/bin/bash
echo "1. Đang sửa lỗi mất hình ảnh và CSS..."
cd /var/www/dacs
cp -r public .next/standalone/ 2>/dev/null
cp -r .next/static .next/standalone/.next/ 2>/dev/null
pm2 restart all

echo "2. Đang tắt trang mặc định của AlmaLinux..."
# Loại bỏ chữ default_server ở file gốc của AlmaLinux để không bị tranh chấp
sed -i 's/default_server//g' /etc/nginx/nginx.conf

echo "3. Đang cấu hình Máy chủ Web đón tên miền hchrestaurant.shop..."
cat << 'EOF' > /etc/nginx/conf.d/dacs.conf
server {
    # Nhận toàn bộ lượng truy cập vào IP và tên miền
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
echo "🚀 HOÀN TẤT LẮP ĐẶT TÊN MIỀN VÀ SỬA CSS!"
