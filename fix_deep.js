const fs = require('fs');

// The file was: UTF-8 Vietnamese bytes read as CP1252/Windows-1252, then those
// CP1252 chars re-encoded as UTF-8.
//
// In CP1252, bytes 0x80-0x9F map to specific chars (different from Latin-1).
// When those CP1252 chars are re-encoded as UTF-8, they produce 2-byte UTF-8 sequences.
//
// CP1252 range 0x80-0x9F mapping (bytes -> Unicode):
const CP1252_EXT = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
};

// CP1252 Latin-1 overlap range (0xA0-0xFF) - same as Latin-1
// bytes 0xA0-0xFF encode as UTF-8 C3 XX (for 0xC0-0xFF) or C2 XX (for 0x80-0xBF)
const DECODE_MAP = {};

// For C3 83 C2 XX: the CP1252 interpretation of bytes C3 (Ã) + XX
// maps to what? In CP1252, C3 = 195 decimal, which is in the Latin-1 overlap range.
// C3 XX in CP1252 = U+00C3 + XX-0x80 (since CP1252 0xA0-0xFF = Latin-1 same range)
// e.g., C3 A0 = U+00C3 + 0x20 = U+00E3? No...
// In CP1252, byte 0xC3 = 195. But CP1252 byte 0xC3 is in the Latin-1 overlap,
// meaning CP1252[0xC3] = Latin-1[0xC3] = U+00C3.
// In CP1252, byte 0xA0 = 160. CP1252[0xA0] = U+00A0.
// Together (CP1252): C3 A0 = U+00C3 followed by U+00A0.
// Then re-encoded as UTF-8: U+00C3 = C3 83, U+00A0 = C2 A0
// → C3 83 C2 A0

// For the LAST BYTE of C3 83 C2 XX patterns:
// XX is the CP1252 byte for the diacritic. The diacritic value = XX - 0x80
// The original UTF-8 base char = C3 (base char) + diacritic offset

