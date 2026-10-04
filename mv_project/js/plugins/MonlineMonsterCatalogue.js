//=============================================================================
// MonlineMonsterCatalogue.js
//=============================================================================
/*:
 * @plugindesc Faithful port of modern algebra's Monster Catalogue (0147.rb): the bestiary scene.
 * @author Monline port
 *
 * @help
 * 0147.rb is the game's bestiary.  It is 2001 lines of Ruby and, unlike the
 * stand-in it replaces (a bare `$dataEnemies` name list with no categories, no
 * stats, no battler and no encounter tracking), it is driven entirely by
 * notetags that the converted database *does* carry:
 *
 *     160 enemies with  \category[n]      (zone tabs)
 *     161 enemies with  \species[n]       (icon + species line)
 *     155 enemies with  \desc{...}        (weakness / resist help line)
 *      51 enemies with  \hide_from_catalog (never listed)
 *
 * What is reproduced
 *   * MAMC_CONFIG verbatim (categories, species, shown stats, colours,
 *     sort order, completion format, frame/battler options);
 *   * Game_System's three tracking arrays (encounter / analyze / hidden) and
 *     `mamc_data_conditions_met?`;
 *   * Game_Enemy#die / #transform registering an encounter, and \analyze items
 *     registering an analysis;
 *   * the four windows - category tabs (icon-only), category label + completion
 *     counter, the monster list, and the monster card (battler, name, species,
 *     8 stats in two columns, framed);
 *   * `beastiarycheck` - the 78 switches that reveal 116 monsters;
 *   * Scene_MonsterCatalogue's window layout and the script calls
 *     `call_monster_catalogue`, `encounter_monster`, `analyze_monster`,
 *     `hide_monster`, `reveal_monster`.
 *
 * Engine differences that need care
 *   * VX Ace is 544x416, MV is 816x624.  Anything measured in *screen* space
 *     (the list width, the help window) is scaled by 1.5; anything measured
 *     against an icon is left at 24, which is the real cell size of the
 *     ported IconSet (see MonlineIconSet.js).
 *   * `Cache.battler` is synchronous in RGSS3; `ImageManager.loadEnemy` is not.
 *     The card therefore redraws itself once the battler bitmap reports ready.
 *   * Ruby's `blt(x, y, bmp, rect, opacity)` has no opacity in MV, so
 *     `bltAlpha` sets `globalAlpha` around the draw for the two-part battler.
 */
//=============================================================================

