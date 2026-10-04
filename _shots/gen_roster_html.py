# -*- coding: utf-8 -*-
"""Render the Bad End roster as a browsable HTML reference."""
import json, io, os, sys, html, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'Monline-MV', 'js', 'plugins',
                   'MonlineBadEnds.roster.json')
DST = os.path.join(HERE, '..', 'BadEnd_Roster.html')

ZONE_NOTE = {
    'A': 'Forest', 'B': 'Coastal', 'C': 'Demon',
    'D': 'Desolate', 'E': 'Desert', 'F': 'Mythic'
}


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    endings = d['endings']
    sw = json.load(open(os.path.join(HERE, '..', 'Monline-MV', 'data',
                                     'System.json'), encoding='utf-8'))['switches']
    by = collections.defaultdict(list)
    for e in endings:
        by[e['zone']].append(e)

    total = len(endings)
    out = []
    out.append('<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">')
    out.append('<title>Monline Bad End roster</title><style>')
    out.append('''
body{font:14px/1.6 "Segoe UI",system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1c1e21}
header{background:#1f2430;color:#fff;padding:22px 28px}
header h1{margin:0;font-size:20px}
header p{margin:6px 0 0;opacity:.75;font-size:13px}
.stats{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px}
.stat{background:#2b3140;border-radius:6px;padding:8px 14px;font-size:12px}
.stat b{display:block;font-size:18px;margin-top:2px}
main{padding:20px 28px 60px}
h2{font-size:16px;margin:26px 0 8px;padding-bottom:6px;border-bottom:2px solid #d8dce3}
h2 span{font-weight:400;color:#6b7280;font-size:13px;margin-left:8px}
table{border-collapse:collapse;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
th{background:#eef1f5;text-align:left;font-weight:600;font-size:12px;
   padding:7px 10px;border-bottom:1px solid #dde1e7}
td{padding:6px 10px;border-bottom:1px solid #eef0f3;vertical-align:top}
td.code{font-weight:600;white-space:nowrap}
td.sw{color:#6b7280;font-size:12px;white-space:nowrap}
tr:nth-child(even) td{background:#fafbfc}
.note{margin:0 0 18px;padding:12px 16px;background:#fff8e1;
      border-left:4px solid #f0ad4e;font-size:13px}
.note code{background:#f1f3f5;padding:1px 5px;border-radius:3px}
''')
    out.append('</style></head><body>')
    out.append('<header><h1>Monline &mdash; Bad End roster</h1>')
    out.append('<p>Every bad end the shipped game actually contains, taken from '
               'the ending banner each one prints, with the achievement switch '
               'that records it.</p>')
    out.append('<div class="stats">')
    out.append('<div class="stat">endings<b>%d</b></div>' % total)
    for z in sorted(by):
        out.append('<div class="stat">%s zone<b>%d</b></div>'
                   % (ZONE_NOTE.get(z, z), len(by[z])))
    out.append('<div class="stat">switches<b>901&ndash;1206</b></div>')
    out.append('</div></header><main>')
    out.append('<p class="note">Three endings had been copy-pasted without their '
               'switch id being updated, so C31, F24 and one of F92\'s two events '
               'all lit up switch <code>906</code> (A6) and could never be '
               'collected separately. Those eight commands now write their own '
               'switch &mdash; <code>941</code>, <code>1138</code>, '
               '<code>1206</code> &mdash; and switch 941, orphaned under the '
               'mangled name <code>ACH: End 35</code>, is renamed '
               '<code>ACH: End C31</code>.</p>')

    for z in sorted(by):
        rows = by[z]
        n = len(rows)
        out.append('<h2>%s Zone <span>%s &middot; %d endings</span></h2>'
                   % (ZONE_NOTE.get(z, z), z, n))
        out.append('<table><thead><tr><th>Code</th><th>Name</th>'
                   '<th>How it happens</th><th>Switch</th></tr></thead><tbody>')
        for e in rows:
            out.append('<tr><td class="code">%s</td><td>%s</td><td>%s</td>'
                       '<td class="sw">%d<br>%s</td></tr>'
                       % (html.escape(e['code']), html.escape(e['name']),
                          html.escape(e['trig'] or '&mdash;'),
                          e['sw'], html.escape(sw[e['sw']] if e['sw'] < len(sw) else '')))
        out.append('</tbody></table>')
    out.append('</main></body></html>')

    txt = '\n'.join(out)
    io.open(DST, 'w', encoding='utf-8').write(txt)
    sys.stdout.write('wrote %s (%d endings, %d bytes)\n' % (DST, total, len(txt)))


main()
