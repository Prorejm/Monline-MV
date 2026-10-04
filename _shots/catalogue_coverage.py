"""Which of 0147.rb's methods has the MV port actually implemented?

Extracts every `def` in the Ruby (grouped by class) and looks for the
camelCase equivalent in MonlineMonsterCatalogue.js.  Anything left over is a
concrete, named gap rather than a vague "it feels incomplete".
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUBY = os.path.join(ROOT, '_vxace_scripts', '0147.rb')
JS = os.path.join(ROOT, 'Monline-MV', 'js', 'plugins', 'MonlineMonsterCatalogue.js')

# names that only exist inside the Ruby's own idioms
SKIP = {'initialize'}


def camel(name):
    parts = name.split('_')
    return parts[0] + ''.join(p.title() for p in parts[1:])


def main():
    text = io.open(RUBY, encoding='utf-8').read()
    js = io.open(JS, encoding='utf-8').read()
    jsl = js.lower()

    cur = '(top)'
    rows = []
    for line in text.splitlines():
        m = re.match(r'\s*(class|module)\s+([A-Za-z_][A-Za-z0-9_]*)', line)
        if m:
            cur = m.group(2)
            continue
        m = re.match(r'\s*def\s+([A-Za-z_][A-Za-z0-9_?!]*)', line)
        if m:
            name = m.group(1).rstrip('?!')
            if name in SKIP:
                continue
            rows.append((cur, name))

    missing = []
    for cls, name in rows:
        c = camel(name)
        # a method is present if the JS mentions either the camelCase name or
        # the snake_case original
        if c.lower() in jsl or name in jsl:
            continue
        missing.append((cls, name, c))

    print('methods in 0147.rb: %d' % len(rows))
    print('no counterpart in the port: %d' % len(missing))
    by = {}
    for cls, name, c in missing:
        by.setdefault(cls, []).append(name + ' -> ' + c)
    for cls in sorted(by):
        print('\n  ' + cls + ' (%d)' % len(by[cls]))
        for x in by[cls]:
            print('    - ' + x)
    return 0


if __name__ == '__main__':
    sys.exit(main())
