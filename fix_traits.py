# -*- coding: utf-8 -*-
"""修复 VX Ace 的 `features` 与 MV `traits` 的字段名不一致导致的启动崩溃。

VX Ace: RPG::BaseItem 子类(Actor/Class/Weapon/Armor/Enemy/State) 用 `features`
MV   : 同名概念叫 `traits`
两者的元素结构其实相同({code, dataId, value})，只是字段名不同。
MV 的 Game_BattlerBase.traitsSet() 会 r.concat(obj.traits)，若某对象没有
`traits` 属性 -> concat(undefined) -> 过滤时 trait.code 抛
TypeError: Cannot read properties of undefined (reading 'code') -> 启动崩溃。
"""
import json
import os

DBS = ["Actors", "Classes", "Enemies", "States", "Weapons", "Armors"]
DIRS = ["Monline-MV/data", "mv_project/data"]

# 万一 code 是 Ruby 符号(字符串)时的映射(与 VX Ace/MV 常量数值一致)
SYM2CODE = {
    "element_rate": 11, "debuff_rate": 12, "state_rate": 13, "state_resist": 14,
    "param": 21, "xparam": 22, "sparam": 23,
    "atk_element": 31, "atk_state": 32, "atk_speed": 33, "atk_times": 34,
    "stype_add": 41, "stype_seal": 42, "skill_add": 43, "skill_seal": 44,
    "equip_wtype": 51, "equip_atype": 52, "equip_fix": 53, "equip_seal": 54,
    "slot_type": 55, "action_plus": 61, "special_flag": 62, "collapse_type": 63,
    "party_ability": 64,
}


def norm_code(c):
    if isinstance(c, str):
        c = SYM2CODE.get(c, None)
        if c is None:
            try:
                c = int(c)
            except Exception:
                return 0
    try:
        return int(c)
    except Exception:
        return 0


def fix_record(r):
    if not isinstance(r, dict):
        return r
    if "features" in r:
        feats = r.pop("features") or []
        traits = []
        for f in feats:
            if not isinstance(f, dict):
                continue
            traits.append({
                "code": norm_code(f.get("code")),
                "dataId": int(f.get("dataId", 0) or 0),
                "value": f.get("value", 0),
            })
        r["traits"] = traits
    if "traits" not in r:
        r["traits"] = []
    return r


def main():
    for d in DIRS:
        if not os.path.isdir(d):
            print("skip (no dir):", d)
            continue
        for db in DBS:
            p = os.path.join(d, db + ".json")
            if not os.path.exists(p):
                continue
            data = json.load(open(p, encoding='utf-8'))
            n = 0
            for r in data:
                if isinstance(r, dict):
                    fix_record(r)
                    n += 1
            json.dump(data, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
            print("fixed %-40s records=%d" % (p, n))


if __name__ == "__main__":
    main()
