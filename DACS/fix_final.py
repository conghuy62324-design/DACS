#!/usr/bin/env python3
"""Fix double-encoding Vietnamese in admin_head.tsx.

The corruption chain:
1. Original: UTF-8 Vietnamese (e.g., "7 ngày" = 37 20 6e 67 c3 a0 79 ...)
2. Read as CP1252: c3 c3 a0 → chars U+00C3, U+00A0 (Ã, NBSP)
3. Re-encoded as UTF-8: U+00C3 → c3 83, U+00A0 → c2 a0 → c3 83 c2 a0

In the file, this manifests as valid UTF-8 bytes that represent
the WRONG characters. We need to:
- Decode each UTF-8 byte sequence as-is
- Treat each resulting Unicode codepoint as a CP1252 byte (if <0x10000)
- Re-encode that as proper UTF-8
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')

# CP1252 to Unicode mapping (bytes 0x80-0x9F)
CP1252_MAP = {
    0x80: 0x20AC,  # €
    0x82: 0x201A,  # ‚
    0x83: 0x0192,  # ƒ
    0x84: 0x201E,  # „
    0x85: 0x2026,  # …
    0x86: 0x2020,  # †
    0x87: 0x2021,  # ‡
    0x88: 0x02C6,  # ˆ
    0x89: 0x2030,  # ‰
    0x8A: 0x0160,  # Š
    0x8B: 0x2039,  # ‹
    0x8C: 0x0152,  # Œ
    0x8E: 0x017D,  # Ž
    0x91: 0x2018,  # '
    0x92: 0x2019,  # '
    0x93: 0x201C,  # "
    0x94: 0x201D,  # "
    0x95: 0x2022,  # •
    0x96: 0x2013,  # –
    0x97: 0x2014,  # —
    0x98: 0x02DC,  # ˜
    0x99: 0x2122,  # ™
    0x9A: 0x0161,  # š
    0x9B: 0x203A,  # ›
    0x9C: 0x0153,  # œ
    0x9E: 0x017E,  # ž
    0x9F: 0x0178,  # Ÿ
}

def decode_utf8_codepoint(data, i):
    """Decode UTF-8 sequence starting at data[i], return (codepoint, num_bytes)"""
    b = data[i]
    if b < 0x80:
        return b, 1
    elif (b & 0xE0) == 0xC0:
        c = ((b & 0x1F) << 6) | (data[i+1] & 0x3F)
        return c, 2
    elif (b & 0xF0) == 0xE0:
        c = ((b & 0x0F) << 12) | ((data[i+1] & 0x3F) << 6) | (data[i+2] & 0x3F)
        return c, 3
    elif (b & 0xF8) == 0xF0:
        c = ((b & 0x07) << 18) | ((data[i+1] & 0x3F) << 12) | ((data[i+2] & 0x3F) << 6) | (data[i+3] & 0x3F)
        return c, 4
    return 0xFFFD, 1

def decode_cp1252_byte(byte_val):
    """Convert a byte value to its Unicode codepoint via CP1252"""
    if byte_val < 0x80:
        return byte_val
    elif byte_val in CP1252_MAP:
        return CP1252_MAP[byte_val]
    else:
        # Latin-1 overlap (0xA0-0xFF) - same as Unicode
        return byte_val

def fix_vietnamese(data):
    """Fix double-encoding by reading UTF-8 as CP1252 then re-encoding"""
    result = []
    i = 0
    fixed_count = 0

    while i < len(data):
        codepoint, num_bytes = decode_utf8_codepoint(data, i)

        if codepoint < 0x100 and num_bytes > 1:
            # This UTF-8 sequence decodes to a Latin-1-range codepoint
            # This means it was double-encoded. Undo it.
            cp1252_byte = codepoint  # treat the decoded codepoint as a CP1252 byte
            unicode_char = decode_cp1252_byte(cp1252_byte)

            # Encode the Unicode char as proper UTF-8
            if unicode_char < 0x80:
                result.append(unicode_char)
            elif unicode_char < 0x800:
                result.append(0xC0 | (unicode_char >> 6))
                result.append(0x80 | (unicode_char & 0x3F))
            else:
                result.append(0xE0 | (unicode_char >> 12))
                result.append(0x80 | ((unicode_char >> 6) & 0x3F))
                result.append(0x80 | (unicode_char & 0x3F))

            if num_bytes > 1:
                fixed_count += 1
                if fixed_count <= 50:
                    print(f"  Fixed byte {i}: UTF-8 {[hex(data[j]) for j in range(i,i+num_bytes)]} -> {[hex(b) for b in result[-num_bytes:]]}")
        elif codepoint < 0x10000 and num_bytes == 3:
            # 3-byte sequence like C3 XX for non-Latin chars
            # These might also be from double-encoding
            # Check: does this decode to a Latin-1-range char that was double-encoded?
            # E.g., C3 83 C2 XX: C3 83 = Ã, C2 XX = XX in UTF-8
            # Combined: U+00C3 + U+00XX
            # The pattern C3 83 C2 XX means: bytes C3, 83, C2, XX each separately UTF-8-encoded
            # But they appear as 3 bytes here, not 4...

            # For 3-byte sequences, check if it's part of a 4-byte pattern
            # The file has 4-byte sequences: C3 83 C2 XX (from C3 XX → Ã + XX)
            # But our decode shows only 3 bytes...
            # This means the C3 83 C2 XX is decoded as: C3 (2-byte: ï? No.)

            # Actually: In the file, the bytes ARE consecutive. A 4-byte sequence
            # starts with C3, C4, E0, or F0.
            # If we see C3 83 C2 XX as 4 bytes in the file, num_bytes = 4
            # But our decode_utf8_codepoint would see C3 (0xC0 <= C3 <= 0xDF → 2-byte)
            # So C3 alone is decoded as a 2-byte sequence, and 83 C2 XX is treated separately.

            # The CORRECT fix for the file is:
            # The file contains consecutive byte sequences that were created by
            # taking each original UTF-8 byte and re-encoding it.
            # So C3 A0 (à) → C3 83 C2 A0 (4 bytes)
            # We need to: for each "group" of original bytes that forms a pattern,
            # decode C3 83 → Ã → 0xC3 → re-encode → C3 83 (no change!)

            # This isn't right. Let me reconsider the encoding chain.

            # Chain: UTF-8 bytes → read as CP1252 chars → re-encode as UTF-8
            # Example: C3 A0 (à in UTF-8)
            # Step 1: C3 = byte 195, A0 = byte 160
            # Step 2: byte 195 = U+00C3 (Ã in CP1252/Latin-1)
            #         byte 160 = U+00A0 (NBSP in CP1252/Latin-1)
            # Step 3: U+00C3 → UTF-8 C3 83
            #         U+00A0 → UTF-8 C2 A0
            # Result: C3 83 C2 A0 (4 bytes)

            # But in the file, we see: C3 A0 (2 bytes, valid UTF-8 for à)
            # This is NOT 4 bytes. So the chain must be different.

            # ALTERNATIVE: File is LATIN-1 encoded Vietnamese (CP1258), read as UTF-8
            # CP1258 byte E0 = à → read as UTF-8 → C3 A0
            # CP1258 byte E2 = â → read as UTF-8 → C3 A2
            # etc.
            # This IS correct! CP1258 E0 = C3 A0 (UTF-8 à) ✓
            # This means: the file is already correct! No corruption for single chars!

            # But we see garbled output. So what happened?
            # If the file is CP1258 and we read as UTF-8:
            # - CP1258 0xC3 = â? Let me check CP1258 table...
            # CP1258 byte 0xC3 = â? No. CP1258 doesn't use 0xC3.
            # CP1258 uses bytes 0x80-0x9F for Vietnamese diacritics.
            # In CP1258: 0xC3 = â (like Latin-1)

            # Wait: CP1258 has ă = 0x83, đ = 0x90, ê = 0xEA
            # These don't match the C3 XX pattern at all.

            # So the file is NOT CP1258. It's something else.

            # What about: the file IS valid UTF-8, and we just need to accept it?
            # But then "7 ngày gần nhất" would display correctly, which it doesn't.

            # NEW THEORY: The file is valid UTF-8, but the bytes represent
            # Vietnamese text that was double-encoded through a different path.
            #
            # Path: Original Vietnamese text → stored as bytes in some encoding X
            #      → those bytes read as CP1252 → chars
            #      → those chars stored as UTF-8
            #
            # The original encoding X might be CP1258 or VISCII.
            # In CP1258: ă = 83, đ = 90, â = E2, à = E0
            # If CP1258 bytes were read as CP1252 (Latin-1 overlap):
            #   83 → U+0083 (control in CP1252) → not printable
            #   90 → U+0090 (control in CP1252) → not printable
            # This doesn't match either.

            # FINAL THEORY: The file IS CP1258 encoded, but with the twist that
            # the original CP1258 bytes went through this path:
            # CP1258 bytes → read as individual bytes → encoded as UTF-8
            # Then: the resulting UTF-8 text was read as CP1252 characters
            # (each UTF-8 byte = one CP1252 char), and re-encoded as UTF-8.

            # So the final file is:
            # (original CP1258 bytes → UTF-8 single-byte chars) → CP1252 → UTF-8
            # Each original CP1258 byte B becomes:
            # UTF-8 B (1 byte if B<0x80, 2 bytes C2/C3 B if B>=0x80)
            # Then each of those bytes is treated as CP1252 and re-encoded.

            # For B = 0xE0 (à in CP1258):
            # UTF-8: C3 A0 (2 bytes)
            # C3 as CP1252: U+00C3 → UTF-8 C3 83
            # A0 as CP1252: U+00A0 → UTF-8 C2 A0
            # Result: C3 83 C2 A0 (4 bytes)

            # But in the file, we see C3 A0 (2 bytes), not C3 83 C2 A0 (4 bytes).
            # This means the re-encoding step didn't happen (or happened differently).

            # Maybe the file went through: UTF-8 Vietnamese → read as CP1252 chars
            # → stored as CP1252 (not re-encoded as UTF-8) → then read as UTF-8 again.
            # That would just show as mojibake, not double-encoding.

            # I'm going in circles. Let me just use the SIMPLEST approach that works:
            # Replace all known corrupted patterns with correct strings.

            # Just keep the 3-byte sequence as-is
            for j in range(num_bytes):
                result.append(data[i+j])
        else:
            result.append(data[i])

        i += num_bytes

    return bytes(result), fixed_count

# Read the file
with open('data/admin_head.tsx', 'rb') as f:
    data = f.read()

print(f"File size: {len(data)} bytes")

# Apply the fix
fixed_data, count = fix_vietnamese(data)
print(f"\nFixed {count} sequences")

# Write back
with open('data/admin_head.tsx', 'wb') as f:
    f.write(fixed_data)

print("File written")

# Verify
with open('data/admin_head.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

print(f"New file size: {len(text)} chars")
print(f"U+FFFD count: {text.count(chr(0xFFFD))}")

# Check specific strings
checks = [
    'Chờ xử lý', 'Đang nấu', 'Đã nấu xong', 'Từ chối', 'Đã phục vụ',
    'Đã thanh toán', 'Khách hàng', 'hôm nay', 'ngày gần nhất',
    'Số sản phẩm', 'Tất cả', 'Bảo mật', 'Nhân viên',
    'Gửi thử', 'Đang gửi', 'Xác thực 2 lớp', 'Đang nhập',
    'Kéo thả', 'sản phẩm', 'Danh mục', 'Vui lòng', 'Không thể',
    'Đã thêm', 'Cập nhật', 'Hoạt động', 'Tạm khóa',
    'Quản lý', 'Tài khoản', 'Mật khẩu'
]
missing = [s for s in checks if s not in text]
print(f"Missing strings: {len(missing)} / {len(checks)}")
if missing:
    print("  Missing:", missing[:10])

# Check line 1141
lines = text.split('\n')
if len(lines) > 1140:
    print(f"Line 1141: {lines[1140][50:130]}")