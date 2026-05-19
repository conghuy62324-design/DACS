#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(encoding='utf-8')

# The file is UTF-8 bytes that were read as Latin-1 (CP1252) and re-saved as UTF-8
# Original Vietnamese: 7 ngày gần nhất
# Raw bytes show: 37 20 6e 67 c3 a0 79 20 67 c3 aa 6e 20 6e 68 c3 aa 1ea 74
# CP1252: c3 a0 = Ã  (U+00C2 U+00A0 in UTF-8 mojibake)
# Let's build the correct mapping by analyzing the raw bytes

# Read the file as raw bytes
with open('DACS/data/admin_head.tsx', 'rb') as f:
    raw = f.read()

# The text we see when read as latin-1:
latin1 = raw.decode('latin-1')
print("Sample latin1:", repr(latin1[86000:86150]))
print("Sample raw bytes:", raw[86000:86100].hex())

# The correct text we want:
correct = latin1.replace('\ufffd', '?')
# Many U+FFFD are there because valid UTF-8 was re-encoded...
# Actually the issue is the file contains UTF-8 bytes but some sequences
# are broken CP1252 sequences that became U+FFFD

# Let's identify all the different byte patterns for Vietnamese chars
# and build a CP1252/CP1258 Vietnamese mapping

# CP1258 (Vietnamese Windows) extended chars:
CP1258 = {
    # Lowercase with diacritics
    0x80: '\u20AB',  # đ (đồng)
    0x83: '\u0103',  # ă
    0x84: '\u1eb1',  # ă macron below (ằ)
    0x85: '\u1ea1',  # ă acute (ắ)
    0x86: '\u1eb3',  # ă hook above (ẳ)
    0x87: '\u1eb5',  # ă tilde (ẵ)
    0x88: '\u0111',  # đ
    0x89: '\u1eb9',  # ê hook (ể)
    0x8A: '\u1eb7',  # ê hook (ễ)
    0x8B: '\u1ebb',  # ê acute (ế)
    0x8C: '\u1ebd',  # ê grave (ề)
    0x8D: '\u1ebf',  # ê tilde (ễ)
    0x8E: '\u1ec1',  # ê acute (ế)
    0x8F: '\u1ec3',  # ê hook (ễ)
    0x90: '\u1ec5',  # ê tilde (ễ)
    0x91: '\u1ec7',  # ê hook (ễ)
    0x92: '\u1ed9',  # ô hook (ỗ)
    0x93: '\u1ed1',  # ô acute (ố)
    0x94: '\u1ed3',  # ô grave (ồ)
    0x95: '\u1ed5',  # ô hook (ỗ)
    0x96: '\u1ed7',  # ô tilde (ỗ)
    0x97: '\u1ed9',  # ô hook
    0x98: '\u1edb',  # ơ acute (ớ)
    0x99: '\u1edd',  # ơ grave (ờ)
    0x9A: '\u1edf',  # ơ hook (ở)
    0x9B: '\u1ee1',  # ơ tilde (ỡ)
    0x9C: '\u1ee3',  # ơ hook (ợ)
    0x9D: '\u1ee3',  # ơ hook
    0x9E: '\u1ee7',  # ư acute (ứ)
    0x9F: '\u1ee5',  # ư breve (ư)
    0xA0: '\u1ea3',  # a hook (ả)
    0xA1: '\u1ea1',  # ă acute
    0xA2: '\u1eaf',  # ă acute
    0xA3: '\u1eb1',  # ă grave
    0xA4: '\u1eb3',  # ă hook
    0xA5: '\u1eb5',  # ă tilde
    0xA6: '\u1eb7',  # ă hook
    0xA7: '\u1eb9',  # ă hook
    0xA8: '\u1ebb',  # ê acute
    0xA9: '\u1ebd',  # ê grave
    0xAA: '\u1ec1',  # ê tilde
    0xAB: '\u1ebf',  # ê acute
    0xAC: '\u1ec3',  # ê hook
    0xAD: '\u1ec5',  # ê tilde
    0xAE: '\u1ec7',  # ê hook
    0xAF: '\u1ec9',  # i hook (ỉ)
    0xB0: '\u1ecb',  # i break hook
    0xB1: '\u1ecd',  # o acute
    0xB2: '\u1ecf',  # o grave
    0xB3: '\u1ed1',  # ô acute
    0xB4: '\u1ed3',  # ô grave
    0xB5: '\u1ed5',  # ô hook
    0xB6: '\u1ed7',  # ô tilde
    0xB7: '\u1ed9',  # ô hook
    0xB8: '\u1edb',  # ơ acute
    0xB9: '\u1edd',  # ơ grave
    0xBA: '\u1edf',  # ơ hook
    0xBB: '\u1ee1',  # ơ tilde
    0xBC: '\u1ee3',  # ơ hook
    0xBD: '\u1ee5',  # ư breve
    0xBE: '\u1ee7',  # ư acute
    0xBF: '\u1ee9',  # ư hook
    0xC0: '\u1ea2',  # a grave
    0xC1: '\u1ea0',  # a acute
    0xC2: '\u1ea6',  # a circumflex
    0xC3: '\u1ea4',  # a circumflex acute
    0xC4: '\u1eab',  # a circumflex hook
    0xC5: '\u1ead',  # a circumflex tilde
    0xC6: '\u1eaf',  # ă acute
    0xC7: '\u1eb2',  # ă grave
    0xC8: '\u1eb4',  # ă hook
    0xC9: '\u1eb6',  # ă tilde
    0xCA: '\u1eb8',  # a hook
    0xCB: '\u1eb0',  # a breve
    0xCC: '\u1ec1',  # e circumflex acute
    0xCD: '\u1ebb',  # e acute
    0xCE: '\u1ec3',  # e circumflex hook
    0xCF: '\u1ec5',  # e circumflex tilde
    0xD0: '\u1ec7',  # e hook
    0xD1: '\u1ebc',  # e tilde
    0xD2: '\u1ec9',  # i hook
    0xD3: '\u1ecb',  # i break hook
    0xD4: '\u1ed3',  # o circumflex grave
    0xD5: '\u1ed5',  # o circumflex hook
    0xD6: '\u1ed7',  # o circumflex tilde
    0xD7: '\u1ed9',  # o circumflex hook
    0xD8: '\u1eed',  # o hook
    0xD9: '\u1ee1',  # o tilde
    0xDA: '\u1ee3',  # o hook
    0xDB: '\u1ee3',  # u horn
    0xDC: '\u1ee5',  # u breve
    0xDD: '\u1eeb',  # u hook
    0xDE: '\u1ef1',  # u hook
    0xDF: '\u1eeb',  # u horn grave
    0xE0: '\u1ea3',  # a hook
    0xE1: '\u1ea1',  # a acute
    0xE2: '\u1ea7',  # a circumflex grave
    0xE3: '\u1ea5',  # a circumflex acute
    0xE4: '\u1aaf',  # a circumflex tilde
    0xE5: '\u1aad',  # a circumflex hook
    0xE6: '\u1eb5',  # ă tilde
    0xE7: '\u1eb3',  # ă hook
    0xE8: '\u1eb9',  # ê hook
    0xE9: '\u1ebd',  # e grave
    0xEA: '\u1ebf',  # e acute
    0xEB: '\u1ec1',  # e circumflex acute
    0xEC: '\u1ec3',  # e circumflex grave
    0xED: '\u1ec5',  # e circumflex hook
    0xEE: '\u1ec7',  # e circumflex tilde
    0xEF: '\u1ec9',  # i hook
    0xF0: '\u1ecb',  # i break hook
    0xF1: '\u1ecd',  # o acute
    0xF2: '\u1ecf',  # o grave
    0xF3: '\u1ed1',  # o acute
    0xF4: '\u1ed3',  # o grave
    0xF5: '\u1ed5',  # o hook
    0xF6: '\u1ed7',  # o tilde
    0xF7: '\u1ed9',  # o hook
    0xF8: '\u1edb',  # o horn acute
    0xF9: '\u1edd',  # o horn grave
    0xFA: '\u1edf',  # o horn hook
    0xFB: '\u1ee1',  # o horn tilde
    0xFC: '\u1ee3',  # o horn hook
    0xFD: '\u1ee7',  # u acute
    0xFE: '\u1ee9',  # u hook
    0xFF: '\u1eef',  # u horn acute
}

