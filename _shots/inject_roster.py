# -*- coding: utf-8 -*-
"""Inline the generated roster into MonlineBadEnds.js.

MV has no way to load a JSON file synchronously at boot, so the roster is
baked into the plugin as a literal.  Kept as [[code, switch, name, trig], ...]
- one line per ending - so the file stays diffable.
"""
import json, io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLUG = os.path.abspath(os.path.join(HERE, '..', 'Monline-MV', 'js', 'plugins',
                                    'MonlineBadEnds.js'))
SRC = os.path.join(os.path.dirname(PLUG), 'MonlineBadEnds.roster.json')


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    rows = []
    for e in d['endings']:
        rows.append('        %s' % json.dumps(
            [e['code'], e['sw'], e['name'], e['trig']],
            ensure_ascii=False, separators=(',', ':')))
    literal = '[\n' + ',\n'.join(rows) + '\n    ]'

    txt = io.open(PLUG, encoding='utf-8').read()
    if '__ROSTER__' not in txt:
        # idempotent rebuild: replace the previous literal instead
        a = txt.index('var ROSTER = [')
        b = txt.index('\n    ];', a) + len('\n    ];')
        txt = txt[:a] + 'var ROSTER = ' + literal + ';' + txt[b:]
    else:
        txt = txt.replace('__ROSTER__', literal)
    io.open(PLUG, 'w', encoding='utf-8').write(txt)
    sys.stdout.write('injected %d endings into %s (%d bytes)\n'
                     % (len(rows), os.path.basename(PLUG), len(txt)))


main()
