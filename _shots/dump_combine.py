#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Dump the real command layout around every `combine_choices` script call.

This is the ground truth for porting Hime's "Large Choices" (0116.rb): we need
to see how the Show Choices (102) / When (402) / When Cancel (403) / End (404)
commands are nested so the merge can re-number branches exactly like Ruby does.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'Monline-MV', 'data')

MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 3


def iter_lists(o):
    """Yield (context, list) for every event command list in the tree."""
    if isinstance(o, dict):
        if isinstance(o.get('code'), int) and isinstance(o.get('parameters'), list):
            pass
        for k, v in o.items():
            if k == 'list' and isinstance(v, list):
                yield o, v
            else:
                for r in iter_lists(v):
                    yield r
    elif isinstance(o, list):
        for v in o:
            for r in iter_lists(v):
                yield r


def dump(files):
    shown = 0
    for fn in files:
        with open(os.path.join(DATA, fn), encoding='utf-8') as fh:
            data = json.load(fh)
        for _ctx, lst in iter_lists(data):
            for i, cmd in enumerate(lst):
                if not isinstance(cmd, dict) or cmd.get('code') != 355:
                    continue
                txt = str((cmd.get('parameters') or [''])[0])
                if 'combine_choices' not in txt:
                    continue
                # find the first 102 at or after i
                j = i
                while j < len(lst) and lst[j].get('code') != 102:
                    j += 1
                if j >= len(lst):
                    continue
                print('\n===== %s : combine_choices at %d, first 102 at %d =====' % (fn, i, j))
                for k in range(i, min(j + 40, len(lst))):
                    c = lst[k]
                    code = c.get('code')
                    ind = c.get('indent')
                    p = c.get('parameters')
                    if code == 355:
                        s = str(p[0]) if p else ''
                        print('  %3d ind=%s 355  %s' % (k, ind, s[:60].replace('\n', '\\n')))
                    elif code == 102:
                        print('  %3d ind=%s 102  choices=%s cancel=%s' % (k, ind, p[0], p[1]))
                    elif code in (402, 403, 404):
                        print('  %3d ind=%s %d  %s' % (k, ind, code, p))
                    elif code == 0:
                        print('  %3d ind=%s 0    (end)' % (k, ind))
                        break
                    else:
                        print('  %3d ind=%s %d  %s' % (k, ind, code, str(p)[:60]))
                shown += 1
                if shown >= MAX:
                    return


def main():
    files = sorted(f for f in os.listdir(DATA)
                   if f.startswith('Map') and f.endswith('.json'))
    dump(files)


if __name__ == '__main__':
    main()
