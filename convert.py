# -*- coding: utf-8 -*-
"""VX Ace (.rvdata2) -> RPG Maker MV JSON 转换器。
依赖: fixreader.py (RGSS 解析) + rubymarshal
输出: mv_project/data/*.json
约定:
  * 瓦片 ID 原样保留（源游戏使用自定义超大瓦片空间，与 MTool 导出一致）
  * 地图 Table 4 层(z=0,1,2,3) -> MV 3 层(z=0,1,2 下/中/上)，丢弃 z=3 区域层
  * 事件指令 code/parameters/indent 两引擎通用，100% 保留
  * VX Ace @condition -> MV conditions(camelCase)
"""
import json
import os
import glob
import struct
from fixreader import load_fix, table_values, FixInt
from rubymarshal.classes import Symbol as SymbolFallback
from rubymarshal.classes import RubyString


SRC = "extracted/Data"
OUT = "mv_project/data"


def camel(s) -> str:
    s = str(s).lstrip('@')
    if '_' not in s:
        return s
    parts = s.split('_')
    out = parts[0] + ''.join(p.capitalize() for p in parts[1:])
    return out or s or '_'


def table_to_nested(tv):
    """把 VX Ace Table 的扁平值还原成嵌套列表(按 dim=1/2/3)。"""
    dim, xs, ys, zs = tv['dim'], tv['xs'], tv['ys'], tv['zs']
    vals = tv['values']
    if dim == 1:
        return vals[:xs]
    if dim == 2:
        return [vals[r * xs:(r + 1) * xs] for r in range(ys)]
    if dim == 3:
        plane = xs * ys
        out = []
        for z in range(zs):
            p = vals[z * plane:(z + 1) * plane]
            out.append([p[r * xs:(r + 1) * xs] for r in range(ys)])
        return out
    return list(vals)


def to_mv(v):
    """递归把 RGSS 对象转成 MV 友好结构(字符串键 camelCase / 列表 / 标量)。"""
    if v is None:
        return None
    if isinstance(v, FixInt):
        return int(v)
    if isinstance(v, RubyString):         # 字符串(可能带 :E 编码 ivar)
        return v.text
    # UserDef(Table / Tone / Color 等) -> 按其 RGSS 类还原
    if hasattr(v, '_private_data') and v._private_data:
        rc = getattr(v, 'ruby_class_name', None)
        if rc == 'Table':
            tv = table_values(v)
            if tv is not None:
                return table_to_nested(tv)
        elif rc in ('Tone', 'Color'):
            d = v._private_data
            if len(d) >= 32:
                vals = struct.unpack('<4d', d[:32])
                return [int(x) if float(x).is_integer() else x for x in vals]
        # 其它 UserDef: 退回 attributes(通常为空 -> {})
    if hasattr(v, 'attributes'):          # RubyObject / UserDef
        out = {}
        for k, val in v.attributes.items():
            key = k.name if hasattr(k, 'name') else str(k)
            out[camel(key)] = to_mv(val)
        return out
    if isinstance(v, dict):
        return {camel(k): to_mv(val) for k, val in v.items()}
    if isinstance(v, (list, tuple)):
        return [to_mv(x) for x in v]
    if isinstance(v, bytes):
        try:
            return v.decode('utf-8', 'replace')
        except Exception:
            return v.decode('latin-1', 'replace')
    if hasattr(v, 'name'):                # Symbol
        return v.name
    return v


# ---------------------------------------------------------------------------
# 地图
# ---------------------------------------------------------------------------
def conv_map_file(path, out_path):
    o = load_fix(open(path, 'rb').read())
    a = o.attributes
    W = int(a.get('@width', 0))
    H = int(a.get('@height', 0))
    tv = table_values(a.get('@data')) if a.get('@data') else None
    if tv is None:
        data = [0] * (W * H * 3)
    else:
        xs, ys, zs = tv['xs'], tv['ys'], tv['zs']
        vals = tv['values']
        data = [0] * (W * H * 3)
        for z in range(3):                       # 丢弃 z=3 区域层
            for y in range(H):
                for x in range(W):
                    if x < xs and y < ys and z < zs:
                        v = vals[x + y * xs + z * xs * ys]
                    else:
                        v = 0
                    data[x + y * W + z * W * H] = int(v)

    # 事件 -> MV 用数组(下标=事件 id, 下标 0 为 null)
    raw_events = a.get('@events')
    events = [None]
    if isinstance(raw_events, dict):
        for eid, ev in raw_events.items():
            if ev is None:
                continue
            eid = int(eid)
            while len(events) <= eid:
                events.append(None)
            events[eid] = conv_event(ev)
    elif isinstance(raw_events, list):
        for ev in raw_events:
            if ev is None:
                continue
            eid = int(ev.attributes.get('@id', 0))
            while len(events) <= eid:
                events.append(None)
            events[eid] = conv_event(ev)

    # 地图其余字段
    mp = {}
    for k, val in a.items():
        key = k.name if hasattr(k, 'name') else str(k)
        if key in ('@data', '@events'):
            continue
        mp[camel(key)] = to_mv(val)
    mp['data'] = data
    mp['width'] = W
    mp['height'] = H
    mp['events'] = events
    write_json(out_path, mp)


