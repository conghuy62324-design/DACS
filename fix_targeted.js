const fs = require('fs');

// Read the file as raw bytes and decode each Vietnamese string properly
const raw = fs.readFileSync('DACS/data/admin_head.tsx');
const latin1 = raw.toString('latin1');

// Vietnamese strings in the file - find each one by searching for unique patterns
// Then determine what the correct text should be

// Strategy: find all unique strings that are corrupted, fix them one by one
// Use the fact that corrupted strings have recognizable patterns:
// - "ChÃ" prefix for strings starting with Vietnamese chars
// - "Ã¡Â»Â" for ờ
// - "Ã¡Â»Â­" for ử
// - "Ã½" for ý
// - "gÃ¡ÂºÂ§n" for gần
// - "nhÃ¡ÂºÂ¥t" for nhất
// etc.

// Instead, let me decode the file byte-by-byte:
// Each Vietnamese character was UTF-8 encoded, then the bytes were re-read as
// individual Latin-1 chars and re-encoded as UTF-8.
//
// For 2-byte UTF-8 (C3 XX or C4 XX):
// - Original: C3 XX where XX >= 0x80
// - Read as Latin-1: C3 = U+00C3, XX = U+00XX
// - Re-encoded as UTF-8: U+00C3 → C3 83, U+00XX → C2 XX (for Latin-1 range 0x80-0xBF)
// So C3 XX → C3 83 C2 XX

// But that was already fixed in fix_encoding_v2.js for some patterns.
// Let me check what remains.

const text = raw.toString('utf8');

// Find all positions with 'Ã' (U+00C3 = C3 83 C2 XX pattern)
let pos = text.indexOf('\u00c3');
let count = 0;
while (pos !== -1 && count < 20) {
  const slice = text.slice(Math.max(0, pos-3), pos+20);
  console.log(`Pos ${pos}: ${JSON.stringify(slice)}`);
  pos = text.indexOf('\u00c3', pos+1);
  count++;
}
