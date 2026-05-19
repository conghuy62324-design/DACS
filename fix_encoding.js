const fs = require('fs');

// Strategy: The file has 588 U+FFFD replacement characters.
// These are Vietnamese strings that were double-encoded:
// Windows-1252 bytes -> interpreted as UTF-8 -> replacement chars

// We read the file as UTF-8 to get the U+FFFD chars,
// and also read as binary to get the actual bytes.

const raw = fs.readFileSync('DACS/data/admin_head.tsx'); // raw Buffer
const text = fs.readFileSync('DACS/data/admin_head.tsx', 'utf8'); // with U+FFFD

// Build a map of every U+FFFD position -> what the actual byte is
// In the raw buffer at the same position, we find the broken byte sequence
// and decode it as Windows-1252

const RFD = '\ufffd';
let pos = 0;
let fixes = [];

while (true) {
  pos = text.indexOf(RFD, pos);
  if (pos === -1) break;

  // In raw buffer at pos, we have the first byte of a broken Windows-1252 sequence
  // Windows-1252 chars in range 0x80-0x9F are the extended ones (Vietnamese diacritics)
  // Common Vietnamese byte pairs in Windows-1252:
  // à=E0, á=E1, â=E2, ã=E3, è=E8, é=E9, ê=EA, ì=EC, í=ED, ò=F2, ó=F3, ô=F4, õ=F5
  // ù=F9, ú=FA, ý=FD, ă=83, ă=E3? no... ă=83 in CP1258, in CP1252 it's different
  // For Vietnamese CP1258: ă=83, đ=E9, ê=EA, ô=F4, ơ=F6, ư=FC, ơ=F9
  // Common broken UTF-8 sequences:
  // 0xC3 0xA0 -> à (when CP1252 0xE0 is interpreted as UTF-8)
  // 0xC3 0xA1 -> á
  // 0xC3 0xA2 -> â
  // 0xC3 0xA8 -> è
  // 0xC3 0xA9 -> é
  // 0xC3 0xAA -> ê
  // 0xC3 0xAC -> ì
  // 0xC3 0xAD -> í
  // 0xC3 0xB2 -> ò
  // 0xC3 0xB3 -> ó
  // 0xC3 0xB4 -> ô
  // 0xC3 0xB5 -> õ
  // 0xC3 0xB9 -> ù
  // 0xC3 0xBA -> ú
  // 0xC3 0xBD -> ý
  // Single-byte 0xFF -> ÿ
  // Single-byte 0xA0 -> in some encodings
  // For Vietnamese-specific CP1258:
  // 0x83 -> ă
  // 0xA8 -> ư
  // 0xA9 -> ư? no...
  // Actually, let's just try to decode as UTF-8 first, then Latin-1
  // and see what makes valid Vietnamese

  let rawPos = 0;
  // Count characters up to pos in text
  let charCount = 0;
  for (let i = 0; i < pos; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7F) charCount++;
    else if (code >= 0xD800 && code <= 0xDBFF) { charCount++; i++; } // surrogate pair
    else charCount++; // this is approximate - UTF-16 code unit
  }
  // Actually, the text string is UTF-16 internally, but the raw buffer position
  // corresponds to UTF-8 byte position...
  // The easiest approach: the U+FFFD appears when we hit an invalid UTF-8 start byte.
  // In the raw buffer, the invalid byte is what we need.

  // Let's just rebuild the string from raw bytes as Windows-1252
  // But this won't work for parts that ARE valid UTF-8 (ASCII + JS code)
  // So instead: find each U+FFFD, look at surrounding raw bytes,
  // decode as Windows-1252, replace

  pos++;
}

console.log('Strategy: converting entire file from Windows-1252 to UTF-8');
console.log('Raw buffer size:', raw.length, 'Text char count:', text.length);

// Check if the file is predominantly CP1252 with U+FFFD
const rfdCount = (text.match(/\ufffd/g) || []).length;
console.log('U+FFFD count:', rfdCount);

// Read as Windows-1252 (CP1252) - Latin-1 will give us single bytes
// But CP1252 is different from Latin-1 for bytes 0x80-0x9F
// Node.js doesn't support CP1252 directly, but we can simulate it
function decodeCP1252(buf) {
  const CP1252_MAP = {
    0x80: 0x20AC, 0x81: 0x0081, 0x82: 0x201A, 0x83: 0x0192,
    0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
    0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039,
    0x8C: 0x0152, 0x8D: 0x008D, 0x8E: 0x017D, 0x8F: 0x008F,
    0x90: 0x0090, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C,
    0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
    0x9C: 0x0153, 0x9D: 0x009D, 0x9E: 0x017E, 0x9F: 0x0178,
  };
  let result = '';
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else if (CP1252_MAP[byte] !== undefined) {
      result += String.fromCodePoint(CP1252_MAP[byte]);
    } else {
      // Try as Latin-1
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

const cp1252Text = decodeCP1252(raw);
const cp1252RfdCount = (cp1252Text.match(/\ufffd/g) || []).length;
console.log('CP1252 U+FFFD count:', cp1252RfdCount);

// If most U+FFFDs are gone, use CP1252
if (cp1252RfdCount < rfdCount / 2) {
  console.log('Using CP1252 decoding');
  fs.writeFileSync('DACS/data/admin_head.tsx', cp1252Text, 'utf8');
  console.log('Done! File converted from CP1252 to UTF-8');
} else {
  console.log('Not CP1252, trying ICU/translation approach...');
}