def conv_event(ev):
    a = ev.attributes
    pages = []
    raw_pages = a.get('@pages') or []
    for pg in raw_pages:
        if pg is None:
            continue
        pages.append(conv_page(pg))
    return {
        'id': int(a.get('@id', 0)),
        'name': to_mv(a.get('@name', '')),
        'x': int(a.get('@x', 0)),
        'y': int(a.get('@y', 0)),
        'pages': pages,
    }


def conv_page(pg):
    a = pg.attributes
    cond = a.get('@condition')
    conditions = to_mv(cond) if cond is not None else {}
    graphic = a.get('@graphic')
    graphic = to_mv(graphic) if graphic is not None else {
        'tileId': 0, 'characterName': '', 'characterIndex': 0, 'direction': 2}
    mr = a.get('@move_route')
    move_route = to_mv(mr) if mr is not None else {
        'repeat': True, 'skippable': False, 'wait': False, 'list': []}
    lst = a.get('@list') or []
    lst = [to_mv(c) for c in lst]
    return {
        'conditions': conditions,
        'directionFix': bool(a.get('@direction_fix', False)),
        'graphic': graphic,
        'list': lst,
        'moveFrequency': int(a.get('@move_frequency', 2)),
        'moveRoute': move_route,
        'moveSpeed': int(a.get('@move_speed', 3)),
        'moveType': int(a.get('@move_type', 0)),
        'priorityType': int(a.get('@priority_type', 0)),
        'stepAnime': bool(a.get('@step_anime', False)),
        'through': bool(a.get('@through', False)),
        'trigger': int(a.get('@trigger', 0)),
        'walkAnime': bool(a.get('@walk_anime', False)),
    }


# ---------------------------------------------------------------------------
# 通用：列表型 DB（Actors/Classes/.../Tilesets/MapInfos/CommonEvents）
# ---------------------------------------------------------------------------
def conv_list_file(path, out_path, drop_first_none=True):
    o = load_fix(open(path, 'rb').read())
    arr = to_mv(o)
    write_json(out_path, arr)


def conv_system(path, out_path):
    o = load_fix(open(path, 'rb').read())
    d = to_mv(o)
    write_json(out_path, d)


def conv_mapinfos(path, out_path):
    """MapInfos: VX Ace 是 Hash(键=地图id)，MV 需要数组(下标=id,[0]=null)。"""
    o = load_fix(open(path, 'rb').read())
    arr = [None]
    for k, v in o.items():
        if v is None:
            continue
        mid = int(k)
        a = v.attributes
        info = {
            'id': mid,
            'name': to_mv(a.get('@name', '')),
            'order': to_mv(a.get('@order', 0)),
            'expanded': to_mv(a.get('@expand', False)),
            'parentId': to_mv(a.get('@parent_id', 0)),
            'scrollX': to_mv(a.get('@scroll_x', 0)),
            'scrollY': to_mv(a.get('@scroll_y', 0)),
        }
        while len(arr) <= mid:
            arr.append(None)
        arr[mid] = info
    write_json(out_path, arr)


def conv_animations(path, out_path):
    """动画: frames 是 RPG::Animation::Frame[]，每帧的 @cell_data 是 2D Table -> 2D 数组。"""
    o = load_fix(open(path, 'rb').read())
    out = []
    for a in o:
        if a is None:
            out.append(None)
            continue
        d = {}
        for k, v in a.attributes.items():
            key = k.name if hasattr(k, 'name') else str(k)
            if key == '@frames':
                frames = []
                for fr in (v or []):
                    if fr is None:
                        frames.append([])
                        continue
                    cd = fr.attributes.get('@cell_data')
                    tv = table_values(cd) if cd is not None else None
                    frames.append(table_to_nested(tv) if tv else [])
                d['frames'] = frames
            else:
                d[camel(key)] = to_mv(v)
        out.append(d)
    write_json(out_path, out)


def write_json(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)


def main():
    os.makedirs(OUT, exist_ok=True)
    # 地图
    maps = sorted(glob.glob(os.path.join(SRC, "Map*.rvdata2")))
    n_map = 0
    for p in maps:
        name = os.path.basename(p)[:-len(".rvdata2")]   # Map001
        if name == "MapInfos":
            continue
        conv_map_file(p, os.path.join(OUT, name + ".json"))
        n_map += 1
    print("maps converted:", n_map)

    # 列表型 DB（Animations 单独处理: frames 为 Table）
    for db in ["Actors", "Classes", "Skills", "Items", "Weapons", "Armors",
               "Enemies", "States", "Troops", "Tilesets",
               "CommonEvents"]:
        conv_list_file(os.path.join(SRC, db + ".rvdata2"),
                       os.path.join(OUT, db + ".json"))
        print("db:", db)

    # MapInfos: VX Ace Hash -> MV 数组
    conv_mapinfos(os.path.join(SRC, "MapInfos.rvdata2"),
                  os.path.join(OUT, "MapInfos.json"))
    print("db: MapInfos")

    # 动画(特殊: frames 的 cell_data 是 2D Table)
    conv_animations(os.path.join(SRC, "Animations.rvdata2"),
                    os.path.join(OUT, "Animations.json"))
    print("db: Animations")

    # System
    conv_system(os.path.join(SRC, "System.rvdata2"),
                os.path.join(OUT, "System.json"))
    print("db: System")


if __name__ == "__main__":
    main()
