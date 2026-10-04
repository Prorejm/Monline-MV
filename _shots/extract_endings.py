# -*- coding: utf-8 -*-
"""Extract the authoritative Bad End roster out of the shipped MV data.

Monline prints a literal banner line at the end of every bad end, e.g.

    \\{\\{\\{ Ending C31 - Once Bitten

followed (within a few commands) by the Control Switches command that turns
the matching `ACH: End C31` switch ON.  Scanning for that banner gives us the
game's own code -> name -> switch mapping, which beats the wiki (the wiki's
own numbering disagrees with the data in places, e.g. C31 sets switch 906
while switch 906 is *named* ACH: End A7).
"""
import json, glob, os, re, collections, io, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', 'Monline-MV', 'data')
RX = re.compile(r'Ending\s*([A-F])\s*(\d+)\s*[-–]\s*(.+)')
WINDOW = 12

found = {}          # code -> {'name':..., 'sw': set(), 'where': []}
orphan_sw = collections.defaultdict(list)


def text_of(c):
    code = c.get('code')
    p = c.get('parameters') or []
    if code == 101 and len(p) > 1 and isinstance(p[1], str):
        return p[1]
    if code == 401 and p and isinstance(p[0], str):
        return p[0]
    if code == 355 or code == 111 or code == 655:
        s = json.dumps(p, ensure_ascii=False)
        return s
    return None


def sw_on(c):
    """Return list of switch ids turned ON by this command."""
    if c.get('code') != 121:
        return []
    p = c.get('parameters') or []
    if len(p) < 3 or p[2] != 0 or p[0] > p[1]:
        return []
    return list(range(p[0], p[1] + 1))


def walk(cmds, src, name):
    for i, c in enumerate(cmds or []):
        t = text_of(c)
        if not t or 'Ending' not in t:
            continue
        m = RX.search(t)
        if not m:
            continue
        zone, num, title = m.group(1), int(m.group(2)), m.group(3).strip()
        title = title.replace('\\{', '').replace('\\}', '').strip()
        title = re.sub(r'\s+', ' ', title)
        code = '%s%d' % (zone, num)
        rec = found.setdefault(code, {'name': title, 'sw': collections.Counter(), 'where': []})
        if len(rec['where']) < 4:
            rec['where'].append('%s|%s' % (src, name))
        # nearest switch turned ON within WINDOW commands, before or after
        for j in range(max(0, i - WINDOW), min(len(cmds), i + WINDOW + 1)):
            for sid in sw_on(cmds[j]):
                if sid >= 701:
                    rec['sw'][sid] += 1


def as_list(x):
    return [e for e in x if isinstance(e, dict)] if isinstance(x, list) else []


def main():
    ce = json.load(open(os.path.join(ROOT, 'CommonEvents.json'), encoding='utf-8'))
    for e in as_list(ce):
        walk(e.get('list'), 'CE%s' % e.get('id'), e.get('name') or '')

    nmap = 0
    for f in sorted(glob.glob(os.path.join(ROOT, 'Map*.json'))):
        base = os.path.basename(f)[:-5]
        if not re.match(r'^Map\d+$', base):
            continue
        d = json.load(open(f, encoding='utf-8'))
        for e in as_list(d.get('events')):
            for pg in (e.get('pages') or []):
                if isinstance(pg, dict):
                    walk(pg.get('list'), base, e.get('name') or '')
        nmap += 1

    tr = json.load(open(os.path.join(ROOT, 'Troops.json'), encoding='utf-8'))
    for t in as_list(tr):
        for pg in (t.get('pages') or []):
            if isinstance(pg, dict):
                walk(pg.get('list'), 'Troop%s' % t.get('id'), t.get('name') or '')

    out = {}
    for code in sorted(found, key=lambda c: (c[0], int(c[1:]))):
        rec = found[code]
        sws = rec['sw'].most_common()
        out[code] = {
            'name': rec['name'],
            'sw': sws[0][0] if sws else None,
            'swAll': [s for s, _ in sws],
            'where': rec['where']
        }
    sys.stdout.write('maps=%d\n' % nmap)
    sys.stdout.write('distinct ending banners found: %d\n' % len(out))
    zones = collections.Counter(c[0] for c in out)
    sys.stdout.write('per zone: %s\n' % dict(zones))
    nosw = [c for c in out if out[c]['sw'] is None]
    sys.stdout.write('banners with no switch: %d %s\n' % (len(nosw), nosw[:30]))
    dup = [(c, out[c]['swAll']) for c in out if len(out[c]['swAll']) > 1]
    sys.stdout.write('ambiguous switch: %d\n' % len(dup))

    dst = os.path.join(os.path.dirname(__file__), 'endings_game.json')
    with io.open(dst, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    sys.stdout.write('wrote %s\n' % dst)


main()