// Mapping XX → original UTF-8 2nd byte
const XX_TO_UTF8 = {};
const BASE = 0xA0;
for (let v = 0; v <= 0x5F; v++) {  // 0xA0-0xFF → 0x00-0x5F
  const cp1252_byte = BASE + v;
  const utf8_byte = 0xC0 + v;  // e.g., 0xA0 → 0xC0? NO!
// Correct: Original UTF-8 byte for CP1252 byte 0xA0 = 0xA0 → UTF-8 C2 A0 (not C3 XX)
// Let me reconsider from first principles.

// In CP1252:
// - bytes 0x80-0x9F → special chars (Euro, quotes, etc.) → UTF-8 2 or 3 bytes
// - bytes 0xA0-0xFF → same as Latin-1 → UTF-8 C2 XX (for 0x80-0xBF) or C3 XX (for 0xC0-0xFF)

// When Latin-1 overlap bytes (0xA0-0xFF) are re-encoded:
// CP1252 byte 0xA0 = U+00A0 → UTF-8 C2 A0  (2-byte, starts with C2)
// CP1252 byte 0xC0 = U+00C0 → UTF-8 C3 80  (2-byte, starts with C3)
// CP1252 byte 0xC1 = U+00C1 → UTF-8 C3 81  (2-byte, starts with C3)
// ...up to CP1252 byte 0xFF = U+00FF → UTF-8 C3 BF

// So: C3 83 C2 XX means the second pair of bytes encodes:
// C3 83 = U+00C3 (Ã) [always the same, because C3 is the UTF-8 start for 0xC0-0xFF]
// C2 XX = U+00XX where XX >= 0x80 → U+00C0 + (XX-0x80) = U+00(0x40+XX)
// Wait no: C2 A0 = U+00A0, C2 BF = U+00BF
// So C2 XX = U+00(0x40 + XX-0x80)? No...
// U+00A0 = 0xA0, U+00BF = 0xBF.
// The offset from A0 is XX - 0xA0. So U+00A0 + (XX - 0xA0) = U+00XX.
// Correct! C2 XX = U+00XX (where XX >= 0x80, so range U+0080-U+00FF)

// And C3 XX = U+00XX where XX >= 0x80
// C3 A0 = U+00A0, C3 BF = U+00BF
// C3 80 = U+00C0, C3 BF = U+00BF? No, that's wrong.
// UTF-8 C3 XX: second byte XX → char = 0xC0 + (XX - 0x80) = XX - 0x40
// C3 80 → 0xC0 - 0x40 = 0x80? No!
// Let me use a lookup table approach instead.
// UTF-8 C3 XX decoding: 0xC0 + (XX & 0x3F) doesn't work directly...
// Correct: For UTF-8 2-byte, byte1 = 110xxxxx, byte2 = 10yyyyyy
// char = (byte1 & 0x1F) << 6 | (byte2 & 0x3F)
// For C3 XX: (0xC3 & 0x1F) = 3, char = 3 << 6 | (XX & 0x3F) = 0xC0 + (XX & 0x3F)
// For XX = 0xA0: char = 0xC0 + 0x20 = 0xE0? WRONG!
// UTF-8 range C0-XX for 2-byte: actually C0-C1 are overlong, 2-byte starts at C2!
// C2 = 11000010, C3 = 11000011 (overlong for C0)
// The valid UTF-8 2-byte range for chars 0x80-0x7FF is C2 80 to C3 BF.
// For C3 A0: char = (3 & 7) << 6 | (0xA0 & 0x3F) = 0x60 | 0x00 = 0x60? NO!
// Let me just use: Buffer.from([0xC3, XX]).toString('utf16le') doesn't work either.

// Using a lookup:
const UTF8_C3_MAP = {};
const c3_valid = 'àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞ';
const c3_bytes = 'C380C381C382C383C384C385C386C387C388C389C38AC38BC38CC38DC38EC38FC390C391C392C393C394C395C396C397C398C399C39AC39BC39CC39DC39EC39FC3A0C3A1C3A2C3A3C3A4C3A5C3A6C3A7C3A8C3A9C3AAC3ABC3ACC3ADC3AEC3AFC3B0C3B1C3B2C3B3C3B4C3B5C3B6C3B7C3B8C3B9C3BAC3BBC3BCC3BDC3BEC3BF';
for (let i = 0; i < c3_bytes.length; i += 4) {
  UTF8_C3_MAP[c3_bytes.slice(i, i+4)] = c3_valid[i/4];
}
const UTF8_C2_MAP = {};
const c2_valid = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ''""••–—˜™š›œžŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ';
const c2_bytes = 'C280C282C283C284C285C286C287C288C289C28AC28BC28CC28DC28EC28FC290C291C292C293C294C295C296C297C298C299C29AC29BC29CC29DC29EC29FC2A0C2A1C2A2C2A3C2A4C2A5C2A6C2A7C2A8C2A9C2AAC2ABC2ACC2ADC2AEC2AFC2B0C2B1C2B2C2B3C2B4C2B5C2B6C2B7C2B8C2B9C2BAC2BBC2BCC2BDC2BEC2BF';
for (let i = 0; i < c2_bytes.length; i += 4) {
  UTF8_C2_MAP[c2_bytes.slice(i, i+4)] = c2_valid[i/4];
}

const raw = fs.readFileSync('DACS/data/admin_head.tsx');
let content = raw.toString('utf8');
let count = 0;

// Fix C3 83 C2 XX sequences
// Pattern: C3 + 0x83 + C2 + XX
// Decoded as CP1252: U+00C3 (Ã) + U+00XX → the CHAR part
// When re-encoded: Ã → C3 83, XX → C2 XX
// The CORRECT original UTF-8 was: C3 (YY) where YY = XX - 0x80 + 0x80? No.
//
// Let me trace again:
// Original UTF-8: C3 A0 (à)
// Read as CP1252: C3 = U+00C3, A0 = U+00A0 → "Ã\u00A0"
// Re-encoded as UTF-8: U+00C3 → C3 83, U+00A0 → C2 A0 → C3 83 C2 A0
//
// So C3 83 C2 A0 → the CORRECT original was C3 A0.
// Pattern: last two hex digits XX of C2 XX → original C3 byte = 0xA0 + (XX - 0xA0) = XX? No!
// C3 83 C2 A0: XX = A0. Original C3 XX = C3 A0. So XX = A0 maps to original byte = A0?
// C3 83 C2 A1: XX = A1. Original = C3 A1.
// C3 83 C2 BD: XX = BD. Original = C3 BD.
//
// Wait: C3 83 C2 A0. The C2 A0 part → UTF-8 C2 A0 = U+00A0.
// In CP1252, byte for U+00A0 = 0xA0. Original UTF-8 second byte = 0xA0.
// C3 83 C2 A1: C2 A1 → U+00A1 = 0xA1 in CP1252. Original = C3 A1.
// C3 83 C2 BD: C2 BD → U+00BD = 0xBD in CP1252. Original = C3 BD.
//
// PATTERN: For C3 83 C2 XX, original UTF-8 = C3 XX
// This is SIMPLE! The last two bytes C2 XX decode to U+00XX via UTF-8,
// and in CP1252, U+00XX = byte XX.
// So: C3 83 C2 XX → C3 XX

for (let xx = 0xA0; xx <= 0xBF; xx++) {
  const hex = xx.toString(16).toUpperCase().padStart(2,'0');
  const bad = Buffer.from([0xC3, 0x83, 0xC2, xx]).toString('utf8');
  const correct = Buffer.from([0xC3, xx]).toString('utf8');
  if (content.includes(bad)) {
    content = content.split(bad).join(correct);
    count++;
    console.log(`Fix C383C2${hex} -> C3${hex}: ${correct}`);
  }
}

// Fix C3 84 C2 XX sequences
// C3 84 C2 XX: This happens when the CP1252 char at U+00C4 (Ä) + U+00XX is re-encoded.
// In CP1252, U+00C4 = byte 0xC4. U+00XX = byte XX.
// Original UTF-8 would be C4 XX.
// So: C3 84 C2 XX → C4 XX
for (let xx = 0xA0; xx <= 0xBF; xx++) {
  const hex = xx.toString(16).toUpperCase().padStart(2,'0');
  const bad = Buffer.from([0xC3, 0x84, 0xC2, xx]).toString('utf8');
  const correct = Buffer.from([0xC4, xx]).toString('utf8');
  if (content.includes(bad)) {
    content = content.split(bad).join(correct);
    count++;
    console.log(`Fix C384C2${hex} -> C4${hex}: ${correct}`);
  }
}

// Fix C3 82 C2 XX (C3 82 = Â, C2 XX = XX)
for (let xx = 0xA0; xx <= 0xBF; xx++) {
  const hex = xx.toString(16).toUpperCase().padStart(2,'0');
  const bad = Buffer.from([0xC3, 0x82, 0xC2, xx]).toString('utf8');
  const correct = Buffer.from([0xC3, 0x80 + (xx - 0xA0)]).toString('utf8');
  if (content.includes(bad)) {
    content = content.split(bad).join(correct);
    count++;
  }
}

// Now fix C4 XX single-byte sequences (if they exist as valid UTF-8)
// In CP1252, bytes C4 XX (where XX >= 0x80): C4 = U+00C4 (Ä), XX = U+00XX
// But in Latin-1, C4 = U+00C4 (Ä), 0x80 = U+0080 (control)
// Hmm. Let me just check if there are any raw C4 XX bytes in the file.
const c4Count = raw.filter((b, i) => b === 0xC4 && i > 0 && raw[i-1] !== 0xC3 && raw[i-1] !== 0xC4).length;
console.log('\nC4 XX standalone sequences (not after C3):', c4Count);

fs.writeFileSync('DACS/data/admin_head.tsx', content, 'utf8');
console.log(`\nTotal: ${count} patterns fixed`);

// Verify
const correctStrings = ['Chờ xử lý', 'Đang nấu', 'Đã nấu xong', 'Từ chối', 'Đã phục vụ',
  'Đã thanh toán', 'Khách hàng', 'hôm nay', 'ngày gần nhất'];
let missing = correctStrings.filter(s => !content.includes(s));
console.log(missing.length ? 'MISSING: ' + missing.join(', ') : 'ALL_CORRECT_STRINGS_OK');

// Check for mojibake 'ngÃ '
console.log('ngÃ in file:', content.includes('ngÃ'));
