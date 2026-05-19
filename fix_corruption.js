const fs = require('fs');

// The corruption: Vietnamese UTF-8 bytes were each decoded as Latin-1 individually,
// then re-encoded as UTF-8, creating "mojibake" like "Chá»Â xá»Â­ lý"
// This happens when UTF-8 text is read character-by-character and each UTF-8
// byte is treated as a Latin-1 character.

// Each Vietnamese char's bytes get "flattened":
// ờ (C3 9C) → bytes C3 and 9C → each treated as Latin-1 (Ã and ) → re-encoded as UTF-8 → Ã (C3 83) +  (C2 9C) = C3 83 C2 9C
// But the file shows "Â" instead of "Ã" - suggesting the chain went through
// CP1252 interpretation where C3 (195) maps differently.

// ACTUAL ANALYSIS of the bytes:
// C3 A1 (á in UTF-8) → as CP1252: C3=A, A1=something in CP1252? No, CP1252 maps C3=Ã in Latin-1 range
// → C3 = U+00C3 (Ã), A1 = U+00A1 → "Ã¡" in UTF-8
// → C3 83 (Ã in UTF-8) + C2 A1 (¡ in UTF-8) = C3 83 C2 A1
// But we see C3 81 instead of C3 A1 for "á"... hmm.

// DIFFERENT THEORY: The file went through:
// 1. Vietnamese stored as VISCII (Vietnamese standard, 8-bit)
// 2. Read as UTF-8 (garbled)
// 3. Read as Latin-1/CP1252 (mojibake)
// 4. Re-saved as UTF-8 (double-encoded)

// For the STATUS STRINGS specifically - let me find them by their distinctive
// JS context patterns and replace byte-by-byte.

// Find 'Chờ xử lý' by searching for the distinctive pattern "Ch" + C3 + C3 in the file

const raw = fs.readFileSync('DACS/data/admin_head.tsx');
const latin1 = raw.toString('latin1');

// ============ APPROACH: Replace all recognizable corrupted strings ============

let content = raw.toString('utf8');

// Function to find and replace corrupted string
// by searching for a distinctive sub-pattern
function fixCorrupted(searchPattern, replacement) {
  // searchPattern should be a distinctive string that's uniquely identifiable
  // even in its corrupted form
  if (content.includes(searchPattern)) {
    const count = (content.match(new RegExp(searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    content = content.split(searchPattern).join(replacement);
    return count;
  }
  return 0;
}

// Find ALL corrupted strings by scanning the file for mojibake patterns
// and matching them to correct Vietnamese strings.

// First, let's scan the file for the most distinctive corrupted substrings
// that unambiguously identify each status/string

// Status: 'Chờ xử lý'
// Corrupted form: we need to find it by its distinctive pattern
// "Ch" followed by something that includes C3 81 C3 9C C3 B1 C3 9B "x"
// The key distinctive pattern: the sequence C3 81 C3 9C (ờ)
// In UTF-8, 'ờ' = C4 9C, NOT C3 9C.
// 'ờ' in UTF-8 = C4 9C. The C3 9C suggests the byte 0x9C was treated as UTF-8 start.

// Let me search for the distinctive hex pattern directly
// The corrupted "Chờ xử lý" → bytes in file:
// Ch C3 81 C3 9C C3 B1 C3 9B x C3 B1 C3 9B C2 AD l C3 BD
// In hex: 43 68 c3 81 c3 9c c3 b1 c3 9b 78 c3 b1 c3 9b c2 ad 6c c3 bd
// Let me try to find this exact byte sequence

const hex = raw.toString('hex');
// Find by searching for specific byte patterns
const corruptedChXuLy = Buffer.from([
  0x43, 0x68,  // Ch
  0xc3, 0x81,  // corrupted á (C3 A1 → C3 81)
  0xc3, 0x9c,  // corrupted ờ? or ờ
  0xc3, 0xb1,  // corrupted ử
  0xc3, 0x9b,  // corrupted ?
  0x78,        // x
  0xc3, 0xb1,  // corrupted ử
  0xc3, 0x9b,  // corrupted ?
  0xc2, 0xad,  // ?
  0x6c,        // l
  0xc3, 0xbd,  // ý
]);
const corruptedStr = corruptedChXuLy.toString('utf8');
console.log('Corrupted status pattern:', JSON.stringify(corruptedStr));

const idx = content.indexOf(corruptedStr);
console.log('Found corrupted status at index:', idx);

// Also let's look for the distinctive patterns
// 'Ch' followed by 'á»' which is U+00E1 U+00BA U+00A7 in Latin-1
const corruptedXuLi = 'Ch\u00e1\u00bb\u00a7\u00a1\u00bb\u00ac l\u00fd';
const idx2 = content.indexOf(corruptedXuLi);
console.log('Found via mojibake string:', idx2);
if (idx2 >= 0) {
  console.log('Context:', JSON.stringify(content.slice(idx2, idx2+30)));
}

// ============ DIFFERENT APPROACH: Use hex-level replacement ============

// Find the byte sequence for "Chờ xử lý" by looking at the raw file
// Search for 'Ch' + C3 81 + C3 9C in raw bytes
let pos = 0;
const byteSearch = Buffer.from([0x43, 0x68]); // 'Ch'
let found = -1;
for (let i = 0; i < raw.length - 2; i++) {
  if (raw[i] === 0x43 && raw[i+1] === 0x68) {
    // Check if next bytes are C3 81 C3 9C (corrupted ờ)
    if (raw[i+2] === 0xc3 && raw[i+3] === 0x81) {
      found = i;
      console.log('Found Ch + C3 81 at byte', i);
      const ctx = raw.slice(i, i+20).toString('latin1');
      console.log('Latin1 context:', JSON.stringify(ctx));
      break;
    }
  }
}
