# Monline → RPG Maker MV 复刻报告

**源游戏**: `G:\新建文件夹 (20)\Monline 0.9.8` (RPG Maker VX Ace, .rvdata2)
**目标**: 可直接在 RPG Maker MV 中打开/运行的工程
**输出工程**: `G:\新建文件夹 (22)\Monline_MV\Monline-MV\`（用户实际打开的工程）

> **注意**：下面第 1–6 节是最初的转换报告（历史记录）。转换完成后工程**点开即崩溃**，
> 之后进行了一轮完整的排障与修复，共定位 **8 个根因**。请直接看
> **第 8 节「修复纪要」**，那里是工程当前的真实状态；第 4 节的「已知限制」大部分已被解决。

---

## 1. 做了什么

| 步骤 | 说明 | 结果 |
|------|------|------|
| 解包 | RGSSAD v3 解密，提取 6792 个文件 | `extracted/` (Data 525 个 .rvdata2 + Graphics) |
| 解析 | 自写 `fixreader.py`(基于 rubymarshal 的容错 RGSS 解析器) | 14/14 库 + 511/511 地图 100% 解析成功 |
| 转换 | `convert.py`: VX Ace → MV JSON | 524 个 JSON (510 地图 + 14 库) |
| 资源映射 | `map_assets.py`: Graphics → img/，32px→48px 缩放 | 6229 张图 (1329 缩放, 4900 直拷) |
| 工程组装 | 以正版 MV `NewData` 为模板拼装 | 完整可运行 MV 工程 |

## 2. 数据转换要点（已修正的坑）

- **瓦片 ID 原样保留**：源游戏使用自定义超大瓦片空间（最大 32400），与 MTool 导出一致，非解析损坏，故不重映射。
- **地图 4 层 → 3 层**：VX Ace Table 的 z=0/1/2/3 丢弃区域层(z=3)，保留 下/中/上 三层。
- **事件数组格式**：MV 的 `events` 是数组(下标=事件 id, [0]=null)，不是 VX Ace 的 Hash。已正确转换。
- **MapInfos 是数组**不是对象（VX Ace 为 Hash，含 `id` 字段）。
- **Table 字段还原**：`Tilesets.flags`(8192 数组) 与 `Animations.frames`(2D cell_data) 从二进制 Table 还原为嵌套数组。
- **Tone/Color → 数组**：`windowTone`、`flashColor` 等还原为 4 小数数组。
- **字符串修复**：RubyString(`{'E':True}` 伪像)已彻底消除，0 残留。
- **空 key 修复**：源自定义字段 `@_` 不再坍缩为空字符串键，改为 `_`。

## 3. 校验结果（mv_project/data）

| 检查项 | 结果 |
|--------|------|
| 地图总数 | 510 |
| tilesetId 非法 | 0 |
| data 数组长度(w×h×3)错误 | 0 |
| DB 数组格式(14 个库) | 全部正确，[0]=null |
| MapInfos 数组格式 | 正确(511 长，含 id) |
| `{'E':True}` 残留 | 0 |

## 4. 已知限制（非转换 bug，是 VX Ace→MV 的固有差异）

### 4.1 Ruby 脚本命令无法运行（最重点）
事件中共有 **6231 条 "Script"(code 355) 指令**。这些 Ruby 代码在 MV(JavaScript) 中不会执行。
→ 游戏大量逻辑（自定义系统）依赖这些脚本，未转换前相关功能不可用。需手动将 Ruby 脚本改写为 MV 插件(plugins)。

### 4.2 RTP 素材缺失（可补）
源游戏的加密包**不含 VX Ace RTP**，以下素材引用了 RTP 命名文件，当前缺失：
- **瓦片组件** 94 个（`World_A1`/`Inside_A1`/`Dungeon_A1`/`Outside_A1` 等）—— 游戏的自定义瓦片(141 个)均已在。
- **角色精灵** 2881 处引用，涉及 40 个 RTP 文件名（`Actor1`–`Actor5`、`!Chest`、`!Door`、`!Switch`、`Animal`、`Behavior*`、`Damage*` 等）。
- **脸图** 2 处。

**修复方法**：把 VX Ace 或 MV 的 RTP `Graphics/` 对应子目录拷贝进 `mv_project/img/` 的 `tilesets/`、`characters/`、`faces/` 即可（MV RTP 的角色名与 VX Ace 基本同名，可直接补）。

### 4.3 音频缺失
游戏音频(BGM/ME/BGS/SE)不在加密包中，当前 `mv_project/audio/` 仅有 MV 自带样例 → 游戏无声。
**修复**：将源游戏的 `Audio/` 拷入 `mv_project/audio/`。

### 4.4 自动元件(Autotile)几何差异
A1–A5 瓦片已按比例 32→48px 缩放，但 VX Ace 与 MV 的 autotile 内部排布不同 → 自动地形(水/草/墙)渲染可能不完美。静态瓦片(B/C/D/E)缩放后对齐正确。

### 4.5 System 窗口皮肤
`img/system/` 直接拷贝（未缩放），窗体皮肤为 32px 基准，MV 期望 48px → 窗口边框可能略错位（不影响运行）。

### 4.6 脚本(Scripts.rvdata2)
VX Ace 的 Ruby 脚本整体未转为 MV 插件(plugins.js 为空)。

## 5. 如何运行 / 收尾

1. 用 RPG Maker MV 打开 `Monline_MV/mv_project/` 工程。
2. 补素材（见 4.2 / 4.3）后，在 MV 编辑器中测试地图加载。
3. 逐步将 4.1 的 Ruby 脚本改写为 MV 插件以恢复游戏逻辑。

## 6. 文件清单

```
Monline_MV/
├─ extracted/        # 解包原始数据(Data + Graphics)
├─ fixreader.py      # RGSS 容错解析器
├─ convert.py        # VX Ace→MV 主转换器
├─ map_assets.py     # 资源映射+缩放
└─ mv_project/       # ★ 最终 MV 工程
   ├─ data/   (524 JSON)
   ├─ img/    (animations/battlebacks/characters/enemies/faces/fogs/parallaxes/pictures/system/tilesets/titles1/weather + NewData 默认)
   ├─ js/ audio/ fonts/ icon/ index.html package.json
```

---

## 7. 当前工程结构（Monline-MV）

```
Monline_MV/
├─ vxace_data_backup/     # 525 个源 .rvdata2 备份（修复的唯一真源）
├─ extracted/             # 解包原始数据（Data + Graphics）
├─ fixreader.py           # RGSS 容错解析器（含 Table 二进制读取）
├─ convert.py             # VX Ace → MV 主转换器
├─ link_tables.py 等      # 转换辅助
├─ fix_tables.py          # ★ 修复 Table 20 字节头错位（Tilesets/Classes/Animations/Maps）
├─ fix_system.py          # ★ 补 System.json 必需键
├─ fix_traits.py          # ★ features → traits
├─ fix_pageimage.py       # ★ 事件页 graphic → image
├─ fix_schema.py          # ★ Troops.conditions 等 MV schema 缺口
├─ port_assets.py         # ★ 素材审计 + 移植 + 生成 MonlineAudioExt.js
├─ gen_image_ext.py       # ★ 生成 MonlineImageExt.js（图片扩展名回退）
├─ gen_shim.py            # 生成 MonlineShim.js（自定义函数桩）
├─ schema_check.py        # ★ 与 MV NewData 对比 schema（0 缺失）
├─ analyze_scripts.py     # ★ 审计全部 Ruby 脚本命令
├─ dump_scripts.py        # ★ 从 Scripts.rvdata2 提取源工程脚本（第二轮新增）
├─ fix_data_defects.py     # ★ 数据缺陷修复 + 括号配平守卫（第三轮新增，幂等）
├─ revert_abs_paren.py     # ★ 一次误判的还原（第三轮，见 12 节根因 25）
├─ _vxace_scripts/        # ★ 275 个解出的 VX Ace 脚本（含引擎源码与第三方脚本）
├─ _shots/                # 无头浏览器验证
│   ├─ smoke.js           # 全流程冒烟测试（含回归指纹 + 真实数据页面条件断言）
│   ├─ smoke.log          # 最近一次运行结果（VERDICT / REGRESSIONS / RUBY_PENDING）
│   ├─ static_check.js    # ★ 离线编译全部 3076 个脚本片段（秒级）
│   ├─ unit_check.js      # ★ 确定性断言 + 13114 条负载三项扫描（第三轮新增）
│   ├─ probe_intro.js      # 开场剧情探针
│   └─ diag_*.js
└─ Monline-MV/            # ★ 最终可运行 MV 工程
    ├─ data/  img/  audio/  fonts/  icon/
    ├─ js/plugins/
    │   ├─ MonlineAssetGuard.js    # 缺失素材降级（消除致命 Loading Error）
    │   ├─ MonlineDataGuard.js     # 运行时数据防护（动画单元格等）
    │   ├─ MonlineImageExt.js      # 图片扩展名回退（3302 项）
    │   ├─ MonlineAudioExt.js      # 音频扩展名回退（37 项）
    │   ├─ MonlineShim.js          # 自定义函数/场景桩（场景可退出，不软锁）
    │   └─ MonlineRubyBridge.js    # ★ Ruby 兼容层（翻译 + 安全求值 + 语义实现
    │                              #   + CP Page Conditions + 实例变量访问器）
    └─ ...
