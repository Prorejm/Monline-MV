#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Regenerate the TOPICS table of MonlineEncyclopedia.js straight out of the
VX Ace source (0146.rb, Nova::Encyclopedia::Topics).

The first pass that produced this table dropped the `:image?` flag, which
matters: 0146.rb:1340 `method_topics_sprites` only builds a picture when the
entry says so, and the 23 "States" entries all say false (they show an icon
instead).  This generator keeps the flag so the port can honour it.
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUBY = os.path.join(ROOT, '_vxace_scripts', '0146.rb')
PLUGINS = [os.path.join(ROOT, p, 'js', 'plugins', 'MonlineEncyclopedia.js')
           for p in ('Monline-MV', 'mv_project')]

src = io.open(RUBY, encoding='utf-8').read()

# ---- isolate the Topics hash ------------------------------------------------
start = src.index('    Topics = {')
end = src.index('    } # <= N', start)
region = src[start:end]

entry_re = re.compile(r'"((?:[^"\\]|\\.)*)"\s*=>\s*\{')
entries = []
for m in entry_re.finditer(region):
    # the entry body runs to the next line that is exactly "},"
    tail = region[m.end():]
    close = re.search(r'\n\s*\},', tail)
    body = tail[:close.start()] if close else tail
    def field(name, default=None):
        fm = re.search(r':%s\s*=>\s*(.*?)(?:,\s*\n|\n|$)' % re.escape(name),
                       body, re.S)
        if not fm:
            return default
        v = fm.group(1).strip()
        return v
    def strfield(name, default=''):
        v = field(name)
        if v is None:
            return default
        if v.startswith("'") and v.endswith("'"):
            return v[1:-1]
        if v.startswith('"') and v.endswith('"'):
            return v[1:-1]
        return v
    entries.append({
        'name': m.group(1),
        'switch': int(field('switch_id', '0')),
        'category': strfield('category').lstrip(':'),
        'info': strfield('info'),
        'imageShown': field('image?', 'false').strip() == 'true',
        'folder': strfield('folder'),
        'image': strfield('image_name'),
        'icon': int(field('icon_index', '0').rstrip(',')),
    })

if len(entries) != 74:
    sys.exit('parsed %d topics, expected 74' % len(entries))

# ---- emit -------------------------------------------------------------------
def js_escape(s):
    return (s.replace('\\', '\\\\').replace('"', '\\"')
             .replace('\n', '\\n').replace('\r', ''))

lines = ['    var TOPICS = [']
for i, e in enumerate(entries):
    head = ('        { name: "%s", category: "%s", switch: %d, imageShown: %s,'
            % (js_escape(e['name']), e['category'], e['switch'],
               'true' if e['imageShown'] else 'false'))
    info = ' info: "%s",' % js_escape(e['info'])
    tail = ('\n          folder: "%s", image: "%s", icon: %d }%s'
            % (e['folder'], js_escape(e['image']), e['icon'],
               ',' if i < len(entries) - 1 else ''))
    lines.append(head + info + tail)
lines.append('    ];')
block = '\n'.join(lines) + '\n'

for p in PLUGINS:
    js = io.open(p, encoding='utf-8').read()
    a = js.index('    var TOPICS = [')
    b = js.index('\n    ];\n', a) + len('\n    ];\n')
    js = js[:a] + block + js[b:]
    io.open(p, 'w', encoding='utf-8', newline='\n').write(js)
    print('rewrote %s' % p)

json.dump(entries, io.open(os.path.join(ROOT, '_shots', '_pedia.json'), 'w',
                           encoding='utf-8'), ensure_ascii=False, indent=1)
print('topics: %d   with picture: %d' %
      (len(entries), sum(1 for e in entries if e['imageShown'])))
