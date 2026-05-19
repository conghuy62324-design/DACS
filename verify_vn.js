const fs = require('fs');
const c = fs.readFileSync('DACS/data/admin_head.tsx', 'utf8');

// Check for bad status patterns
const badPatterns = [
  "Ch? x?",
  "ang n?u",
  " n?u xong",
  "T? ch?i",
  " ph?c v?",
  " thanh toán",
  "h\u00eam nay",
  "ng\u00e0y",
  "C?p nh?t",
  "S? s?n",
  "T\u1ea5t c\u1ea3",
  "Chua c d? li?u",
];

let bad = [];
for (const p of badPatterns) {
  if (c.includes(p)) {
    const lines = c.split('\n').reduce((acc, l, i) => l.includes(p) ? acc.concat(i+1) : acc, []);
    bad.push(p + ' at lines: ' + lines.slice(0,5).join(','));
  }
}

console.log(bad.length ? 'BAD_PATTERNS:\n' + bad.join('\n') : 'BAD_PATTERNS: NONE');

// Check correct strings ARE present
const correctStrings = [
  'Chờ xử lý', 'Đang nấu', 'Đã nấu xong', 'Từ chối', 'Đã phục vụ',
  'Đã thanh toán', 'Khách hàng', 'hôm nay', 'ngày gần nhất',
  'Doanh thu', 'Số sản phẩm', 'Tất cả', 'Bảo mật', 'Nhân viên',
  'Gửi thử', 'Đang gửi', 'Xác thực 2 lớp', 'Đang nhập',
  'Kéo thả', 'sản phẩm', 'Danh mục', 'Vui lòng', 'Không thể',
  'Đã thêm', 'Cập nhật', 'Hoạt động', 'Tạm khóa',
  'Quản lý', 'Tài khoản', 'Mật khẩu', '2FA'
];

let missing = [];
for (const s of correctStrings) {
  if (!c.includes(s)) missing.push(s);
}
console.log(missing.length ? 'MISSING_CORRECT:\n' + missing.join('\n') : 'CORRECT_STRINGS: ALL_PRESENT');
