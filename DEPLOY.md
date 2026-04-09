# Hướng dẫn Deploy dự án lên VPS (dailysieu.re)

Dự án này là Next.js full-stack (có API, MySQL, Nodemailer) nên bạn phải chạy nó bằng **Node.js** trên VPS, không thể upload file HTML tĩnh.

Dưới đây là các bước để bạn tự deploy:

## Yêu cầu trên VPS
- **Node.js** (v18+)
- **MySQL/MariaDB**
- **Nginx** (Làm reverse proxy)
- **PM2** (Process manager cho Node.js: `npm install -g pm2`)

## Bước 1: Chuẩn bị Source Code
1. Có thể đẩy code này lên một repository private trên GitHub, hoặc zip toàn bộ (bỏ thư mục `node_modules` và `.next`) rồi upload lên VPS.
2. Giải nén vào một thư mục trên VPS (ví dụ: `/var/www/hch-restaurant`).

## Bước 2: Thiết lập Biến Môi Trường (Cực kỳ quan trọng)
1. Trong thư mục dự án trên VPS, đổi tên file `.env.production` thành `.env`:
   ```bash
   cp .env.production .env
   ```
2. Mở file `.env` và sửa các thông tin MySQL cho đúng với Database bạn đã tạo trên VPS:
   ```ini
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=tendangnhapbantaotrenVPS
   DB_PASSWORD=matkhaubantaotrenVPS
   DB_NAME=tendatabasebantaotrenVPS
   ```
3. Cập nhật `JWT_SECRET` thành một chuỗi bảo mật thật dài.
4. Thông tin SMTP đã được cấu hình sẵn trong file đó.

## Bước 3: Cài đặt và Build dự án
Chạy lệnh bằng Terminal (SSH) trên VPS tại thư mục dự án:
```bash
npm install
npm run build
```

## Bước 4: Chạy ứng dụng bằng PM2
Ứng dụng sẽ chạy ở dạng Standalone mode rất nhẹ và nhanh.
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
*Lưu ý: Sau khi chạy, App của bạn sẽ chạy ngầm ở port 3000.*

## Bước 5: Cấu hình Nginx trỏ Domain vào App
1. Sửa file cấu hình Nginx của domain (thường nằm ở `/etc/nginx/sites-available/your-domain.com`).
2. Xóa giao diện cấu hình cũ của port 80 và chép nội dung từ file `nginx.conf.template` tôi đã tạo sẵn vào.
3. Nhớ thay chữ `your-domain.com` thành tên miền thật của bạn.
4. Restart Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

## Bước 6: Kiểm tra
Mở trình duyệt, truy cập `http://your-domain.com` để xem web và `http://your-domain.com/admin` để xem trang quản trị. Web sẽ tự động khởi tạo database ở lần chạy đầu tiên.
Bây giờ admin sẽ dùng luồng 2FA với email đã cấu hình SMTP.
