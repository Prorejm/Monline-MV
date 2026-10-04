#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QA / Edward - INDEPENDENT census of the JP notetags.

Written from scratch; deliberately does NOT import or reuse the engineer's
qa_tag_census.py.  Two independent angles:

  1. the converted MV json  (what the running game actually reads)
  2. the original VX Ace Enemies.rvdata2 raw bytes (what the original game read)

Angle 2 is the tie-breaker: if the two disagree the conversion dropped tags.

The scan is deliberately WIDER than the port's regex
    /<(?:JP_GAIN|jp gain):[ ](\d+)>/gi
so that near-miss spellings (no space, two spaces, uppercase, no colon ...)
show up as warnings instead of silently draining JP.
"""
import io
import json
import os
import re
import sys

ROOT = r'G:/新建文件夹 (22)/Monline_MV'
DATA_A = os.path.join(ROOT, 'Monline-MV', 'data')
DATA_B = os.path.join(ROOT, 'mv_project', 'data')
RVDATA = os.path.join(ROOT, 'extracted', 'Data', 'Enemies.rvdata2')

# what the port accepts
STRICT = re.compile(rb'<[ ]*(?:JP_GAIN|jp gain):[ ]*(\d+)[ ]*>', re.I)
# anything that smells like a jp tag at all
LOOSE = re.compile(rb'<[ ]*[A-Za-z_ ]{0,12}jp[ _]?(gain|rate)[ ]*:[ ]*([^>]*)>', re.I)

fails = []


def check(label, got, want):
    ok = (got == want)
    print(('  ok   ' if ok else '  FAIL ') + '%s: got %r want %r' % (label, got, want))
    if not ok:
        fails.append('%s got %r want %r' % (label, got, want))
    return ok


def load(p):
    with io.open(p, 'r', encoding='utf-8') as fh:
        return json.load(fh)


def stats(raw):
    """raw = bytes of a whole file -> (strict_hits, distinct, per_index)"""
    strict = []
    for m in STRICT.finditer(raw):
        strict.append((m.start(), int(m.group(1))))
    loose_other = []
    for m in LOOSE.finditer(raw):
        s = m.group(0)
        if not STRICT.fullmatch(s) and not STRICT.search(s):
            loose_other.append(s)
    return strict, loose_other


def per_entry(rows):
    """rows = json list -> dict id -> list of strict values in note order"""
    out = {}
    for row in rows or []:
        if not row:
            continue
        note = row.get('note')
        if not isinstance(note, str):
            continue
        vals = [int(v) for v in
                re.findall(r'<[ ]*(?:JP_GAIN|jp gain):[ ]*(\d+)[ ]*>', note, re.I)]
        if vals:
            out[row.get('id')] = vals
    return out


def name_of(rows, eid):
    for row in rows or []:
        if row and row.get('id') == eid:
            return row.get('name')
    return None


print('=== 1. Enemies.json  (MV, both copies) ===')
res = {}
for tag, d in (('Monline-MV', DATA_A), ('mv_project', DATA_B)):
    p = os.path.join(d, 'Enemies.json')
    raw = open(p, 'rb').read()
    rows = load(p)
    strict, loose = stats(raw)
    per = per_entry(rows)
    n_enemies = len([r for r in rows if r])
    print(' [%s] %s' % (tag, p))
    res[tag] = (strict, per, rows, len(loose))
    print('   enemies in file      : %d' % n_enemies)
    print('   <jp gain:> matches   : %d' % len(strict))
    print('   enemies carrying one : %d' % len(per))
    print('   multi-tag enemies    : %d' % len([k for k, v in per.items() if len(v) > 1]))
    print('   values seen          : %s' % sorted(set(v for v, _ in strict))[:12])
    print('   near-miss tag shapes : %d %s' % (len(loose), loose[:5]))

check('Monline-MV Enemies.json <jp gain:> occurrences', len(res['Monline-MV'][0]), 159)
check('Monline-MV Enemies.json enemies with a tag', len(res['Monline-MV'][1]), 156)
check('mv_project Enemies.json <jp gain:> occurrences', len(res['mv_project'][0]), 159)
check('mv_project Enemies.json enemies with a tag', len(res['mv_project'][1]), 156)
check('both copies agree (occurrences)',
      len(res['Monline-MV'][0]), len(res['mv_project'][0]))
check('total enemies', len([r for r in res['Monline-MV'][2] if r]), 213)

print()
print('=== 2. Enemies.rvdata2 raw byte scan ===')
if os.path.exists(RVDATA):
    raw = open(RVDATA, 'rb').read()
    strict, loose = stats(raw)
    print('   file bytes           : %d' % len(raw))
    print('   <jp gain:> matches   : %d' % len(strict))
    print('   near-miss tag shapes : %d %s' % (len(loose), loose[:5]))
    check('rvdata2 <jp gain:> occurrences', len(strict), 159)
    # the port takes the LAST tag, so compare multisets of "last value per enemy"
    mv_last = sorted(v[-1] for v in res['Monline-MV'][1].values())
    print('   mv last-values count : %d' % len(mv_last))
else:
    print('  FAIL rvdata2 not found at %s' % RVDATA)
    fails.append('rvdata2 missing')

print()
print('=== 3. named enemies ===')
rows = res['Monline-MV'][2]
per = res['Monline-MV'][1]


def by_name(n):
    for row in rows:
        if row and row.get('name') == n:
            return row
    return None


targets = [('Holstaurus', 10), ('Sea Bishop', 40), ('Kejourou', 12), ('Yuuka', 12)]
for nm, want in targets:
    row = by_name(nm)
    if row is None:
        print('  FAIL %s not found' % nm)
        fails.append('enemy %s missing' % nm)
        continue
    vals = per.get(row.get('id'))
    got = vals[-1] if vals else None
    note = row.get('note') or ''
    print('  %-12s id=%-4s tags=%-10s effective=%s' % (nm, row.get('id'), vals, got))
    check('  %s effective jp' % nm, got, want)
    if vals and len(vals) > 1:
        print('       note: %r' % note[:120])

# enemy id 1
row1 = [r for r in rows if r and r.get('id') == 1]
if row1:
    print('  enemy id 1 name       : %s' % row1[0].get('name'))
    check('  enemy id 1 effective jp', per.get(1, [None])[-1], 10)

print()
print('=== 4. multi-tag enemies (last one must win) ===')
multi = [(k, v) for k, v in per.items() if len(v) > 1]
for k, v in sorted(multi):
    print('  id=%-4d %-16s tags=%s -> effective %d' % (k, name_of(rows, k), v, v[-1]))
check('number of multi-tag enemies', len(multi), 3)

print()
print('=== 5. Actors.json <jp rate:> ===')
RATE = re.compile(r'<[ ]*(?:JP_RATE|jp rate):[ ]*(\d+)[ ]*(?:[%％])[ ]*>', re.I)
RATE_LOOSE = re.compile(r'<[ ]*[A-Za-z_ ]{0,12}jp[ _]?rate[ ]*:[ ]*([^>]*)>', re.I)
for tag, d in (('Monline-MV', DATA_A), ('mv_project', DATA_B)):
    p = os.path.join(d, 'Actors.json')
    raw = open(p, 'rb').read()
    rows_a = load(p)
    hits = RATE.findall(raw.decode('utf-8'))
    loose = [m for m in RATE_LOOSE.findall(raw.decode('utf-8'))]
    print(' [%s] rate tags=%d %s  loose-shapes=%s' % (tag, len(hits), hits, loose))
    check('%s Actors.json <jp rate:> count' % tag, len(hits), 1)
    a25 = [r for r in rows_a if r and r.get('id') == 25]
    if a25:
        note = a25[0].get('note') or ''
        print('   actor 25 name=%r note=%r' % (a25[0].get('name'), note[:160]))
        m = RATE.search(note)
        check('%s actor 25 rate value' % tag, m.group(1) if m else None, '0')
    else:
        print('  FAIL actor 25 missing')
        fails.append('actor 25 missing')

print()
print('=== 6. Skills / Items / Weapons / Armors / States / Classes ===')
for base in ('Skills', 'Items', 'Weapons', 'Armors', 'States', 'Classes', 'Troops'):
    p = os.path.join(DATA_A, base + '.json')
    if not os.path.exists(p):
        print('  (skip) %s.json missing' % base)
        continue
    raw = open(p, 'rb').read()
    strict, loose = stats(raw)
    rates = RATE.findall(raw.decode('utf-8'))
    n = len([r for r in (load(p) or []) if r])
    print('  %-9s entries=%-5d jp_gain=%-3d jp_rate=%-3d near-miss=%d %s'
          % (base, n, len(strict), len(rates), len(loose), loose[:3]))
    if base in ('Skills', 'Items'):
        check('%s.json <jp gain:> count' % base, len(strict), 0)
    if base == 'Skills':
        check('Skills.json entry count', n, 815)
    if base == 'Items':
        check('Items.json entry count', n, 370)

print()
if fails:
    print('CENSUS FAILED (%d):' % len(fails))
    for f in fails:
        print('  - ' + f)
    sys.exit(1)
print('CENSUS PASSED: every independent count matches the claim')
