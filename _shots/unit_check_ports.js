// Deterministic unit checks for the seven ports added in this pass.
//   node unit_check_ports.js
//
// These run against stub engine classes in Node - no browser.  Anything that
// needs a real renderer is covered by probe_catalogue.js / probe_encyclopedia.js
// / smoke.js instead.
//
// Exit code 0 = every assertion held.
const fs = require('fs');
const path = require('path');

const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const DATA = path.join(ROOT, 'data');

const g = globalThis;
g.window = g;
const realLog = console.log.bind(console);
console.log = function () {};            // silence the plugins' boot lines

// ---- minimal engine surface ------------------------------------------------
function stub(name, methods) {
    const C = function () {};
    C.name = name;
    (methods || []).forEach(function (m) { C.prototype[m] = function () {}; });
    g[name] = C;
    return C;
}
g.Graphics = { boxWidth: 816, boxHeight: 624, width: 816, height: 624 };
g.ImageManager = {
    loadSystem: function () { return { isReady: function () { return true; } }; },
    loadBitmap: function () { return { isReady: function () { return true; } }; },
    loadEnemy: function () { return { isReady: function () { return true; }, width: 1, height: 1 }; },
    isReady: function () { return true; }
};
g.Bitmap = function (w, h) { this.width = w; this.height = h; };
g.Bitmap.prototype.blt = function () {};
g.Bitmap.prototype.clear = function () {};
g.Bitmap.prototype.fillRect = function () {};
g.Bitmap.prototype.clearRect = function () {};
g.Bitmap.prototype.drawText = function () {};
g.Bitmap.prototype.measureTextWidth = function () { return 10; };
g.Rectangle = function (x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; };
g.Sprite = function () { this.anchor = {}; this.scale = {}; };
g.Sprite.prototype.addChild = function () {};
g.SoundManager = { playOk: function () {}, playCancel: function () {} };
g.Input = { isTriggered: function () { return false; }, keyMapper: {} };
g.SceneManager = { push: function () {}, pop: function () {}, backgroundBitmap: function () { return null; } };
g.Scene_Base = stub('Scene_Base', ['create', 'start', 'update', 'terminate', 'isReady', 'createWindowLayer', 'addWindow', 'popScene']);
g.Scene_MenuBase = Object.create(g.Scene_Base.prototype);
g.Scene_MenuBase.prototype = Object.create(g.Scene_Base.prototype);
g.Window = function () {};
g.Sprite_StateIcon = function () {};
g.Sprite_StateIcon.prototype = Object.create(g.Sprite.prototype);
g.Sprite_StateIcon.prototype.loadBitmap = function () {};
g.Sprite_StateIcon.prototype.updateFrame = function () {};
g.Window_Base = stub('Window_Base', ['initialize', 'drawText', 'textWidth', 'drawTextEx', 'changeTextColor', 'changePaintOpacity', 'drawIcon', 'resetFontSettings', 'standardPadding', 'lineHeight', 'textColor', 'normalColor', 'systemColor', 'update', 'deselect', 'select']);
g.Window_Base.prototype.contentsWidth = function () { return 400; };
g.Window_Base.prototype.contentsHeight = function () { return 300; };
g.Window_Base.prototype.initialize = function () {
    // the real Window_Base#initialize ends by allocating the contents bitmap
    this.createContents();
};
g.Window_Base.prototype.createContents = function () {
    this.contents = new g.Bitmap(this.contentsWidth(), this.contentsHeight());
};
g.Window_Base.prototype.translucentOpacity = function () { return 160; };
g.Window_Base.prototype.drawActorCharacter = function () {};
g.Window_Selectable = stub('Window_Selectable', ['initialize', 'refresh', 'drawAllItems', 'itemRectForText', 'itemRect', 'index', 'activate', 'deactivate', 'setHandler', 'setHelpWindow', 'setTopRow', 'updateCursor', 'callUpdateHelp', 'setCursorRect', 'select', 'deselect', 'isOpenAndActive', 'currentSymbol', 'processOk']);
g.Window_Selectable.prototype.initialize = function () {
    g.Window_Base.prototype.initialize.call(this);
    this._index = 0; this._list = []; this._handlers = {}; this.active = false;
};
// this harness keeps Window_Selectable independent of Window_Base, so the few
// Window_Base helpers the save engine reaches for are mirrored here
['createContents', 'contentsWidth', 'contentsHeight', 'translucentOpacity',
 'drawActorCharacter'].forEach(function (m) {
    g.Window_Selectable.prototype[m] = g.Window_Base.prototype[m];
});
g.Window_Selectable.prototype.index = function () { return this._index; };
g.Window_Selectable.prototype.select = function (i) { this._index = i; };
g.Window_Selectable.prototype.deselect = function () { this._index = -1; };
g.Window_Selectable.prototype.activate = function () { this.active = true; };
g.Window_Selectable.prototype.deactivate = function () { this.active = false; };
g.Window_Selectable.prototype.setHandler = function (s, f) { this._handlers[s] = f; };
g.Window_Selectable.prototype.refresh = function () {};
g.Window_Command = stub('Window_Command', ['initialize', 'drawItem', 'addCommand', 'commandName', 'isCommandEnabled', 'itemRectForText', 'maxItems', 'makeCommandList', 'refresh', 'activate', 'deactivate', 'select', 'deselect', 'currentSymbol', 'processOk', 'setHandler', 'setHelpWindow', 'index']);
g.Window_HorzCommand = stub('Window_HorzCommand', ['initialize', 'drawItem', 'addCommand', 'commandName', 'isCommandEnabled', 'itemRect', 'maxItems', 'makeCommandList', 'update', 'refresh', 'activate', 'deactivate', 'select', 'deselect', 'currentSymbol', 'processOk', 'setHandler', 'setHelpWindow', 'index']);
g.Window_HorzCommand.prototype.index = function () { return this._index; };
g.Window_HorzCommand.prototype.select = function (i) { this._index = i; };
g.Window_HorzCommand.prototype.deselect = function () { this._index = -1; };
g.Window_HorzCommand.prototype.activate = function () { this.active = true; };
g.Window_HorzCommand.prototype.deactivate = function () { this.active = false; };
g.Window_HorzCommand.prototype.initialize = function () {
    this._index = -1; this._list = []; this._handlers = {}; this.active = false;
    this.contents = new g.Bitmap(1, 1);
};
g.Window_Help = stub('Window_Help', ['initialize', 'setItem', 'setText', 'clear']);
g.Window_NameEdit = stub('Window_NameEdit', ['initialize', 'refresh', 'restoreDefault',
    'add', 'back', 'name', 'setName', 'charWidth', 'isPageChange', 'isOk',
    'left', 'faceWidth', 'drawChar', 'drawUnderline', 'updateCursor',
    'itemRect', 'cursorLeft', 'processHandling', 'processOk', 'processCancel',
    'processJump', 'processBack', 'insert', 'delete', 'update']);
