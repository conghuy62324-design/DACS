const fs = require('fs');
const DATA_DIR = './data/';
const data = fs.readFileSync(DATA_DIR + 'admin_head.tsx');
console.log('Read', data.length, 'bytes');
const latin1 = data.toString('latin1');
const utf8 = Buffer.from(latin1, 'utf8');
fs.writeFileSync(DATA_DIR + 'admin_head.tsx', utf8);
console.log('Written. Size:', utf8.length);
const text = fs.readFileSync(DATA_DIR + 'admin_head.tsx', 'utf8');
const lines = text.split('\n');
console.log('Line 1141:', lines[1140].slice(50,130));
console.log('Contains ngày gần nhất:', text.includes('ngày gần nhất'));
console.log('Contains Chờ xử lý:', text.includes('Chờ xử lý'));
const checks = ['Chờ xử lý', 'Đang nấu', 'Đã nấu xong', 'Từ chối', 'Đã phục vụ',
  'Đã thanh toán', 'Khách hàng', 'hôm nay', 'ngày gần nhất',
  'Số sản phẩm', 'Tất cả', 'Bảo mật', 'Nhân viên',
  'Gửi thử', 'Đang gửi', 'Xác thực 2 lớp', 'Đang nhập',
  'Kéo thả', 'sản phẩm', 'Danh mục', 'Vui lòng', 'Không thể',
  'Đã thêm', 'Cập nhật', 'Hoạt động', 'Tạm khóa',
  'Quản lý', 'Tài khoản', 'Mật khẩu'];
const missing = checks.filter(s => !text.includes(s));
console.log('Missing:', missing.length, 'of', checks.length);
if (missing.length) console.log('Missing:', missing.slice(0,5));
