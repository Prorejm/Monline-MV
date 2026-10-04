"""One-shot revert of an over-eager "repair" that removed a needed paren.

`fix_data_defects.py` originally treated `X.abs) <= n` as a stray-paren typo and
stripped the `)`.  The VX Ace master data proves the opposite:

    $ vxace_data_backup/Map264.rvdata2
    (($game_map.events[15].x - $game_player.x).abs
     + ($game_map.events[15].y - $game_player.y).abs) <= 2

is fully balanced - the closing paren belongs to the leading group.  It is the
*translator* (receiverStart/rewriteSuffix) that dropped the matching opener.

This script restores the 18 affected conditions, identified structurally: a
script payload that is unbalanced towards the open side and ends in `.abs <=`.
231 other `.abs <=` expressions in the data are balanced and untouched.
"""
import glob
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECTS = ['Monline-MV', 'mv_project']
APPLY = '--apply' in os.sys.argv


def walk_strings(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v)
    elif isinstance(obj, str):
        yield obj


ABS_RX = re.compile(r'\.abs(?=\s*<=)')


def rebalance(s):
    bal = s.count('(') - s.count(')')
    if bal <= 0:
        return s
    hits = list(ABS_RX.finditer(s))
    if not hits:
        return s
    if bal != 1:
        raise SystemExit('unexpected imbalance %d in %r' % (bal, s))
    at = hits[-1].end()
    return s[:at] + ')' + s[at:]


total = 0
for proj in PROJECTS:
    data_dir = os.path.join(ROOT, proj, 'data')
    if not os.path.isdir(data_dir):
        continue
    n = 0
    for path in sorted(glob.glob(os.path.join(data_dir, '*.json'))):
        with io.open(path, 'r', encoding='utf-8') as fh:
            text = fh.read()
        blob = json.loads(text)
        changed = False

        def fix(o):
            global changed
            if isinstance(o, dict):
                for k, v in list(o.items()):
                    if isinstance(v, str):
                        nv = rebalance(v)
                        if nv != v:
                            o[k] = nv
                            changed = True
                    elif isinstance(v, (dict, list)):
                        fix(v)
            elif isinstance(o, list):
                for i, v in enumerate(o):
                    if isinstance(v, str):
                        nv = rebalance(v)
                        if nv != v:
                            o[i] = nv
                            changed = True
                    elif isinstance(v, (dict, list)):
                        fix(v)

        fix(blob)
        if changed:
            n += 1
            if APPLY:
                with io.open(path, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(json.dumps(blob, ensure_ascii=False))
    print('%s: %d file(s) restored' % (proj, n))
    total += n
print('%s (%d files)' % ('APPLIED' if APPLY else 'dry run only', total))