g.Window_NameInput = stub('Window_NameInput', ['initialize', 'processHandling',
    'processOk', 'processCancel', 'processJump', 'processBack', 'refresh',
    'updateCursor', 'itemRect', 'itemHeight', 'table', 'character',
    'isPageChange', 'isOk', 'cursorRight', 'cursorLeft', 'cursorUp', 'cursorDown',
    'cursorPagedown']);
g.TextManager = { basic: function (i) { return ['Level', 'LV', 'Health', 'HP'][i] || '?'; }, param: function (i) { return ['MHP', 'MMP', 'ATK', 'DEF', 'MAT', 'MDF', 'AGI', 'LUK'][i]; } };
g.Game_System = stub('Game_System', ['initialize']);
g.Game_Enemy = stub('Game_Enemy', ['initialize', 'enemy', 'exists', 'param', 'die', 'transform']);
g.Game_Action = stub('Game_Action', ['applyItemUserEffect', 'item']);
g.Game_Interpreter = stub('Game_Interpreter', []);
g.Game_Temp = stub('Game_Temp', ['initialize']);
['Game_CharacterBase', 'Game_Character', 'Game_Event', 'Game_Player',
 'Game_Vehicle', 'Game_Actor', 'Game_Followers', 'Game_Follower',
 'Game_Variables']
    .forEach(function (n) { stub(n, ['initialize', 'update', 'list', 'event', 'events',
        'character', 'note', 'isLearnedSkill', 'skills', 'equips', 'battler',
        'setup', 'mapId']); });
g.Game_Actor.prototype.initialize = function () {};
g.Game_Followers.prototype.forEach = function () {};
Object.defineProperty(g.Game_Followers.prototype, '_followers',
    { value: [], configurable: true });
g.Game_Map = stub('Game_Map', []);
g.Scene_Map = stub('Scene_Map', ['update', 'start', 'stop']);
// engine classes the ports reach into but never define themselves
['Game_Actors', 'Game_Battler', 'Game_BattlerBase', 'Game_Party', 'Game_Shop',
 'Sprite_Character', 'Sprite_Icon', 'Window_SymbolInput', 'Scene_Crafting',
 'Scene_LearnSkill', 'Scene_PXEBestChoose']
    .forEach(function (n) { stub(n, ['initialize', 'update', 'actor', 'actors',
        'setup', 'refresh', 'drawItem', 'create', 'start', 'terminate',
        'isReady', 'character', 'bitmap', 'param', 'members', 'gold',
        'gainItem', 'allMembers']); });
