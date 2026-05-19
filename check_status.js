const fs = require('fs');
const raw = fs.readFileSync('DACS/data/admin_head.tsx');

// The file is valid UTF-8. But the pattern shows:
// "Chờ xử lý" → "ChÃ¡Â»Â xÃ¡Â»Â­ lÃ½"
// Decoded as Latin-1: "Chá»Â xá»Â­ lý"
// This means the ORIGINAL CP1258 bytes [E1, 9C, F1, 9B, 6C, BD] were each
// individually converted to UTF-8, resulting in [C3 A1] + [C3 9C] + [C3 B1] + [C3 9B] + [6C] + [C3 BD]
// BUT somewhere in the chain, the first byte of each pair got shifted.
// Original: C3 A1 C3 9C C3 B1 C3 9B 6C C3 BD
// Current:  C3 81 C3 9C C3 B1 C3 9B 6C C3 BD
// Pattern: C3 A1 → C3 81, then C3 9C+ are fine...

// Actually no. Let me check each corrupted string's exact bytes.
// For 'Chờ xử lý': Latin-1 = 'Ch' + C3 A1 C3 9C C3 B1 C3 9B 6C C3 BD
// Current file: ...C3 81 C3 9C C3 B1 C3 9B 6C C3 BD...
// C3 81 vs C3 A1: difference = 0x20
// C3 81 = C3 (128+65) = 0xC0 + 0x01 = C3 81
// C3 A1 = C3 (128+65) = 0xC0 + 0x21 = C3 A1
// 0x81 vs 0xA1: 0x20 offset = 32 decimal

// C3 81 = UTF-8 for U+00C1 (Á)
// But we want C3 A1 = UTF-8 for U+00E1 (á)

// C3 81 → C3 A1 = change byte 0x81 to 0xA1 (+32)
// C3 B4 → C3 B4 = already correct (ô)
// So the pattern is: C3 XX → C3 (XX + 0x20) for 0x80-0xBF
// BUT not for all bytes. Let me check all status strings.

// Status strings and their Latin-1 + correct UTF-8:
const statusMap = [
  // [corrupted_pattern, correct_utf8_string]
  // ờ = C3 9C, ử = C3 B1, ý = C3 BD, ô = C3 B4, à = C3 A0
  // Chờ xử lý: Ch + C3 A1 (corrupt) + C3 9C + C3 B1 + C3 9B + 6C + C3 BD
  // C3 A1 corrupted to C3 81
  ["Ch\u00c3\u0081\u00c3\u009c\u00c3\u00b1\u00c3\u009b6c\u00c3\u00bd", "Chờ xử lý"],
  // ờ = C3 9C, à = C3 A0, ô = C3 B4, ệ = C4 87
  // Đang nấu: C4 90 C3 A0 C3 B4 C4 87 C3 B9
  // C4 90 → C3 9C (ờ)? NO
  // Let me check: Đ = C4 90, correct bytes [C4 90]. File has [C3 9C]? Maybe not.
];

// Let me directly check the file bytes for status strings
const c = raw.toString('utf8');

// Find 'Chờ xử lý' or its corrupted form
const idx = c.indexOf('Ch');
console.log('First Ch occurrence:');
console.log(JSON.stringify(c.slice(idx, idx+30)));

// Also search for the corrupted status keys in the object
const search1 = "'Ch' + '\u00c3\u0081'"; // corrupted ờ-xử pattern
// Let's just search for all status-related strings
const latin1 = raw.toString('latin1');
const idx2 = latin1.indexOf('Ch');
console.log('\nLatin1 Ch at:', idx2, JSON.stringify(latin1.slice(idx2, idx2+40)));

// Check bytes at idx2
const at = raw.slice(idx2/2, idx2/2+30);
console.log('Bytes hex:', at.toString('hex'));