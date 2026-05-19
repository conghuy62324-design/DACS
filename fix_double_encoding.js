const fs = require('fs');
const raw = fs.readFileSync('DACS/data/admin_head.tsx');

// Byte mapping: when Vietnamese UTF-8 bytes (C3 XX or C4 XX) are read as Latin-1
// and re-encoded as UTF-8, they become C3 83 C2 XX for C3 XX, and C3 84 C2 XX for C4 XX.
// The correct Vietnamese chars are the C3 XX or C4 XX bytes decoded as UTF-8.
// We need to reverse this.

const DECODE_MAP = {
  // C383C2XX -> should be C3 XX-0x80 (undo the +0x80 offset)
  // Mapping from last byte to what the original C3 byte was
  'C383C2A0': 'C3A0',  // à
  'C383C2A1': 'C3A1',  // á
  'C383C2A2': 'C3A2',  // â
  'C383C2A3': 'C3A3',  // ã
  'C383C2A4': 'C3A4',  // ä
  'C383C2A5': 'C3A5',  // å
  'C383C2A6': 'C3A6',  // æ
  'C383C2A7': 'C3A7',  // ç
  'C383C2A8': 'C3A8',  // è
  'C383C2A9': 'C3A9',  // é
  'C383C2AA': 'C3AA',  // ê
  'C383C2AB': 'C3AB',  // ë
  'C383C2AC': 'C3AC',  // ì
  'C383C2AD': 'C3AD',  // í
  'C383C2AE': 'C3AE',  // î
  'C383C2AF': 'C3AF',  // ï
  'C383C2B0': 'C3B0',  // ð
  'C383C2B1': 'C3B1',  // ñ
  'C383C2B2': 'C3B2',  // ò
  'C383C2B3': 'C3B3',  // ó
  'C383C2B4': 'C3B4',  // ô
  'C383C2B5': 'C3B5',  // õ
  'C383C2B6': 'C3B6',  // ö
  'C383C2B7': 'C3B7',  // ÷
  'C383C2B8': 'C3B8',  // ø
  'C383C2B9': 'C3B9',  // ù
  'C383C2BA': 'C3BA',  // ú
  'C383C2BB': 'C3BB',  // û
  'C383C2BC': 'C3BC',  // ü
  'C383C2BD': 'C3BD',  // ý
  'C383C2BE': 'C3BE',  // þ
  'C383C2BF': 'C3BF',  // ÿ
  // C384C2XX -> should be C4 XX-0x80
  'C384C2A0': 'C4A0',  // ă
  'C384C2A1': 'C4A1',
  'C384C2A2': 'C4A2',
  'C384C2A3': 'C4A3',
  'C384C2A4': 'C4A4',
  'C384C2A5': 'C4A5',
  'C384C2A6': 'C4A6',
  'C384C2A7': 'C4A7',
  'C384C2A8': 'C4A8',
  'C384C2A9': 'C4A9',
  'C384C2AA': 'C4AA',
  'C384C2AB': 'C4AB',
  'C384C2AC': 'C4AC',
  'C384C2AD': 'C4AD',
  'C384C2AE': 'C4AE',
  'C384C2AF': 'C4AF',
  'C384C2B0': 'C4B0',
  'C384C2B1': 'C4B1',
  'C384C2B2': 'C4B2',
  'C384C2B3': 'C4B3',
  'C384C2B4': 'C4B4',
  'C384C2B5': 'C4B5',
  'C384C2B6': 'C4B6',
  'C384C2B7': 'C4B7',
  'C384C2B8': 'C4B8',
  'C384C2B9': 'C4B9',
  'C384C2BA': 'C4BA',
  'C384C2BB': 'C4BB',
  'C384C2BC': 'C4BC',
  'C384C2BD': 'C4BD',
  'C384C2BE': 'C4BE',
  'C384C2BF': 'C4BF',
  'C384C280': 'C480',
  'C384C281': 'C481',
  'C384C282': 'C482',  // đ
  'C384C283': 'C483',
  'C384C284': 'C484',
  'C384C285': 'C485',
  'C384C286': 'C486',
  'C384C287': 'C487',
  'C384C288': 'C488',
  'C384C289': 'C489',
  'C384C28A': 'C48A',
  'C384C28B': 'C48B',
  'C384C28C': 'C48C',
  'C384C28D': 'C48D',
  'C384C28E': 'C48E',
  'C384C28F': 'C48F',
  'C384C290': 'C490',
  'C384C291': 'C491',
  'C384C292': 'C492',
  'C384C293': 'C493',
  'C384C294': 'C494',
  'C384C295': 'C495',
  'C384C296': 'C496',
  'C384C297': 'C497',
  'C384C298': 'C498',
  'C384C299': 'C499',
  'C384C29A': 'C49A',
  'C384C29B': 'C49B',
  'C384C29C': 'C49C',
  'C384C29D': 'C49D',
  'C384C29E': 'C49E',
  'C384C29F': 'C49F',
  'C384C2A0': 'C4A0',
};

// Decode the mapped UTF-8 byte pairs to actual Vietnamese chars
const CORRECT_CHARS = {};
for (const [hex4, utf8hex] of Object.entries(DECODE_MAP)) {
  try {
    const buf = Buffer.from(utf8hex, 'hex');
    const char = new TextDecoder('utf-8').decode(buf);
    CORRECT_CHARS[hex4] = char;
  } catch(e) {
    // skip
  }
}

// Apply fixes
let content = raw.toString('utf8');
let count = 0;

for (const [hex4, char] of Object.entries(CORRECT_CHARS)) {
  const bytes = Buffer.from(hex4, 'hex');
  const badUtf8 = bytes.toString('utf8');
  if (content.includes(badUtf8)) {
    content = content.split(badUtf8).join(char);
    count++;
    console.log(`Fixed ${hex4} -> ${char} (${Buffer.from(char).toString('hex')})`);
  }
}

fs.writeFileSync('DACS/data/admin_head.tsx', content, 'utf8');
console.log(`\nTotal: ${count} patterns fixed`);

// Verify
const verifyChecks = ['Chờ xử lý', 'Đang nấu', 'Đã nấu xong', 'Từ chối', 'Đã phục vụ',
  'Đã thanh toán', 'Khách hàng', 'hôm nay', 'ngày gần nhất', 'Số sản phẩm',
  'Tất cả', 'Bảo mật', 'Nhân viên', 'Gửi thử', 'Đang gửi', 'Xác thực 2 lớp',
  'Đang nhập', 'Kéo thả', 'sản phẩm', 'Danh mục', 'Vui lòng', 'Không thể',
  'Đã thêm', 'Cập nhật', 'Hoạt động', 'Tạm khóa', 'Quản lý', 'Tài khoản', 'Mật khẩu'];
let missing = [];
for (const s of verifyChecks) {
  if (!content.includes(s)) missing.push(s);
}
console.log(missing.length ? 'MISSING: ' + missing.join(', ') : 'ALL_STRINGS_CORRECT');

// Check for remaining mojibake
const mojibake = ['C3 83 C2', 'C3 84 C2', 'C3 83 C3'];
let rfd = 0;
for (const ch of content) {
  if (ch.charCodeAt(0) === 0xFFFD) rfd++;
}
console.log('U+FFFD remaining:', rfd);