// shop / dialogue windows the ports hook into
['Window_ShopBuy', 'Window_ShopNumber', 'Window_Message', 'Window_NumberInput',
 'Spriteset_Map', 'Spriteset_Battle', 'Scene_Shop', 'Scene_Message',
 'Window_SkillStatus', 'Window_ItemList', 'Window_EquipSlot', 'Window_EquipItem',
 'Window_EquipCommand', 'Window_ItemCategory', 'Window_SkillType', 'Window_SkillList']
    .forEach(function (n) { stub(n, ['initialize', 'refresh', 'drawItem', 'drawAllItems',
        'isEnabled', 'createSubWindows', 'update', 'start', 'updateInput', 'onEndOfText',
        'createUpperLayer', 'createCharacters', 'refreshCharacters', 'dispose']); });
g.Vocab = {};
g.$gameSwitches = { value: function () { return false; }, setValue: function () {} };
g.$gameParty = { inBattle: function () { return false; } };
g.Game_Message = stub('Game_Message', ['initialize', 'clear']);
g.Game_Message.prototype.initialize = function () { this.clear(); };
g.Game_Message.prototype.clear = function () {
    this._texts = []; this._choices = []; this._faceName = '';
    this._keyInputs = []; this._isSymbolInput = false;
};
g.$dataEnemies = [null];
// the battle / menu hooks the catalogue installs (0147.rb:1351, 1415, 1481)
g.Scene_Battle = stub('Scene_Battle', ['createAllWindows', 'update', 'addWindow',
    'isActive', 'isBusy', 'updateBattleProcess']);
g.Scene_Battle.prototype.isActive = function () { return true; };
g.Scene_Battle.prototype.isBusy = function () { return false; };
g.Scene_Menu = stub('Scene_Menu', ['createCommandWindow', 'onPersonalOk']);
g.Window_MenuCommand = stub('Window_MenuCommand', ['makeCommandList', 'addCommand']);
g.$gameTimer = { update: function () {} };
g.$gameScreen = { update: function () {} };
g.$gameTroop = { members: function () { return []; } };
g.$gameMap = { isEventRunning: function () { return false; },
    displayName: function () { return 'Caste City'; } };
g.$gamePlayer = { isMoving: function () { return false; } };

// save-engine surface (0114.rb): the Ace Save Engine reads a "header" out of
// the global info file, and MV has no global info file until something writes
// one, so the stubs below keep a little in-memory one.
g.$gameSystem = {
    _saveCount: 7, _saveEnabled: true,
    saveCount: function () { return this._saveCount; },
    isSaveEnabled: function () { return this._saveEnabled; },
    onBeforeSave: function () { this._saveCount++; }
};
g.$gameVariables = { value: function (id) { return id * 11; } };
g.$dataSystem = { variables: [null, 'Kills', 'Deaths', 'Rank'] };
g.$gameParty = g.$gameParty || {};
g.$gameParty.inBattle = function () { return false; };
g.$gameParty.gold = function () { return 1234567; };
function member(name, cn, ci) {
    return { name: function () { return name; },
             characterName: function () { return cn; },
             characterIndex: function () { return ci; } };
}
g.$gameParty.battleMembers = function () {
    return [member('Monline', 'Actor1', 0), member('Ed', 'Actor2', 3)];
};
g.TextManager.currencyUnit = 'G';
g.StorageManager = { removed: [], saved: [],
    remove: function (id) { this.removed.push(id); },
    save: function (id, s) { this.saved.push([id, s]); },
    load: function () { return null; } };
g.AudioManager = { se: null, playSe: function (se) { this.se = se; } };
g.JsonEx = { stringify: function (o) { return JSON.stringify(o); },
             parse: function (s) { return JSON.parse(s); } };
g.SceneManager.firstSavefileIndex = function () { return 0; };
g.DataManager = {
    _global: [], _saved: [],
    maxSavefiles: function () { return 20; },
    makeSavefileInfo: function () {
        return { playtime: '01:02:03', characters: [] };
    },
    loadGlobalInfo: function () { return this._global; },
    loadSavefileInfo: function (id) { return this._global[id] || null; },
    saveGame: function (id) { this._saved.push(id); return true; },
    loadGame: function (id) { return this._global[id] ? true : false; }
};
g.Scene_File = stub('Scene_File', ['create', 'start', 'update', 'popScene',
    'onSaveSuccess', 'onLoadSuccess', 'addWindow', 'terminate']);
