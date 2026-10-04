# -*- coding: utf-8 -*-
"""修复事件页字段名: VX Ace 用 @graphic, MV 用 image。
MV 的 Game_Event.setupPageSettings() 读取 page.image.tileId，若为 graphic 则
page.image 未定义 -> TypeError: Cannot read properties of undefined (reading 'tileId')。
"""
import json
import os
import glob

DIRS = ["Monline-MV/data", "mv_project/data"]


def fix_map(m):
    if not isinstance(m, dict):
        return 0
    n = 0
    for ev in (m.get('events') or []):
        if not isinstance(ev, dict):
            continue
        for pg in (ev.get('pages') or []):
            if isinstance(pg, dict) and 'graphic' in pg:
                pg['image'] = pg.pop('graphic')
                n += 1
    return n


def main():
    for d in DIRS:
        if not os.path.isdir(d):
            print("skip:", d); continue
        maps = 0; pages = 0
        for f in glob.glob(os.path.join(d, "Map*.json")):
            if os.path.basename(f) == "MapInfos.json":
                continue
            m = json.load(open(f, encoding='utf-8'))
            pages += fix_map(m)
            json.dump(m, open(f, 'w', encoding='utf-8'), ensure_ascii=False)
            maps += 1
        print("fixed %-20s maps=%d pages=%d" % (d, maps, pages))


if __name__ == "__main__":
    main()