```

## 8. 修复纪要（8 个根因）

「点开就崩溃」不是一个 bug，而是 8 个独立问题叠加。按发现顺序：

| # | 根因 | 症状 | 修复 |
|---|------|------|------|
| 1 | `System.json` 缺 MV 必需键（`terms.messages` 等 51 项） | `TextManager.message()` 抛错 | `fix_system.py` |
| 2 | 数据库缺 `traits`（VX Ace 叫 `features`） | `Game_BattlerBase.traits` 崩溃 | `fix_traits.py` |
| 3 | 事件页字段 `graphic` 应为 `image` | `Game_Event.setupPageSettings` 崩溃 | `fix_pageimage.py` |
| 4 | `command355` 直接 eval Ruby | `ReferenceError` 中断 game loop | `MonlineShim.js` |
| 5 | **RGSS Table 头少读 4 字节**（16 实际 20） | 动画单元格错位 → `undefined.clamp()` 崩溃；地图瓦片全图错位；通行性错位 | `fix_tables.py` |
| 6 | 同上遗漏的 `Classes.params`（错位且转置成 100×8） | 属性成长取错行 | `fix_tables.py::fix_classes` |
| 7 | **MV 对三处 Ruby 脚本是裸 eval，零 try/catch** | 任何 Ruby 调用 → `SceneManager.stop()` → 冻结在 "Loading Error" | `MonlineRubyBridge.js` |
| 8 | `Troops.json` 的 `pages[].condition` 应为 `conditions` | 每场战斗一开始就冻结（`meetsConditions` 读 `undefined.turnEnding`） | `fix_schema.py` |

### 8.1 根因 5/6：RGSS Table 二进制

RGSS `Table` 的真实布局是 **20 字节头**：

```
[int32 dim][int32 xs][int32 ys][int32 zs][int32 n]   <- 20 字节
[int16 data × n]
```

转换器早期按 16 字节读，于是 `values[0]/values[1]` 其实是元素数 `n` 的低/高 16 位
（所以总能看到 `[n_low16, 0]` 这种残留，如 Map014 开头的 `[14400, 0]`），
且整个数组**错位 2 个 int16**。全工程只有 4 处用到 Table：

- `Tilesets.flags` → 8192 项扁平数组（通行性）
- `Classes.params` → `params[属性id][等级]`（8×100）
- `Animations.frames[].cell_data` → 每单元格 8 个 int
  （`pattern, x, y, zoom, rotation, mirror, opacity, blendMode`）
- `Map*.json` 的 `data` → `x + y*w + z*w*h`（z 0..3 瓦片层 / 4 阴影 / 5 区域）

### 8.2 根因 7（最关键）：MV 未加保护的 eval

grep `js/` 得到 5 处 `eval(`，其中 **MV 1.6.3 有三处完全没有 try/catch**：

| 位置 | 命令 | MV 源码 | 原状态 |
|---|---|---|---|
| `rpg_objects.js:7093` | 移动路线「脚本」(code 45) | `eval(params[0]);` | ❌ 裸 eval |
| `rpg_objects.js:9307` | 条件分支「脚本」(111 / type 12) | `result = !!eval(this._params[1]);` | ❌ 裸 eval |
| `rpg_objects.js:9444` | 变量操作「脚本」(122 / type 4) | `value = eval(this._params[4]);` | ❌ 裸 eval |
| `rpg_objects.js:10500` | 事件脚本 355/655 | `eval(script);` | ⚠️ 已由 MonlineShim 兜住 |
| `rpg_objects.js:1697` | 伤害公式 | `Math.max(eval(item.damage.formula), 0)` | ✅ MV 自带 try/catch 且已定义 `v` |

异常路径：`Game_Character.updateRoutineMove` → `Game_Map.updateEvents` →
`Scene_Map.update` → `SceneManager.catchException` → **`SceneManager.stop()`**，
画面停在 "Loading Error / Retry"。

工程里有 **3643 条移动路线脚本 + 6459 条事件脚本（去重后 3076 条）**，
其中 `self_switch("A", true)` 用了 1555 次 —— 只要有一个事件跑到移动路线，游戏就冻结。

**`MonlineRubyBridge.js` 的三层设计**：

- **A 安全**：接管全部三个入口。code 111/122 采用「先求值，再把参数替换成字面量/查表名，
  调用原生实现，用后还原」的技巧 —— 这样 MV 自己的 `_branch`/`skipBranch` 逻辑完全不动。
- **B 翻译**：`translate()` 把 Ruby 改写为 JS。关键点：`mapCode()` 按字符串字面量切段，
  **只改代码段**，否则对白文本里的 `@`、`nil` 会被误改；多行 Ruby 字符串的换行会被转义。
  支持：关键字哈希 `:k => v`、`@ivar`/`self`、`:sym`、`nil`、
  `x.nil?` → `isNil(x)`、`(a-b).abs` → `Math.abs(a-b)`（反向扫描平衡括号找接收者）、
  `include?/is_a?/to_s/to_i`、通用谓词 `foo?(..)` → `foo(..)`、
  Ruby 蛇形属性 → MV 方法、`$game_map.events[id]` → `$gameMap.event(id)`、
  `Tidloc::Set_Coord` → `Tidloc.Set_Coord`、`and/or/not`、续行反斜杠、
  `case/when/end` → `switch`（含 `stmt if cond`）、`"#{expr}"` 插值。
- **C 语义**：**真的实现**了承载玩法的自定义 API（不是吞掉）——
  `self_switch`(1555 次)/`setSelfSwitch`/`setAllSelf`/`isSelfSwitch?`、
  移动类 `set_char`/`jump_to`/`move_toward_*`/`turn_toward_event`/`find_path`/`chase_leader` 等、
  系统类 `get_hp_percent`/`gain_armor`/`equip_armor_by_etype`/`remove_equip`/`fadeout`/`fadein`。
  Ruby 全局桥用 `Proxy`：`$game_variables[123]` 可读写真实变量、
  `$game_self_switches[[m,e,'A']]`、`$game_actors[2]`、`$data_*`；
  未知 `$Foo` 交给自动生长的万能桩。
  纯视觉系统（`light`/`map_effects`/`weather`/`show_fog`/`cam_*`/`nel_textpop` 等）
  登记为可计数 no-op，清单在 `MonlineRuby.pending`，留待 Phase 2 真重写。

### 8.3 根因 8：Troops 条件键名

```js
Game_Troop.prototype.meetsConditions = function(page) {
    var c = page.conditions;               // 转换出来的是 page.condition
    if (!c.turnEnding && ...)              // undefined.turnEnding → TypeError
```

489 个战斗事件页全部修正。内层键名（`turnEnding`/`actorId`/…）转换器已正确，
只有外层包装名错。

### 8.4 素材：图片扩展名（本轮第二大发现）

源游戏美术**大部分是 JPEG**，但 MV 的 `ImageManager.loadBitmap` 把扩展名写死成 `.png`
（`rpg_managers.js:859`）。实测：

- 事件共引用 **4421 个不同图片名**（7461 条显示图片指令）
- 其中 **3144 个只存在 `.jpg`/`.jpeg`** → 没有回退就会**静默显示空白**（约 71%！）

`gen_image_ext.py` 扫描 `img/` 生成 3302 项清单，插件在选择扩展名后再拼 URL，
既修好问题又保持 404 数为 0（否则缺失素材诊断会被噪音淹没）。

另有 **26 个图片名任何扩展名都不存在**（`Pentagram1`、`Lamia265`、`PrincessMaid2148`、
`Beret1` 等），属源游戏自身的死引用，由 `MonlineAssetGuard` 降级为空白。

### 8.5 验证

**离线静态校验 `_shots/static_check.js`**（秒级，先跑这个）：
在 Node 造引擎桩后 eval 插件，把 `data/` 里全部脚本片段（含 655 续行拼接、
111 条件、122 变量操作）跑一遍 `translate()` + `new Function()` 编译。

结果：**移动路线 982/982；事件脚本 2091/2094；零残留 Ruby token。**

仅剩 3 条（各 1 次）是源数据本身写坏的数据库改写脚本
（`RPG::UsableItem::Effect.new` 这种运行时类构造、一条引号不配对的武器描述），
已被 try/catch 兜住，只是那 3 处描述文字改动会丢失。

**在线冒烟 `_shots/smoke.js`**：启动 → 标题 → 新建游戏 → 推进开场剧情 →
20 次真实 `reserveTransfer` 地图传送 → 行走 → 7 个菜单场景 → 战斗（含回合推进）→
图片解码检查 → 截图，并汇总 `MonlineRuby.report()`。

**schema 校验 `schema_check.py`**：与 MV `NewData` 对比 → **15/15 文件 0 缺失键**。

## 9. 仍未完成（Phase 2）

以下系统目前是**安全 no-op**（游戏能跑但功能缺失），调用次数见 `MonlineRuby.pending`
与 `_shots/smoke.log` 的 `RUBY_PENDING` 行：

| 系统 | 调用次数（一次冒烟内） | 说明 |
|---|---|---|
| `light.*` | 1131 | 光照/视野锥 |
| `show_fog` / `fade_fog` / `tint_fog` | 1061 / 1059 / 265 | 雾效 |
| `anchor_picture_to_screen` | 656 | 图片锚定 |
| `zoom_event_sprite` | 2 | 精灵缩放 |
| `map_effects.*` | 少量 | 屏幕特效 |
| `cam_set` / `cam_follow` / `cam_center` | — | 镜头 |
| `nel_textpop` | 604 | 自定义文字弹出 |
| `combine_choices` / `disable_choice` / `hide_choice` | 101+ | 自定义选项系统 |
| ~~`global_save` / `global_load`~~ | ~~595 / 11~~ | **不需要移植**：源工程 `LGlobalSave::VARIABLES_TO_SAVE` 与 `SWITCHES_TO_SAVE` 两个数组都是 `[]`，原作里这两个方法本身就是空操作。已核对全部脚本，无任何覆写。 |
| `chain_commands` / `snooze_bar` / `remove_bar` / `set_symbols` | — | 杂项 |
| `Tidloc::Set_Coord` | 少量 | 瓦片定位模块 |
| `find_path` | 460 | 目前是「每帧朝目标走一步」的近似，非真 A* |
| `set_char` 的参数语义 | 484 | 源脚本签名不明确，按「名字+索引+朝向」尽力映射 |

另外：`$game_party.change_inventory("Main")` 等多背包系统、JP/技能学习系统
（`gain_jp`）也是桩。

## 10. 如何运行

1. 直接用 RPG Maker MV 打开 `Monline_MV/Monline-MV/`（含 `Game.rpgproject`）。
2. 若修改了 `vxace_data_backup/` 相关内容，重跑顺序：
   `fix_tables.py` → `fix_system.py` → `fix_traits.py` → `fix_pageimage.py`
   → `fix_schema.py` → `port_assets.py` → `gen_image_ext.py`
   → `schema_check.py`（应为 0 缺失）→ `_shots/static_check.js`（应 0 编译失败）。
3. 两个工程副本的 `data/` 与 `js/plugins/` 已同步（`cmp` 一致）；`mv_project/img`、`audio` 仍比主工程少 768 个文件，详见 12 节末尾。

## 11. 第二轮修复纪要（根因 9–15）

第一轮解决了「点开即崩」。第二轮用「让冒烟测试真正跑通整局」的方式，
又挖出 7 个**不会崩、但会静默走错**的问题。其中第 13 条是量级最大的一个。

### 定位手法

关键在于把「失败」拆成**确定性的指纹**，而不是看「有没有报错」：

- 在 `smoke.js` 里插一段合成事件指令序列，用**执行轨迹**（包 `executeCommand`
  记录 `_index:code`）把「哪条指令真的被执行了」变成可观测数据；
- 对真实数据做断言（直接 `fetch('data/Map238.json')` 调选择逻辑），而不是只看
  「游戏能不能启动」。

### 根因 9：`command355` 多推一格 `_index` → 吞掉脚本后的一条指令

MV 的 `executeCommand()` 在命令方法返回 `true` 后**自己**做 `this._index++`，
所以原生 `command355` **不**递增索引（只有消费 655 续行的 `while` 循环里递增）。
我最初的覆写多加了一句 `this._index++`，后果是**每执行一次脚本就静默跳过紧随其后的
一条指令**（脚本后面的「显示文章」「条件分支」会整体错位）。

指纹：合成序列 `355 / 655 / 122(常量7→变量A) / 355 / 0`，轨迹必须是
`0:355 2:122 3:355 4:0 5:-1`；若变量 A 最终为 0，就是本条。修复后
`REGRESSIONS.index.v501 = 7`。

> 踩坑记录：第一次断言仍报失败，原因是测试用的变量号 501/502 **超出了变量表**
> （`$dataSystem.variables.length = 222`），而 `Game_Variables#setValue` 对越界
> id 是**静默忽略**的。已改成用表内安全 id，并确认变量表 222、开关表 1501
> 与 VX 源**完全一致**，最大引用 211 / 1449 都在范围内。

### 根因 10：`with(__scope)` 偷走了求值函数的 `__self` 参数

沙箱用 `new Function('__self','__scope','with(__scope){…}')` 实现 Ruby 风格全局查找。
但 `with` 在**函数自身作用域之前**被查询，而作用域 `Proxy` 的 `has` 陷阱对任何
「不在 `window` 上」的名字都返回 `true` —— 于是 `__self` / `__scope` 被自己的
作用域抢走，`__self` 解析成一个空桩函数。

后果：所有 `@ivar` 读写和 `self.x` 都打在桩上，**静默失效**（`@shop_stock[1] = 2`
等价于什么都没做）。修复：`has` 对 `__self` / `__scope` 直接返回 `false`。

先做了**全量 `@ivar` 审计**再动手（因为这会让原先「静默空转」的脚本真正落到对象上）：
- 全库只有 3 个不同 `@ivar`：`@event_id`(1628)、`@map_id`(161)、`@shop_stock`(114)、
  `@move_speed`(6)、`@dashing`(1)；
- 唯一危险的是 `@shop_stock[...] =`（下标赋值，114 次）；
- `self.方法` 出现 **0 次** → 修 A 不会引发连锁。

修复：把 `map_id / event_id / move_speed / dashing / shop_stock` 五个访问器
**装到全部四个宿主原型**上（`Game_Character` / `Game_Event` / `Game_Interpreter` /
`Game_Player`），且写成防御式（`_mapId` 优先、方法存在性检查）。指纹：
`REGRESSIONS.selfVar.stock3 = 7`（解释器上），`MOVEROUTE.moveFails = 0`（事件上）。

### 根因 11：这个引擎构建里根本没有 `SceneManager.scene`

源脚本有 **176 处** `SceneManager.scene.log_window...`（自定义消息日志窗口）。
但工程内 `js/rpg_managers.js` 只定义 `SceneManager._scene`，**没有公开的
`scene` 访问器**（`grep -rn "SceneManager\.scene" js/*.js` 全空）。于是
`SceneManager.scene.log_window` → `undefined.log_window` → TypeError。

修复：在插件里补上公开访问器，并把 `null` 场景（传送到一半时脚本可能读到）折成
一个 permissive 桩，而不是把 `null` 抛给调用方。同时保留 `Scene_Base.prototype.log_window`
的桩窗口，让 `add_text(...).flush()`、`wait_and_clear` 这类调用形态全部安全。

### 根因 12：`@shop_stock` 所在的宿主此前没有访问器

审计发现 114 次 `@shop_stock[n] = v` 全部发生在 `code 355/655`（即
`__self` 是 `Game_Interpreter`），而 `Game_Interpreter.prototype` 之前**没有**
`shop_stock`。已随根因 10 一并补全。

### 根因 13（量级最大）：漏移植了源工程的 **CP Page Conditions** 脚本

症状：新建游戏后**开场剧情跑错**，且卡在换名场景。追查发现 238 号地图的开场事件
有 **11 个页面，全部没有原生条件**，注释块里却写着：

```
extra conditions
variable 99 = 0        ← page 0
variable 99 = 1        ← page 1
...                    ← page 10 是 "God Mode"
```

一开始怀疑是转换丢了条件，于是先做**双向验证**：

1. 直接从 `vxace_data_backup/Map238.rvdata2` 读源数据 → **源数据也没有条件**，
   说明转换是忠实的；
2. 全量统计源数据页面条件：**11242 / 22526 个页面是有真条件的** → 转换器没有
   普遍丢条件；
3. 那问题只能出在「条件写在注释里」这件事上。

于是把源工程的 `Scripts.rvdata2` 解出来（写 `dump_scripts.py`；rubymarshal 会把脚
本正文按 UTF-8 解码而正文是 zlib 二进制，所以改用「全文件扫 zlib 流」的方式），
在 275 个脚本、336 万字符里找到了 **`0181.rb` = Neon Black 的 CP Page Conditions**。

它的机制是：`Game_Event#conditions_met?` → `原生条件 && page.extra_conditions`，
而 `extra_conditions` 解析**注释块**（首行须匹配 `/extra condition[s]?/i`，后续
`408` 行每行一个条件），支持 `switch N on`、`variable N <op> V`、`item/weapon/armor N`、
`actor N`、`script …`、以及一组日期/时间条件。

**影响面：994 个页面 / 656 个事件。** 没有它，这些页面全都「看起来无条件」，
而 VX Ace 和 MV 都是「编号最大的匹配页优先」，于是游戏会静默选到错误的页。

顺带用引擎源码定死了选页语义（`0035.rb`）：

```ruby
def find_proper_page
  @event.pages.reverse.find {|page| conditions_met?(page) }
end
```

从末页倒着找第一个匹配 = **编号最大者优先**，与 MV 的 `findProperPageIndex` 一致。
统计也佐证：5468 个多页事件里 **3735 个**是「第 0 页无条件 + 后面页才有条件」，
这个模式只在「最大者优先」下成立 —— 所以**选页逻辑一个字都不能改**。

修复：把 CP Page Conditions 完整移植进 `MonlineRubyBridge.js`（第 10 节），
正则顺序与 Ruby `case/when` 逐条对齐，解析结果缓存在页面对象的**不可枚举**属性上
（避免回流进地图数据）。`script` 条件走 `MR.evalExpr(..., quiet=true)`，失败即
「条件不满足」，与 Ruby 的 `rescue return false` 一致。

指纹：`REGRESSIONS.pages238 = {matched_v99_0:[0], matched_v99_3:[3]}` —— 对真实
地图数据，`变量99=0` 时只有第 0 页匹配、`=3` 时只有第 3 页匹配。修复后
`after-cutscene` 的 `scene` 从 `Scene_Name` 回到 `Scene_Map`，传送重新全部通过。

### 根因 14：`SceneManager.call(...)` 撞上了 `Function.prototype.call`

还剩 2 条错误：`SceneManager.call(Scene_PXEBestChoose)` → `Error: This is a static class`。

原因很有意思：MV 里 `SceneManager` 是一个**函数对象**
（`function SceneManager() { throw new Error('This is a static class'); }`），
所以 `SceneManager.call(...)` 命中的不是「切场景」，而是继承来的
`Function.prototype.call` —— 它把 `SceneManager` 当普通函数调用，正好触发那个静态类
守卫。VX Ace 的 `SceneManager.call(C)` 对应 MV 的 `SceneManager.goto(C)`。

修复：翻译器加 `SceneManager.call(` → `SceneManager.goto(`。同时排查了同族陷阱
（`call/apply/bind/toString/valueOf/hasOwnProperty/caller/arguments`），
全库只有这一处。

### 根因 15：桩场景没有退出途径（软锁）

`MonlineShim.js` 为未移植的场景（`Scene_Crafting` / `Scene_LearnSkill` /
`Scene_PXEBestChoose`）生成了空壳场景，但它**没有任何退出路径** ——
进去之后就出不来了，对玩家而言和崩溃没有区别。修复：桩场景在 OK/Cancel 时
`SceneManager.goto(Scene_Map)`，并在进入时打一条 `console.warn`。

### 已核实「不是问题」的几项

| 疑点 | 结论 |
|---|---|
| `global_save` / `global_load` 是空桩 | **忠实**。源工程 `VARIABLES_TO_SAVE` / `SWITCHES_TO_SAVE` 都是 `[]`，原作里就是空操作。 |
| 页面条件疑似被转换丢掉 | **没有**。11242/22526 页面有真条件；238 号地图那个事件源数据本身也没有条件（条件写在注释里，见根因 13）。 |
| 选页方向（最大者优先 vs 最小者优先） | **与 VX Ace 一致**，见根因 13 的引擎源码。 |
| 变量表 / 开关表长度 | 222 / 1501，**与 VX 源完全一致**；最大引用 211 / 1449 均在范围内。 |
| `NET_FAILURES 1  img/characters/$Harpy.png` | **误报**。该文件确实存在（`%24Harpy.png` 直接请求返回 200）；`requestfailed` 是 `net::ERR_ABORTED`（引擎会自行替换/取消 `<img>` 请求）。已让测试忽略 `ERR_ABORTED` 并打印真实 reason。 |
| 静态校验报告 `residual ruby tokens: ivar:18, include?:24` | **校验器误报**。它没有剥离字符串字面量，把对白里的 `@`、`include?` 也算进去了。改成先剥离字符串/注释后，残留为 **none**。 |
| `probe_intro` 显示开场剧情「没跑」 | **时序问题**，非跳过。 |

### 顺手修掉的翻译器缺口

`RPG::UsableItem::Effect` 这类**嵌套常量**：原规则只做一遍 `/g` 替换，
`RPG::BaseItem::Feature` 只会被改掉前半截、留下 `::Feature` 依然语法错误。
已改成循环替换到稳定。事件脚本编译失败数从 **3 → 1**（3076 条去重片段里仅 1 条，
是源数据自身把 Ruby 字符串拆行写坏了，无法在不猜测意图的前提下修，已被 try/catch 兜住）。

### 本轮校验结果

```
MOVEROUTE     selfSwitchD:true  moved:false  stopped:false  showed:false  moveFails:0
REGRESSIONS   v500:2 v501:7 v502:1 | stock3:7 | scene.hasAccessor:true | logWindow:true
              extraSynth{switchOff:false,switchOn:true,wrongValue:false}
              pages238{matched_v99_0:[0], matched_v99_3:[3]}
RUBY_ERRORS   0 in 0 group(s)
GUARD_REPORTS 0
MISSING_ASSETS 0
NET_FAILURES  0
ERR_SCREENS   none
HARD_ERRORS   none
VERDICT       PASS
```

20 次真实地图传送：19 次通过，1 次（`285`）被判为 `DEFERRED` —— 它落在 map 238，
而 238 的开场是 285 条指令的 AUTORUN，剧情放映期间传送请求会被挂住。**这是原作的
脚本行为，不是移植缺陷**，因此记为 soft 信号而不是失败（`SOFT_NOTES` 行）。

> 测试侧同时改掉了两处会制造假失败的地方：传送检查从「固定等 2.6 秒」改成
> 「轮询 + 区分是否被剧情挡住」；`NET_FAILURES` 忽略 `ERR_ABORTED`。

---

## 12. 第三轮修复纪要（根因 16–25）

第二轮的结论是 `VERDICT PASS`，但报告里仍留着两条尾巴：`RUBY_ERRORS 1 in 1 group(s)`
和 `failedEvent: 1`。本轮从这一条报错开始追，一路追到**数据层**，又挖出 10 个
「不崩、但静默做错」的问题 —— 它们不会让游戏停住，所以前两轮的测试全都没报警。

### 定位手法

新增两个离屏工具，把「靠肉眼看画面」换成「可重复的断言」：

| 工具 | 作用 |
|---|---|
| `_shots/unit_check.js` | **新增**。在 Node 里用**真实翻译器 + 真实自定义方法**跑确定性断言：翻译产物、`move_speed` 访问器、`no_dash`、`CustomData` 存取与存档往返；再对全部 **13114 条**脚本负载做三项扫描（改名残留 / 赋值左侧是函数调用 / 编译失败） |
| `fix_data_defects.py` | **新增**。四项幂等数据修复 + 括号配平守卫 |
| `_shots/static_check.js` | 既有。3076 条去重片段离线编译，本轮从 `1 失败 / repaired:1` 收敛到 **0 失败 / repaired:0** |

思路很简单：**凡是「调用次数 > 0 但没有任何实现」的名字，一律当成嫌疑人**。
`MonlineRuby.pending` 里记的是「已知的桩」，但 `autoStub` 悄悄兜住的那些不在里面 ——
`CustomData.update_armor` 就是这样被发现的。

### 根因 16：`CustomData` 模块整个缺失（280 处调用，本轮量级最大）

冒烟测试的 `RUBY_ERRORS` 那一条原文是：

```
[event] TypeError: CustomData.update_armor is not a function
   <-- a = $data_armors[159]
       a.name = "Rags"
       a.description = "This gettup makes you look poor as shit, ..."
       CustomData.update_armor(a)
```

源工程 `0176.rb` 是 Hime 的 **Custom Database**：游戏在运行中改写数据库行
（改名字/描述/图标/数值），再调 `CustomData.update_*` 写进 `$custom_*` 哈希，
好让存档把它带回来 —— 因为两个引擎都在每次启动时从 `Data/` 重新读数据库。

`CustomData` 既不在 `F`（自定义 API 表）也不在 `window` 上，于是落到兜底桩
`autoStub('CustomData')`：它返回一个**普通函数**，于是 `.update_armor` 是 `undefined`，
一调用就 TypeError。全库统计 **280 处**：

| 方法 | 次数 |
|---|---|
| `update_class` | 78 |
| `update_actor` | 72 |
| `update_item` | 69 |
| `update_armor` | 36 |
| `update_skill` / `update_enemy` / `update_weapon` | 12 / 7 / 6 |

**修法**：按 0176.rb 原样实现 `CustomData`，两层都做全：
1. `add_object` / `update_object` + 9 组 `add_*` / `update_*`
   （`dataset.length` 与 Ruby `Array#size` 在 1-based 同构，语义完全一致）；
2. `$custom_actors` … `$custom_mapinfos` 用 `Object.defineProperty` 暴露成真正的
   全局（用 getter 是因为读档会整块换掉哈希）；
3. 挂 `DataManager.makeSaveContents` / `extractSaveContents`，把哈希塞进存档、
   读档后合并回数据库 —— 与 `0176.rb` 的 `make_custom_contents` /
   `merge_custom_contents` 一一对应。

### 根因 17：VX Ace 的蛇形字段名在 MV 里是驼峰（106 处静默写废）

`a.icon_index = 11897` 这种写法，在 MV 里叫 `iconIndex`。原来的翻译器只做**方法**改名，
不做**字段**改名，于是这行会在 armor 对象上凭空造一个没人读的 `icon_index`，
图标**永远不变** —— 不报错、不崩溃、只是没效果。

| 源写法 | MV 名 | 出现次数 |
|---|---|---|
| `icon_index` | `iconIndex` | 97 |
| `data_id` | `dataId` | 4 |
| `currency_unit` | `currencyUnit` | 4 |
| `animation_id` | `animationId` | 1 |
| `tp_gain` | `tpGain` | 1 |

**修法**：翻译器加 `FIELDS` 表，读、写都改名（这些在两边都是普通过滤属性，改名对读写都成立）。

### 根因 18：`move_speed` 的赋值被翻译成了函数调用（65 处，**运行时会真的报错**）

VX Ace 里 `move_speed` 是 `attr_accessor`，数据里大量**赋值**，而且带小数：

```
$game_player.move_speed = 4          (57 次)
$game_map.events[20].move_speed = 4.15   (8 次)
```

翻译器原来的 `ATTRS` 表把 `.move_speed` 一律改成 `.moveSpeed()`
（因为 MV 里它是方法）。赋值左侧就变成了 `$gamePlayer.moveSpeed() = 4`
—— 这在**非严格模式**下能通过编译，运行时抛
`ReferenceError: Invalid left-hand side in assignment`，**整段脚本报废**。

`static_check` 抓不到它，正因为它是运行时错误而不是编译错误；而 `unit_check`
新增的「赋值左侧是调用」扫描正是为这类问题准备的。小数也不能丢：
VX Ace 的 `distance_per_frame = 2 ** move_speed / 256`，`4.15` 与 `4` 手感不同。

**修法**：
1. 把 `move_speed` 从 `ATTRS` 里**移出**，改成在 `Game_Character`（及其子类）上装一个
   真正的访问器，读走 `moveSpeed()`、写走 `setMoveSpeed()`，且**不截断小数**；
2. 给 `ATTRS` 的其余项加「赋值左侧不替换」的负向前瞻
   （`(?![ \t]*[+\-*/%&|^]?=(?!=))`，顺带覆盖 `+=` 等复合赋值）。

### 根因 19：`no_dash`（66 处）—— 旗子存下来了，但没人读

`$game_player.no_dash = true`（42 次）/ `= false`（24 次）是源工程「过场时禁止奔跑」
的做法。原来没有任何实现，赋值只会落进 `autoStub` 的虚空里。

**修法**：`Game_Character` 上加 `no_dash` 访问器，并把它接到
`Game_Player#isDashButtonPressed()` —— MV 的 `updateDashing()` 就是靠这个方法决定
是否奔跑，所以这是唯一需要拦的点。

### 根因 20：`Audio.me_stop` 撞上 MV 的驼峰 API

`Audio.me_stop`（1 处）在 MV 里是 `Audio.meStop()`。顺手把整张 VX Ace `Audio` 表
（`bgm_play` / `bgs_play` / `me_fade` / `se_play` …）都做了映射，
调用式与裸引用两种写法都覆盖。

### 根因 21：`X.instance_eval("ruby")` 丢掉了接收者（6 处）

```
$game_map.events[3].instance_eval("@move_speed += 0.5")   (3 次, 另有 +=1.0 3 次)
```

这是「从别的事件改这个角色」的写法。直接当自由函数调用会**丢掉接收者**，
`@move_speed` 就落到错误的 `self` 上。

**修法**：翻译器把接收者改成第一个实参（`__instanceEval(X, "...")`），
Bridge 提供 `__instanceEval(obj, src)`，用 `obj` 当 `self` 再跑一遍求值。

### 根因 22：尾随 `if` 只在 `case` 块里才被处理（130 行潜在语法错误）

数据里有 130 行 Ruby 尾随 `if`：

```
$game_actors[1].name = "Abigal" if $game_actors[1]
```

它们**正好全在一个大 `case ... end` 块里**，所以 `rewriteCase()` 内部那句
`modifierIf(line)` 顺手把它们改了 —— 一编译就过，`static_check` 也报不出问题。
这是**巧合**：`rewriteCase()` 在片段里没有 `case` 时会提前返回，
块外的尾随 `if` 就会直接 `SyntaxError`，而 355 里的一句语法错误会**整段作废**。

**修法**：把尾随 `if` 提升为独立、**字符串感知**的通条规则（`mapCode` 保护字符串，
所以 `text = "come back if you can"` 这类对白不会被切坏），并顺带支持尾随 `unless`。
判断「顶层关键字」时要求前后都是空白，因此 `if (cond) { ... }`、
`} else if ...` 这些已经成形的行不会被二次处理。

### 根因 23：677 条「显示文字」被 MTool 双层包裹（画面直接错位）

约 1.1% 的 `101` 命令被写成了两层：

```json
{"code":101, "parameters": {"code":101, "parameters": ["", 0, 1, 2]}}
                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

MV 的 `Game_Interpreter` 把 `command.parameters` 当**数组**用：

```js
this._params = command.parameters;
$gameMessage.setFaceImage(this._params[0], this._params[1]);   // undefined
$gameMessage.setBackground(this._params[2]);                     // undefined
$gameMessage.setPositionType(this._params[3]);                   // undefined
```

后果在引擎源码里看得一清二楚（`js/rpg_windows.js`）：

```js
Window_Message.prototype.updatePlacement = function() {
    this._positionType = $gameMessage.positionType();
    this.y = this._positionType * (Graphics.boxHeight - this.height) / 2;   // = NaN
```

再加上 `setBackgroundType(undefined)` → `opacity = 0`（窗口底图全透明）、
脸图也拿不到。**文字本身照常显示**（正文在随后的 `401` 命令里），
所以只表现为「这 677 句没有立绘、没有对话框底、位置错乱」——
这正是它藏了两轮的原因。全库 `101` 共 59720 条，写对的有 59043 条。

**修法**：结构化解包（外层 `indent`/`code` 与内层完全一致，已逐一核对，0 处不一致），
跨 166 个文件共 677 处。

### 根因 24：一条丢引号的描述串，让整个武器升级事件静默失效

```
w.description = "Feed me. Feed me. Feed me. Feed me.\n + 
"Feed me. Feed me. Feed me. Feed me."
```

第一行漏了收尾引号（同一武器的另外两个版本都写成 `... returning \n" + `，意图明确）。
翻译后 JS 变成 `"Feed me. ...\n + \n"` 后面跟裸标识符 `Feed`，**语法错误**
→ 该 355 块整体不执行 → 武器升级事件什么都不做。

**修法**：补引号（1 处）。同时给 `evalScript`（355 / 45 都走它）补上和 `evalExpr`
一样的 `repairBalance` 兜底 —— 以后哪怕数据再出现一处不配平，也只是被修掉并计数，
而不是整段静默报废。

### 根因 25：3 条条件脚本缺括号（Map095）

`($game_map.events[@event_id].y - $game_player.y).abs) <= 2` 少一个左括号。
`111` 条件走 `evalExpr`，有 `repairBalance` 兜着，所以**一直没出事**；
但依赖运行时兜底不是好状态。**修法**：构建期就把 111/122 表达式配平
（丢弃多余的右括号 / 补齐缺失的左括号），并把 355/655 **合并成块**后再检查
——逐行检查会误判，因为 `nel_textpop(` 这类调用本来就跨续行。

> **一次误判，记录在案**：我最初把这 18 处 `.abs) <=` 当成「多一个右括号」全删了。
> 用 VX Ace 母本 `vxace_data_backup/*.rvdata2`（配合 Marshal 长度前缀解码）核对后发现，
> 其中 **15 处是配平的**（那个 `)` 属于一个前导分组，跨 16 个文件共 18 处），
> 删掉反而破坏了它。已由 `revert_abs_paren.py` 还原（按「不配平且以 `.abs <=` 结尾」
> 精确定位，其余 231 处 `.abs <=` 本来就配平、不碰）。
> 教训：**改动数据前先拿母本核对**，别用形态推测。

### 已核实「不是问题」的几项（本轮新增）

| 疑点 | 结论 |
|---|---|
| `direction = 6` / `region_id = ...` 出现 200+ 次 | **假警报**。grep 命中的是 note 标签与对白文本；按 355/655/45/111/122 的结构逐条解析后，真实脚本负载里**一次都没有**。 |
| 翻译器会把配平表达式改坏 | **不会**。`receiverStart` 会正确地把前导 `(` 一起收进接收者（`(A).abs` → `Math.abs(A)`），输出配平。Map095 的 3 处报错来自源数据自身的括号缺失。 |
| `CommonEvents.json` 里有命令的 `parameters` 是字典 | **同根因 23**，677 处，已全部解包。 |
| `X.abs <= n` 需要 `repairBalance` | **已消除**。构建期配平后，`static_check` 的 `repaired` 计数从 10 → **0**。 |

### 本轮校验结果

```
static_check  MOVEROUTE-45  982/982 编译通过, 残留 ruby token: none
              EVENT-355    2094/2094 编译通过, 残留 ruby token: none
              TOTAL COMPILE FAILURES: 0
unit_check    13114 条负载：改名残留 0 / 赋值左侧是调用 0 / 编译失败 0
              UNIT CHECK PASSED: all assertions held

REGRESSIONS   customData{exists,9 组方法,ret:true,registered:true,liveRowTouched:true}
              dbRewrite{name:"Regression Blade", iconIndex:9025, deadIconProp:false, errors:0}
              moveSpeed{fractional:4.15, noDash{unlocked:true, locked:false}}
              showText{total:2222, malformed:0}
RUBY_STATS    {"move":11,"event":1790,"failedMove":0,"failedEvent":0,"translated":2613}
RUBY_ERRORS   0 in 0 group(s)
GUARD_REPORTS 0 | MISSING_ASSETS 0 [] | NET_FAILURES 0
ERR_SCREENS   none | HARD_ERRORS none | VERDICT PASS
```

**`failedEvent` 从 1 归零**，第二轮的尾巴清掉了。

### 两个工程副本的同步状态

| | `Monline-MV/`（主，可运行） | `mv_project/`（供 MV 编辑器打开） |
|---|---|---|
| `data/` 524 个 JSON | ✅ 已修（含根因 23/24/25） | ✅ 同步 |
| `js/plugins/` 两个自研插件 | ✅ | ✅ 已同步（`cmp` 一致） |
| `img/` / `audio/` | 6819 / 726 个文件 | 6403 / 374 个文件（**少 768 个**） |

`mv_project/` 的画面/音频素材仍是第一轮的残缺状态（见 4.2 / 4.3）。它只影响
「在 MV 编辑器里打开时的预览」，不影响 `Monline-MV/` 的真实运行。
若要补齐，把 `Monline-MV/img`、`Monline-MV/audio` 整目录覆盖过去即可（本轮未擅自执行）。


---

## 13. 第四轮：Phase 2 起步（根因 26–28 + 两个自研系统移植）

前一轮把「崩溃」和「静默保真度」都清零了。从这一轮开始进入用户选的
**Phase 2（全做）**：把原来只是「不崩但什么都不做」的自研系统换成真实现。

### 本轮定位手法

不再靠猜：`RUBY_PENDING` 就是工作清单。它是运行时按**调用次数**统计的
「这个名字被真正调用了，但落到了空桩上」。把清单按次数排序，前几名就是
最值得移植的系统。基线（第一轮结束时）长这样：

```
light.setup 909 | light.set_color 910 | light.set_zoom 910
light.set_opacity 405 | light.set_flicker 405            <- 同一套系统，共 3539 次
anchor_picture_to_screen 656 | anchor_picture_to_event 1  <- 另一套
show_fog 10 | fade_fog 7 | tint_fog 2 | cam_* 4 | nel_textpop 1 | ...
合计 4233 次
```

于是本轮挑了两套量级最大、且**母本就在手上**的系统：Zeus81 Lights & Shadows
（`_vxace_scripts/0234.rb` + 说明 0235）与 Hime Picture Anchors（`0239.rb`）。

### 根因 26：Ruby 的「裸无参方法调用」被翻译成了纯属性读取（280 处）

Ruby 里整行写 `light.clear` 是**方法调用**（Ruby 的括号可省）；同名的
`map_effects.clear`、`SceneManager.scene.log_window.wait_and_clear`、
`Fiber.yield` 也一样。翻译成 JS 之后这些变成了**取属性**：

```js
light.clear            // 取到一个函数对象，然后丢掉 —— 什么也没发生
```

**不报错、不崩溃、也不生效**，正是本轮要消灭的那一类。全库扫描：语句位置
**280 处**。

**修法**：加一条「裸方法调用」规则 —— 整行只有 `A.b.c`（三层以上点链、无参数、
无赋值、无运算符）时补 `()`。难点不在补，而在**不能多补**：

- `toString` / `valueOf` / 行尾注释 / 字符串内部 都要绕开；
- 更关键的是**表达式语境**。`111`（type 12）与 `122`（type 4）的操作数是**值**，
  那里 `$game_party.battle_members.size` 里的 `.size` 是读数组长度
  （桥接层给 `Array.prototype` 装了 `size` getter），补上 `()` 会变成调用。

**修法**：`MR.translate(src, options)` 新增 `options.expression`，
`evalExpr` 传 `{expression: true}`，只在语句语境执行这条规则。
实测：语句位置 280 处全部变成真调用；表达式位置 13 处**一处未动**。

### 根因 27：`F` 里的桩会**遮蔽**已移植的真实现（诊断谎报）

`COSMETIC` 列表会把一批名字装到 `F` 上（`F` 就是求值器 `with` 语句的对象），
每个是一个「计数桩」。问题在于：MonlinePicAnchor 明明已经把
`anchor_picture_to_screen` 等 7 个函数装到了 `window` 上，但只要 `F` 里有一个
同名桩，`with` 就会**优先命中 `F` 的桩**，真实现永远拿不到控制权。

表现为：656 次调用全部落到空桩，而 `RUBY_PENDING` 里
`anchor_picture_to_screen: 654` 看起来像「还没移植」—— 诊断系统在**说谎**。

**修法**：装桩前先判断这个名字是不是真的有实现了。判据不能只看
`typeof window[n] === 'function'`，因为 `MonlineShim` 早于桥接加载，
它给每个只是「中和掉」的系统（`show_fog`、`cam_*`、`fade_fog`…）都装了
**无标记的占位空函数**。所以判据用 shim 自己的账本：

```js
function isRealPort(name) {
    if (typeof window[name] !== 'function') { return false; }
    if (window[name].__rubyStub) { return false; }
    if (window.MonlineShim.functions.indexOf(name) >= 0) { return false; } // 还是占位符
    return true;
}
```

一个名字只有被移植插件从 `MonlineShim.functions` 里**移掉**，才算真实现
（MonlinePicAnchor 正是这么做的）。

> **这个坑我当场踩了一次**：第一版判据只写了 `typeof window[n] === 'function'`，
> 结果 `show_fog` / `cam_*` / `zoom_event_sprite` 这些**只有占位符**的名字
> 被当成了真实现，桥接不再装计数桩 —— 于是它们从 `RUBY_PENDING` 里**整个消失**。
> 功能上没坏（本来也是空桩），但 Phase 2 的工作清单凭空少了一批名字。
> 是冒烟测试里 `show_fog: 10` 忽然变成 0 才暴露的。已改为读 shim 账本，
> 并加了单测断言：`isRealPort('anchor_picture_to_screen') === true`
> 且 `isRealPort('show_fog') === false`。

### 系统移植之一：Zeus81 Lights & Shadows v1.3

数据实际调用面（`light` / `shadow` 两个代理）：`.setup` 1578、`.set_color` 1577、
`.chara_id` 1576、`.set_zoom` 1512、`.set_flicker` 1386、`.set_opacity` 687、
`.set_pos` 211、`[call]` 135、`.clear` 70、`.directions` 59。

母本 0234.rb 的渲染管线（**这一节是本轮最花时间的部分，因为必须读到原始语义**）：

1. **夜层**：一块屏幕大小的精灵，用「**负向屏幕色调取反**」的颜色填充
   （例：tone = (-68,-51,-68) → 夜层色 (68,51,68)），`blend_type = 2`。
   同时把色调里负的那几路**归零**（`tone.red += -r if r < 0`），
   避免引擎色调与夜层重复生效。
2. **打洞**：每盏可见的灯被 `Bitmap#blt` 画进夜层位图，`opacity` 用灯自己的
   `opacity`，**完全不读 `sprite.color`** —— 这就是为什么一盏「全 0 颜色」的灯
   白天不可见、夜里却仍然「阻止画面变暗」。
3. **彩色光晕**：同一盏灯**另外**还是一个真实精灵（z = 0xC000 + 1、`blend_type = 1` 叠加），
   带 `sprite.color`。手电筒的颜色只来自这里。

**三个必须自己查证、不能靠印象的语义**（都拿母本自带的说明文档 0235.rb 定案）：

| 语义 | 我的第一判断 | 查证后的事实 | 证据 |
|---|---|---|---|
| `blend_type` 编号 | 以为 2 是 multiply | **0 Normal / 1 Addition / 2 Subtraction** | 0235.rb 第 287–292 行原文 |
| RGSS `Sprite#color` | 以为是**乘算**染色 | 是**按 alpha 用颜色替换**（`rgb = lerp(src.rgb, color.rgb, a/255)`，源 alpha 保留） | 0235.rb 第 218–233 行：`set_color(255,0,0,255)` 注释为 `# => red light`，且「全 0 颜色 ⇒ 白天不可见、夜里只阻止变暗」 |
| 打洞的机制 | 以为是灯自己变亮 | 是**在夜层上打洞** | 0235.rb 同段 + 法文社区原文「les lumières feront comme des trous dans un masque」 |

第二条是关键：`torch.png` 经逐像素读取确认是 **纯黑 + alpha 遮罩**
（中心 `(0,0,0,255)`、四角 `(0,0,0,0)`、半径方向 alpha 渐隐，200×200，
移植前后两个副本字节一致）。**黑源图 + 乘算染色 = 永远是黑的**，
那 `# => red light` 就永远不可能成立。所以只能是替换。
在纯黑源图上替换退化成 `rgb = color.rgb * (alpha/255)`，
于是光晕 = 用灯的颜色填充、再按源图 alpha 裁剪（canvas `destination-in`）。
这同时消掉了我原先「原始层 + 染色层」两级精灵的复杂度 —— 一级就够，
而且颜色的 alpha 可以并到 `sprite.opacity` 上，不必为每个动画中间帧各存一张位图。

**PIXI 没有减法混合**（MV 的 WebGL 只原生实现 normal/add/multiply/screen；
canvas 渲染器的 `'difference'` 在 WebGL 下会静默退化成 normal）。夜层因此
改成用 **MULTIPLY + 补色**：`S - D` 记为 `S × (255 - D) / 255`。
两者在纯黑处一致（都是 0）、在全白处一致（都是 `255-D`），**打洞语义完全相同**
（洞处 `D = 0` ⇒ 乘数 255 ⇒ 原样恢复），只是中间调略亮一档、且永不削顶 ——
对一个原本没按 MV 色彩预览过的夜景来说，这是安全的方向。
`blend_type = 2`（减法）本身映射到 MULTIPLY（唯一能「按形状压暗」的模式），
并在注释里写明这是近似。

**世界缩放**：VX Ace 32px 网格 / 544×416 屏 → MV 48px / 816×624，
世界素材已按 1.5× 放大。但 `img/pictures` **保持 1:1**（`torch.png` 两版都是
200×200），所以灯的位置与缩放必须自己乘 `WORLD_SCALE = 48/32`。
漏了这一步，一支火把只会照亮 4 格而不是 6 格。

**接线**：`JsonEx._decode` 靠 `window[value['@']]` 还原原型，所以
`Game_Light` / `Game_Shadow` 必须挂到 `window`；灯光注册表挂
`$gameMap._monlineLights`（`DataManager.makeSaveContents` 会序列化 `$gameMap`，
于是灯光随存档往返）。`Game_Map#setup` 时清掉 `chara_id >= 0` 的灯
（锚在事件上的灯换个地图就没了），但保留 `-1`（玩家火把）—— 与母本一致。

### 系统移植之二：Hime Picture Anchors（0239.rb）

`anchor_picture_to_screen` 656 次、`anchor_picture_to_event` 1 次。母本把锚点
存进 `Game_Picture#anchor`，在 `Sprite_Picture#update_position` 里改写坐标。

移植要点：锚点只在 `Game_Picture#initialize` 里重置成屏幕锚；坐标公式与母本
逐字对应 —— 角色锚 `chara.screenX() + picture.x()`，地图锚
`(tile - $gameMap.displayX()) * tileWidth()`。

### 本轮校验结果

```
static_check  MOVEROUTE-45  982/982,  EVENT-355  2094/2094,  TOTAL COMPILE FAILURES: 0
unit_check    13114 条负载；UNIT CHECK PASSED（新增 23 条灯光渲染断言 + 锚点遮蔽断言）
              裸调用 语句位置 280 处 → 全部为真调用
                     表达式位置 13 处 → 一处未动
```

`RUBY_PENDING` 前后对比（冒烟实测）：

| | 基线（第一轮结束） | 本轮结束 |
|---|---|---|
| `light.*` | 3539 | **0** |
| `anchor_picture_to_*` | 657 | **0** |
| `show_fog` / `fade_fog` / `tint_fog` | 19 | 19 |
| `cam_set` / `cam_center` / `cam_follow` | 4 | 4 |
| `chain_commands` / `zoom_event_sprite` / `nel_textpop` | 4 | 5 |
| `map_effects.set_zoom` | 3 | 3 |
| `log_window.*` | 6 | 7 |
| **合计** | **4233** | **39** |

其余指标：`RUBY_ERRORS 0 in 0 group(s)`、`GUARD_REPORTS 0`、
`MISSING_ASSETS 0`、`NET_FAILURES 0`、`ERR_SCREENS none`、
`HARD_ERRORS none`、**`VERDICT PASS`**。

> `show_fog` 等仍是非零，是**有意保留**的：它们确实还没移植，
> 但必须继续出现在清单里，否则 Phase 2 就没法按量级排序了（见根因 27）。

### 本轮新增文件

| 文件 | 说明 |
|---|---|
| `js/plugins/MonlineLights.js` | ~700 行，Zeus81 Lights & Shadows 移植（夜层 / 打洞 / 叠加光晕 / 数据类 / 解释器代理） |
| `js/plugins/MonlinePicAnchor.js` | ~180 行，Hime Picture Anchors 移植（7 个锚点函数 + `Sprite_Picture` 坐标改写） |
| `js/plugins.js` | 插件顺序：`MonlineShim` → `MonlinePicAnchor` → `MonlineLights` → `MonlineRubyBridge` |

### 明确记录的已知缺口

- **`Sprite#wave_*`** 在 MV 里没有对应物，属性存得住、调用不崩，但不产生波动。
  源数据从未调用 `set_wave`。
- **阴影（shadow）不渲染**。数据从未调用 `shadow` / `set_shadowable`，
  且 MV 的图块集不带 VX Ace 的阴影位。数据类与 API 存在，脚本不会崩。
- **`angle`（旋转）只作用于叠加光晕，不作用于夜层的洞** —— 这一条**与母本一致**：
  0235.rb 自己说明「angle works but only for daylights」，因为 `Bitmap#blt`
  本来就无法旋转。

### 两个工程副本的同步状态（本轮更新）

| | `Monline-MV/`（主，可运行） | `mv_project/`（供 MV 编辑器打开） |
|---|---|---|
| `js/plugins/` 全部插件 | ✅ | ✅ 已同步（本轮新增 2 个插件 + 桥接 + `plugins.js`） |
| `data/` 524 个 JSON | ✅ | ✅ 一致（`diff -rq` 无差异） |
| `img/` 世界素材 | ✅ 已 1.5× 放大 | ⚠️ **仍是旧的 1:1 版本**（`characters`/`enemies`/`faces`/`parallaxes`/`animations`/`battlebacks*` 全部不同） |

`mv_project/` 的**代码与数据**现在与主工程一致；只有世界素材还是放大前的旧版本，
它只影响「在 MV 编辑器里打开时的预览」。若要补齐，把 `Monline-MV/img` 整目录覆盖过去即可。

---

## 14. 第五轮：Galv 相机控制移植 + UI 现状体检

### 工作清单的方法修正（重要）

上一轮我拿 `RUBY_PENDING` 当 Phase 2 的优先级依据。它是**运行时**统计的，
只覆盖冒烟走过的那几条路径 —— 严重低估。补了 `_shots/census.js`，
用与 `unit_check.js` **完全相同**的负载提取逻辑（递归遍历 `list`、
按 `command355` 的方式拼接 355+655）扫全部 **13,114** 条脚本负载，得到全量：

| 系统 | 全量 | 状态 |
|---|---|---|
| `light`（Zeus81） | 8865 | ✅ |
| `map_effects`（Zeus81） | 1241 | 待做（最重） |
| 雾 `show_fog`+`fade_fog`+`tint_fog`（Shaz） | 805 | 待做 |
| 选项 `hide_choice`+`disable_choice`+`combine_choices` | 707 | 待做 |
| `nel_textpop` | 604 | 待做 |
| `cam_set`+`cam_center`+`cam_follow`（Galv） | 607 | ✅ |
| `anchor_picture_to_*`（Hime） | 657 | ✅ |
| `global_save` / `global_load` | 607 | 待做 |
| 其余十余个小系统 | ~400 | 待做 |

冒烟里 `RUBY_PENDING` 从 **4233 归到 39**，但真正剩余工作量约 **7,900 次调用**。
两者差两个数量级 —— 这就是"用抽样当总体"的代价。

### 根因 28：`F` 里的桩**遮蔽**已移植的真实现（诊断谎报）

`MonlineRubyBridge` 的 `COSMETIC.forEach` 会把一批名字装到求值器的 `with` 对象 `F` 上。
`with` 的命中优先级高于 `window`，所以 MonlinePicAnchor 明明已把 7 个锚点函数装到
`window`，**只要 `F` 里有同名桩，真实现永远拿不到控制权**；而 `RUBY_PENDING` 里
`anchor_picture_to_screen: 654` 看起来像"还没移植"。诊断系统在**说谎**。

**修法**：加 `isRealPort(name)` 守卫。判据的关键在于**不能只看 `typeof`** ——
`MonlineShim` 早于桥接加载，给每个只是"中和掉"的系统（`show_fog`、`cam_*`、`fade_fog`…）
都装了**无标记的占位空函数**，靠 `typeof` 区分不开。必须读 shim 自己的账本：

```js
function isRealPort(name) {
    if (typeof window[name] !== 'function') { return false; }
    if (window[name].__rubyStub) { return false; }
    if (window.MonlineShim.functions.indexOf(name) >= 0) { return false; } // 仍是占位符
    return true;
}
```

> **同一个坑我当场踩了第二次**：第一版判据只写 `typeof window[n] === 'function'`，
> 结果 `show_fog` / `cam_*` / `zoom_event_sprite` 这些**只有占位符**的名字被当成真实现，
> 桥接不再装计数桩 → 它们从 `RUBY_PENDING` 里**整个消失**。功能上没坏（本来也是空桩），
> 但 Phase 2 的工作清单凭空少了一批名字。是冒烟里 `show_fog: 10` 忽然变成 0 才暴露的。
> 已改成读 shim 账本，并加了双向单测断言。

### 系统移植：Galv Cam Control v1.4（0216.rb）→ `MonlineCamera.js`

`cam_target` 就是全部状态机：`0` = 玩家驱动（MV 默认）、`-1` = 锁死、`>0` = 跟随某事件。
`cam_set/cam_center/cam_follow` 都是「锁 → 滚到目标 → （center 才）解锁」。

**两个必须自己发现的引擎差异**：

1. **MV 的 `Game_Map#doScroll` 只实现了 2/4/6/8 四个正方向，没有对角线。**
   而母本的 `scroll_to_target` 每步会从 8 个方向里挑 —— 需要斜着走时，
   `startScroll(1/3/7/9, ...)` 在 MV 里**什么都不动**，镜头原地卡死。
   必须像母本的 `#overwrite def do_scroll` 一样把对角线用两个正方向组合补回来。

2. **`Fiber.yield while scrolling?` 在 MV 里没有对应物。**
   母本用它**阻塞事件**直到卷屏结束（切镜头的时序全靠它）。MV 的解释器是
   `update()` 驱动而非协程驱动，因此给桥接加了一条通用通道：

   ```js
   MR.waitFor(mode)   // 由移植插件调用
   ```
   `command355` 求值后消费它 → `this.setWaitMode(mode)`；`MonlineCamera`
   在 `updateWaitMode()` 里每帧推进一步，把 Ruby 的 `loop do ... end`
   做成状态机。MV 的 `update()` 循环正好在 `command355` 返回后检查
   `updateWait()`，所以等待立即生效。

3. **`Game_Character#x` / `#y` 在 MV 里是只读访问器属性，不是方法。**
   `Object.defineProperties(Game_CharacterBase.prototype, { x: { get: ... } })`。
   我第一版写成 `chara.x()` —— **单测全绿，因为桩把 `x` 写成了方法**；
   浏览器立刻 `TypeError: chara.x is not a function`，把解释器打死后
   后续所有探针（传送、菜单、战斗）连锁失败。

   → 由此新增**引擎形状守卫**：`engineShapes()` 直接解析 `rpg_js` 源码，
   取出 `defineProperties` 的访问器名与 `prototype.X = function` 的方法名，
   逐项断言"**桩的形状 === 引擎的形状**"。
   *测试桩撒谎比没有测试更危险* —— 这次的教训值得单独记一条。

4. **安全兜底**：镜头计划 600 帧（约 10 秒）未收敛就放弃并直接吸附。
   母本靠协程把坏状态局部化，这里的解释器链是全图共享的，宁可少走一段也不冻结地图。

**验证**：单元 39 条断言（含对角线方向选择、边界阻断、比屏幕小的地图、不可达目标、
跟随目标消失、锁定时抑制玩家卷屏、wait mode 释放与死亡解释器清理）；
浏览器冒烟新增 `REGRESSIONS.camera`，用**引擎自身的正方向行为作对照**验证
"方向 1 == 下 + 左"（不依赖地图尺寸，且在真 WebGL 引擎里跑）→ 全绿。

### UI 现状体检（第三阶段前置调查，尚未动手）

用户反馈"界面/字体颜色有强行兼容的拼接感"。查证结果 —— **不是编码乱码，是版式/取色/字体三层全不对位**：

| 现象 | 根因 | 证据 |
|---|---|---|
| 对话框**没有外框** | MV 的外框九宫格取 `x 96..192`，而移植进来的是 VX Ace 版式的 `Window.png`（**128×128**）→ 越界 | `Window#_refreshFrame`：`blt(skin,120,0,48,24)` 等，需宽 ≥192 |
| 画面上的**洋红方块**与零散青点 | 暂停符取 `(144,96)`、光标取 `(100,100,40,40)`、箭头取 `(132,24)`/`(132,60)` → 全部越界，拿到无关像素 | `_refreshCursor` / `_refreshPauseSign` / `_refreshArrows` |
| **所有 `\C[n]` 彩色文字变纯黑** | MV 的 `textColor(n)` 从 `(96+(n%8)*12+6, 144+(n/8)*12+6)` 取色，越界 → `Bitmap#getPixel` 返回 `'#000000'` | `rpg_windows.js:173` + `rpg_core.js:1196` |
| 字体"时代感"不足 | `System.json` **缺 `fontFace`** → `standardFontFace()` 回退 `'GameFont'`，实际是 **M+ 1m**（2000 年代日文字体） | `fonts/mplus-1m-regular.ttf` |

要点：MV 的 `Bitmap#getPixel` 返回的是 **`'#rrggbb'` 字符串且不含 alpha**，
越界时是 `'#000000'` 而**不是透明** —— 所以症状是"彩字全变黑"而不是"字看不见"，
很容易被误判成正常的黑字而不是缺陷。

另：游戏正文是**纯英文**（整个 `data/` 里 CJK 字符数为 **0**，`locale: en_US`、
`terms` 全英文），所以与字符集无关，纯粹是视觉对位问题。

**任务已登记**（#6 重建 192×192 MV 版式皮肤、#7 现代字体栈与窗调），
按用户要求排在移植完成之后执行。

### 本轮校验结果

```
static_check  982/982 + 2094/2094, TOTAL COMPILE FAILURES: 0
unit_check    UNIT CHECK PASSED
              （新增 39 条相机断言、13 条引擎形状守卫、23 条灯光渲染断言）
smoke         VERDICT PASS | RUBY_ERRORS 0 | HARD_ERRORS none | ERR_SCREENS none
              MISSING_ASSETS 0 | NET_FAILURES 0 | REGRESSIONS.camera 全绿
RUBY_PENDING  light.* 与 anchor_picture_* 全部归零；cam_* 由 607 归零
```

---

## 15. 第六轮：素材格式全量核查 + 界面层换成 MV 版

用户要求顺序：**先确认素材转换全部完成 → 再把界面细枝末节换成更适合 MV 的版本 →
最后才对素材做现代化**。本轮完成前两步。

### 15.1 全量素材审计（新增 `_shots/asset_audit.js`）

运行时的 `MISSING_ASSETS 0` **不可信** —— 它只统计冒烟走过的那几条路径。
新增脚本按 15 个类别、覆盖每一个引用点（DB 字段、地图头部、事件命令 231/283/241/245/249/250/355、
CommonEvents、Troops）把 510 张地图 + 全库扫一遍。

> 脚本自己踩了两个坑，都记在注释里：
> ① 一开始只查 `audio/<名字>`，而音频在 `audio/bgm|bgs|me|se/` 子目录 → 误报 74 个缺失。
> ② 一开始假设地图 JSON 是 MV 编辑器的 `[{...}]` 数组形式；实际运行时读的是
> `$dataMap.width/.data/.events`（`DataManager.makeEmptyMap` 就是建一个**普通对象**），
> 数组形式是**编辑器**的形态 → 导致 `parallaxes`/`battlebacks`/`pictures` 整类"看不见"。
> 顺带核实：`events` 数组确实以 **id 为下标**（`[null, {id:1,...}]`），与
> `Game_Event.prototype.event()` 的 `$dataMap.events[this._eventId]` 一致 ✓。

**结果（修正后）**：

| 类别 | 引用次数 | 去重 | 缺失 |
|---|---|---|---|
| characters | 11098 | 508 | **0** |
| pictures | 7512 | 4468 | 26（死引用，见下） |
| audio se / me / bgm / bgs | 3728 / 377 / 369 / 192 | 220 / 12 / 60 / 16 | **0 / 0 / 0 / 0** |
| tilesets / enemies / animations / parallaxes | 305 / 213 / 227 / 105 | 142 / 203 / 137 / 63 | **0** |
| battlebacks1 / battlebacks2 | 228 / 129 | 74 / 39 | **6 / 7**（本轮修复） |
| faces / fogs / titles1 | 26 / 133 / 1 | 23 / 5 / 1 | **0** |

### 修复：13 个战斗背景漏拷（根因 29）

`port_assets.py` 的 `scan_data` 在**地图头部只收集了 `parallaxName`**，
漏了 `battleback1Name` / `battleback2Name`；`System.json` 里的那两个是**默认值**，
不是每张地图的覆盖值。所以 141 处地图级战斗背景从未被请求。

修法：在收集元组里补上这两个键，然后重跑 —— **13 个全部来自 VX Ace RTP，0 unresolved**。
`Monline-MV` 补 13 个、`mv_project` 补 46 个。修完 `battlebacks1/2` 缺失归零。

### 26 个图片缺失：确认为**原游戏自带的死引用**

`Pentagram1..9`（各 ×2）与 `Beret1`/`Echidna11`/`Lamia265`/`PrincessMaid2148` 等 17 个。
已核实这些名字在**源工程归档、VX Ace RTP 里都不存在**，而现存的是
`Beret174a`/`Beret184a` 这种「名字+编号+后缀」形态 —— 说明原脚本是**动态拼接**图片名，
部分组合本来就没有素材。原版游戏同样缺这些图，属**无害死引用**（归零是做不到的，
任何来源都没有）。

**结论：素材格式转换已完成。** 音频 100%；图片 14/15 类别 100%，唯一缺口是上述死引用。

### 15.2 界面层：`img/system` 与 MV 原版逐项对比

这是"强行兼容的拼接感"的**主要来源**。三张图被 MV 按错误尺寸读取 —— 而且**都不报错**：

| 文件 | 移植后 | MV 需要 | 后果 |
|---|---|---|---|
| `Window.png` | 128×128（VX Ace 版式） | **192×192** | 无外框；光标/箭头/暂停符取到无关像素（画面上的**洋红方块**）；**32 个文字颜色全部越界 → `getPixel` 返回 `'#000000'` → 所有 `\C[n]` 彩字变纯黑** |
| `Balloon.png` | 256×320（VX Ace，32px 格） | **384×720（48px 格）** | 表情气泡取错帧 |
| `IconSet.png` | 384×20000（**24px 格**） | 16 列 × **32px 格** | 见下 |

MV 的具体读取位置（`js/rpg_core.js` / `rpg_windows.js`）：

```
外框九宫格 margin=24 : x 96..192, y 0..96      # _refreshFrame
光标九宫格 margin=4  : x 96..144, y 96..144    # _refreshCursor
上/下箭头            : (132,24,24,12) / (132,60,24,12)
暂停符 4 帧 24×24    : (144,96)
32 个文字颜色        : (96+(n%8)*12+6, 144+(n/8)*12+6)   # textColor()
```

**修法**：直接从本机 MV 安装目录取原版皮肤 ——
`SteamLibrary/.../RPG Maker MV/NewData/img/system/{Window,Balloon}.png`。
这是**定义上**的 MV 原生版式，一次解决外框、装饰乱码、彩字全黑三个问题。

**已验证**：皮肤 192×192；`textColor(0) = '#ffffff'`、`textColor(1) = '#20a0d6'`
（以前两者都是 `#000000`）✓

### 根因 30：图标表格子尺寸与纹理上限（本轮最隐蔽的一个）

`Window_Base._iconWidth = 32` / `_iconHeight = 32` 是**硬编码**（`rpg_windows.js:30`），
`Sprite_StateIcon` 另有一份同样的硬编码。而游戏自带的 `IconSet.png` 是
**384×20000、24px 格、16 列**（VX Ace 网格；946 个不同图标、最大索引 13321 → 833 行）。

两个问题，**都不会抛异常**：

1. **格子错位**：用 32px 去切 24px 网格，每个图标被裁掉 1/3 并串入邻居；
   第 12–15 列（x ≥ 384）**完全落在 384 宽的图外**。
   浏览器实测：`icon13` 取样 x=416 → **0 像素**；`icon0` 只能拿到 6/64 格。
2. **纹理超限**：20000px 高 > `MAX_TEXTURE_SIZE`（实测本机 WebGL = **16384**，
   ANGLE 路径 **8192**）。PIXI 会拒绝上传 → WebGL 下**整张表什么都不显示**。
   （无头环境回退到了 canvas 渲染器才没暴露这条。）

**修法**（刻意**不**重采样：24→32 是 4/3 非整数缩放，会让像素画出现锯齿）：

- 新增 `split_iconset.py`：把主表按 **256 行/块**（256×24 = 6144px，对 8192 上限也安全）
  切成 4 块，块 0 保留 `IconSet` 原名（MV 自己的 `reserveSystem('IconSet')` 仍取到有效文件）。
- 新增 `js/plugins/MonlineIconSet.js`：
  把 `Window_Base._iconWidth/_iconHeight` 与 `Sprite_StateIcon._iconWidth/_iconHeight`
  设为**真实的 24**（MV 的图标布局全部由这两个常量推导，改它们不会造成别处错位）；
  重写 `drawIcon` 与 `Sprite_StateIcon.updateFrame`，**按行选块**；并预热全部 4 块。

**验证**（`_shots/probe_icons.js`，走插件的真实路径并数像素）：

```
iconW/iconH        24 / 24              （原 32/32）
icon13             chunk 0, sx=312      （原 416，越界 0 像素）→ 172 像素
4095 / 4096        块 0 末行 / 块 1 首行  → 块接缝正确切换
icon13321          chunk 3, sy=1536     （原 26624，越界 0 像素）→ 402 像素
drawIcon(13321)    经引擎真入口出 402 像素
4 块全部加载       6144 / 6144 / 6144 / 1560
```

### 15.3 字体与窗口色调

- **字体**：MV 的 `standardFontFace()` **根本不读 `$dataSystem.fontFace`**（MV 的
  System.json 里也没有这个字段），它只看 `$dataSystem.locale`：`zh*` → SimHei、
  `ko*` → Dotum、**其余一律 `'GameFont'`** —— 而 MV 捆绑的 `GameFont` 是
  `fonts/mplus-1m-regular.ttf`（**M+ 1m，2000 年代日文字体**）。
  所以字体**必须用插件覆盖**，改数据无效。新增 `js/plugins/MonlineUIStyle.js`：
  `Segoe UI, Microsoft YaHei UI, Microsoft YaHei, PingFang SC, Hiragino Sans GB,
  Noto Sans SC, Helvetica Neue, Arial, sans-serif`
  —— 拉丁文用现代系统 UI 字体，后面保留 CJK 覆盖，将来做中文化也不会掉回衬线体。
- **窗口色调**：`System.json` 的 `windowTone` 原本是 VX Ace 的紫色 `[34,0,34,0]`，
  配 MV 的蓝色皮肤发浑 → 改为 MV 默认 `[0,0,0,0]`（两个工程都已改）。

### 本轮校验结果

```
asset_audit   510 张地图 / 15 类别：仅 pictures 26 个死引用缺失，其余全 0
static_check  982/982 + 2094/2094, TOTAL COMPILE FAILURES: 0
unit_check    UNIT CHECK PASSED
probe_icons   图标尺寸/分块/接缝/高位图标/皮肤取色/字体 全部符合预期
smoke         REGRESSIONS.systemAssets 已加入（防止被悄悄改回去）
```

---

## 16. 第七轮：图片格式真转换 + 缺失素材填补

用户确认两件事：**① 把不支持格式的源图片真正转换格式（而不是用运行时查表绕过）；
② 缺失素材可以自行填补，"符合就行"**。

### 16.1 把 3302 张 JPEG 真正转成 PNG，并移除 146KB 的运行时查表

MV 构造图片 URL 的方式是**无条件追加 `.png`**（`rpg_managers.js:861`）：

```js
var path = folder + encodeURIComponent(filename) + '.png';
```

所以 `.jpg` 在 MV 里**根本不可达**，此前靠 `MonlineImageExt.js`（146KB、3302 条
例外表 + `loadBitmap` 覆盖）在运行时改写 URL。实测该表 3302 条 = 磁盘上
3300 个 `.jpg` + 2 个 `.jpeg`，一一对应。

**决定真转换**（而不是把 JPEG 改名成 `.png`）—— 改名靠浏览器的格式嗅探也能跑，
但那只是把"运行时查表"换成了"文件元数据撒谎"，本质没变，也正是要摆脱的拼接感。

实测体积：40 张随机样本 **×2.31**，全量 375 MB → **781 MB**（`img` 1.6 GB → ~2.1 GB）。

新增 `convert_images.py`：
- 全部转为**真 PNG**（无损，`compress_level=9`），源文件默认**保留**；
- 同名 `.png` 已存在的 3 个 `.jpg` 是**不可达死重**（MV 只会请求 `.png`）→ 跳过不覆盖；
- **转换与删源分离**（`--delete-sources`，默认关）。这一步是被教训教出来的：
  第一版边转边删，一轮删到第 50 个文件时触发了删除安全护栏而中断
  （49 个已完成）。改成默认不删之后，重跑是幂等且便宜的；
  残留的 `.jpg` 对 MV 完全不可见，删除可以作为一个独立的、显式的决定。

**结果**：`Monline-MV` 3251 张转换成功、0 失败；`mv_project` 同样处理。
**`MonlineImageExt.js` 随之成为死代码，已从两个工程中移除**（`plugins.js` 与文件本体），
MV 现在走原生路径。

> **附带发现**：3302 个源 JPEG 里有 **1366 个（41%）尾部截断**
> （PIL 报 `image file is truncated` / `broken data stream`）。已核对它们与
> `extracted/` 里的原件**逐字节相同** —— 也就是说截断是**原游戏自带的**，
> 原版 VX Ace 也是靠容错解码器渲染的。转换时用
> `ImageFile.LOAD_TRUNCATED_IMAGES = True` 复现浏览器的行为（渲染到断点为止），
> 并逐个计数列出，而不是静默丢弃。

### 16.2 缺失素材填补（26 张，全部"符合"）

这 26 个名字是 `Show Picture`(231) 命令里的**字面参数**（不是脚本拼出来的），
且在源归档、VX Ace RTP、MV RTP 里**都不存在** —— 原游戏本身就缺。
已核实 231 的参数是 VX Ace 的 10 参形态（含 `positionMode`），与 MV 的
`command231`（`_params[3] === 0` 分支）**完全兼容**，7464 条无一错位 ✓。

新增 `fill_missing_assets.py`，按**实际用法**分四类填补（全部 544×416、`.png`、
绝不覆盖已存在文件）：

| 类别 | 名字 | 做法 | 依据 |
|---|---|---|---|
| 不可见 | `Beret1` | 全透明 544×416 | 该场景以 **opacity 0** 显示它，诚实的替代就是"没有东西"，只是不再报加载错误 |
| 自绘 | `Pentagram1..9` | 用游戏自带的灰度五芒星角色图（`Characters/$Pentagram.png`）**上色 + 九步旋转** 成魔法阵 | 逐帧依次显示，是仪式特效；用游戏自己的图形派生最贴合 |
| 同族替代 | `Echidna6/8/11/12`、`Nereid1`、`Dullahan2`、`PrincessMaid48/266/271/325/2148/2149` | **按编号取最近同族图** | 这些名字都是 `怪物名+编号` 的阶段/变体 CG（`PrincessMaid` 有 221 张），同族即同一角色 |
| 同族替代 | `Wurm2`/`Wurm8` | 最近 `Sandwurm*`（`Wurm8`→`Sandwurm8` 精确命中） | 源里 `Wurm*.png` **一张都没有**，该生物的图片族实际叫 `Sandwurm*` |
| 角色原画合成 | `Lamia265/288` | `img/enemies/Lamia.png` 合成到暗色背景上 | Lamia 没有任何图片族，但**它自己的战斗立绘在**，比拿别的角色替代更贴合 |

**复审：15 个类别、`TOTAL missing distinct assets: 0`** ✓

### 16.3 顺带清理

- `img/tilesets/*.txt`（31 个）是 VX Ace RTP 的自动元件名称表（`Water A|水場A`），
  非游戏素材、MV 不会读取 → 保留（无害），仅在此记录。

### 本轮校验结果

```
asset_audit   TOTAL missing distinct assets: 0   （15 类全 0）
convert       3251 转换 / 0 失败 / 1366 截断源按浏览器方式渲染
fill          26/26 写入，0 覆盖既有文件
static_check  982/982 + 2094/2094, TOTAL COMPILE FAILURES: 0
unit_check    UNIT CHECK PASSED
smoke         REGRESSIONS.systemAssets + camera 断言全部保留
```

---

## 17. 第八轮：事件数据核对 + 修女精灵图配错的根因

用户报告两件事：**① 测试时发现"很多事件缺失"；② 恶魔区教堂修女的精灵图配错**。

### 17.1 事件数据：与源逐项核对，**完全一致**（新增 `audit_events.py`）

先做客观核对，而不是猜。用 `fixreader.py`（`fix_tables.py` 重建数据时用的同一个解析器）
读 `vxace_data_backup/Map*.rvdata2`，与 `Monline-MV/data/Map*.json` 逐项对比。

**关键结构事实**：VX Ace 的 `RPG::Map#events` 是 **Hash（id → 事件）**，
而 MV 是**以 id 为下标的数组**（`[null, {id:1}, ...]`）；转换已正确做了这个映射 ✓。

```
maps compared            : 510
total events             : 13622（两侧完全相同）
missing events           : 0
invented events          : 0
position mismatches      : 0
page-count mismatches    : 0
command-count mismatches : 0
sprite mismatches        : 0
trigger/priority 不一致  : 0
```

**结论：事件数据没有丢失也没有错配。** 玩家看到的"事件缺失"不是数据层问题。

> **我自己的审计错了两次，都记在这里以免重蹈：**
> ① 一开始读源事件页的 `@image` —— VX Ace 实际叫 **`@graphic`**
> （`RPG::Event::Page::Graphic`，`fix_pageimage.py` 才把它改名成 MV 的 `image`）。
> 用错字段会让**每一页**都返回空，于是凭空报出 **14272 处"精灵图不一致"**。
> 是拿 `Map006.rvdata2` 的**原始字节**去 grep `!ITEMChests004` —— 明明存在 —— 才拆穿的。
> ② 一开始以为 `Map008` 多了事件 id=11：那是把**数组长度**（含下标 0 的 `null`）当成了事件数。
>
> 教训：**跨引擎核对时，先确认字段名的引擎差异；任何"大规模不一致"的结论，
> 都要用第二种独立证据交叉验证一次再下结论。**

### 17.2 修女精灵图配错：根因是 **163 个 RTP 素材被换成了 MV 版**（新增 `fix_rtp_sources.py`）

顺着修女定位：恶魔区教堂（Map072 / Map376 / Map377，`Church Undercroft`）的
修女事件（`Nun 1`/`Nun 2`/`Nun`）用的都是 **`People2` + characterIndex 1**。

而 `People2.png` 的实际来源：

| 来源 | 尺寸 | 归一化哈希 |
|---|---|---|
| 游戏自带 | 无 | — |
| **VX Ace RTP** | 384×256 | `a27c94193651` |
| MV RTP | 576×384 | `40e05008c300` |
| **移植后（修复前）** | 576×384 | `40e05008c300` ← **是 MV 版** |

**同一个 `characterIndex: 1` 在两张表上是不同的人** —— 修女因此显示成了 MV 版里那个人。

**为什么会被顶替**：`port_assets.py` 只补"缺失"的文件，而更早的 `copy_rtp.py`
已经把一批 **MV RTP** 的同名文件放进了工程，于是 `port_assets.py` 看到文件已存在就跳过了，
**再也没有回头用 VX Ace 的版本**。

**修复**：新增 `fix_rtp_sources.py` —— 只有当「移植文件 == MV RTP 版本」**且**
「VX Ace 有同名文件」时才替换，并按工程的 **×1.5 最近邻**规则放大后写回。
共替换 **163 个**文件，包括：

- `img/characters`：`People1-4`（**所有 NPC**）、`Actor1-3`（玩家角色）、
  `!Door1` / `!Chest` / `!Switch1-2` / `!Flame` / `!Crystal` / `!$Gate1-2`、
  `Damage1-3`、`Evil`、`Vehicle`、`$BigMonster1-2` 等 24 个
- `img/faces`：`People1-4`、`Actor1-3`、`Evil` 等
- `img/enemies`：全部被顶替的敌人战斗图
- `img/parallaxes`、`img/battlebacks1/2`

**刻意排除**：
- `img/system` —— `Window.png`/`Balloon.png` 是**有意**换成 MV 版的（第 15 节），换回去会毁掉那个修复；
- `img/tilesets` —— 两代引擎图块集几何不同，且地图 `data` 是按现有表转换的，替换会让全图瓦片错位。

**复核**：`People2.png` 的哈希现在等于 VX Ace 版 `a27c94193651` ✓

### 本轮校验结果

```
audit_events   510 张地图 / 13622 事件：0 缺失 0 错配
fix_rtp        163 个文件换回 VX Ace 版（×1.5），People2 已复核
asset_audit    15 类 TOTAL missing distinct assets: 0
static_check   982/982 + 2094/2094, TOTAL COMPILE FAILURES: 0
unit_check     UNIT CHECK PASSED
smoke          VERDICT PASS
```

---

## 18. 第九轮：系统性移植缺失的系统（雾效 / 选项 / 自定义场景）

用户要求：**"这种类型的错误要修复不要再犯，通通都要移植"**。
起因是 `SceneManager.call(Scene_LearnSkill)` 抛出（MV 根本没有这个场景）。
所以这一轮不再等逐个报错，而是**先全量扫出所有"被引用的未定义类"，再整体移植**。

### 18.1 全量扫描：数据里引用的未定义类，一共只有 3 个（脚本 `check_undefined.js` 思路）

做法：收集工程（引擎 + 全部插件）定义的类名，再扫全部脚本负载（355/45/111/122）
里的 `Scene_ / Window_ / Sprite_ / Game_ / Data_ / RPG_` 前缀标识符，取差集。

```
referenced class-like names: 4   not defined in the project: 3

  Scene_Crafting         11 次
  Scene_LearnSkill        2 次
  Scene_PXEBestChoose     1 次
```

**这就是全部。** 顺带把扫描范围扩到源脚本内部，才看到它们还会连带引用
`Encyclopedia` / `Scene_MonsterCatalogue`（0148.rb 的菜单入口），一并处理。

> 关键教训：**MV 里 `function Scene_X(){}` 写在插件 IIFE 里不是全局**，而
> `SceneManager.call(...)` 在翻译后的脚本里是**通过桥接的作用域代理读 `window[name]`**
> 解析的 —— 所以每个场景都必须 `window.Scene_X = Scene_X;` 才算修好。
> 这点已写进单测（断言 `typeof window.Scene_Crafting === 'function'`）。

### 18.2 新增 `MonlineFog.js` —— Shaz Multi Layer Fog v2.0（0246.rb，805 次调用）

| VX Ace | MV 对应 |
|---|---|
| `Plane` | `TilingSprite` |
| `Plane#ox/oy` | `TilingSprite#origin`（MV 的 `updateTransform` 转成 `tilePosition = -origin`） |
| `Plane#zoom_x/zoom_y` | `tileScale` |
| per-fog tone | `ToneFilter`：`reset() → adjustTone() → adjustSaturation(-gray)` |

- 雾贴图按 1:1 移植而世界是 ×1.5，所以 **zoom 与漂移都乘 `WORLD_SCALE`**，保持相对世界的观感一致；
- `ox/oy = displayX*48 + sx2*1.5`，`sx2 -= sx/8`（母本语义：`@sx = @sx2 = sx`，即从速度开始递减）；
- 透明度/色调用 Zeus 式定长缓动 `(v*(d-1)+target)/d`；
- `z` 默认 `300 + number`（数据从不传），负 z 走"地图之下、远景之上"分支；
- 换图清空（`CLEAR_ON_TRANSFER`）、战斗场景同样显示（`BATTLE_FOGS`）；
- hue 用**位图缓存**（数据只用到 0 与 100 两档）。

**过程中修掉两个真 bug（都被单测锁住）**：
1. **开局即崩**：`Game_Screen#initialize` 会调 `this.clear()`，此时 `$gameScreen` 还是 null，
   而容器走了全局变量 → `TypeError` → 游戏根本起不来。改成**基于传入实例**。
2. **读档后崩**：`$gameScreen` 进存档，`JsonEx` 靠 `window[类名]` 还原原型 →
   没注册 `window.Game_Fog` 时读档返回普通对象，下一帧 `store[k].update is not a function`。

### 18.3 新增 `MonlineChoice.js` —— Tsuki Choice Options（0117.rb，707 次调用）

- `hide_choice(n, 条件)`：把选项**从列表移除**，但保留 `可见位置 → 原始索引` 映射；
- `disable_choice(n, 条件)`：保留可见、不可选、绘制变暗（`isEnabled`）；
- `text_choice` / `color_choice`：改标签 / 改颜色；
- 取消项若本身被隐藏或禁用，则**禁止取消**；
- 条件通过 `MonlineRuby.evalExpr` 求值，并绑定母本的 `v / s / p / t` 简写。

**关键设计**：`_choices` **保持完整**（不重排），只在 `Window_ChoiceList` 里过滤、在
`callOkHandler` 里把可见位置映射回原始索引 —— 这样 MV 自己的取消语义与事件分支表都不受影响。

> 踩坑：`evalExpr` 是 `return (...);` 包装的，所以条件**必须是单个表达式**。
> 一开始写 `var v=$game_variables; (cond)` → 语法错误 → 所有条件静默为 false。
> 改成 IIFE：`(function(v,s,p,t){return (cond);})($game_variables, ...)`。

### 18.4 新增 `MonlineScenes.js` —— 三个 MV 没有的自定义场景

三者**全部是 note 标签驱动**，所以数据里本来就有全部信息：

**Scene_Crafting**（0187.rb，Coelocanth 合成系统，11 次引用）
`<craft item:id:qty>` / `<craft weapon:..>` / `<craft armor:..>` / `<craft gold:N>` /
`<craft switch:N>` / `<craft recipe:N>` → 解析后按类目列出可合成物，材料不足则禁用，确认即扣除并产出。

**Scene_LearnSkill**（0126.rb，YEA Learn Skill Engine，2 次引用）
`<learn cost: N jp|exp|gold>` / `<learn require switch: N>` → 列出可学技能，扣 JP/EXP/金币后学会。
顺带实现 `Game_Actor` 的 JP 池（`jp / gain_jp / lose_jp`），因为原版是 YEA-JPManager 提供的。

**Scene_PXEBestChoose**（0148.rb，1 次引用）
六项命令菜单：PXEpedia / Bestiary / Functions / Augment / PXE Shop / Return，
分别路由到百科、怪物图鉴、`Scene_LearnSkill`（角色 25）、`Scene_Equip`（角色 25）、
`Scene_Map` + 公共事件 82、返回。

**Scene_MonsterCatalogue / Encyclopedia**：原版这两块是庞大的独立脚本，
其"已见过/已击败"状态在转换中丢失，故移植为**可用的精简版**（列出敌人名录 + 名称）。

> 又踩一个低级但致命的坑：注释里写 `Scene_*/Window_*/Sprite_*` 时，
> 其中的 **`*/` 会提前结束块注释**，后面内容变成代码 → 整个插件语法错误。
> 我"修"这一句时又在说明文字里写了一次 `*/`（同一个坑踩两遍），已彻底删除。

### 本轮校验结果

```
check_undefined  数据引用的未定义类：3 个 → 全部移植
unit_check       UNIT CHECK PASSED
                 雾效 26 条 + 选项 18 条 + 场景 20 条断言
static_check     0 编译失败
smoke            VERDICT PASS
RUBY_PENDING     {"map_effects.set_zoom":3,"chain_commands":1,"nel_textpop":1,
                  "zoom_event_sprite":2,"log_window.add_text":4,
                  "log_window.wait_and_clear":3,"?totally_undefined_ruby_call":1}
```