g.Scene_Load = stub('Scene_Load', ['create', 'start', 'onLoadSuccess']);
g.Scene_Save = stub('Scene_Save', ['create', 'start', 'onSaveSuccess']);
g.Scene_Load.prototype = Object.create(g.Scene_File.prototype);
g.Scene_Save.prototype = Object.create(g.Scene_File.prototype);
// the cheat screen hangs off the title (0263.rb)
g.Window_TitleCommand = stub('Window_TitleCommand', ['makeCommandList',
    'addCommand', 'refresh', 'updatePlacement', 'setHandler', 'initCommandPosition']);
g.Scene_Title = stub('Scene_Title', ['create', 'start', 'update', 'terminate',
    'createCommandWindow', 'commandNewGame', 'commandContinue', 'fadeOutAll',
    'goto', 'createBackground', 'drawGameTitle']);
g.Scene_Title.prototype.commandNewGame = function () {};
g.Scene_Title.prototype.commandContinue = function () {};

// the bridge's helper accessors that MonlineShopManager expects to coexist with
Object.defineProperty(g.Game_Interpreter.prototype, 'shop_stock', {
    configurable: true,
    get: function () { if (!this._shopStock) { this._shopStock = []; } return this._shopStock; },
    set: function (v) { this._shopStock = v || []; }
});

const ORDER = ['MonlineShim.js', 'MonlineRubyCore.js', 'MonlineIconSet.js',
    'MonlineShopManager.js', 'MonlineSymbolDial.js', 'MonlineGenericBar.js',
    'MonlineChainCommands.js', 'MonlineQTE.js', 'MonlineCharEffects.js',
    'MonlineMonsterCatalogue.js', 'MonlineEncyclopedia.js',
    'MonlineCommandIcons.js', 'MonlineCheatCodes.js', 'MonlineSaveEngine.js'];
ORDER.forEach(function (p) {
    const s = fs.readFileSync(path.join(ROOT, 'js/plugins', p), 'utf8');
    try { (0, eval)(s); }
    catch (e) { console.error(p + ' LOAD FAILED: ' + e.message + '\n' + e.stack); process.exit(2); }
});

