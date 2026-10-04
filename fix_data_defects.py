"""Repair the defects the VX Ace -> MV conversion left in the data files.

Four independent, idempotent repairs.  Each one is *silent* at run time - the
game plays, but something quietly does the wrong thing.

  1. doubly-wrapped event commands
         {"code":101, "parameters":{"code":101, "parameters":["",0,1,2]}}
     Game_Interpreter reads `command.parameters` as an array, so every index was
     undefined.  Result for the 677 affected Show Text commands: no face image,
     `setBackgroundType(undefined)` -> opacity 0, and
     `this.y = this._positionType * (boxHeight - height) / 2` -> NaN.
     59 043 other 101 commands were written correctly, which is why the defect
     stayed hidden.

  2. an unterminated string literal
         w.description = "Feed me. Feed me. Feed me. Feed me.\\n + 
     The other two variants of the same weapon in the same file read
     `... returning \\n" + `, so the missing quote is unambiguous.  Broken, the
     translated JS is a SyntaxError, which kills the whole 355 block - the
     weapon-upgrade event did nothing at all.

  3. unbalanced script payloads
     A Ruby Script condition that is missing a bracket.  `MonlineRuby.repairBalance`
     covers the expression paths at run time, but a 355 *statement* block has no
     such fallback, so the data is normalised at build time instead.

  4. (superseded) An earlier revision of this script also stripped `)` from
     `X.abs) <= n`, mistaking a needed paren for a typo.  The VX Ace master
     proves 15 of those are balanced groups; `revert_abs_paren.py` restored
     them.  The other 3 (Map095) really were missing a bracket, and the balance
     guard below (3) covers them, so no rule for it remains here.

Usage:  python fix_data_defects.py            # dry run
        python fix_data_defects.py --apply
"""
import glob
import io
import json
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.abspath(__file__))
APPLY = '--apply' in sys.argv
PROJECTS = ['Monline-MV', 'mv_project']

RAW_RULES = [
    ('Feed me.' + '\\\\' + 'n + "',
     'Feed me.' + '\\\\' + 'n\\" + "', 'unterminated string literal'),
]


def commands(obj):
    if isinstance(obj, dict):
        if 'code' in obj and isinstance(obj.get('parameters'), (dict, list)):
            yield obj
        for v in obj.values():
            yield from commands(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from commands(v)


def unwrap(cmd):
    p = cmd.get('parameters')
    if not isinstance(p, dict) or not isinstance(p.get('parameters'), (list, dict)):
        return False
    cmd['code'] = p.get('code', cmd.get('code'))
    if 'indent' in p:
        cmd['indent'] = p['indent']
    cmd['parameters'] = p['parameters']
    return True


def payload_slots(cmd):
    """Yield (container, key) for a *single-expression* Ruby payload.

    Only Script conditions (111) and Script control-variables (122) qualify:
    both are complete expressions on one line.  A 355/655 statement block cannot
    be judged line by line - calls such as `nel_textpop(` are legally split
    across continuation commands - so those are handled as joined blocks by
    `check_blocks`.
    """
    p = cmd.get('parameters')
    if not isinstance(p, list) or not p:
        return
    code = cmd.get('code')
    if code == 111 and len(p) > 1 and p[0] == 12 and isinstance(p[1], str):
        yield p, 1
    elif code == 122 and len(p) > 4 and p[3] == 4 and isinstance(p[4], str):
        yield p, 4


def join_blocks(blob):
    """Yield the joined source of every 355 + 655 continuation block."""
    out = []

    def rec(o):
        if isinstance(o, dict):
            lst = o.get('list')
            if isinstance(lst, list):
                i = 0
                while i < len(lst):
                    c = lst[i]
                    if isinstance(c, dict) and c.get('code') in (355, 655):
                        src = ''
                        while i < len(lst) and isinstance(lst[i], dict) \
                                and lst[i].get('code') in (355, 655):
                            pp = lst[i].get('parameters') or ['']
                            src += str(pp[0] if pp else '') + '\n'
                            i += 1
                        out.append(src)
                        continue
                    i += 1
            for v in o.values():
                rec(v)
        elif isinstance(o, list):
            for v in o:
                rec(v)

    rec(blob)
    return out


def rebalance(src):
    """Drop unmatched closers, append unmatched openers.  '' when balanced."""
    out = []
    stack = []
    quote = None
    i = 0
    dropped = 0
    n = len(src)
    while i < n:
        ch = src[i]
        if quote:
            out.append(ch)
            if ch == '\\':
                i += 1
                if i < n:
                    out.append(src[i])
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in '"\'':
            quote = ch
            out.append(ch)
            i += 1
            continue
        if ch in '([{':
            stack.append(ch)
            out.append(ch)
            i += 1
            continue
        if ch in ')]}':
            if stack:
                stack.pop()
                out.append(ch)
            else:
                dropped += 1
            i += 1
            continue
        out.append(ch)
        i += 1
    closed = {'(': ')', '[': ']', '{': '}'}
    appended = ''.join(closed[c] for c in reversed(stack))
    if not dropped and not appended:
        return ''
    return ''.join(out) + appended


grand = Counter()
samples = []
blocks_bad = []
for proj in PROJECTS:
    data_dir = os.path.join(ROOT, proj, 'data')
    if not os.path.isdir(data_dir):
        print('SKIP missing %s' % data_dir)
        continue
    print('=== %s ===' % proj)
    counts = Counter()
    for path in sorted(glob.glob(os.path.join(data_dir, '*.json'))):
        with io.open(path, 'r', encoding='utf-8') as fh:
            text = fh.read()
        new_text = text
        for broken, fixed, label in RAW_RULES:
            n = new_text.count(broken)
            if n:
                counts[label] += n
                new_text = new_text.replace(broken, fixed)

        blob = json.loads(new_text)
        cmds = list(commands(blob))
        counts['doubly-wrapped command'] += sum(1 for c in cmds if unwrap(c))

        changed_bal = 0
        for cmd in cmds:
            for container, key in payload_slots(cmd):
                fixed = rebalance(container[key])
                if fixed:
                    changed_bal += 1
                    if len(samples) < 12:
                        samples.append('%s  code=%s\n      was: %r\n      now: %r'
                                       % (os.path.basename(path), cmd.get('code'),
                                          container[key][:110], fixed[:110]))
                    container[key] = fixed
        counts['unbalanced expression (111/122)'] += changed_bal

        # 355/655 blocks: report only - a block is assembled at run time, so a
        # defect here has to be looked at rather than guessed at.
        for block in join_blocks(blob):
            if rebalance(block):
                counts['unbalanced 355/655 block'] += 1
                if len(blocks_bad) < 8:
                    blocks_bad.append('%s\n      %r'
                                      % (os.path.basename(path), block[:150]))

        if APPLY and (new_text != text or changed_bal):
            with io.open(path, 'w', encoding='utf-8', newline='') as fh:
                fh.write(json.dumps(blob, ensure_ascii=False))
    for label in ('doubly-wrapped command', 'unterminated string literal',
                  'unbalanced expression (111/122)', 'unbalanced 355/655 block'):
        print('  %-32s %d' % (label, counts[label]))
        grand[label] += counts[label]
    print('  %s' % ('APPLIED' if APPLY else 'dry run only'))
    print('')

if samples:
    print('unbalanced expressions touched:')
    for s in samples:
        print('    ' + s)
if blocks_bad:
    print('unbalanced 355/655 blocks (report only, not modified):')
    for s in blocks_bad:
        print('    ' + s)
print('TOTAL: %s' % dict(grand))
