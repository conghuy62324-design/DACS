#!/usr/bin/env python3
"""Fix mojibake in admin_head.tsx by properly converting Latin-1 to UTF-8
handling CP1252/Windows-1252 Vietnamese characters."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('data/admin_head.tsx', 'rb') as f:
    data = f.read()

latin1_text = data.decode('latin-1')

# Count the types of extended chars to understand the encoding
from collections import Counter
ext_chars = Counter()
for ch in latin1_text:
    cp = ord(ch)
    if cp > 0x7F:
        ext_chars[cp] += 1

print(f"Extended chars: {len(ext_chars)} types, {sum(ext_chars.values())} total")
for cp, count in sorted(ext_chars.items())[:30]:
    print(f"  U+{cp:04X} ({chr(cp)!r}): {count}")

# CP1252 mapping for bytes 0x80-0x9F (Vietnamese extended range)
CP1252_EXT = {
    0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E',
    0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6',
    0x89: '\u2030', 0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152',
    0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C',
    0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
    0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A',
    0x9C: '\u0153', 0x9E: '\u017E', 0x9F: '\u0178',
}

# For the Vietnamese mojibake fix, we need to identify the pattern:
# mojibake 'à' = C3 A0 C2 A0 (bytes in Latin-1 = C3 + NBSP)
# The mojibake chars have U+00C3 (Ã) and U+00A0 (NBSP) in specific patterns.
# Normal mojibake 'à' would only appear in contexts where the original
# was UTF-8 'à' (C3 A0). So any occurrence of this pattern is mojibake.

# BUT: the CP1252 range 0xA0-0xFF is the same as Latin-1.
# So the Latin-1 text we have is: bytes 0x80-0xFF as U+0080-U+00FF.
# We need to: interpret these as CP1252 bytes, map to Unicode, encode as UTF-8.

def latin1_to_utf8(text):
    """Convert Latin-1 text (bytes 0x80-0xFF) to proper UTF-8 via CP1252 mapping."""
    result = []
    for ch in text:
        cp = ord(ch)
        if cp < 0x80:
            result.append(chr(cp))
        elif cp in CP1252_EXT:
            result.append(CP1252_EXT[cp])
        else:
            # Latin-1 overlap range 0xA0-0xFF = same as CP1252
            # Encode as UTF-8
            if cp < 0x800:
                result.append(chr(0xC0 | (cp >> 6)))
                result.append(chr(0x80 | (cp & 0x3F)))
            else:
                result.append(chr(0xE0 | (cp >> 12)))
                result.append(chr(0x80 | ((cp >> 6) & 0x3F)))
                result.append(chr(0x80 | (cp & 0x3F)))
    return ''.join(result)

utf8_text = latin1_to_utf8(latin1_text)
print(f"\nConverted text size: {len(utf8_text)} chars")
print(f"Line 1141: {utf8_text.split(chr(10))[1140][50:130]}")

# Check for Vietnamese strings
checks = ['Chờ xử lý', 'Đang nấu', 'Đã nấu xong', 'Từ chối', 'Đã phục vụ',
  'Đã thanh toán', 'Khách hàng', 'hôm nay', 'ngày gần nhất',
  'Số sản phẩm', 'Tất cả', 'Bảo mật', 'Nhân viên']
missing = [s for s in checks if s not in utf8_text]
print(f"Missing: {len(missing)} / {len(checks)}")
if missing:
    print("  Missing:", missing[:5])

# Write the fixed file
with open('data/admin_head.tsx', 'w', encoding='utf-8') as f:
    f.write(utf8_text)
print("File written!")