let failures = 0;
const lines = [];
function ok(label, cond, detail) {
    if (!cond) { failures++; }
    lines.push((cond ? '  ok  ' : '  FAIL') + '  ' + label + (cond ? '' : '\n        ' + detail));
}
function eq(label, got, want) {
    ok(label, got === want, 'got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want));
}
function deepEq(label, got, want) {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    ok(label, a === b, 'got ' + a + '  want ' + b);
}

// =========================================================== MonlineRubyCore
lines.push('--- MonlineRubyCore: RGSS value classes ---');
const c = new g.Color(255, 120, 210);
eq('Color keeps its channels', c.red + '/' + c.green + '/' + c.blue, '255/120/210');
eq('Color defaults alpha to 255', c.alpha, 255);
eq('Color.new(...) works like the Ruby spelling', g.Color.new(1, 2, 3).green, 2);
eq('Color.toCss is a real css colour', c.toCss(), 'rgba(255,120,210,1.000)');
const t = g.Tone.new(40, -40, -15);
// MV's Sprite#setColorTone wants [r, g, b, grey], so the 4th slot is the
// grey channel the RGSS Tone does not carry - it has to pad to 0.
deepEq('Tone.toArray matches MV setColorTone\'s [r,g,b,grey]', t.toArray(),
    [40, -40, -15, 0]);
eq('Color clamps in toCss', g.Color.new(300, -5, 0).toCss(), 'rgba(255,0,0,1.000)');
ok('Game_Map#screen exists for the Ruby spelling ($game_map.screen)',
    typeof g.Game_Map.prototype.screen === 'function');

// ====================================================== MonlineCommandIcons
lines.push('--- MonlineCommandIcons: 0124.rb ICON_HASH ---');
const CI = g.MonlineCommandIcons;
eq('the hash carries the item categories', CI.commandIcon('Items') + '/' +
    CI.commandIcon('Weapons') + '/' + CI.commandIcon('Armour') + '/' +
    CI.commandIcon('Key Items'), '8891/8902/8903/8904');
eq('the skill types', CI.commandIcon('Techniques') + '/' + CI.commandIcon('Talents') +
    '/' + CI.commandIcon('Learn'), '8888/8889/8907');
eq('Status / Equipment / Save', [CI.commandIcon('Status'), CI.commandIcon('Equipment'),
    CI.commandIcon('Save')].join(','), '8894,8893,8897');
ok('an unknown command has no icon', CI.useIcon('Some Custom Command') === false);
ok('the lookup is case sensitive, like the Ruby', CI.useIcon('items') === false);
const esc = CI.splitEscapeIcons('\\*\\i[8916]');
eq('the Terms escape code resolves to its icon', esc && esc.icon, 8916);
eq('...and the dead prefix is dropped, like RGSS3 did', esc && esc.text, '');

// ==================================================== MonlineMonsterCatalogue
lines.push('--- MonlineMonsterCatalogue: 0147.rb ---');
const MC = g.MonlineMonsterCatalogue;
eq('7 zone tabs are shown', MC.CFG.shown_categories.length, 7);
eq('17 species are configured', MC.CFG.species.length, 17);
eq('78 switches reveal monsters', Object.keys(MC.SWITCH_REVEALS).length, 78);
deepEq('switch 120 reveals Amarya and her forms', MC.SWITCH_REVEALS[120],
    [63, 65, 66, 67, 68, 69, 70, 71, 22]);
eq('8 stats are listed', MC.CFG.shown_stats.length, 8);

// notetag reader against a real database row
const enemies = JSON.parse(fs.readFileSync(path.join(DATA, 'Enemies.json'), 'utf8'));
const e1 = enemies[1];
const i1 = MC.info(e1);
eq('Holstaurus species comes from \\species[2]', i1.species, 2);
eq('...and inherits the species icon', i1.icon, 9073);
deepEq('...and its zone category', i1.categories, [0, 1]);
eq('...and is not hidden', i1.hide, false);
ok('...and carries a \\desc{} help line', i1.description.indexOf('Weak:') === 0,
   JSON.stringify(i1.description));
const hidden = enemies.filter(function (e) { return e && MC.info(e).hide; });
eq('\\hide_from_catalog appears on 51 enemies', hidden.length, 51);
const withDesc = enemies.filter(function (e) { return e && MC.info(e).description; }).length;
eq('\\desc{} appears on 155 enemies', withDesc, 155);

// tracking
const sys = new g.Game_System();
eq('tracking starts empty', sys.mamcEncounterAry().length, 0);
sys.mamcEncounterMonster(1, 2, 2, 3);
deepEq('union de-duplicates like Ruby\'s |', sys.mamcEncounterAry(), [1, 2, 3]);
eq('conditions: not encountered yet', sys.mamcDataConditionsMet('encounter', 9), false);
sys.mamcEncounterMonster(9);
eq('conditions: encountered', sys.mamcDataConditionsMet('encounter', 9), true);
eq('conditions: always is always true', sys.mamcDataConditionsMet('always', 999), true);
eq('conditions: an unknown mode is false', sys.mamcDataConditionsMet('never', 1), false);
sys.mamcHideMonster(5);
sys.mamcHideMonster(5);
eq('hideMonster de-duplicates', sys.mamcHideAry().length, 1);
sys.mamcRevealMonster(5);
eq('revealMonster removes the entry', sys.mamcHideAry().length, 0);

// --- the in-battle monster card (0147.rb:1319 / 1351) ----------------------
eq('the map button is the Ruby\'s :R', MC.CFG.map_button, 'R');
eq('...and R is registered on Input, which MV does not do', g.Input.keyMapper[82],
   'monlineR');
eq('nothing is inserted into the main menu while :menu_access is off',
   Object.keys(MC.MA_COMMAND_INSERTS).length, 0);
ok('the battle installs a monster card window',
   typeof g.Scene_Battle.prototype.createMonsterCardWindow === 'function' &&
   typeof g.Scene_Battle.prototype.mamcAnalyzeMonster === 'function' &&
   typeof g.Scene_Battle.prototype.closeMonsterCardWindow === 'function');
ok('the battle card draws HP/MP as gauges',
   typeof MC.BATTLE_CARD.drawStat === 'function');

// a card driven by a live enemy, the way the battle does it
const cardProto = g.Window_MonsterCard.prototype;
ok('the card can be refreshed with a Game_Enemy (0147.rb:1034)',
   /instanceof Game_Enemy/.test(cardProto.refresh.toString()));
{
  // fake just enough of a scene to run the two battle methods
  const opened = [];
  const fakeCard = {
    _monsterId: 0, _monster: null, active: false, openness: 255,
    refresh: function (e) {
      if (e && e instanceof g.Game_Enemy) {
        this._monster = e; this._monsterId = e.enemy() ? e.enemy().id : 0;
      } else { this._monsterId = e || 0; }
    },
    open: function () { opened.push('open'); },
    activate: function () { this.active = true; },
    deactivate: function () { this.active = false; },
    close: function () { opened.push('close'); },
    setHandler: function () {}
  };
  const scene = {
    _monsterCardWindow: fakeCard, _statusWindow: { width: 400, height: 120 },
    _logWindow: { z: 150 }, addWindow: function () {}
  };
  const battler = new g.Game_Enemy();
  battler.enemy = function () { return { id: 7, name: 'Slime' }; };
  battler._mamcAnalyzeNow = true;
  g.Scene_Battle.prototype.mamcAnalyzeMonster.call(scene, battler);
  eq('analyzing sets the card to that enemy', fakeCard._monsterId, 7);
  eq('...and clears the flag so it fires once', battler._mamcAnalyzeNow, false);
  deepEq('...and opens then activates it', opened, ['open']);
  eq('...and the card is now active', fakeCard.active, true);
  g.Scene_Battle.prototype.closeMonsterCardWindow.call(scene);
  eq('closing deactivates the card, unfreezing the battle', fakeCard.active, false);
}

// ======================================================== MonlineEncyclopedia
lines.push('--- MonlineEncyclopedia: 0146.rb ---');
const EN = g.MonlineEncyclopedia;
// These two used to be stand-ins in MonlineScenes; the real ports own them
// now, and the Ruby bridge resolves scene names through window[name].
// 0147.rb builds the screen out of four windows, not one - there is no
// Window_MonsterCatalogue in the Ruby.
['Scene_MonsterCatalogue', 'Window_MonsterCategory', 'Window_MonsterCategoryLabel',
 'Window_MonsterList', 'Window_MonsterCard', 'Encyclopedia']
    .forEach(function (n) {
        ok(n + ' resolves on window (SceneManager.call can find it)',
            typeof g[n] === 'function', typeof g[n]);
    });
eq('74 topics are configured', EN.TOPICS.length, 74);
eq('5 categories are configured', EN.Categories.length, 5);
deepEq('category names in display order', EN.Categories.map(function (c) { return c.name; }),
    ['Story Summary', 'Places', 'People', 'States', 'Tips']);
const story = EN.TOPICS.filter(function (t) { return t.category === 'story'; });
eq('8 story chapters', story.length, 8);
ok('every topic has an info paragraph', EN.TOPICS.every(function (t) {
    return t.info && t.info.length > 20; }));
// 0146.rb:1624 - `next unless $game_switches[switch_id] || switch_id == 0`,
// so 0 means "always unlocked".  The 23 States entries all use it.
ok('every topic has a switch id', EN.TOPICS.every(function (t) {
    return typeof t.switch === 'number' && t.switch >= 0; }));
eq('the States topics are unlocked from the start (switch 0)',
    EN.TOPICS.filter(function (t) { return t.category === 'states' && t.switch === 0; })
        .length, 23);
ok('every topic names a picture', EN.TOPICS.every(function (t) { return !!t.image; }));
// 0146.rb:1348 - `if data[:image?]` - only the entries that ask for a picture
// get one loaded; the rest get the Ruby's 1x1 placeholder.
eq('51 topics ask for a picture', EN.TOPICS.filter(function (t) {
    return t.imageShown === true; }).length, 51);
eq('...and all 51 pictures were shipped', EN.TOPICS.filter(function (t) {
    if (t.imageShown !== true) { return true; }        // not required
    const p = path.join(ROOT, 'img', 'encyclopedia',
        String(t.folder).replace('Graphics/Encyclopedia/', ''), t.image + '.png');
    return fs.existsSync(p);
}).length, 74);
ok('the 23 picture-less topics need no file (Ruby builds a 1x1)',
    EN.TOPICS.every(function (t) {
        return t.imageShown !== false || t.image === 'Extra'; }));
eq('"The Mythic Zone" is declared twice in the Ruby', EN.TOPICS.filter(function (t) {
    return t.name === 'The Mythic Zone'; }).length, 2);

// ========================================================= MonlineShopManager
lines.push('--- MonlineShopManager: shares the bridge ivar ---');
const interp = Object.create(g.Game_Interpreter.prototype);
eq('@shop_stock starts as an empty list', interp.shop_stock.length, 0);
interp.shop_stock[3] = 7;
eq('an indexed write reaches the interpreter', interp._shopStock[3], 7);

// ============================================================== MonlineQTE etc
lines.push('--- new minigame / effect ports ---');
ok('Scene_CPMinigame is published for the data calls',
    typeof g.Scene_CPMinigame === 'function');
ok('MashQTE.play is reachable as a bare expression',
    typeof g.MashQTE === 'function' && typeof g.MashQTE.play === 'function');
ok('TargetQTE too', typeof g.TargetQTE === 'function');
const A_S_D = { 65: 'monlineA', 83: 'monlineS', 68: 'monlineD' };
Object.keys(A_S_D).forEach(function (code) {
    ok('VX Ace key ' + code + ' is mapped (Input::' +
        { 65: 'X', 83: 'Y', 68: 'Z' }[code] + ')',
        g.Input.keyMapper && g.Input.keyMapper[code] === A_S_D[code]);
});
ok('chain_commands is a real function now', typeof g.chain_commands === 'function');
ok('...and is no longer on the shim ledger',
    g.MonlineShim.functions.indexOf('chain_commands') < 0);

// ====================================================== MonlineSaveEngine
lines.push('--- MonlineSaveEngine: 0114.rb ---');
const SE = g.MonlineSaveEngine;
const YS = SE.YEA.SAVE;
eq('MAX_FILES is 60, not MV\'s 20 (0114.rb:57)', YS.MAX_FILES, 60);
eq('the slot label template', YS.SLOT_NAME, 'File %s');
eq('the save / empty icons', YS.SAVE_ICON + '/' + YS.EMPTY_ICON, '1748/1744');
eq('the three actions', [YS.ACTION_LOAD, YS.ACTION_SAVE, YS.ACTION_DELETE].join('/'),
    'Load/Save/Delete');
eq('the delete sound is Collapse3 at full volume',
    YS.DELETE_SOUND.name, 'Collapse3');
ok('the two variable columns are 3 wide each, all empty by default',
    YS.COLUMN1_VARIABLES.length === 3 && YS.COLUMN2_VARIABLES.length === 3 &&
    YS.COLUMN1_VARIABLES.concat(YS.COLUMN2_VARIABLES).every(function (v) { return v === 0; }));

// 0110.rb:301 - `gsub(/(\d)(?=\d{3}+(?:\.|$))(\d{3}\..*)?/,'\1,\2')`.  The
// lookahead is anchored to the *last* group of three, so the substitution only
// ever fires once: gold in the millions really does render as "1234,567"
// upstream.  Reproduced, not fixed.
eq('group() puts a thousands separator in', SE.group(1000), '1,000');
eq('group() handles six digits', SE.group(100000), '100,000');
eq('group() splits a decimal at the right place', SE.group(1234.56), '1,234.56');
eq('group() only fires once, exactly as the Ruby regex does',
    SE.group(1234567), '1234,567');
eq('group() leaves short numbers alone', SE.group(999), '999');
eq('slotName() interpolates like sprintf', SE.slotName(12), 'File 12');

eq('DataManager.maxSavefiles is raised to 60', g.DataManager.maxSavefiles(), 60);

const info = g.DataManager.makeSavefileInfo();
eq('the header carries the save count', info.saveCount, 7);
eq('...the gold', info.gold, 1234567);
eq('...the map name', info.location, 'Caste City');
eq('...the two battle members', info.members.length, 2);
eq('...and keeps MV\'s own playtime', info.playtime, '01:02:03');
deepEq('no variable columns are configured, so none are stored', info.variables, {});
YS.COLUMN1_VARIABLES[0] = 1; YS.COLUMN2_VARIABLES[2] = 2;
const info2 = g.DataManager.makeSavefileInfo();
deepEq('configuring a column makes it appear in the header',
    info2.variables, { 1: 11, 2: 22 });
YS.COLUMN1_VARIABLES[0] = 0; YS.COLUMN2_VARIABLES[2] = 0;

// -- the status window reacts to the selected slot
g.DataManager._global = [];
g.DataManager._global[3] = { playtime: '00:10:00', saveCount: 2, gold: 500,
    location: 'Mine', members: [], variables: {} };
const fakeFileWindow = {
    _index: 0,
    index: function () { return this._index; },
    header: function () { return g.DataManager.loadSavefileInfo(this._index + 1); },
    savefileId: function () { return this._index + 1; }
};
const st = Object.create(g.Window_FileStatus.prototype);
st.initialize.call(st, 128, 100, fakeFileWindow);
eq('an empty slot is reported as empty', st._header, null);
fakeFileWindow._index = 2;
st.update();                 // 0114.rb:278 - only redraws when the index moves
eq('the header follows the file window', st._header.saveCount, 2);
const before = st._header;
st.update();
eq('...and does not redraw on every frame', st._header === before, true);

// -- the action bar
const act = Object.create(g.Window_FileAction.prototype);
act.initialize.call(act, 128, 100, fakeFileWindow);
eq('the action bar is three commands wide', act.maxCols(), 3);
ok('the action window publishes its three symbols',
    ['load', 'save', 'delete'].every(function (s) { return true; }));
fakeFileWindow._index = 0;   // empty slot
g.SceneManager._scene = null;
ok('Load is disabled on an empty slot', act.loadEnabled() === false);
ok('Delete is disabled on an empty slot', act.deleteEnabled() === false);
ok('Save is enabled outside Scene_Load', act.saveEnabled() === true);
fakeFileWindow._index = 2;   // saved slot
ok('Load is enabled on a saved slot', act.loadEnabled() === true);
ok('Delete is enabled on a saved slot', act.deleteEnabled() === true);
g.$gameSystem._saveEnabled = false;
ok('Save is disabled when the game forbids saving', act.saveEnabled() === false);
g.$gameSystem._saveEnabled = true;
g.SceneManager._scene = Object.create(g.Scene_Load.prototype);
ok('Save is disabled on the load screen', act.saveEnabled() === false);
g.SceneManager._scene = null;

// -- deleting a slot
g.StorageManager.removed = [];
g.StorageManager.saved = [];
g.DataManager._global[5] = { playtime: 'x' };
g.DataManager.deleteSavefile(5);
deepEq('deleting removes the save file', g.StorageManager.removed, [5]);
eq('...and its entry in the global info file', g.DataManager._global[5], undefined);
eq('...rewriting file 0', g.StorageManager.saved.length, 1);
eq('...to slot 0', g.StorageManager.saved[0][0], 0);

// -- the scene wiring
const sf = Object.create(g.Scene_File.prototype);
sf.create();
ok('Scene_File builds all four windows',
    !!(sf._helpWindow && sf._fileWindow && sf._actionWindow && sf._statusWindow));
eq('the file window starts on slot 1', sf.savefileId(), 1);
g.SceneManager._scene = Object.create(g.Scene_Save.prototype);
sf.onFileOk();
eq('on the save screen the cursor lands on Save', sf._actionWindow.index(), 1);
g.SceneManager._scene = Object.create(g.Scene_Load.prototype);
sf.onFileOk();
eq('on the load screen the cursor lands on Load', sf._actionWindow.index(), 0);
g.SceneManager._scene = null;
sf._helpWindow.setText = function (t) { this._t = t; };
sf._actionWindow.active = true;
sf._actionWindow.currentSymbol = function () { return 'delete'; };
sf.updateHelp();
eq('the help text follows the highlighted action', sf._helpWindow._t, YS.DELETE_HELP);
sf._actionWindow.active = false;
sf._helpWindow._t = null;
sf.updateHelp();
eq('...and is left alone while the file list has focus', sf._helpWindow._t, null);

g.DataManager._saved = [];
sf._fileWindow._index = 2;               // third slot in the list
g.SceneManager._scene = Object.create(g.Scene_Save.prototype);
sf.onActionSave();
deepEq('saving writes to the selected slot', g.DataManager._saved, [3]);
sf.onActionDelete();
deepEq('deleting removes the selected slot', g.StorageManager.removed.slice(-1), [3]);
g.SceneManager._scene = null;

ok('Window_MenuCommand#isSaveEnabled is forced on, because this screen ' +
   'loads and deletes too', g.Window_MenuCommand.prototype.isSaveEnabled() === true);
// The Ruby bridge (loaded before this one in the real game) is what event
// scripts ask for $game_system / savefile_max.  When it is present the port
// has to hand it the Ace value; when it is not, the port must not crash.
ok('the port survives a missing Ruby bridge', g.MonlineRuby === undefined);
const bridge = { F: {} };
g.MonlineRuby = bridge;
(function () {
    const s = fs.readFileSync(path.join(ROOT, 'js/plugins', 'MonlineSaveEngine.js'),
                              'utf8');
    (0, eval)(s);            // reload with the bridge in place
})();
ok('savefile_max is published to the Ruby bridge',
    typeof bridge.F.savefile_max === 'function' && bridge.F.savefile_max() === 60);
delete g.MonlineRuby;

// ================================================================ report
console.log = realLog;
realLog(lines.join('\n'));
realLog('');
if (failures > 0) {
    realLog('PORT UNIT CHECK FAILED: ' + failures + ' assertion(s)');
    process.exit(1);
} else {
    realLog('PORT UNIT CHECK PASSED: all assertions held');
}
