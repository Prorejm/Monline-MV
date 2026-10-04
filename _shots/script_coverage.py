#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Which VX Ace scripts have no counterpart in the MV port?

For every _vxace_scripts/*.rb this pulls out the fingerprints that a port is
obliged to reproduce - `$imported["KEY"]` markers, `class X` / `module X`
names and the script's own banner - and greps the shipped MV javascript for
them.  A script whose fingerprints appear nowhere is a script the port has
never looked at.

Usage:
    python _shots/script_coverage.py            # unported only
    python _shots/script_coverage.py --all      # everything
    python _shots/script_coverage.py 0123       # one script, with the hits
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUBY = os.path.join(ROOT, '_vxace_scripts')
MV = [os.path.join(ROOT, 'Monline-MV', 'js', 'plugins'),
      os.path.join(ROOT, 'Monline-MV', 'js')]

SKIP_JS = ('plugins.js', 'main.js', 'libs')


def read(path):
    return io.open(path, encoding='utf-8', errors='replace').read()


def banner(src):
    """The script's own title line, whatever banner style it uses."""
    for line in src.splitlines()[:24]:
        s = line.strip()
        if not s.startswith('#'):
            continue
        s = s.lstrip('#').strip()
        if not s:
            continue
        if s.startswith(('=', '-', '_', '~')):
            continue
        if 'RPG Maker VX Ace' in s:
            continue
        return s[:78]
    return '?'


def fingerprints(src):
    out = []
    for m in re.finditer(r'\$imported\[["\']([^"\']+)["\']\]', src):
        out.append(('imported', m.group(1)))
    for m in re.finditer(r'^\s*(?:class|module)\s+([A-Z][A-Za-z0-9_:]*)',
                         src, re.M):
        name = m.group(1)
        # skip the stock VX Ace / RGSS classes every script reopens
        if name.split('::')[0] in ('RPG', 'Graphics', 'Input', 'Cache',
                                   'DataManager', 'Numeric', 'String',
                                   'Array', 'Hash', 'Math', 'Kernel'):
            continue
        out.append(('class', name))
    return out


def main(argv):
    js = []
    for d in MV:
        for f in sorted(os.listdir(d)):
            if f.endswith('.js') and f not in SKIP_JS and 'plugins.js' not in f:
                p = os.path.join(d, f)
                if os.path.isfile(p):
                    js.append(read(p))
    blob = '\n'.join(js)

    only = argv[0] if argv and not argv[0].startswith('--') else None
    show_all = '--all' in argv

    rows = []
    for f in sorted(os.listdir(RUBY)):
        if not f.endswith('.rb'):
            continue
        if only and not f.startswith(only):
            continue
        src = read(os.path.join(RUBY, f))
        fps = fingerprints(src)
        hits, misses = [], []
        for kind, name in fps:
            needle = name if kind == 'imported' else re.escape(name)
            if re.search(needle, blob):
                hits.append(name)
            else:
                misses.append(name)
        rows.append((f[:4], banner(src), len(fps), hits, misses))

    w = max(len(r[1]) for r in rows) + 2
    print('script  %-*s  fp  found  missing' % (w, 'title'))
    print('-' * (w + 30))
    unported = 0
    for num, title, total, hits, misses in rows:
        if not misses:
            if show_all or only:
                print('%s  %-*s  %2d  %5d  -' % (num, w, title, total, len(hits)))
            continue
        unported += 1
        print('%s  %-*s  %2d  %5d  %s' % (num, w, title, total, len(hits),
                                          ', '.join(sorted(set(misses))[:6])))
        if only:
            print('      found: ' + ', '.join(sorted(set(hits))[:20]))
    print('-' * (w + 30))
    print('%d/%d scripts leave at least one fingerprint unmatched'
          % (unported, len(rows)))


if __name__ == '__main__':
    main(sys.argv[1:])
