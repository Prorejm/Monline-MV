"""Verify (and if asked, regenerate) the 0147.rb beastiarycheck table.

The Monster Catalogue ships a Monline-specific `beastiarycheck`: 78 switches,
each of which reveals one or more monsters in the bestiary.  It is data, not
logic, so it is checked mechanically against the Ruby instead of by eye.

Usage:
    python _shots/gen_bestiary.py            # verify only
    python _shots/gen_bestiary.py --write    # rewrite the table in the plugin
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUBY = os.path.join(ROOT, '_vxace_scripts', '0147.rb')
JS = os.path.join(ROOT, 'Monline-MV', 'js', 'plugins', 'MonlineMonsterCatalogue.js')

# `if $game_switches[101]` ... `mamc_encounter_monster(1)` ... `end`
HEAD = re.compile(r'if\s+\$game_switches\[(\d+)\]')
CALL = re.compile(r'mamc_encounter_monster\((\d+)\)')


def from_ruby(path):
    text = io.open(path, encoding='utf-8').read()
    start = text.index('def beastiarycheck')
    end = text.index('\n  end', start)
    body = text[start:end]
    # keep source order: Python dicts preserve insertion order
    out = {}
    cur = None
    for line in body.splitlines():
        m = HEAD.search(line)
        if m:
            cur = int(m.group(1))
            out.setdefault(cur, [])
            continue
        m = CALL.search(line)
        if m and cur is not None:
            out[cur].append(int(m.group(1)))
    return out


def from_js(path):
    text = io.open(path, encoding='utf-8').read()
    start = text.index('var SWITCH_REVEALS = {')
    end = text.index('};', start)
    body = text[start + len('var SWITCH_REVEALS = '):end + 1]
    body = re.sub(r'//[^\n]*', '', body)
    body = re.sub(r'(\d+):', r'"\1":', body)
    raw = json.loads(body)
    return dict((int(k), v) for k, v in raw.items())


def render(table):
    lines = []
    for k in sorted(table):
        lines.append('        %d: [%s]' % (k, ', '.join(str(x) for x in table[k])))
    return '\n'.join(lines)


def main(argv):
    rb = from_ruby(RUBY)
    js = from_js(JS)
    n_rb = sum(len(v) for v in rb.values())
    n_js = sum(len(v) for v in js.values())
    print('ruby: %d switches, %d monster ids' % (len(rb), n_rb))
    print('js  : %d switches, %d monster ids' % (len(js), n_js))
    bad = 0
    for k in sorted(set(rb) | set(js)):
        a, b = rb.get(k), js.get(k)
        if a != b:
            bad += 1
            print('  MISMATCH switch %d: ruby=%s js=%s' % (k, a, b))
    print('mismatches: %d' % bad)
    if '--write' in argv:
        text = io.open(JS, encoding='utf-8').read()
        start = text.index('var SWITCH_REVEALS = {') + len('var SWITCH_REVEALS = ')
        end = text.index('};', start) + 1
        text = text[:start] + '{\n' + render(rb) + '\n    ' + text[end:]
        io.open(JS, 'w', encoding='utf-8', newline='\n').write(text)
        print('rewrote SWITCH_REVEALS from the Ruby')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