var MonlineMonsterCatalogue = MonlineMonsterCatalogue || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // MAMC_CONFIG - verbatim from 0147.rb:97
    //-------------------------------------------------------------------------
    var CFG = {
        show_entry_when: 'encounter',
        show_battler_when: 'encounter',
        show_data_when: 'encounter',
        complete_when: 'encounter',
        show_completion: 'fraction',
        absent_monster_name: '???',
        shown_stats: ['mhp', 'mmp', 'atk', 'def', 'mat', 'mdf', 'agi', 'luk'],
        // 0147.rb writes these as :"Vocab.hp" / :"Vocab.param(n)" so they
        // follow the database Terms - same thing via MV's TextManager.
        shown_stat_labels: {
            mhp: function () { return TextManager.basic(0); },
            mmp: function () { return TextManager.basic(1); },
            atk: function () { return TextManager.param(2); },
            def: function () { return TextManager.param(3); },
            mat: function () { return TextManager.param(4); },
            mdf: function () { return TextManager.param(5); },
            agi: function () { return TextManager.param(6); },
            luk: function () { return TextManager.param(7); }
        },
        stats_label: 'Stats',
        // ID is the 1-based place in this array (0147.rb:207)
        species: [
            [9072, 'Divine'], [9073, 'Beast'], [9074, 'Bird'],
            [9075, 'Humanlike'], [9076, 'Devil'], [9077, 'Elemental'],
            [9078, 'Anomaly'], [9079, 'Fish'], [9080, 'Golem'],
            [9081, 'Insect'], [9082, 'Empowered'], [9083, 'Plant'],
            [9084, 'Reptile'], [9085, 'Slime'], [9086, 'Undead'],
            [9087, 'Yokai'], [9071, 'Human']
        ],
        menu_access: false,
        menu_index: 4,
        menu_label: 'Bestiary',
        map_access: false,
        // 0147.rb:147 - the Ruby says `:R`.  MV's Input has no 'R' in its
        // keyMapper, so the key is registered as 'monlineR' further down and
        // resolved at the point of use.
        map_button: 'R',
        silhouette: false,
        // ID is the place in this array; 0 is "all" (0147.rb:279)
        categories: [
            [334, 'Bestiary'], [8870, 'Forest Zone'], [8871, 'Coastal Zone'],
            [8872, 'Demon Zone'], [8873, 'Desolate Zone'],
            [8874, 'Desert Zone'], [8875, 'Mythic Zone'],
            [8876, 'Tower Zone'], [8877, 'Unknown Area']
        ],
        shown_categories: [1, 2, 3, 4, 5, 6, 8],
        hide_category_cursor: true,
        list_window_width: 216,
        desc_window_lines: 1,
        sort_by: 'encounter',
        number_by: 'none',
        number_format: '%d. ',
        frame_width: 2,
        battler_opacity: 255,
        battler_opacity_under_stats: 128,
        windowskin: false,
        font_name: false,
        show_monster_icon: false,
        inherit_species_icon: true,
        system_colour: 'system_color',
        normal_colour: 'normal_color',
        frame_colour: 'system_color',
        frame_shadow_colour: [0, 0, 0, 128],
        species_colour: 8,
        silhouette_colour: [0, 0, 0],
        complete_colour: 3,
        completion_label: '',
        fraction_format: '%d/%d',
        percent_format: '%.1f%%'
    };

    // 0147.rb:412 - drop category ids that have no definition
    CFG.shown_categories = CFG.shown_categories.filter(function (n) {
        return !!CFG.categories[n];
    });
    if (!CFG.shown_categories.length) { CFG.shown_categories = [0]; }

    //-------------------------------------------------------------------------
    // 0147.rb:1659 beastiarycheck - the switches that reveal a monster.
    // Verbatim from the Ruby: 78 switches, 116 monster ids.
    //-------------------------------------------------------------------------
    var SWITCH_REVEALS = {
        101: [1],
        102: [2, 3],
        103: [4],
        104: [5],
        105: [6],
        106: [7],
        107: [8],
        108: [10],
        109: [12],
        110: [13],
        111: [14],
        112: [15],
        113: [16],
        114: [17],
        115: [18],
        116: [11],
        117: [19],
        118: [20],
        119: [21],
        120: [63, 65, 66, 67, 68, 69, 70, 71, 22],
        121: [77, 79, 23],
        122: [24],
        123: [25],
        124: [26],
        125: [80, 27],
        126: [28],
        127: [29],
        128: [30],
        129: [31],
        130: [32],
        131: [34],
        132: [35],
        133: [36],
        134: [117, 37, 38],
        135: [40],
        136: [122, 41],
        137: [42],
        138: [43],
        139: [44],
        140: [45],
        141: [46],
        142: [47],
        143: [48],
        144: [130, 131, 134, 135, 138, 139, 140],
        145: [50],
        146: [51],
        147: [55],
        148: [54],
        149: [56],
        150: [58],
        151: [132],
        152: [142],
        154: [177, 178, 174],
        156: [61],
        157: [64],
        158: [76],
        159: [78],
        160: [89],
        161: [85],
        162: [86, 87, 88],
        163: [90],
        164: [91],
        165: [93],
        166: [98, 99],
        167: [100, 101],
        168: [113, 114, 115, 116],
        169: [176],
        170: [189, 190, 191],
        171: [156],
        172: [157, 158, 159],
        173: [170],
        174: [171, 172, 173],
        175: [162],
        176: [166],
        177: [167],
        178: [127],
        179: [174],
        180: [94, 95, 96]
    };

    //-------------------------------------------------------------------------
    // Screen scale: the Ruby's pixel constants were tuned for 544x416.
    //-------------------------------------------------------------------------
    function scale() { return Graphics.boxWidth / 544; }
    function listWidth() { return Math.round(CFG.list_window_width * scale()); }

    // 0147.rb:1276 reads `monster.send(stat)`.  VX Ace's Game_Enemy has mhp /
    // atk / agi accessors; MV's Game_BattlerBase only exposes param(id), so
    // the eight shown stats map onto the eight parameter ids.
    var STAT_PARAM = { mhp: 0, mmp: 1, atk: 2, def: 3, mat: 4, mdf: 5, agi: 6, luk: 7 };

    function sprintf2(fmt, a, b) {
        return fmt.replace(/%d/, String(a)).replace(/%d/, String(b));
    }
    function sprintf1(fmt, a) {
        return fmt.replace(/%d/, String(a));
    }

    //-------------------------------------------------------------------------
    // RPG::Enemy additions (0147.rb:440)
    //
    // MV's $dataEnemies entries are plain JSON objects, so the Ruby's memoised
    // readers become a single lazily-built cache hung off each enemy with a
    // non-enumerable property (the database is never serialised into a save,
    // so this cannot leak into save files).
    //-------------------------------------------------------------------------
    var INFO = '_mamcInfo';

    function info(enemy) {
        if (!enemy) { return null; }
        if (enemy[INFO]) { return enemy[INFO]; }
        var note = String(enemy.note || '');
        var o = {};

        var dm = /\\(?:DESCRIPTION|DESC)\{([\s\S]+?)\}/im.exec(note);
        if (dm) {
            o.description = dm[1].replace(/[\r\n]/g, '')
                                 .replace(/\\n/gi, '\n');
        } else {
            o.description = '';
        }

        var im = /\\ICON\[\s*(\d+)\s*\]/i.exec(note);
        o.icon = im ? parseInt(im[1], 10) : undefined;
        var sm = /\\SPECIES\[\s*(\d+)\s*\]/i.exec(note);
        o.species = sm ? parseInt(sm[1], 10) : 0;
        if (o.icon === undefined && CFG.inherit_species_icon &&
            o.species >= 1 && CFG.species[o.species - 1]) {
            o.icon = CFG.species[o.species - 1][0];
        }
        if (typeof o.icon !== 'number') { o.icon = 0; }

        o.categories = [0];
        var cm = /\\CATEGOR(?:Y|IES)\[([^\]]*)\]/i.exec(note);
        if (cm) {
            (cm[1].match(/\d+/g) || []).forEach(function (d) {
                var v = parseInt(d, 10);
                if (o.categories.indexOf(v) < 0) { o.categories.push(v); }
            });
        }

        o.hide = /\\HIDE_FROM_CATALOG/i.test(note);

        var sl = /\\SILHOUETTE\[\s*["']([^"']+)["'][,;:\s]*H?(\d*)\s*\]/i.exec(note);
        o.silhouette = sl ? [sl[1], parseInt(sl[2] || '0', 10)] : [];

        Object.defineProperty(enemy, INFO, {
            value: o, enumerable: false, configurable: true, writable: true
        });
        return o;
    }
    MonlineMonsterCatalogue.info = info;

    function analyzeItem(item) {
        return !!item && /\\ANALYZE/i.test(String(item.note || ''));
    }

    //-------------------------------------------------------------------------
    // Game_System (0147.rb:523)
    //-------------------------------------------------------------------------
    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _Game_System_initialize.call(this);
        this._mamcEncounter = [];
        this._mamcAnalyze = [];
        this._mamcHidden = null;
    };

    Game_System.prototype.mamcEncounterAry = function () {
        if (!this._mamcEncounter) { this._mamcEncounter = []; }
        return this._mamcEncounter;
    };
    Game_System.prototype.mamcAnalyzeAry = function () {
        if (!this._mamcAnalyze) { this._mamcAnalyze = []; }
        return this._mamcAnalyze;
    };
    // 0147.rb:543 - lazily seeded from the \hide_from_catalog notetags
    Game_System.prototype.mamcHideAry = function () {
        if (!this._mamcHidden) {
            this._mamcHidden = [];
            var ary = this._mamcHidden;
            ($dataEnemies || []).forEach(function (e) {
                if (e && info(e).hide) { ary.push(e.id); }
            });
        }
        return this._mamcHidden;
    };
    function union(ary, ids) {
        for (var i = 0; i < ids.length; i++) {
            var v = parseInt(ids[i], 10);
            if (!isNaN(v) && ary.indexOf(v) < 0) { ary.push(v); }
        }
    }
    Game_System.prototype.mamcEncounterMonster = function () {
        union(this.mamcEncounterAry(), arguments);
    };
    Game_System.prototype.mamcAnalyzeMonster = function () {
        union(this.mamcAnalyzeAry(), arguments);
    };
    // 0147.rb:553
    Game_System.prototype.mamcDataConditionsMet = function (condition, id) {
        id = parseInt(id, 10) || 0;
        switch (condition) {
        case 'always': return true;
        case 'encounter': return this.mamcEncounterAry().indexOf(id) >= 0;
        case 'analyze': return this.mamcAnalyzeAry().indexOf(id) >= 0;
        }
        return false;
    };
    Game_System.prototype.mamcHideMonster = function (id) {
        var a = this.mamcHideAry();
        id = parseInt(id, 10);
        if (a.indexOf(id) < 0) { a.push(id); }
    };
    Game_System.prototype.mamcRevealMonster = function (id) {
        var a = this.mamcHideAry();
        var i = a.indexOf(parseInt(id, 10));
        if (i >= 0) { a.splice(i, 1); }
    };

    //-------------------------------------------------------------------------
    // Game_Enemy (0147.rb:572) - dying or transforming counts as an encounter
    //-------------------------------------------------------------------------
    function remember(self) {
        var e = self.enemy ? self.enemy() : null;
        if (self.exists && !self.exists()) { return; }
        if (e && $gameSystem) { $gameSystem.mamcEncounterMonster(e.id); }
    }
    var _Game_Enemy_die = Game_Enemy.prototype.die;
    Game_Enemy.prototype.die = function () {
        remember(this);
        return _Game_Enemy_die.apply(this, arguments);
    };
    var _Game_Enemy_transform = Game_Enemy.prototype.transform;
    Game_Enemy.prototype.transform = function (enemyId) {
        remember(this);
        return _Game_Enemy_transform.apply(this, arguments);
    };

    // \analyze items (0147.rb:593) - MV has no Game_Battler#item_user_effect,
    // so the item application is hooked instead.
    var _applyItemUserEffect = Game_Action.prototype.applyItemUserEffect;
    Game_Action.prototype.applyItemUserEffect = function (target) {
        _applyItemUserEffect.apply(this, arguments);
        var item = this.item();
        if (!analyzeItem(item) || !target || !$gameSystem) { return; }
        if (typeof target.isEnemy !== 'function' || !target.isEnemy()) { return; }
        var e = target.enemy ? target.enemy() : null;
        if (!e) { return; }
        $gameSystem.mamcAnalyzeMonster(e.id);
        target._mamcAnalyzeNow = true;
        if (target._result && target._result.success !== undefined) {
            target._result.success = true;
        }
    };

    //-------------------------------------------------------------------------
    // MAMC_WindowAdditions (0147.rb:645)
    //-------------------------------------------------------------------------
    var ADD = {
        // 0147.rb:665 - Integer / Symbol / Array, like the Ruby's case
        mamcTextColor: function (param) {
            if (typeof param === 'number') { return this.textColor(param); }
            if (typeof param === 'string') {
                if (param === 'normal_color') { return this.normalColor(); }
                if (param === 'system_color') { return this.systemColor(); }
                return this.normalColor();
            }
            if (param instanceof Array) {
                var c = new Color(param[0], param[1], param[2]);
                c.alpha = (param.length > 3 ? param[3] : 255);
                return c.toCss ? c.toCss() : c;
            }
            return this.normalColor();
        },
        mamcNormalColor: function () {
            var c = CFG.normal_colour;
            return c === 'normal_color' ? this.normalColor() : this.mamcTextColor(c);
        },
        mamcSystemColor: function () {
            var c = CFG.system_colour;
            return c === 'system_color' ? this.systemColor() : this.mamcTextColor(c);
        },
        mamcChangeColor: function (colour, enabled) {
            this.changeTextColor(colour);
            this.changePaintOpacity(enabled !== false);
        }
    };
    function extendWindow(proto) {
        Object.keys(ADD).forEach(function (k) { proto[k] = ADD[k]; });
    }

    function bltAlpha(dest, dx, dy, src, sx, sy, sw, sh, opacity) {
        if (!src || !src.isReady || (src.isReady && !src.isReady())) { return; }
        var ctx = dest._context;
        var old = ctx.globalAlpha;
        ctx.globalAlpha = (opacity === undefined ? 255 : opacity) / 255;
        dest.blt(src, sx, sy, sw, sh, dx, dy);
        ctx.globalAlpha = old;
        dest._setDirty && dest._setDirty();
    }

    //-------------------------------------------------------------------------
    // Window_MonsterCategory (0147.rb:693) - the icon-only zone tabs
    //-------------------------------------------------------------------------
    function Window_MonsterCategory() { this.initialize.apply(this, arguments); }
    Window_MonsterCategory.prototype = Object.create(Window_HorzCommand.prototype);
    Window_MonsterCategory.prototype.constructor = Window_MonsterCategory;
    extendWindow(Window_MonsterCategory.prototype);

    Window_MonsterCategory.prototype.initialize = function (x, y) {
        Window_HorzCommand.prototype.initialize.call(this, x, y);
    };
    Window_MonsterCategory.prototype.windowWidth = function () {
        return listWidth();
    };
    // 0147.rb:709
    Window_MonsterCategory.prototype.maxCols = function () {
        return Math.min(Math.floor((this.width - this.standardPadding()) /
                                   (24 + this.spacing())), this.maxItems());
    };
    Window_MonsterCategory.prototype.maxItems = function () {
        return this._list ? this._list.length : 0;
    };
    Window_MonsterCategory.prototype.makeCommandList = function () {
        var self = this;
        CFG.shown_categories.forEach(function (cat) {
            var ary = CFG.categories[cat];
            self.addCommand(ary[1], 'cat' + cat, true, ary[0]);
        });
    };
    Window_MonsterCategory.prototype.itemRect = function (index) {
        return Window_HorzCommand.prototype.itemRect.call(this, index);
    };
    // 0147.rb:730 - only the icon, centred, bright when selected
    Window_MonsterCategory.prototype.drawItem = function (index) {
        if (!this._list || !this._list[index]) { return; }
        var rect = this.itemRect(index);
        this.contents.clearRect(rect.x, rect.y, rect.width, rect.height);
        this.changePaintOpacity(this.isEnabled(index));
        this.drawIcon(this._list[index].ext,
                      rect.x + Math.floor((rect.width - 24) / 2), rect.y + 1);
        this.changePaintOpacity(true);
    };
    // 0147.rb:738 - only the selected tab is drawn lit
    Window_MonsterCategory.prototype.isEnabled = function (index) {
        return this.index() === index;
    };
    Window_MonsterCategory.prototype.isCommandEnabled = function () {
        return true;
    };
    // 0147.rb:744 - redraw both ends of the move instead of a full refresh
    Window_MonsterCategory.prototype.select = function (index) {
        var old = this.index();
        Window_Selectable.prototype.select.call(this, index);
        if (this.contents && old !== this.index()) {
            if (old >= 0) { this.drawItem(old); }
            if (this.index() >= 0) { this.drawItem(this.index()); }
        }
    };
    // 0147.rb:753
    Window_MonsterCategory.prototype.update = function () {
        Window_HorzCommand.prototype.update.call(this);
        var cat = CFG.shown_categories[this.index()];
        if (this._monsterListWindow && cat !== undefined) {
            this._monsterListWindow.category = cat;
        }
        if (this._labelWindow && cat !== undefined) {
            this._labelWindow.category = cat;
        }
    };
    // 0147.rb:775 - :hide_category_cursor
    Window_MonsterCategory.prototype.updateCursor = function () {
        if (CFG.hide_category_cursor) {
            this.setCursorRect(0, 0, 0, 0);
        } else {
            Window_Selectable.prototype.updateCursor.call(this);
        }
    };
    MonlineMonsterCatalogue.Window_MonsterCategory = Window_MonsterCategory;

    //-------------------------------------------------------------------------
    // Window_MonsterCategoryLabel (0147.rb:787) - zone name + completion
    //-------------------------------------------------------------------------
    function Window_MonsterCategoryLabel() { this.initialize.apply(this, arguments); }
    Window_MonsterCategoryLabel.prototype = Object.create(Window_Base.prototype);
    Window_MonsterCategoryLabel.prototype.constructor = Window_MonsterCategoryLabel;
    extendWindow(Window_MonsterCategoryLabel.prototype);

    Window_MonsterCategoryLabel.prototype.initialize = function (x, y) {
        Window_Base.prototype.initialize.call(this, x, y,
                                              this.windowWidth(), this.windowHeight());
        this.refresh(CFG.shown_categories[0]);
    };
    Window_MonsterCategoryLabel.prototype.windowWidth = function () {
        return listWidth();
    };
    // 0147.rb:864
    Window_MonsterCategoryLabel.prototype.windowHeight = function () {
        var h = this.standardPadding() * 2 + this.lineHeight();
        if (CFG.show_completion !== 'none') { h += this.lineHeight(); }
        return h;
    };
    Window_MonsterCategoryLabel.prototype.refresh = function (categoryId) {
        if (categoryId === undefined || categoryId === null) {
            categoryId = this._category;
        }
        this._category = categoryId;
        this.contents.clear();
        var label = (CFG.categories[categoryId] || ['', ''])[1];
        this.mamcChangeColor(this.mamcSystemColor());
        this.contents.fontBold = true;
        this.drawText(label, 0, 0, this.contentsWidth(), 'center');
        this.contents.fontBold = false;
        if (CFG.show_completion !== 'none') {
            this.drawCompletion(0, this.lineHeight());
        }
    };
    // 0147.rb:809
    Window_MonsterCategoryLabel.prototype.drawCompletion = function (x, y) {
        var align = 'center';
        if (CFG.completion_label) {
            this.mamcChangeColor(this.mamcSystemColor());
            this.drawText(CFG.completion_label, x, y,
                          this.contentsWidth(), this.lineHeight());
            align = 'right';
        }
        var c = this.getCompletion();
        var colour = (c[0] === c[1] && c[1] > 0)
            ? this.mamcTextColor(CFG.complete_colour)
            : this.mamcNormalColor();
        this.mamcChangeColor(colour);
        this.drawText(this.completionToString(c[0], c[1]), x, y,
                      this.contentsWidth(), align);
    };
    // 0147.rb:825
    Window_MonsterCategoryLabel.prototype.getCompletion = function () {
        var a = 0, b = 0;
        var hidden = $gameSystem ? $gameSystem.mamcHideAry() : [];
        ($dataEnemies || []).forEach(function (enemy) {
            if (!enemy) { return; }
            var inf = info(enemy);
            if (inf.categories.indexOf(this._category) < 0) { return; }
            if (hidden.indexOf(enemy.id) >= 0) { return; }
            b += 1;
            if ($gameSystem &&
                $gameSystem.mamcDataConditionsMet(CFG.complete_when, enemy.id)) {
                a += 1;
            }
        }, this);
        return [a, b];
    };
    // 0147.rb:838
    Window_MonsterCategoryLabel.prototype.completionToString = function (a, b) {
        if (b === 0) { return ''; }
        if (CFG.show_completion === 'fraction') { return sprintf2(CFG.fraction_format, a, b); }
        if (CFG.show_completion === 'percent') {
            return (a / b * 100).toFixed(1) + '%';
        }
        return '';
    };
    // 0147.rb:850
    Window_MonsterCategoryLabel.prototype.setCategory = function (category) {
        if (this._category === category) { return; }
        this.refresh(category);
    };
    Object.defineProperty(Window_MonsterCategoryLabel.prototype, 'category', {
        configurable: true,
        get: function () { return this._category; },
        set: function (v) { this.setCategory(v); }
    });
    MonlineMonsterCatalogue.Window_MonsterCategoryLabel = Window_MonsterCategoryLabel;

    //-------------------------------------------------------------------------
    // Window_MonsterList (0147.rb:877)
    //-------------------------------------------------------------------------
    function Window_MonsterList() { this.initialize.apply(this, arguments); }
    Window_MonsterList.prototype = Object.create(Window_Selectable.prototype);
    Window_MonsterList.prototype.constructor = Window_MonsterList;
    extendWindow(Window_MonsterList.prototype);

    Window_MonsterList.prototype.initialize = function (x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this._data = [];
        this.select(0);
        this.activate();
    };
    // 0147.rb:891
    Window_MonsterList.prototype.setCategory = function (category) {
        if (this._category === category) { return; }
        this._category = category;
        this.refresh();
        this.select(0);
        this.setTopRow(0);
    };
    Object.defineProperty(Window_MonsterList.prototype, 'category', {
        configurable: true,
        get: function () { return this._category; },
        set: function (v) { this.setCategory(v); }
    });
    Window_MonsterList.prototype.maxCols = function () { return 1; };
    Window_MonsterList.prototype.maxItems = function () {
        return this._data ? this._data.length : 0;
    };
    Window_MonsterList.prototype.item = function () {
        return (this._data && this.index() >= 0) ? this._data[this.index()] : null;
    };
    Window_MonsterList.prototype.currentItemEnabled = function () {
        return this.isEntryEnabled(this.item());
    };
    // 0147.rb:925
    Window_MonsterList.prototype.include = function (enemy) {
        if (!enemy) { return false; }
        if (info(enemy).categories.indexOf(this._category) < 0) { return false; }
        if ($gameSystem && $gameSystem.mamcHideAry().indexOf(enemy.id) >= 0) {
            return false;
        }
        return $gameSystem
            ? $gameSystem.mamcDataConditionsMet(CFG.show_entry_when, enemy.id)
            : false;
    };
    // 0147.rb:933 (aliased as show_name?)
    Window_MonsterList.prototype.isEntryEnabled = function (enemy) {
        if (!enemy || !$gameSystem) { return false; }
        return $gameSystem.mamcDataConditionsMet(CFG.show_battler_when, enemy.id) ||
               $gameSystem.mamcDataConditionsMet(CFG.show_data_when, enemy.id);
    };
    // 0147.rb:942
    Window_MonsterList.prototype.makeItemList = function () {
        var self = this;
        this._data = ($dataEnemies || []).filter(function (e) {
            return e && self.include(e);
        });
        if (CFG.sort_by === 'alphabet') {
            this._data.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
        } else if (CFG.sort_by === 'encounter') {
            var order = $gameSystem ? $gameSystem.mamcEncounterAry().slice().reverse() : [];
            order.forEach(function (id) {
                var enemy = $dataEnemies ? $dataEnemies[id] : null;
                if (!enemy) { return; }
                var at = self._data.indexOf(enemy);
                if (at >= 0) {
                    self._data.splice(at, 1);
                    self._data.unshift(enemy);
                }
            });
        }
    };
    // 0147.rb:958
    Window_MonsterList.prototype.drawItem = function (index) {
        var enemy = this._data[index];
        if (!enemy) { return; }
        var rect = this.itemRectForText(index);
        var enabled = this.isEntryEnabled(enemy);
        this.mamcChangeColor(this.mamcNormalColor(), enabled);
        if (CFG.number_by && CFG.number_by !== 'none') {
            this.drawNumber(index, rect);
        }
        if (this.isEntryEnabled(enemy)) {
            this.drawText(enemy.name, rect.x, rect.y, rect.width);
        } else {
            var x = rect.x, w = rect.width;
            if (CFG.show_monster_icon) { x += 24; w -= 24; }
            this.drawText(CFG.absent_monster_name, x, rect.y, w);
        }
    };
    // 0147.rb:983
    Window_MonsterList.prototype.drawNumber = function (index, rect) {
        var num = CFG.number_by === 'id' ? this._data[index].id : index + 1;
        var s = sprintf1(CFG.number_format, num);
        var tw = this.textWidth(s);
        this.drawText(s, rect.x, rect.y, rect.width);
        rect.x += tw;
        rect.width -= tw;
    };
    Window_MonsterList.prototype.refresh = function () {
        this.makeItemList();
        Window_Selectable.prototype.refresh.call(this);
    };
    // 0147.rb:1005 - the "help window" is the monster card
    Window_MonsterList.prototype.updateHelp = function () {
        if (this._helpWindow && this._helpWindow.setMonsterId) {
            this._helpWindow.setMonsterId(this.item() ? this.item().id : 0);
        }
    };
    MonlineMonsterCatalogue.Window_MonsterList = Window_MonsterList;

    //-------------------------------------------------------------------------
    // Window_MonsterCard (0147.rb:1016)
    //-------------------------------------------------------------------------
    function Window_MonsterCard() { this.initialize.apply(this, arguments); }
    Window_MonsterCard.prototype = Object.create(Window_Selectable.prototype);
    Window_MonsterCard.prototype.constructor = Window_MonsterCard;
    extendWindow(Window_MonsterCard.prototype);

    Window_MonsterCard.prototype.initialize = function (x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this._monsterId = 0;
        this._monster = null;
        this.refresh(0);
    };

    // 0147.rb:1033
    Window_MonsterCard.prototype.refresh = function (monsterId) {
        if (monsterId === undefined || monsterId === null) { monsterId = this._monsterId; }
        monsterId = monsterId || 0;
        if (monsterId && monsterId instanceof Game_Enemy) {
            this._monster = monsterId;
            this._monsterId = this._monster.enemy() ? this._monster.enemy().id : 0;
        } else {
            this._monsterId = monsterId;
            this._monster = monsterId > 0 ? new Game_Enemy(monsterId, 0, 0) : null;
        }
        this.contents.clear();
        this.resetFontSettings();
        this._needBattler = false;
        var w = CFG.frame_width;
        if (this._monsterId > 0 &&
            (this.showBattler() || CFG.silhouette)) {
            this.drawBattler(1 + w * 2, 4 + w * 4 + this.lineHeight(),
                             !this.showBattler());
        }
        this.drawFrame();
        if (this.showData() && this.shownStats().length) { this.drawStatsLabel(); }
        if (this._monster) { this.drawName(6 + w * 2, 2 + w * 2); }
        if (this.showData()) {
            this.drawSpecies(6 + w * 2, 4 + w * 4 + this.lineHeight());
            this.drawStats();
        }
        this.updateHelp();
    };
    Window_MonsterCard.prototype.setMonsterId = function (id) {
        if (this._monsterId !== id) { this.refresh(id); }
    };
    Object.defineProperty(Window_MonsterCard.prototype, 'monster_id', {
        configurable: true,
        get: function () { return this._monsterId; },
        set: function (v) { this.setMonsterId(v); }
    });

    // 0147.rb:1064
    Window_MonsterCard.prototype.drawFrame = function () {
        var w = CFG.frame_width;
        var wd = this.contentsWidth() - 2 - w;
        var hg = this.contentsHeight() - 2 - w;
        this.drawBasicFrame(1 + w, 1 + w, wd, hg,
                            this.mamcTextColor(CFG.frame_shadow_colour));
        this.drawBasicFrame(1, 1, wd, hg, this.mamcTextColor(CFG.frame_colour));
    };
    // 0147.rb:1074
    Window_MonsterCard.prototype.drawBasicFrame = function (x, y, width, height, colour) {
        var w = CFG.frame_width;
        var c = this.contents;
        c.fillRect(x, y, width, w, colour);
        c.fillRect(x, y + this.lineHeight() + (w + 1) * 2, width, w, colour);
        c.fillRect(x, y + height - w, width, w, colour);
        c.fillRect(x, y, w, height, colour);
        c.fillRect(x + width - w, y, w, height, colour);
    };
    // 0147.rb:1087
    Window_MonsterCard.prototype.drawStatDivider = function (x, y, width, labelX, tw, colour) {
        var w = CFG.frame_width;
        this.contents.fillRect(x, y, labelX - x, w, colour);
        this.contents.fillRect(labelX + tw, y, width - ((labelX - x) + tw), w, colour);
    };
    // 0147.rb:1095
    Window_MonsterCard.prototype.drawStatsLabel = function () {
        var w = CFG.frame_width;
        this.contents.fontBold = true;
        var stw = this.textWidth(CFG.stats_label) + 8;
        var lx = 34;
        var y = this.statY();
        this.drawStatDivider(1 + w, y + this.lineHeight() / 2 + w,
                             this.contentsWidth() - 2 - 3 * w, lx, stw,
                             this.mamcTextColor(CFG.frame_shadow_colour));
        this.drawStatDivider(1, y + this.lineHeight() / 2,
                             this.contentsWidth() - 2 - w, lx, stw,
                             this.mamcTextColor(CFG.frame_colour));
        this.mamcChangeColor(this.mamcTextColor(CFG.frame_colour));
        this.drawText(CFG.stats_label, lx, y, stw, 'center');
        this.resetFontSettings();
    };
    // 0147.rb:1110
    Window_MonsterCard.prototype.drawBattler = function (x, y, silhouette) {
        var bmp = this.setupBattlerGraphic(x, y, silhouette);
        var clearHght = Math.max(this.statY() + (this.lineHeight() / 2) - y, 0);
        var srcH = Math.min(clearHght, bmp.height);
        if (srcH > 0) {
            bltAlpha(this.contents, x, y, bmp, 0, 0, bmp.width, srcH,
                     CFG.battler_opacity);
        }
        if (bmp.height > clearHght) {
            bltAlpha(this.contents, x, y + clearHght, bmp, 0, clearHght,
                     bmp.width, bmp.height - clearHght,
                     CFG.battler_opacity_under_stats);
        }
        // `ImageManager.loadEnemy` is asynchronous; flag a redraw for when the
        // bitmap lands, but only while it is genuinely pending - otherwise the
        // refresh/refresh cycle never settles.
        if (this._battlerSource && !this._battlerSource.isReady()) {
            this._pendingBattler = true;
        }
    };
    Window_MonsterCard.prototype.drawName = function (x, y) {
        this.mamcChangeColor(this.mamcNormalColor());
        this.drawText(this.monsterName(), x, y,
                      this.contentsWidth() - 2 * x, this.lineHeight());
    };
    // 0147.rb:1133
    Window_MonsterCard.prototype.drawSpecies = function (x, y) {
        var enemy = this._monster ? this._monster.enemy() : null;
        if (!enemy) { return; }
        var sid = info(enemy).species;
        if (sid < 1) { return; }
        var entry = CFG.species[sid - 1];
        if (!entry) { return; }
        this.drawIcon(entry[0], x, y);
        this.mamcChangeColor(this.mamcTextColor(CFG.species_colour));
        this.drawText(entry[1], x + 24, y,
                      this.contentsWidth() - x * 2, this.lineHeight());
    };
    // 0147.rb:1144
    Window_MonsterCard.prototype.drawStats = function () {
        var w = CFG.frame_width;
        var x = 6 + w * 2;
        var y = this.statY() + this.lineHeight();
        var width = Math.floor((this.contentsWidth() - x * 2) / 2) - 8;
        var stats = this.shownStats();
        for (var i = 0; i < stats.length; i++) {
            this.drawStat(x + ((i % 2) * (width + 16)),
                          y + (Math.floor(i / 2) * this.lineHeight()),
                          width, stats[i]);
        }
    };
    // 0147.rb:1156
    Window_MonsterCard.prototype.drawStat = function (x, y, width, stat) {
        var val = this.statValue(stat);
        var labelFn = CFG.shown_stat_labels[stat];
        var label = labelFn ? labelFn() : stat;
        var tw = this.textWidth(val) + 4;
        this.mamcChangeColor(this.mamcSystemColor());
        this.drawText(label, x, y, width - tw, this.lineHeight());
        this.mamcChangeColor(this.mamcNormalColor());
        this.drawText(val, x, y, width, 'right');
    };
    // 0147.rb:1169
    Window_MonsterCard.prototype.showData = function (monsterId) {
        if (monsterId === undefined) { monsterId = this._monsterId; }
        if (!(monsterId >= 1) || !$dataEnemies || monsterId > $dataEnemies.length - 1) {
            return false;
        }
        return $gameSystem
            ? $gameSystem.mamcDataConditionsMet(CFG.show_data_when, monsterId)
            : false;
    };
    // 0147.rb:1176
    Window_MonsterCard.prototype.showBattler = function (monsterId) {
        if (monsterId === undefined) { monsterId = this._monsterId; }
        if (!(monsterId >= 1) || !$dataEnemies || monsterId > $dataEnemies.length - 1) {
            return false;
        }
        if (this.showData(monsterId)) { return true; }
        return $gameSystem
            ? $gameSystem.mamcDataConditionsMet(CFG.show_battler_when, monsterId)
            : false;
    };
    // 0147.rb:1183
    Window_MonsterCard.prototype.setupBattlerGraphic = function (x, y, silhouette) {
        var src = this.getBattler(silhouette);
        this._battlerSource = src;
        var maxWidth = this.contentsWidth() - 2 * x;
        var maxHeight = this.contentsHeight() - y - (1 + CFG.frame_width * 2);
        var rect = { x: x, y: y, width: Math.max(maxWidth, 1), height: Math.max(maxHeight, 1) };
        var fit = this.battlerRect(src, rect);
        var dummy = new Bitmap(Math.max(Math.floor(maxWidth), 1),
                               Math.max(Math.floor(maxHeight), 1));
        if (!src || !src.isReady()) { return dummy; }
        if (fit.fits) {
            dummy.blt(src, 0, 0, src.width, src.height,
                      fit.x, fit.y);
        } else {
            dummy.blt(src,
                      Math.floor((src.width - fit.width) / 2),
                      Math.floor((src.height - fit.height) / 2),
                      fit.width, fit.height, fit.x, fit.y);
        }
        return dummy;
    };
    // 0147.rb:1205
    Window_MonsterCard.prototype.getBattler = function (silhouette) {
        var enemy = this._monster ? this._monster.enemy() : null;
        if (!enemy) { return ImageManager.loadEnemy('', 0); }
        var hue = enemy.battlerHue || 0;
        var name = enemy.battlerName || '';
        if (silhouette) {
            var sil = info(enemy).silhouette;
            if (sil.length) {
                return ImageManager.loadEnemy(sil[0], sil[1]);
            }
            return this.bmpToSilhouette(ImageManager.loadEnemy(name, hue));
        }
        return ImageManager.loadEnemy(name, hue);
    };
    // 0147.rb:1222 - per-pixel, exactly as the Ruby does it (and only reached
    // when :silhouette is on, which the game leaves off).
    Window_MonsterCard.prototype.bmpToSilhouette = function (bmp) {
        if (!bmp || !bmp.isReady()) { return bmp; }
        var c = this.mamcTextColor(CFG.silhouette_colour);
        var base = /^rgba\((\d+),(\d+),(\d+)/.exec(c) || [0, 0, 0, 0];
        var ctx = bmp._context;
        var img = ctx.getImageData(0, 0, bmp.width, bmp.height);
        var d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            if (d[i + 3] !== 0) {
                d[i] = +base[1]; d[i + 1] = +base[2]; d[i + 2] = +base[3];
            }
        }
        ctx.putImageData(img, 0, 0);
        bmp._setDirty && bmp._setDirty();
        return bmp;
    };
    // 0147.rb:1238
    Window_MonsterCard.prototype.battlerRect = function (bmp, rect) {
        var dest = { x: 0, y: 0, width: bmp ? bmp.width : 0, height: bmp ? bmp.height : 0 };
        var fits = dest.width <= rect.width && dest.height <= rect.height;
        if (!fits) {
            if (dest.width > rect.width) { dest.width = rect.width; }
            if (dest.height > rect.height) { dest.height = rect.height; }
        }
        dest.x = Math.floor((rect.width - dest.width) / 2);
        if (dest.height < (this.statY() - rect.y - 16)) {
            dest.y = Math.floor((this.statY() - rect.y - dest.height) / 2);
        } else if (dest.height > Math.floor((rect.height * 3) / 4)) {
            dest.y = Math.floor((rect.height - dest.height) / 2);
        } else {
            dest.y = 8;
        }
        return { x: dest.x, y: dest.y, width: dest.width, height: dest.height, fits: fits };
    };
    // 0147.rb:1261
    Window_MonsterCard.prototype.shownStats = function () {
        if (!this._monster || !this.showData()) { return []; }
        return CFG.shown_stats.filter(function (stat) {
            return STAT_PARAM[stat] !== undefined;
        }, this);
    };
    // 0147.rb:1269
    Window_MonsterCard.prototype.monsterName = function () {
        var enemy = this._monster ? this._monster.enemy() : null;
        if (!enemy) { return ''; }
        return (this.showBattler() || this.showData())
            ? enemy.name : CFG.absent_monster_name;
    };
    // 0147.rb:1276
    Window_MonsterCard.prototype.statValue = function (stat) {
        var v = (STAT_PARAM[stat] !== undefined)
            ? this._monster.param(STAT_PARAM[stat])
            : (typeof this._monster[stat] === 'function'
               ? this._monster[stat]() : 0);
        if (typeof v === 'number' && !isFinite(Math.round(v))) { return String(v); }
        if (typeof v === 'number' && v % 1 !== 0) {
            return Math.round(v * 100) + '%';
        }
        return String(v);
    };
    // 0147.rb:1300
    Window_MonsterCard.prototype.statY = function () {
        var y = this.contentsHeight() - (1 + CFG.frame_width * 2);
        var n = this.shownStats().length;
        if (n) { y -= (Math.floor((n + 1) / 2) + 1) * this.lineHeight(); }
        return y;
    };
    // 0147.rb:1308
    Window_MonsterCard.prototype.updateHelp = function () {
        if (this._helpWindow) {
            var enemy = (this._monster && this.showData()) ? this._monster.enemy() : null;
            if (this._helpWindow.setItem) {
                this._helpWindow.setItem(enemy ? { description: info(enemy).description } : null);
            } else {
                this._helpWindow.setText(enemy ? info(enemy).description : '');
            }
        }
    };
    // The battler image is loaded asynchronously; redraw once it lands.
    Window_MonsterCard.prototype.update = function () {
        Window_Selectable.prototype.update.call(this);
        if (this._pendingBattler && this._battlerSource &&
            this._battlerSource.isReady()) {
            this._pendingBattler = false;
            this.refresh();
        }
    };
    MonlineMonsterCatalogue.Window_MonsterCard = Window_MonsterCard;

    //-------------------------------------------------------------------------
    // Scene_MonsterCatalogue (0147.rb:1581)
    //-------------------------------------------------------------------------
    function Scene_MonsterCatalogue() { this.initialize.apply(this, arguments); }
    Scene_MonsterCatalogue.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_MonsterCatalogue.prototype.constructor = Scene_MonsterCatalogue;

    Scene_MonsterCatalogue.prototype.initialize = function () {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_MonsterCatalogue.prototype.start = function () {
        Scene_MenuBase.prototype.start.call(this);
        this.beastiaryCheck();
        this.createHelpWindow();
        this.createCategoryLabelWindow();
        this.createCategoryWindow();
        this.createMonsterCardWindow();
        this.createMonsterListWindow();
    };

    // 0147.rb:1593
    Scene_MonsterCatalogue.prototype.createHelpWindow = function () {
        if (CFG.desc_window_lines > 0) {
            this._helpWindow = new Window_Help(CFG.desc_window_lines);
            this._helpWindow.y = Graphics.boxHeight - this._helpWindow.height;
            this.addWindow(this._helpWindow);
        }
    };
    Scene_MonsterCatalogue.prototype.createCategoryLabelWindow = function () {
        this._categoryLabelWindow = new Window_MonsterCategoryLabel(0, 0);
        this._categoryLabelWindow.category = CFG.shown_categories[0];
        this.addWindow(this._categoryLabelWindow);
    };
    Scene_MonsterCatalogue.prototype.createCategoryWindow = function () {
        if (CFG.shown_categories.length < 2) { return; }
        this._categoryWindow = new Window_MonsterCategory(
            0, this._categoryLabelWindow.height);
        this._categoryWindow._labelWindow = this._categoryLabelWindow;
        this.addWindow(this._categoryWindow);
    };
    // 0147.rb:1619
    Scene_MonsterCatalogue.prototype.createMonsterCardWindow = function () {
        var x = listWidth();
        var hg = this._helpWindow ? this._helpWindow.y : Graphics.boxHeight;
        this._monsterCardWindow = new Window_MonsterCard(
            x, 0, Graphics.boxWidth - x, hg);
        this._monsterCardWindow.setHandler('cancel', this.popScene.bind(this));
        this._monsterCardWindow.setHelpWindow(this._helpWindow);
        this.addWindow(this._monsterCardWindow);
    };
    // 0147.rb:1629
    Scene_MonsterCatalogue.prototype.createMonsterListWindow = function () {
        var y = this._categoryWindow
            ? this._categoryWindow.y + this._categoryWindow.height
            : this._categoryLabelWindow.height;
        var hg = this._helpWindow ? this._helpWindow.y - y : Graphics.boxHeight - y;
        this._monsterListWindow = new Window_MonsterList(0, y, listWidth(), hg);
        // The Ruby wires help_window *after* the category, which means
        // `update_help` is skipped on the very first row and the card stays
        // blank until the player presses a direction.  Setting it first makes
        // the opening entry show its card; nothing else changes.
        this._monsterListWindow.setHelpWindow(this._monsterCardWindow);
        this._monsterListWindow.category = CFG.shown_categories[0];
        // The Ruby gives the cancel handler to the card, but the card is never
        // the active window (the list activates itself), so without this the
        // player would have no way out of the bestiary at all.
        this._monsterListWindow.setHandler('cancel', this.popScene.bind(this));
        if (this._categoryWindow) {
            this._categoryWindow._monsterListWindow = this._monsterListWindow;
        }
        this.addWindow(this._monsterListWindow);
    };

    // 0147.rb:1659 - the reveal switches
    Scene_MonsterCatalogue.prototype.beastiaryCheck = function () {
        if (!$gameSwitches || !$gameSystem) { return; }
        Object.keys(SWITCH_REVEALS).forEach(function (sw) {
            if ($gameSwitches.value(+sw)) {
                $gameSystem.mamcEncounterMonster.apply($gameSystem,
                                                       SWITCH_REVEALS[sw]);
            }
        });
    };

    Scene_MonsterCatalogue.prototype.terminate = function () {
        Scene_MenuBase.prototype.terminate.call(this);
        if ($gameMap) { $gameMap.requestRefresh(); }
    };
    MonlineMonsterCatalogue.Scene_MonsterCatalogue = Scene_MonsterCatalogue;

    // 0147.rb:1403 closes the battle card outright (no animation) when
    // `$imported["YEA-BattleEngine"]` is set.  Monline ships 0111.rb, so it is.
    var YEA_BATTLE_ENGINE = true;

    /** 0147.rb:147 - `:R` has no MV equivalent, so the key is mapped by hand. */
    function mapButton() {
        var b = String(CFG.map_button);
        if (b === 'R' || b === 'r') { return Input.keyMapper[82] || 'monlineR'; }
        return b.toLowerCase();
    }

    //-------------------------------------------------------------------------
    // MAMC_BattleMonsterCard (0147.rb:1319) + Scene_Battle (0147.rb:1351)
    //
    // Using an \analyze item or skill flags the enemy (`_mamcAnalyzeNow`, set
    // by the Game_Action hook above); the battle then freezes and shows that
    // enemy's card.  The battle card is refreshed with the *live* Game_Enemy
    // rather than an id, which is what the module is for: HP and MP become
    // gauges and rate stats become percentages.
    //-------------------------------------------------------------------------
    var BATTLE_CARD = {
        drawStat: function (x, y, width, stat) {
            if (this._monster && (stat === 'mhp' || stat === 'hp')) {
                this.drawActorHp(this._monster, x, y, width);
                return;
            }
            if (this._monster && (stat === 'mmp' || stat === 'mp')) {
                this.drawActorMp(this._monster, x, y, width);
                return;
            }
            Window_MonsterCard.prototype.drawStat.call(this, x, y, width, stat);
        }
    };

    // 0147.rb:1300 - the Ruby's `stat_value` here only differs by reading the
    // stat off `monster` directly; `Window_MonsterCard#statValue` already
    // renders a fraction as a percentage, so it is inherited as-is.

    var _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function () {
        _Scene_Battle_createAllWindows.call(this);
        this.createMonsterCardWindow();
    };

    /** 0147.rb:1360 */
    Scene_Battle.prototype.createMonsterCardWindow = function () {
        var sw = this._statusWindow;
        var width = sw ? sw.width : Graphics.boxWidth;
        var height = Graphics.boxHeight - (sw ? sw.height : 0);
        var card = new Window_MonsterCard(
            Math.floor((Graphics.boxWidth - width) / 2), 0, width, height);
        // 0147.rb:1364 - above the log window, and never below z 200.  MV's
        // windows carry no `z` at all, so an undefined one has to be treated
        // as 0 rather than added to (undefined + 1 is NaN, and a NaN z breaks
        // the window layer's sort).
        var logZ = (this._logWindow && typeof this._logWindow.z === 'number')
            ? this._logWindow.z : 0;
        card.z = Math.max(logZ + 1, 200);
        card.openness = 0;
        Object.keys(BATTLE_CARD).forEach(function (k) { card[k] = BATTLE_CARD[k]; });
        var self = this;
        var close = function () { self.closeMonsterCardWindow(); };
        card.setHandler('ok', close);
        card.setHandler('cancel', close);
        this._monsterCardWindow = card;
        this.addWindow(card);
    };

    /** 0147.rb:1374 */
    Scene_Battle.prototype.mamcAnalyzeMonster = function (target) {
        target._mamcAnalyzeNow = false;
        this._monsterCardWindow.refresh(target);
        this._monsterCardWindow.open();
        this._monsterCardWindow.activate();
    };

    // 0147.rb:1383 - while the card is up the battle is frozen; otherwise an
    // enemy that has just been analyzed opens its card before play resumes.
    var _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function () {
        var card = this._monsterCardWindow;
        if (card && card.active) {
            // `update_basic`: the frame and the input keep running, the battle
            // process does not.
            $gameTimer.update(true);
            $gameScreen.update();
            Scene_Base.prototype.update.call(this);
            return;
        }
        if (card && $gameTroop) {
            var pending = null;
            $gameTroop.members().forEach(function (e) {
                if (!pending && e && e._mamcAnalyzeNow) { pending = e; }
            });
            if (pending) { this.mamcAnalyzeMonster(pending); return; }
        }
        _Scene_Battle_update.call(this);
    };

    /** 0147.rb:1402 */
    Scene_Battle.prototype.closeMonsterCardWindow = function () {
        var card = this._monsterCardWindow;
        if (!card) { return; }
        // With the Yanfly battle engine the window has no open/close animation,
        // so the Ruby hides it outright instead of closing it.
        if (YEA_BATTLE_ENGINE) { card.openness = 0; } else { card.close(); }
        // Window_Selectable#processOk already deactivated before calling the
        // handler; this is the belt-and-braces path for the handlers that do
        // not go through it, and without it the battle would stay frozen.
        card.deactivate();
    };
    MonlineMonsterCatalogue.BATTLE_CARD = BATTLE_CARD;

    //-------------------------------------------------------------------------
    // Scene_Map (0147.rb:1415) - a map button opens the catalogue
    //
    // MAMC_CONFIG[:map_access] is false in Monline, so the Ruby never even
    // defines this class body.  It is ported anyway (guarded the same way) so
    // that flipping the option produces the documented behaviour.
    //-------------------------------------------------------------------------
    // VX Ace's `Input.trigger?(:R)` has no MV equivalent; 82 is R.
    Input.keyMapper[82] = Input.keyMapper[82] || 'monlineR';

    if (CFG.map_access) {
        var _Scene_Map_updateScene = Scene_Map.prototype.updateScene;
        Scene_Map.prototype.updateScene = function () {
            _Scene_Map_updateScene.call(this);
            if (!SceneManager.isSceneChanging()) { this.updateCallMonsterCatalogue(); }
        };
        /** 0147.rb:1428 */
        Scene_Map.prototype.updateCallMonsterCatalogue = function () {
            if ($gameMap.isEventRunning()) {
                this._monsterCatalogueCalling = false;
            } else {
                if (!this._monsterCatalogueCalling &&
                    Input.isTriggered(mapButton())) {
                    this._monsterCatalogueCalling = true;
                }
                if (this._monsterCatalogueCalling && !$gamePlayer.isMoving()) {
                    this.callMonsterCatalogue();
                }
            }
        };
        /** 0147.rb:1435 */
        Scene_Map.prototype.callMonsterCatalogue = function () {
            this._monsterCatalogueCalling = false;
            SoundManager.playOk();
            SceneManager.push(Scene_MonsterCatalogue);
        };
    }

    //-------------------------------------------------------------------------
    // Menu access (0147.rb:1459-1576) - modern algebra's Insert Command
    //
    // Also inert in Monline (:menu_access is false).  The Ruby leans on `eval`
    // for the command name / enable condition / handler; Monline's own entry is
    // a plain string, `true` and `false` respectively, so the port takes those
    // three shapes and no others - an unsupported shape simply stays inert
    // rather than eval'ing database text.
    //-------------------------------------------------------------------------
    var MA_COMMAND_INSERTS = {};
    MonlineMonsterCatalogue.MA_COMMAND_INSERTS = MA_COMMAND_INSERTS;

    /** 0147.rb:1573 - :name, :index, :enable, :scene, :other */
    function insertCommand(name, index, enable, scene, other) {
        return { name: name, index: index, enable: enable, scene: scene,
                 other: other };
    }

    if (CFG.menu_access) {
        MA_COMMAND_INSERTS.monster_catalogue = insertCommand(
            CFG.menu_label, CFG.menu_index, true, 'Scene_MonsterCatalogue', false);

        /** 0147.rb:1467 - lazily built so old saves are not corrupted. */
        Game_System.prototype.maicInsertedMenuCommands = function () {
            if (!this._maicInsertedMenuCommands) {
                this._maicInsertedMenuCommands = Object.keys(MA_COMMAND_INSERTS);
                var self = this;
                this._maicInsertedMenuCommands.sort(function (a, b) {
                    return MA_COMMAND_INSERTS[a].index - MA_COMMAND_INSERTS[b].index;
                });
            }
            return this._maicInsertedMenuCommands;
        };

        /** 0147.rb:1497 - the entry is inserted at :index, not appended. */
        Window_MenuCommand.prototype.maicInsertCommand = function (symbol) {
            var cmd = MA_COMMAND_INSERTS[symbol];
            if (!cmd) { return; }
            var name = typeof cmd.name === 'string' ? cmd.name : String(cmd.name);
            var enabled = cmd.enable === 0 ? true
                        : (cmd.enable === true ? true : !!cmd.enable);
            this.addCommand(name, symbol, enabled);
            var added = this._list.pop();
            this._list.splice(Math.min(cmd.index, this._list.length), 0, added);
        };

        var _menuMakeCommandList = Window_MenuCommand.prototype.makeCommandList;
        Window_MenuCommand.prototype.makeCommandList = function () {
            _menuMakeCommandList.call(this);
            var self = this;
            $gameSystem.maicInsertedMenuCommands().forEach(function (sym) {
                self.maicInsertCommand(sym);
            });
        };

        /** 0147.rb:1545 */
        Scene_Menu.prototype.maicCommandInsert = function () {
            var cmd = MA_COMMAND_INSERTS[this._commandWindow.currentSymbol()];
            if (cmd && window[cmd.scene]) { SceneManager.push(window[cmd.scene]); }
        };

        var _menuCreateCommandWindow = Scene_Menu.prototype.createCommandWindow;
        Scene_Menu.prototype.createCommandWindow = function () {
            _menuCreateCommandWindow.call(this);
            var self = this;
            $gameSystem.maicInsertedMenuCommands().forEach(function (sym) {
                self._commandWindow.setHandler(sym,
                    self.maicCommandInsert.bind(self));
            });
        };

        var _menuOnPersonalOk = Scene_Menu.prototype.onPersonalOk;
        Scene_Menu.prototype.onPersonalOk = function () {
            if ($gameSystem.maicInsertedMenuCommands().indexOf(
                    this._commandWindow.currentSymbol()) >= 0) {
                this.maicCommandInsert();
            } else {
                _menuOnPersonalOk.call(this);
            }
        };
    }

    //-------------------------------------------------------------------------
    // Script calls (0147.rb:611)
    //-------------------------------------------------------------------------
    function currentInterpreter() {
        var MR = window.MonlineRuby;
        return (MR && MR.current) ? MR.current : null;
    }
    function encounter_monster() {
        if (!$gameSystem) { return false; }
        $gameSystem.mamcEncounterMonster.apply($gameSystem, arguments);
        return true;
    }
    function analyze_monster() {
        if (!$gameSystem) { return false; }
        $gameSystem.mamcAnalyzeMonster.apply($gameSystem, arguments);
        return true;
    }
    function hide_monster(id) {
        if (!$gameSystem) { return false; }
        $gameSystem.mamcHideMonster(id);
        return true;
    }
    function reveal_monster(id) {
        if (!$gameSystem) { return false; }
        $gameSystem.mamcRevealMonster(id);
        return true;
    }
    function call_monster_catalogue() {
        if ($gameParty && $gameParty.inBattle()) { return false; }
        SceneManager.push(Scene_MonsterCatalogue);
        return true;
    }

    ['encounter_monster', 'analyze_monster', 'hide_monster', 'reveal_monster',
     'call_monster_catalogue'].forEach(function (name) {
        window[name] = ({
            encounter_monster: encounter_monster,
            analyze_monster: analyze_monster,
            hide_monster: hide_monster,
            reveal_monster: reveal_monster,
            call_monster_catalogue: call_monster_catalogue
        })[name];
        if (window.MonlineRuby && window.MonlineRuby.F) {
            window.MonlineRuby.F[name] = window[name];
        }
        if (window.MonlineShim && window.MonlineShim.functions) {
            var i = window.MonlineShim.functions.indexOf(name);
            if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
        }
        if (window.Game_Interpreter) {
            Game_Interpreter.prototype[name] = window[name];
        }
    });

    // Replace the stand-in MonlineScenes installed; the bridge resolves scene
    // names through `window[...]`, so this has to be a global.
    window.Scene_MonsterCatalogue = Scene_MonsterCatalogue;
    window.Window_MonsterCategory = Window_MonsterCategory;
    window.Window_MonsterCategoryLabel = Window_MonsterCategoryLabel;
    window.Window_MonsterList = Window_MonsterList;
    window.Window_MonsterCard = Window_MonsterCard;

    MonlineMonsterCatalogue.CFG = CFG;
    MonlineMonsterCatalogue.SWITCH_REVEALS = SWITCH_REVEALS;

    console.log('[MonlineMonsterCatalogue] loaded');
})();
