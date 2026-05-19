const fs = require('fs');
const raw = fs.readFileSync('DACS/data/admin_head.tsx');

// Read the file as UTF-8 to get the corrupted text
const corrupted = raw.toString('utf8');

// THE ENCODING BUG:
// 1. UTF-8 Vietnamese bytes → read as CP1252/Windows-1252 → chars
// 2. Those chars → re-encoded as UTF-8 → 4-byte sequences
// CORRECTION: We need to undo step 2, then step 1.

// Pattern: C3 83 C2 XX (4 bytes) → was originally C3 XX (2 bytes, UTF-8 for à-ÿ range)
// Pattern: C4 83 C2 XX (4 bytes) → was originally C4 XX (2 bytes, UTF-8 for ă-ƿ range)

// Decode map: 4-byte bad sequence → 2-byte correct sequence
const DECODE = {};
const ENCODE = {};

function addPair(bad, good) {
  DECODE[bad] = good;
  ENCODE[good] = bad;
}

// For C3 XX range (0x80-0xBF = à-ÿ):
// Bad: C3 83 C2 XX
// The last byte XX in C2 XX is the original UTF-8 second byte
// because C2 XX → U+00XX (when decoded as UTF-8)
// And U+00XX in CP1252 = byte XX
// And original UTF-8 for that = C3 XX
// So: C3 83 C2 XX → C3 XX
for (let x = 0x80; x <= 0xBF; x++) {
  const xx = x.toString(16).toUpperCase().padStart(2,'0');
  addPair(`C3${xx}`, `C3${xx}`);
}
// But C3 83 C2 XX has the middle byte 83 fixed
for (let x = 0x80; x <= 0xBF; x++) {
  const xx = x.toString(16).toUpperCase().padStart(2,'0');
  const bad4 = `C3${xx}`;
  addPair(`C3 83 C2 ${xx}`.replace(/ /g,''), bad4);
}

// For C4 XX range (ă-ƿ):
for (let x = 0x80; x <= 0xBF; x++) {
  const xx = x.toString(16).toUpperCase().padStart(2,'0');
  addPair(`C4 83 C2 ${xx}`.replace(/ /g,''), `C4${xx}`);
}
for (let x = 0x80; x <= 0xBF; x++) {
  const xx = x.toString(16).toUpperCase().padStart(2,'0');
  const bad4 = `C4${xx}`;
  addPair(`C4 84 C2 ${xx}`.replace(/ /g,''), bad4);
}

// Alternative approach: build ALL 4-byte to 2-byte mappings directly
const ALL_FIXES = {};
const raw_str = raw.toString('hex').toUpperCase();

// Scan for all C3 XX C3 XX or C3 XX C2 XX patterns
let result = corrupted;
let totalFixed = 0;

// Fix 4-byte sequences
for (let x = 0x80; x <= 0xBF; x++) {
  const xx = x.toString(16).toUpperCase().padStart(2,'0');
  // C3 83 C2 XX → C3 XX
  const bad = Buffer.from([0xC3, 0x83, 0xC2, x]).toString('utf8');
  const good = Buffer.from([0xC3, x]).toString('utf8');
  if (result.includes(bad)) {
    const n = (result.match(new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    result = result.split(bad).join(good);
    totalFixed += n;
    console.log(`Fixed C383C2${xx} -> C3${xx} (${n}x): ${good}`);
  }
  // C4 84 C2 XX → C4 XX
  const bad2 = Buffer.from([0xC4, 0x84, 0xC2, x]).toString('utf8');
  const good2 = Buffer.from([0xC4, x]).toString('utf8');
  if (result.includes(bad2)) {
    const n = (result.match(new RegExp(bad2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    result = result.split(bad2).join(good2);
    totalFixed += n;
    console.log(`Fixed C484C2${xx} -> C4${xx} (${n}x)`);
  }
}

fs.writeFileSync('DACS/data/admin_head.tsx', result, 'utf8');
console.log(`\nTotal fixes: ${totalFixed}`);

// Verify
const raw2 = fs.readFileSync('DACS/data/admin_head.tsx');
const text = raw2.toString('utf8');
console.log('ngÃ in file:', text.includes('ngÃ'));
console.log('7 ngày gần nhất:', text.includes('7 ngày gần nhất'));
console.log('U+FFFD count:', (text.match(/\ufffd/g)||[]).length);
