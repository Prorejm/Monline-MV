#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Scan converted MV maps for the real call shapes of unported Ruby helper names.

Reports, for each pending name, the distinct argument shapes actually used in
event Script commands (code 355) so a port can match the real signature.
"""
import json
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'Monline-MV', 'data')

NAMES = [
    'setSelfSwitch', 'isSelfSwitch?', 'setAllSelf',
    'global_save', 'global_load', 'log_window', 'combine_choices',
    'equip_armor_by_etype', 'remove_equip',
    'zoom_event_sprite', 'zoom_player_sprite', 'weather', 'set_symbols',
    'chain_commands', 'Set_Coord', 'Clear_Coord', 'snooze_bar', 'remove_bar',
    'get_shop', 'price_good', 'blinds', 'get_hp_percent', 'TargetQTE',
    'MashQTE', 'TriggerQTE', 'TimingQTE', 'reflect_sprite', 'gain_armor',
    'char_effects', 'lock_pick', 'picture_monopoly', 'icon_scroll',
]

NORM_NUM = re.compile(r'-?\d+(\.\d+)?')
NORM_STR = re.compile(r'"[^"]*"|\'[^\']*\'')


def norm(line):
    """Collapse literals so shapes group together."""
    s = NORM_STR.sub('S', line)
    s = NORM_NUM.sub('N', s)
    return s.strip()


def main():
    counts = collections.Counter()
    shapes = collections.defaultdict(collections.Counter)
    files = sorted(f for f in os.listdir(DATA)
                   if f.startswith('Map') and f.endswith('.json'))
    for fn in files:
        with open(os.path.join(DATA, fn), encoding='utf-8') as fh:
            try:
                data = json.load(fh)
            except Exception:
                continue
        stack = [data]
        while stack:
            o = stack.pop()
            if isinstance(o, dict):
                if o.get('code') == 355:
                    params = o.get('parameters') or ['']
                    text = str(params[0]) if params else ''
                    for line in text.split('\n'):
                        for name in NAMES:
                            if name in line:
                                counts[name] += 1
                                shapes[name][norm(line)] += 1
                stack.extend(o.values())
            elif isinstance(o, list):
                stack.extend(o)

    order = sorted(NAMES, key=lambda n: -counts[n])
    print('=' * 78)
    print('real call shapes in Map*.json (code 355)')
    print('=' * 78)
    for name in order:
        if not counts[name]:
            continue
        print('\n### %s   (%d refs)' % (name, counts[name]))
        for shape, c in shapes[name].most_common(8):
            print('   %5d  %s' % (c, shape))
    print('\n-- names with zero event refs --')
    for name in order:
        if not counts[name]:
            print('   %s' % name)


if __name__ == '__main__':
    main()
