#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('DACS/data/admin_head.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

issues = []
patterns = [
    'Ch? x?', 'ang n?', ' n?u xong', 'T? ch?i', ' ph?c v?',
    ' thanh to', 'h\u00eem', 'ng\u00e0y', 'C?p nh?t', 'S? s?n',
    '\u0111\u01a1n', 'Chua c d? li?u', 'Kh\u00f4ng th\u1ec3'
]

for pat in patterns:
    if pat in content:
        lines = [i+1 for i, line in enumerate(content.split('\n')) if pat in line]
        issues.append("STILL_BROKEN: {} on lines: {}".format(repr(pat), lines[:5]))

if issues:
    for iss in issues:
        print(iss)
else:
    print("OK: no common garbled patterns found")
