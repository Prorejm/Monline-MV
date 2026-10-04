# -*- coding: utf-8 -*-
"""Build the canonical Bad End roster.

Inputs
  * System.json switches 901-1206 named 'ACH: End <code>'  -> canonical switch
  * endings_game.json  (banner text mined out of the events) -> in-game names
  * wiki_page.txt                                            -> trigger hints

Output
  * Monline-MV/js/plugins/MonlineBadEnds.roster.json  (loaded by the plugin)
  * a report of every event whose post-banner switch disagrees with the
    canonical one (the shipped game has at least one: C31 writes 906 = A6).
"""
import json, glob, os, re, collections, io, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', 'Monline-MV', 'data')
DST = os.path.join(HERE, '..', 'Monline-MV', 'js', 'plugins')

ZONE_NAME = {
    'A': 'Forest Zone', 'B': 'Coastal Zone', 'C': 'Demon Zone',
    'D': 'Desolate Zone', 'E': 'Desert Zone', 'F': 'Mythic Zone'
}


def load_switches():
    s = json.load(open(os.path.join(ROOT, 'System.json'), encoding='utf-8'))['switches']
    by_code = {}
    for i, n in enumerate(s):
        if not n:
            continue
        m = re.match(r'^ACH:\s*End\s*([A-F])\s*(\d+)\s*$', n.strip())
        if m:
            by_code['%s%d' % (m.group(1), int(m.group(2)))] = i
    return s, by_code


def load_wiki():
    """code -> (name, trigger)"""
    txt = io.open(os.path.join(HERE, 'wiki_page.txt'), encoding='utf-8').read()
    out = {}
    for line in txt.split('\n'):
        m = re.match(r'^Ending\s*([A-F])\s*(\d+)\s*[-–]\s*([^:]+?)\s*:\s*(.+)$', line.strip())
        if m:
            code = '%s%d' % (m.group(1), int(m.group(2)))
            out[code] = (m.group(3).strip(), m.group(4).strip())
        else:
            m2 = re.match(r'^Ending\s*([A-F])\s*(\d+)\s*[-–]\s*(.+)$', line.strip())
            if m2:
                code = '%s%d' % (m2.group(1), int(m2.group(2)))
                out.setdefault(code, (m2.group(3).strip(), None))
    return out


def main():
    switches, by_code = load_switches()
    game = json.load(open(os.path.join(HERE, 'endings_game.json'), encoding='utf-8'))
    wiki = load_wiki()

    # ---- canonical switch per code -------------------------------------
    # Prefer the switch literally named for the code.  C31 has no such switch
    # in the shipped data (the game writes 906 = A6 by mistake); the only
    # unassigned switch in the 901-1206 block is 941, labelled 'ACH: End 35',
    # which sits exactly where C31 belongs in the ascending C run.  Claim it.
    assigned = set(by_code.values())
    orphan = [i for i in range(901, 1207) if i not in assigned]
    canon = dict(by_code)
    notes = []
    for code in sorted(game, key=lambda c: (c[0], int(c[1:]))):
        if code in canon:
            continue
        if orphan:
            sid = orphan.pop(0)
            canon[code] = sid
            notes.append('%s had no switch; claimed orphan %d (%r)' % (code, sid, switches[sid]))

    # ---- disagreements with what the events actually write --------------
    mismatch = []
    for code in sorted(game, key=lambda c: (c[0], int(c[1:]))):
        want = canon[code]
        got = game[code]['sw']
        if got != want:
            mismatch.append((code, got, want, switches[got] if got else '', switches[want]))

    # ---- roster ---------------------------------------------------------
    roster = []
    for code in sorted(game, key=lambda c: (c[0], int(c[1:]))):
        gname = game[code]['name']
        gname = re.sub(r'\\fi\d+$', '', gname).strip()
        gname = gname.replace('\\n', ' ').replace('\\c', '').strip()
        wname, wtrig = wiki.get(code, (None, None))
        roster.append({
            'code': code,
            'zone': code[0],
            'sw': canon[code],
            'name': gname,
            'wiki': wname if wname and wname.lower() != gname.lower() else '',
            'trig': wtrig or ''
        })

    dst = os.path.join(DST, 'MonlineBadEnds.roster.json')
    payload = {
        'zones': ZONE_NAME,
        'endings': roster
    }
    with io.open(dst, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    sys.stdout.write('canonical switches: %d\n' % len(canon))
    sys.stdout.write('orphans claimed: %s\n' % notes)
    sys.stdout.write('roster entries: %d -> %s\n' % (len(roster), dst))
    sys.stdout.write('mismatches (event writes X, should be Y): %d\n' % len(mismatch))
    for code, got, want, gn, wn in mismatch:
        sys.stdout.write('   %-4s %-34s writes %s %-20s should be %s %s\n'
                         % (code, game[code]['name'][:34], got, gn, want, wn))
    with io.open(os.path.join(HERE, 'roster_mismatch.json'), 'w', encoding='utf-8') as fh:
        json.dump([{'code': c, 'got': g, 'want': w} for c, g, w, _, _ in mismatch],
                  fh, ensure_ascii=False, indent=1)


main()
