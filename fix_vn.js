const fs = require('fs');
let content = fs.readFileSync('DACS/data/admin_head.tsx', 'utf8');

const replacements = [
  // Status strings
  ["Ch? x?", "Chờ xử lý"],
  ["ang n?u", "Đang nấu"],
  [" n?u xong", " Đã nấu xong"],
  ["T? ch?i", "Từ chối"],
  [" ph?c v?", " Đã phục vụ"],
  [" thanh toán", " Đã thanh toán"],
  ["h�m", "hôm"],
  ["ng�y", "ngày"],
  ["C?p nh?t", "Cập nhật"],
  ["S? s?n ph?m", "Số sản phẩm"],
  ["t?t c?", "tất cả"],
  ["Đơn hàng", "Đơn hàng"],
  ["7 ngày gần nhất", "7 ngày gần nhất"],
  ["Chua c d? li?u", "Chưa có dữ liệu"],
  ["Doanh thu", "Doanh thu"],
  ["Đang gửi...", "Đang gửi..."],
  ["Gửi thử", "Gửi thử"],
  ["Bật xác thực", "Bật xác thực"],
  ["Không thể", "Không thể"],
  ["Đã thêm", "Đã thêm"],
  ["Vui lòng", "Vui lòng"],
  ["Nhập", "Nhập"],
  ["mã OTP", "mã OTP"],
  ["Xác thực", "Xác thực"],
  ["Đang nhập", "Đang nhập"],
  ["Hoạt động", "Hoạt động"],
  ["Tạm khóa", "Tạm khóa"],
  ["sản phẩm", "sản phẩm"],
  ["Danh mục", "Danh mục"],
  ["Khách hàng", "Khách hàng"],
  ["Bảo mật", "Bảo mật"],
  ["Tài khoản", "Tài khoản"],
  ["Nhân viên", "Nhân viên"],
  ["Điện thoại", "Điện thoại"],
  ["Mật khẩu", "Mật khẩu"],
  ["Kéo thả", "Kéo thả"],
  ["Tên đăng nhập", "Tên đăng nhập"],
  ["Hành động", "Hành động"],
  ["Cần nhập", "Cần nhập"],
  ["Bạn cần", "Bạn cần"],
  ["Quyền admin", "Quyền admin"],
  ["Đã lưu", "Đã lưu"],
  ["2FA", "2FA"],
  ["cho admin", "cho admin"],
  ["cấu hình", "cấu hình"],
  ["email OTP", "email OTP"],
  ["thử tới", "thử tới"],
  ["hiện có", "hiện có"],
  ["Được thanh toán", "Được thanh toán"],
  ["thêm bàn", "thêm bàn"],
  ["Cập nhật lại", "Cập nhật lại"],
  ["toàn bộ", "toàn bộ"],
  ["link QR", "link QR"],
  ["tạo từng", "tạo từng"],
  ["mã QR", "mã QR"],
  ["số bàn", "số bàn"],
  ["tầng", "tầng"],
  ["Ví dụ", "Ví dụ"],
  ["Cập nhật", "Cập nhật"],
  ["Hoạt động", "Hoạt động"],
  ["Tạm khóa", "Tạm khóa"],
  ["Chưa có", "Chưa có"],
  ["bàn nào", "bàn nào"],
  ["Vui lòng nhập", "Vui lòng nhập"],
  ["đầy đủ", "đầy đủ"],
  ["tên", "tên"],
  ["thành công", "thành công"],
  ["Không thể lưu", "Không thể lưu"],
  ["Lưu sản", "Lưu sản"],
  ["Thêm sản", "Thêm sản"],
  ["sản phẩm", "sản phẩm"],
  ["Chọn danh mục", "Chọn danh mục"],
  ["thay đổi", "thay đổi"],
  ["ảnh tại", "ảnh tại"],
  ["đây", "đây"],
  ["Tất cả", "Tất cả"],
  ["trạng thái", "trạng thái"],
  ["Không hoạt động", "Không hoạt động"],
  ["Không tìm thấy", "Không tìm thấy"],
  ["Nhập trực tiếp", "Nhập trực tiếp"],
  ["số lượng", "số lượng"],
  ["xóa danh mục", "xóa danh mục"],
  ["Quản lý", "Quản lý"],
  ["chỉ cần", "chỉ cần"],
  ["Danh mục", "Danh mục"],
  ["Đồ nướng", "Đồ nướng"],
  ["Món phụ", "Món phụ"],
  ["Chọn ảnh", "Chọn ảnh"],
  ["Lưu thay đổi", "Lưu thay đổi"],
  ["Thêm danh mục", "Thêm danh mục"],
  ["Hủy chỉnh sửa", "Hủy chỉnh sửa"],
  ["khách hàng", "khách hàng"],
  ["hôm nay", "hôm nay"],
  ["Biểu đồ", "Biểu đồ"],
  ["màn hình", "màn hình"],
  ["Tự reset", "Tự reset"],
  ["ngày mới", "ngày mới"],
  ["Điền đầy", "Điền đầy"],
  ["Bảo mật", "Bảo mật"],
  ["Đang bật", "Đang bật"],
  ["Đang tắt", "Đang tắt"],
  ["chủ", "chủ"],
  ["(không", "(không"],
  ["bắt buộc)", "bắt buộc)"],
  ["Để trống", "Để trống"],
  ["đổi mật", "đổi mật"],
  ["Khuyến nghị", "Khuyến nghị"],
  ["sau khi", "sau khi"],
  ["Hoàn tất", "Hoàn tất"],
  ["đăng nhập", "đăng nhập"],
  ["Mã OTP", "Mã OTP"],
  ["6 số", "6 số"],
  ["Xác nhận", "Xác nhận"],
  ["OTP", "OTP"],
  ["Theo dõi", "Theo dõi"],
  ["nhanh", "nhanh"],
  ["vai trò", "vai trò"],
  ["Hiện tại", "Hiện tại"],
  ["chỉ có", "chỉ có"],
  ["Bạn cần", "Bạn cần"],
  ["quyền", "quyền"],
  ["Truy cập", "Truy cập"],
  ["Đăng nhập", "Đăng nhập"],
  ["admin", "admin"],
  ["Không thể đăng", "Không thể đăng"],
  ["thử email", "thử email"],
  ["email", "email"],
  ["Mã", "Mã"],
  ["??", "📊"],
];

let count = 0;
for (const [old, neo] of replacements) {
  if (content.includes(old)) {
    content = content.split(old).join(neo);
    count++;
  }
}

// Also fix the status array/map
const statusFixes = [
  ["Ch? x? l", "Chờ xử lý"],
  ["ang n?u", "Đang nấu"],
  [" n?u xong", " Đã nấu xong"],
  ["T? ch?i", "Từ chối"],
  [" ph?c v?", " Đã phục vụ"],
  [" thanh toán", " Đã thanh toán"],
];
for (const [old, neo] of statusFixes) {
  if (content.includes(old)) {
    content = content.split(old).join(neo);
    count++;
  }
}

fs.writeFileSync('DACS/data/admin_head.tsx', content, 'utf8');
console.log('Fixed ' + count + ' patterns');

// Verify
const check = ['Ch? x?', 'ang n?', 'T? ch?i', ' n?u xong', ' ph?c v?', 'h�m', 'ng�y'];
let still = [];
for (const p of check) {
  if (content.includes(p)) still.push(p);
}
if (still.length) console.log('STILL_BROKEN: ' + still.join(', '));
else console.log('ALL_CLEAN');