# Actually, let me try a simpler approach.
# The file is VALID UTF-8. The U+FFFD appears because some bytes
# form incomplete UTF-8 sequences.
# The bytes that look like Latin-1 mojibake are actually UTF-8
# that got decoded character-by-character as Latin-1 and then stored.

# Let me check: are there mojibake UTF-8 sequences?
# E.g., UTF-8 "à" = C3 A0
# Latin-1 interpretation: "Ã " (capital A tilde + NBSP)
# If these are then re-encoded as UTF-8:
# "Ã " in UTF-8 = C3 83 C2 A0

# So if raw bytes have C3 83 C2 A0 -> that's double-encoded "à"
# Let me scan for these patterns:
import re

# Look for double-encoded UTF-8 patterns
# C3 83 C2 XX = doubled Latin-1 'Ã ' + char
# E.g., à = C3 A0 -> double = C3 83 C2 A0
# á = C3 A1 -> double = C3 83 C2 A1

double_encoded_count = 0
for i in range(len(raw) - 3):
    b0, b1, b2, b3 = raw[i], raw[i+1], raw[i+2], raw[i+3]
    if (b0 == 0xC3 and b1 == 0x83 and b2 == 0xC2 and
        b3 in [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
               0xA8, 0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF,
               0xE0, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7,
               0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF,
               0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7,
               0xF8, 0xF9, 0xFA, 0xFB, 0xFC, 0xFD, 0xFE, 0xFF]):
        double_encoded_count += 1

print(f"Double-encoded UTF-8 sequences found: {double_encoded_count}")

# Also check for 4-byte UTF-8 sequences (Vietnamese Supplement)
utf8_4byte = 0
for i in range(len(raw) - 3):
    b0 = raw[i]
    if b0 >= 0xF0:
        utf8_4byte += 1

print(f"4-byte UTF-8 start bytes: {utf8_4byte}")

# Count valid UTF-8 chars vs replacement chars
valid_utf8 = 0
invalid_utf8 = 0
i = 0
while i < len(raw):
    b = raw[i]
    if b < 0x80:
        valid_utf8 += 1
        i += 1
    elif b >= 0xF0:
        valid_utf8 += 1
        i += 4
    elif b >= 0xE0:
        valid_utf8 += 1
        i += 3
    elif b >= 0xC0:
        valid_utf8 += 1
        i += 2
    else:
        invalid_utf8 += 1
        i += 1

print(f"Valid UTF-8: {valid_utf8}, Invalid/malformed: {invalid_utf8}")
