# -*- coding: utf-8 -*-
"""把转换出的 System.json 补齐为 MV 必需的完整结构，防止启动崩溃。

根因: VX Ace 的 RPG::System 结构与 MV 不同 —— 缺 terms.messages(51 条)、
attackMotions / equipTypes / victoryMe / defeatMe / magicSkills / menuCommands /
optSideView / locale，且 terms.basic / terms.commands 的顺序与 MV 不一致。
MV 运行时 TextManager.message() 会访问 $dataSystem.terms.messages[...]，
缺失即抛 TypeError -> 启动崩溃、编辑器打开即崩。

策略(保真补丁，不丢失游戏原始数值):
  * 以 MV NewData 的 System.json 为“结构模板”
  * 缺失的顶层键直接从模板补齐
  * terms.messages 用模板(消息模板是 JS 格式，VX Ace 的值本就不通用)
  * terms.basic / params / commands 保留游戏取值，按 MV 顺序/长度整理
"""
import json
import os
import sys

MV_SYS = "G:/SteamLibrary/steamapps/common/RPG Maker MV/NewData/Data/System.json"
TARGETS = [
    "Monline-MV/data/System.json",
    "mv_project/data/System.json",
]

# MV terms.commands 顺序(26): 0 fight,1 escape,2 attack,3 guard,4 item,5 skill,
# 6 equip,7 status,8 formation,9 save,10 gameEnd,11 options,12 weapon,13 armor,
# 14 keyItem,15 equip2,16 optimize,17 clear,18 newGame,19 continue,20 toTitle,
# 21 cancel,22 buy,23 sell,...
# VX Ace 顺序(24): 0 fight,1 escape,2 attack,3 guard,4 item,5 skill,6 equip,
# 7 status,8 formation,9 save,10 game_end,11 <blank>,12 weapon,13 armor,
# 14 key_item,15 equip2,16 optimize,17 clear,18 new_game,19 continue,
# 20 shutdown,21 to_title,22 cancel,23 <blank>
CMDMAP = {0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,
          12:12,13:13,14:14,15:15,16:16,17:17,18:18,19:19,20:21,21:22}


def fix_system(ours, tpl):
    out = dict(ours)  # keep all game values
    # 1) 顶层缺失键 -> 用模板补齐
    added = []
    for k, v in tpl.items():
        if k not in out:
            out[k] = v
            added.append(k)
    # 2) terms -> 整理成 MV 结构
    ot = ours.get('terms', {}) or {}
    tt = tpl['terms']
    our_basic = ot.get('basic')
    our_params = ot.get('params')
    our_cmds = ot.get('commands')

    # basic: MV 期望 10 项(level,levelA,hp,hpA,mp,mpA,tp,tpA,exp,expA)
    basic = list(tt['basic'])  # 模板长度正确
    if isinstance(our_basic, list):
        for i, v in enumerate(our_basic[:len(basic)]):
            if v:
                basic[i] = v
    # params: MV 期望 8 项
    params = list(tt['params'])
    if isinstance(our_params, list):
        for i, v in enumerate(our_params[:len(params)]):
            if v:
                params[i] = v
    # commands: MV 顺序/长度
    cmds = list(tt['commands'])
    if isinstance(our_cmds, list):
        for mvi, oi in CMDMAP.items():
            if oi < len(our_cmds) and our_cmds[oi]:
                cmds[mvi] = our_cmds[oi]
    out['terms'] = {
        'basic': basic,
        'commands': cmds,
        'params': params,
        'messages': tt['messages'],   # 关键：补消息模板(防崩)
    }
    # 3) equipTypes: 用游戏的 etypes(VX Ace 放在 terms.etypes),补前导空串(MV 1-based)
    etypes = ot.get('etypes')
    if isinstance(etypes, list) and etypes:
        out['equipTypes'] = [""] + list(etypes)
    # 4) locale / optSideView 兜底
    out.setdefault('locale', 'en')
    out.setdefault('optSideView', False)
    return out, added


def main():
    if not os.path.exists(MV_SYS):
        print("!! 找不到 MV 模板:", MV_SYS); sys.exit(1)
    tpl = json.load(open(MV_SYS, encoding='utf-8'))
    for t in TARGETS:
        if not os.path.exists(t):
            print("skip (not found):", t); continue
        ours = json.load(open(t, encoding='utf-8'))
        fixed, added = fix_system(ours, tpl)
        json.dump(fixed, open(t, 'w', encoding='utf-8'), ensure_ascii=False)
        miss = [k for k in tpl if k not in fixed]
        print("patched: %s | +keys=%s | still-missing=%s | terms.messages=%d"
              % (t, added, miss, len(fixed['terms']['messages'])))


if __name__ == "__main__":
    main()
