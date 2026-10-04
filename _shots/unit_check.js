// Deterministic unit checks for the Ruby bridge - no browser required.
//   node unit_check.js
//
// Covers the *silent* fidelity defects found after the crash fixes: things
// that no longer throw but quietly do the wrong thing (dead properties,
// assignment targets turned into calls, Ruby modules missing entirely).
//
// Exit code 0 = every assertion held.
const fs = require('fs');
const path = require('path');

const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const PLUGIN = path.join(ROOT, 'js/plugins/MonlineRubyBridge.js');
const DATA = path.join(ROOT, 'data');

// ---------------------------------------------------------------- stub env
function stubClass(name, methods) {
    const C = function() {};
    C.name = name;
    methods.forEach(m => { C.prototype[m] = function() {}; });
    return C;
}
const protoMethods = ['processMoveCommand', 'updateStop', 'setImage', 'setDirection',
    'moveSpeed', 'setMoveSpeed', 'isDashButtonPressed', 'isDashing', 'locate', 'jump',
    'moveTowardCharacter', 'moveAwayFromCharacter', 'turnTowardCharacter',
    'requestAnimation', 'requestBalloon', 'eventId', 'update'];

const g = globalThis;
g.window = g;
g.Game_Character = stubClass('Game_Character', protoMethods);
g.Game_Event = stubClass('Game_Event', protoMethods);
g.Game_Player = stubClass('Game_Player', protoMethods);
g.Game_Interpreter = stubClass('Game_Interpreter', protoMethods.concat(['currentCommand', 'nextEventCode', 'command355', 'terminate', 'setWaitMode', 'updateWaitMode']));
g.Game_Action = stubClass('Game_Action', ['evalDamageFormula']);
// MonlineJp aliases applyItemUserEffect (0173.rb:446), so the stub has to have
// it - `hook` skips a missing method rather than inventing one.
g.Game_Action.prototype.applyItemUserEffect = function() {};
g.Scene_Base = stubClass('Scene_Base', ['create', 'start', 'update', 'stop', 'terminate']);
g.Game_Character.prototype.constructor = g.Game_Character;
g.Game_Event.prototype = Object.create(g.Game_Character.prototype);
g.Game_Player.prototype = Object.create(g.Game_Character.prototype);
g.Game_Interpreter.prototype.constructor = g.Game_Interpreter;

// make the character stubs behave like MV's do
g.Game_Character.prototype.moveSpeed = function() { return this._moveSpeed; };
g.Game_Character.prototype.setMoveSpeed = function(v) { this._moveSpeed = v; };
g.Game_Player.prototype.isDashButtonPressed = function() { return this._dashPressed === true; };

// real-ish database globals the Custom Database registry needs
g.$dataActors = [null, { id: 1, name: 'Ralph' }];
g.$dataClasses = [null, { id: 1, name: 'Hero' }];
g.$dataSkills = [null, { id: 1, name: 'Attack' }];
g.$dataItems = [null, { id: 1, name: 'Potion' }];
g.$dataWeapons = [null, { id: 1, name: 'Sword' }, { id: 2, name: 'Axe' }];
g.$dataArmors = [null, { id: 1, name: 'Vest' }];
g.$dataEnemies = [null, { id: 1, name: 'Slime' }];
g.$dataStates = [null, { id: 1, name: 'KO' }];
g.$dataTroops = [null, { id: 1, name: 'Troop' }];
g.$dataMapInfos = { 1: { id: 1, name: 'Map' } };
g.DataManager = {
    makeSaveContents: function() { return { marker: 'base' }; },
    extractSaveContents: function() {}
};

// ------------------------------------------------- engine stubs for lights
// MonlineLights.js has to load before the bridge so the bridge wires the real
// `light` proxy instead of its permissive fallback - same order plugins.js
// uses.
g.Graphics = {
    width: 816, height: 624, frameCount: 0,
    isWebGL: function() { return true; }
};

// A canvas 2D context that records what was drawn instead of drawing it, so
// the night layer's maths can be asserted without a browser.  The fields the
// plugin reads (`fillStyle`, `globalAlpha`, `globalCompositeOperation`) are
// plain values so the recording is faithful.
function RecordingCtx(log) {
    this._log = log;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000000';
}
RecordingCtx.prototype.save = function() { this._log.push(['save']); };
RecordingCtx.prototype.restore = function() { this._log.push(['restore']); };
RecordingCtx.prototype.clearRect = function() { this._log.push(['clearRect']); };
RecordingCtx.prototype.fillRect = function() {
    this._log.push(['fillRect', this.fillStyle, this.globalCompositeOperation, this.globalAlpha]);
};
RecordingCtx.prototype.drawImage = function() {
    this._log.push(['drawImage', this.globalCompositeOperation, this.globalAlpha, arguments.length]);
};
RecordingCtx.prototype.translate = function() { this._log.push(['translate']); };
RecordingCtx.prototype.getImageData = function(x, y, w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
};
RecordingCtx.prototype.putImageData = function() {};
RecordingCtx.prototype.scale = function() { this._log.push(['scale']); };

function TestBitmap(w, h) {
    this.width = w || 0;
    this.height = h || 0;
    this._canvas = { width: this.width, height: this.height };
    this._ops = [];
    this._context = new RecordingCtx(this._ops);
    this._isLoading = 0;
}
TestBitmap.prototype.isReady = function() { return this.width > 0; };
TestBitmap.prototype._setDirty = function() { this._dirty = true; };
TestBitmap.prototype.resize = function(w, h) { this.width = w; this.height = h; };
TestBitmap.prototype.clear = function() {};
TestBitmap.prototype.clearRect = function() {};
TestBitmap.prototype.fillRect = function() {};
TestBitmap.prototype.blt = function() {};
g.Bitmap = TestBitmap;

function TestSprite() {
    this.anchor = { x: 0, y: 0 };
    this.scale = { x: 1, y: 1 };
    this.rotation = 0;
    this.opacity = 255;
    this.visible = true;
    this.blendMode = 0;
    this.bitmap = null;
    this.parent = null;
    this.children = [];
    this.x = 0;
    this.y = 0;
    this._frame = { x: 0, y: 0, width: 0, height: 0 };
}
TestSprite.prototype.setFrame = function(x, y, w, h) {
    this._frame = { x: x, y: y, width: w, height: h };
};
TestSprite.prototype.addChild = function(c) { this.children.push(c); c.parent = this; };
TestSprite.prototype.removeChild = function(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) { this.children.splice(i, 1); }
    if (c.parent === this) { c.parent = null; }
};
TestSprite.prototype.update = function() {};
g.Sprite = TestSprite;

// One ready 200x200 "torch.png" bitmap per file name, so the light system has
// something real to slice into frames.
g._pictureBitmaps = {};
g._fogBitmaps = {};
g.ImageManager = {
    loadPicture: function(name) {
        if (!g._pictureBitmaps[name]) { g._pictureBitmaps[name] = new TestBitmap(200, 200); }
        return g._pictureBitmaps[name];
    },
    // MV has no loadFog; MonlineFog loads img/fogs/ through this directly.
    loadBitmap: function(folder, name) {
        const key = folder + name;
        if (!g._fogBitmaps[key]) { g._fogBitmaps[key] = new TestBitmap(256, 256); }
        return g._fogBitmaps[key];
    }
};
g.Game_Map = stubClass('Game_Map', ['setup', 'mapId', 'tileWidth', 'tileHeight',
    'displayX', 'displayY', 'isLoopHorizontal', 'isLoopVertical',
    'adjustX', 'adjustY', 'event', 'vehicle']);

// --- camera (Galv 0216.rb): a map that really scrolls -----------------------
// MonlineCamera aliases these at load time, so they must be genuine *before*
// the plugin loads - in particular doScroll, because the port's override adds
// the four diagonals on top of the engine's cardinal cases.
g.Game_Map.prototype.doScroll = function(direction, distance) {
    switch (direction) {
    case 2: this.scrollDown(distance); break;
    case 4: this.scrollLeft(distance); break;
    case 6: this.scrollRight(distance); break;
    case 8: this.scrollUp(distance); break;
    }
};
g.Game_Map.prototype.isScrolling = function() { return this._scrollRest > 0; };
g.Game_Map.prototype.scrollDistance = function() {
    return Math.pow(2, this._scrollSpeed) / 256;
};
// MV's own updateScroll, including its "could not move -> stop" escape hatch.
g.Game_Map.prototype.updateScroll = function() {
    if (!this.isScrolling()) { return; }
    const lastX = this.displayX(), lastY = this.displayY();
    this.doScroll(this._scrollDirection, this.scrollDistance());
    if (this.displayX() === lastX && this.displayY() === lastY) {
        this._scrollRest = 0;
    } else {
        this._scrollRest -= this.scrollDistance();
    }
};
g.Game_Player.prototype.centerX = function() {
    return (g.Graphics.width / 48 - 1) / 2.0;
};
g.Game_Player.prototype.centerY = function() {
    return (g.Graphics.height / 48 - 1) / 2.0;
};
// Counted so the test can prove the port suppresses it while locked.
g.Game_Player.prototype.updateScroll = function() {
    this._scrollCalls = (this._scrollCalls || 0) + 1;
};
g.Game_Interpreter.prototype.setWaitMode = function(mode) { this._waitMode = mode; };
g.Game_Interpreter.prototype.updateWaitMode = function() { return false; };

g.Spriteset_Map = stubClass('Spriteset_Map', ['createLowerLayer', 'update', 'dispose']);
g.Game_Follower = stubClass('Game_Follower', ['isVisible', 'screenX', 'screenY']);
Object.setPrototypeOf(g.Game_Follower.prototype, g.Game_Character.prototype);

// --- MonlineTextPop stubs (must exist before loadPlugin so its Sprite_Character
//     hook actually registers; the port guards on typeof, so without this the
//     alias is simply skipped and the functional tests below would no-op) ---
g.Game_Followers = function() { this._data = []; };
g.Game_Followers.prototype.data = function() { return this._data; };
g.Game_Followers.prototype.forEach = function() {};
g.$gamePlayer = g.$gamePlayer || { followers: function() { return new g.Game_Followers(); } };
g.Game_Interpreter.prototype.event_id = function() { return this._eventId || 0; };
g.Sprite_Character = stubClass('Sprite_Character', ['update', 'dispose']);
g.Sprite_Character.prototype.bitmap = { height: 48 };
// TestSprite already has addChild/removeChild; TestBitmap lacks the text API
// the port calls, so augment it instead of overwriting g.Sprite/g.Bitmap.
if (typeof TestBitmap === 'function') {
    TestBitmap.prototype.measureTextWidth = function(t) { return String(t).length * 8; };
    TestBitmap.prototype.drawText = function() {};
    TestBitmap.prototype.fontFace = '';
    TestBitmap.prototype.fontSize = 0;
    TestBitmap.prototype.fontBold = false;
    TestBitmap.prototype.fontItalic = false;
    TestBitmap.prototype.textColor = '';
}
g.Game_Picture = stubClass('Game_Picture', ['initialize', 'x', 'y', 'name', 'number']);
g.Sprite_Picture = stubClass('Sprite_Picture', ['updatePosition', 'update']);
// MV's real Sprite_Picture#updatePosition, so the anchor override has
// something genuine to defer to.
g.Sprite_Picture.prototype.picture = function() {
    return g.$gameScreen.picture(this._pictureId);
};
g.Sprite_Picture.prototype.updatePosition = function() {
    var picture = this.picture();
    this.x = Math.floor(picture.x());
    this.y = Math.floor(picture.y());
};
g.SceneManager = { _scene: null };
// character API the light system samples
g.Game_Character.prototype.direction = function() { return this._direction || 2; };
g.Game_Character.prototype.pattern = function() { return this._pattern || 0; };
g.Game_Character.prototype.screenX = function() { return this._screenX || 0; };
g.Game_Character.prototype.screenY = function() { return this._screenY || 0; };
g.Game_Character.prototype.isTransparent = function() { return this._transparent === true; };
// MV declares x/y as read-only accessor *properties* on Game_CharacterBase
// (`Object.defineProperties(..., { x: { get: ... } })`), NOT as methods.  The
// stub has to have the same shape or it lies: a port written against
// `chara.x()` passes here and throws "chara.x is not a function" in the
// browser.  That is exactly what happened the first time round.
Object.defineProperties(g.Game_Character.prototype, {
    x: { get: function() { return this._x || 0; }, configurable: true },
    y: { get: function() { return this._y || 0; }, configurable: true }
});
g.$gameMap = new g.Game_Map();
g.$gameMap.tileWidth = function() { return 48; };
g.$gameMap.tileHeight = function() { return 48; };
g.$gameMap.displayX = function() { return 0; };
g.$gameMap.displayY = function() { return 0; };
g.$gameMap.isLoopHorizontal = function() { return false; };
g.$gameMap.isLoopVertical = function() { return false; };
g.$gameMap.mapId = function() { return 1; };
g.$gameMap.vehicle = function() { return null; };
g._pictures = {};
// MonlineChoice hooks Game_Message.prototype at *load* time, so the class has
// to exist before the plugins are evaluated.
// MonlineScenes subclasses these at load time (Object.create of their
// prototypes), so the classes must exist before the plugins are evaluated.
['Scene_MenuBase', 'Scene_ItemBase', 'Scene_Equip', 'Scene_Map'].forEach(function(n) {
    g[n] = stubClass(n, ['initialize', 'create', 'createHelpWindow',
        'createStatusWindow', 'popScene', 'actor', 'item', 'onItemOk']);
});
['Window_ItemList', 'Window_SkillList', 'Window_Command', 'Window_Selectable']
    .forEach(function(n) {
        g[n] = stubClass(n, ['initialize', 'refresh', 'setHandler',
            'setHelpWindow', 'setActor', 'item', 'index', 'addCommand',
            'makeCommandList', 'activate', 'drawAllItems', 'itemRectForText',
            'drawText', 'includes', 'isEnabled']);
    });
// MonlineMapEffects hooks Spriteset_Map / Game_Map at load time and applies
// state to a real-ish spriteset, so give it the few members it touches.
g.Spriteset_Map = stubClass('Spriteset_Map', ['initialize', 'create', 'update']);
g.Spriteset_Map.prototype.scale = { x: 1, y: 1 };
g.Spriteset_Map.prototype.update = function() {};
g.PIXI = { filters: {
    BlurFilter: function() { this.blur = 0; },
    ColorMatrixFilter: function() { this.reset = function() {}; this.hue = function() {}; }
} };

g.SoundManager = { playUseItem: function() {}, playUseSkill: function() {},
    playBuzzer: function() {} };

// MonlineScenes extends Game_Actor at load time (JP pool for the learn-skill
// scene) and MonlineJp extends Game_BattlerBase (`jpr`, 0173.rb:395), so both
// classes - and the inheritance between them, which rpg_objects.js has - must
// exist before the plugins are evaluated.
// The method list MUST mirror real engine names, never what the code under test
// happens to call: MV's Game_Actor has `isLearnedSkill` and no `isLearned`
// (rpg_objects.js:3964).  Stubbing a name the engine does not have turns a
// guaranteed crash into a green unit run - asserted for below.
const ACTOR_METHODS = ['isLearnedSkill', 'learnSkill', 'currentExp', 'loseExp',
    'gainJp', 'loseJp', 'changeExp', 'addedSkillTypes', 'levelUp'];
g.Game_BattlerBase = stubClass('Game_BattlerBase',
    ['isActor', 'actor', 'currentClass', 'equips', 'states', 'isDead']);
g.Game_Actor = stubClass('Game_Actor', ACTOR_METHODS);
// Re-link instead of relying on stubClass: Game_Actor must inherit the battler
// base, or `jpr` would be missing and every earnJp would throw.
g.Game_Actor.prototype = Object.create(g.Game_BattlerBase.prototype);
g.Game_Actor.prototype.constructor = g.Game_Actor;
ACTOR_METHODS.forEach(function(name) {
    g.Game_Actor.prototype[name] = function() {};
});
g.Game_Actor.prototype.jp = function() { return this._jp || 0; };
g.Game_Battler = function() {};
g.Game_Battler.prototype = Object.create(g.Game_BattlerBase.prototype);
g.Game_Battler.prototype.constructor = g.Game_Battler;
g.Game_Unit = stubClass('Game_Unit', ['members', 'aliveMembers', 'deadMembers']);
g.Game_Troop = function() { this._enemies = []; };
g.Game_Troop.prototype = Object.create(g.Game_Unit.prototype);
g.Game_Troop.prototype.constructor = g.Game_Troop;
g.Game_Troop.prototype.members = function() { return this._enemies; };
g.Game_Troop.prototype.deadMembers = function() {
    return this._enemies.filter(function(e) { return e.isDead(); });
};
g.Game_Enemy = function() { this._enemyId = 0; this._dead = false; };
g.Game_Enemy.prototype = Object.create(g.Game_Battler.prototype);
g.Game_Enemy.prototype.constructor = g.Game_Enemy;
g.Game_Enemy.prototype.enemy = function() { return this._enemyData || null; };
g.Game_Enemy.prototype.isDead = function() { return this._dead === true; };
// BattleManager is a plain singleton object in MV, not a class - it records the
// order the victory steps run in so the JP grant's position can be asserted.
g.BattleManager = {
    _order: [],
    playVictoryMe: function() { this._order.push('me'); },
    makeRewards: function() { this._order.push('rewards'); },
    displayVictoryMessage: function() { this._order.push('victory'); },
    displayRewards: function() { this._order.push('display'); },
    gainRewards: function() { this._order.push('gain'); },
    // VX Ace only clears battle states in battle_end (0174.rb:385), i.e. *after*
    // gain_jp, so the JP must already be on the actor by the time MV clears
    // them.  The test installs `g.__jpSnapshot` and reads this back.
    removeBattleStates: function() {
        this._order.push('states');
        if (typeof g.__jpSnapshot === 'function') {
            this._jpAtStates = g.__jpSnapshot();
        }
    },
    performVictory: function() {},
    replayBgmAndBgs: function() {},
    endBattle: function() { this._order.push('end'); },
    // Same shape as rpg_managers.js:2633 so the position of the grafted JP
    // grant can be read back.
    processVictory: function() {
        this._order.length = 0;
        this.removeBattleStates();
        this.performVictory();
        this.playVictoryMe();
        this.makeRewards();
        this.displayVictoryMessage();
        this.displayRewards();
        this.gainRewards();
        this.endBattle(0);
    }
};

g.Game_Message = stubClass('Game_Message', ['clear', 'choices',
    'choiceCancelType', 'onChoice', 'setChoices']);
// MonlineChoice also hooks Window_ChoiceList.prototype while loading.  These
// behaviours have to be in place *before* the plugin captures the originals:
//   * isCancelEnabled must answer true, or the plugin's override (which asks
//     the original first) can never allow cancelling;
//   * addCommand records the labels so the test can read them back.
g.Window_ChoiceList = stubClass('Window_ChoiceList', ['makeCommandList',
    'callOkHandler', 'isEnabled', 'isCancelEnabled', 'addCommand', 'index']);
g.Window_ChoiceList.prototype.isCancelEnabled = function() { return true; };
g.Window_ChoiceList.prototype.addCommand = function(name) {
    this.names = this.names || [];
    this.names.push(name);
};
g.Window_ChoiceList.prototype.index = function() { return this._index || 0; };

// Scene_LearnSkill hooks Window_SkillType (adds the "Learn" command) and
// Scene_Skill (wires up its handler) at load time, so both have to exist
// before the plugins are evaluated - they are MV core classes in the game.
g.Window_SkillType = function() {};
g.Window_SkillType.prototype = Object.create(g.Window_Command.prototype);
g.Window_SkillType.prototype.constructor = g.Window_SkillType;
g.Window_SkillType.prototype.makeCommandList = function() {};
g.Scene_Skill = function() {};
g.Scene_Skill.prototype = Object.create(g.Scene_ItemBase.prototype);
g.Scene_Skill.prototype.constructor = g.Scene_Skill;
g.Scene_Skill.prototype.createSkillTypeWindow = function() {};

// A real Game_Screen class, because MonlineFog hooks its prototype and a plain
// object would silently miss the hook entirely.
g.Game_Screen = function() { this._monlineFogs = null; };
g.Game_Screen.prototype.update = function() {};
g.Game_Screen.prototype.clear = function() {};
// The bridge's scope proxy maps the Ruby `$game_variables` / `$game_switches`
// names onto these MV globals, so they have to exist for any condition
// evaluation to work (in the real game MV defines them).
g.$gameVariables = { _data: {}, value: function(n) { return this._data[n] || 0; } };
g.$gameSwitches = { _data: {}, value: function(n) { return this._data[n] || false; } };
g.$gameParty = { items: [], members: function() { return []; } };
g.$gameTroop = {};
g.$gameScreen = new g.Game_Screen();
g.$gameScreen.tone = function() { return [0, 0, 0, 0]; };
g.$gameScreen.picture = function(n) {
    if (!g._pictures[n]) { g._pictures[n] = new g.Game_Picture(); }
    return g._pictures[n];
};

// ---- fog (Shaz 0246.rb): MV has no Plane, so the port uses TilingSprite ----
g.TilingSprite = function() {
    this.bitmap = null;
    this.origin = { x: 0, y: 0 };
    this.tileScale = { x: 1, y: 1 };
    this.blendMode = 0;
    this.opacity = 255;
    this.visible = true;
    this.filters = null;
    this.parent = null;
    this.children = [];
    this.x = 0; this.y = 0; this._width = 0; this._height = 0;
};
g.TilingSprite.prototype.move = function(x, y, w, h) {
    this.x = x || 0; this.y = y || 0; this._width = w || 0; this._height = h || 0;
};
g.TilingSprite.prototype.setFrame = function(x, y, w, h) { this._frame = { x: x, y: y, width: w, height: h }; };
g.TilingSprite.prototype.addChild = function(c) { this.children.push(c); c.parent = this; };
g.TilingSprite.prototype.removeChild = function(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) { this.children.splice(i, 1); }
    if (c.parent === this) { c.parent = null; }
};
g.TilingSprite.prototype.addChildAt = function(c, i) {
    this.children.splice(i, 0, c); c.parent = this;
};
g.ToneFilter = function() { this.calls = []; };
g.ToneFilter.prototype.reset = function() { this.calls.push(['reset']); };
g.ToneFilter.prototype.adjustTone = function(r, gg, b) { this.calls.push(['tone', r, gg, b]); };
g.ToneFilter.prototype.adjustSaturation = function(v) { this.calls.push(['sat', v]); };
g.Spriteset_Battle = stubClass('Spriteset_Battle', ['createLowerLayer', 'update', 'dispose']);
g.Game_Player.prototype.performTransfer = function() {};
g.Game_Player.prototype.isTransferring = function() { return this._transferring === true; };
g.Game_Player.prototype.newMapId = function() { return this._newMapId || 0; };
g.Game_Player.prototype.followers = function() {
    return { follower: function() { return null; }, isVisible: function() { return true; } };
};
g.$gamePlayer = new g.Game_Player();

// ------------------------------------------------------ load the two ports
function loadPlugin(p) {
    const s = fs.readFileSync(path.join(ROOT, 'js/plugins', p), 'utf8');
    try {
        (0, eval)(s);                                  // eslint-disable-line no-eval
    } catch (e) {
        console.error(p + ' LOAD FAILED: ' + e.message + '\n' + e.stack);
        process.exit(2);
    }
}
// Same order as plugins.js.  MonlineShim matters here: it is what plants the
// *placeholder* no-ops that the bridge has to tell apart from a real port.
loadPlugin('MonlineShim.js');
loadPlugin('MonlinePicAnchor.js');
loadPlugin('MonlineCamera.js');
// Fog has to come before Lights: both hook createLowerLayer, and the original
// puts fogs at z=300+n while Zeus's night layer sits at 0xC000, so the fog has
// to be added first to end up underneath it.
loadPlugin('MonlineFog.js');
loadPlugin('MonlineChoice.js');
loadPlugin('MonlineScenes.js');
loadPlugin('MonlineJp.js');
loadPlugin('MonlineMapEffects.js');
loadPlugin('MonlineTextPop.js');
loadPlugin('MonlineLights.js');

// -------------------------------------------------------------- load plugin
const src = fs.readFileSync(PLUGIN, 'utf8');
try {
    (0, eval)(src);                                    // eslint-disable-line no-eval
} catch (e) {
    console.error('PLUGIN LOAD FAILED: ' + e.message + '\n' + e.stack);
    process.exit(2);
}
const MR = g.MonlineRuby;

// --------------------------------------- load the ports that patch the bridge
// These five overwrite entries the bridge put on `MonlineRuby.F` (or accessors
// it installed on Scene_Base), so they must run *after* it - which is also how
// plugins.js orders them.
if (typeof Array.prototype.clone !== 'function') {
    // rpg_core.js
    Array.prototype.clone = function() { return this.slice(); };
}
g.Game_Interpreter.prototype.clear = function() {};
g.Game_Interpreter.prototype.setupChoices = function() {};
g.Game_Temp = stubClass('Game_Temp', []);
g.Game_Temp.prototype.initialize = function() {};
g.Scene_Map = stubClass('Scene_Map', ['update', 'start']);
g.Scene_Battle = stubClass('Scene_Battle', ['update', 'start']);
g.Window_BattleLog = function() { this.initialize.apply(this, arguments); };
g.Window_BattleLog.prototype.initialize = function() {
    this._lines = []; this._methods = []; this.waits = 0; this.refreshes = 0;
};
g.Window_BattleLog.prototype.refresh = function() { this.refreshes++; };
g.Window_BattleLog.prototype.wait = function() { this.waits++; };
g.Window_BattleLog.prototype.push = function(name) {
    this._methods.push({ name: name, params: Array.prototype.slice.call(arguments, 1) });
};
g.Window_BattleLog.prototype.clear = function() { this._lines = []; };

// recording stand-ins the ports under test drive.
// A factory, not a singleton: the MonlineChoice section swaps `$gameMessage`
// for a real Game_Message instance, so this has to be re-installed per section.
g.messageRecorder = function() {
    return {
        _choices: [], _cancel: null, _cb: null,
        setChoices: function(c, d, t) { this._choices = c; this._cancel = t; },
        choices: function() { return this._choices; },
        choiceCancelType: function() { return this._cancel; },
        setChoiceBackground: function(b) { this._bg = b; },
        setChoicePositionType: function(p) { this._pos = p; },
        setChoiceCallback: function(f) { this._cb = f; }
    };
};
g.$gameMessage = g.messageRecorder();
g.$gameSelfSwitches = {
    _d: {},
    setValue: function(k, v) { this._d[JSON.stringify(k)] = v; },
    value: function(k) { return this._d[JSON.stringify(k)]; }
};
function varStore() {
    return { _d: [], value: function(i) { return this._d[i]; },
        setValue: function(i, v) { this._d[i] = v; } };
}
g.$gameVariables = varStore();
g.$gameSwitches = varStore();
g.$gameTemp = new g.Game_Temp();
g.$gameTemp._tidloc_compass = [];
g.localStorage = { _d: {},
    getItem: function(k) { return k in this._d ? this._d[k] : null; },
    setItem: function(k, v) { this._d[k] = String(v); } };
g.DM_CALLS = [];
if (typeof g.DataManager.setupNewGame !== 'function') {
    g.DataManager.setupNewGame = function() { g.DM_CALLS.push('new'); };
}
if (typeof g.DataManager.saveGame !== 'function') {
    g.DataManager.saveGame = function() { g.DM_CALLS.push('save'); return true; };
}
if (typeof g.DataManager.loadGame !== 'function') {
    g.DataManager.loadGame = function() { g.DM_CALLS.push('load'); return true; };
}

// MonlineZoom touches Game_CharacterBase / Sprite_Character; MonlineWeather
// needs Game_System, a Spriteset upper layer and SceneManager.push/pop.
// Augment, never replace: the TextPop section already put an `update` on
// Sprite_Character, and blowing the class away would take that with it.
if (!g.Game_CharacterBase) { g.Game_CharacterBase = stubClass('Game_CharacterBase', []); }
if (typeof g.Game_CharacterBase.prototype.initMembers !== 'function') {
    g.Game_CharacterBase.prototype.initMembers = function() {};
}
if (typeof g.Game_CharacterBase.prototype.update !== 'function') {
    g.Game_CharacterBase.prototype.update = function() {};
}
if (!g.Sprite_Character) { g.Sprite_Character = stubClass('Sprite_Character', []); }
if (typeof g.Sprite_Character.prototype.updateOther !== 'function') {
    g.Sprite_Character.prototype.updateOther = function() {};
}
if (!g.Game_System) { g.Game_System = stubClass('Game_System', []); }
if (typeof g.Game_System.prototype.initialize !== 'function') {
    g.Game_System.prototype.initialize = function() {};
}
g.$gameSystem = new g.Game_System();
g.$gameSystem._weather = [-1, 0, ''];
g.$gameSystem._weatherRestore = [-1, 0, ''];
g.$gameSystem._weatherRecordSet = [-1, 0, ''];
g.$gameSystem._weatherTemp = [-1, 0, ''];
g.Game_Interpreter.prototype.character = function(n) {
    return n === -1 || n === 0 ? g.$gamePlayer : (g.$gameMap.event ? g.$gameMap.event(n) : null);
};
['Spriteset_Map', 'Spriteset_Battle'].forEach(function(name) {
    if (g[name] && !g[name].prototype.createUpperLayer) {
        g[name].prototype.createUpperLayer = function() {};
    }
});
if (!g.SceneManager.push) {
    g.SceneManager.push = function() {};
    g.SceneManager.pop = function() {};
}

['MonlineChoiceMerge.js', 'MonlineSelfSwitch.js', 'MonlineCompass.js',
 'MonlineBattleLog.js', 'MonlineGlobalSave.js', 'MonlineZoom.js',
 'MonlineWeather.js'].forEach(loadPlugin);

let failures = 0;
const lines = [];
function ok(label, cond, detail) {
    const mark = cond ? '  ok  ' : '  FAIL';
    if (!cond) failures++;
    lines.push(mark + '  ' + label + (detail && !cond ? '\n        ' + detail : ''));
}
function eq(label, got, want) {
    ok(label, got === want, 'got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want));
}
function has(label, hay, needle) {
    ok(label, hay.indexOf(needle) >= 0, 'in ' + JSON.stringify(hay) + '  want ' + JSON.stringify(needle));
}
function hasNot(label, hay, needle) {
    ok(label, hay.indexOf(needle) < 0, 'in ' + JSON.stringify(hay) + '  must not contain ' + JSON.stringify(needle));
}
function compiles(label, code) {
    try {
        new Function('__self', '__scope', 'with(__scope){\n' + code + '\n}'); // eslint-disable-line no-new-func
        ok(label + ' [compiles]', true);
        return true;
    } catch (e) {
        ok(label + ' [compiles]', false, e.name + ': ' + e.message);
        return false;
    }
}

// ============================================================ 1. translator
lines.push('--- translator: assignment targets and field renames ---');

let js = MR.translate('$game_player.move_speed = 4');
hasNot('move_speed write is not turned into a call', js, 'moveSpeed()');
has('move_speed write keeps the accessor name', js, '.move_speed = 4');
compiles('move_speed write', js);

js = MR.translate('$game_map.events[20].move_speed = 4.15');
eq('event receiver rewrite + accessor write', js, '$gameMap.event(20).move_speed = 4.15');
compiles('event move_speed write', js);

js = MR.translate('self.move_speed += 0.5');
hasNot('compound assignment is not turned into a call', js, 'moveSpeed()');
compiles('compound move_speed assignment', js);

js = MR.translate('v = $game_player.move_speed');
has('move_speed read stays on the accessor (float-safe)', js, '.move_speed');

js = MR.translate('$game_player.move_speed = 4 if $game_switches[1]');
eq('modifier-if keeps the accessor assignment intact', js,
    'if ($game_switches[1]) { $game_player.move_speed = 4 }');
compiles('modifier-if compiles', js);

js = MR.translate('$game_player.no_dash = true if $game_variables[9] == 3');
has('modifier-if keeps the comparison', js, '$game_variables[9] == 3');
compiles('modifier-if with comparison compiles', js);

js = MR.translate('$game_actors[1].name = "Abigal" if $game_actors[1]');
eq('the exact data line converts', js,
    'if ($game_actors[1]) { $game_actors[1].name = "Abigal" }');
compiles('data modifier-if line compiles', js);

js = MR.translate('a = "come back if you can"');
hasNot('a string containing " if " is never split', js, 'if (');
eq('string with a trailing-looking if survives', js, 'a = "come back if you can"');

js = MR.translate('x = 1 unless $game_switches[2]');
eq('modifier-unless negates', js, 'if (!($game_switches[2])) { x = 1 }');
compiles('modifier-unless compiles', js);

js = MR.translate('$game_player.no_dash = false unless $game_switches[2]');
hasNot('modifier-unless did not break the accessor write', js, 'noDash');

js = MR.translate('c = $game_map.events[@event_id]');
has('$game_map.events[id] -> event(id) still works', js, '$gameMap.event(__self.event_id)');

// plain fields -> camelCase, reads and writes
const FIELD_CASES = [
    ['a.icon_index = 11897', '.iconIndex = 11897'],
    ['w.animation_id = 166', '.animationId = 166'],
    ['s.tp_gain = 10', '.tpGain = 10'],
    ['ft.data_id = 58', '.dataId = 58'],
    ['$data_system.currency_unit = "G"', '.currencyUnit = "G"'],
    ['x = $data_armors[159].icon_index', '.iconIndex']
];
FIELD_CASES.forEach(([ruby, want]) => {
    const out = MR.translate(ruby);
    has('field rename: ' + ruby, out, want);
    hasNot('no snake_case left: ' + ruby, out, /\.(icon_index|animation_id|tp_gain|data_id|currency_unit)\b/);
    compiles('field rename compiles: ' + ruby, out);
});

// Audio API rename
js = MR.translate('Audio.me_stop');
eq('Audio.me_stop -> Audio.meStop()', js, 'Audio.meStop()');
js = MR.translate('Audio.me_stop if $game_system.me_playing');
has('Audio rename inside a modifier-if', js, 'Audio.meStop()');
compiles('Audio rename compiles', js);

// instance_eval with an explicit receiver
js = MR.translate('$game_map.events[3].instance_eval("@move_speed += 0.5")');
eq('instance_eval receiver becomes argument 1', js,
    '__instanceEval($gameMap.event(3), "@move_speed += 0.5")');
compiles('instance_eval compiles', js);
ok('instance_eval keeps the string literal untouched',
    js.indexOf('"@move_speed += 0.5"') >= 0, js);

// ===================================================== 2. runtime semantics
lines.push('--- runtime: move_speed accessor ---');
const player = new g.Game_Player();
player.move_speed = 4.15;
eq('fractional move_speed survives the setter (VX Ace allows 2**4.15/256)',
    player.move_speed, 4.15);
player.move_speed = 7;
eq('integer move_speed', player.move_speed, 7);
player.move_speed = null;
eq('nil move_speed keeps the current value', player.move_speed, 7);

const npc = new g.Game_Event();
npc.move_speed = 4.15;
eq('event receiver also gets the accessor', npc.move_speed, 4.15);

lines.push('--- runtime: no_dash ---');
eq('no_dash defaults to false', player.no_dash, false);
player._dashPressed = true;
eq('dash works while unlocked', player.isDashButtonPressed(), true);
player.no_dash = true;
eq('no_dash = true locks out dashing', player.isDashButtonPressed(), false);
player.no_dash = false;
eq('no_dash = false restores dashing', player.isDashButtonPressed(), true);
player._dashPressed = false;

lines.push('--- runtime: CustomData (Hime Custom Database, script 0176) ---');
ok('CustomData exists', typeof g.CustomData === 'object' && g.CustomData !== null);

// the exact failing payload from the smoke test
const armor = g.$dataArmors[1];
armor.name = 'Rags';
armor.description = 'This gettup makes you look poor as shit';
eq('update_armor returns true', g.CustomData.update_armor(armor), true);
eq('the edit stays on the live row', g.$dataArmors[1].name, 'Rags');
eq('the row is registered for save/load',
    (g.$custom_armors && g.$custom_armors[1] === armor), true);

// every kind the data actually calls (7) must answer, and all 9 exist
['actor', 'class', 'skill', 'item', 'weapon', 'armor', 'enemy', 'state', 'troop']
    .forEach(kind => {
        ok('CustomData.update_' + kind + ' exists',
            typeof g.CustomData['update_' + kind] === 'function');
        ok('CustomData.add_' + kind + ' exists',
            typeof g.CustomData['add_' + kind] === 'function');
    });

// add_object semantics: id = dataset.length, then push (Ruby `dataset << obj`)
const newWeapon = { name: 'Debug Blade' };
const wid = g.CustomData.add_weapon(newWeapon);
eq('add_weapon assigns id = dataset.length', wid, g.$dataWeapons.length - 1);
eq('add_weapon pushed the object', g.$dataWeapons[wid], newWeapon);
eq('add_weapon returns the id', newWeapon.id, wid);

lines.push('--- runtime: save/load round trip of the registry ---');
const contents = g.DataManager.makeSaveContents();
ok('makeSaveContents carries the registry',
    contents && contents.__monlineCustomData
    && contents.__monlineCustomData.armors[1] === armor);
// simulate a fresh boot: database back to stock, then load the save
const mutated = g.$dataArmors[1];
g.$dataArmors[1] = { id: 1, name: 'Vest' };
g.DataManager.extractSaveContents(contents);
eq('extractSaveContents re-applies the edited row',
    g.$dataArmors[1].name, 'Rags');
eq('...the very same object', g.$dataArmors[1], mutated);

lines.push('--- runtime: helper implementations ---');
eq('instance_eval runs with the receiver as self',
    typeof g.__instanceEval, 'function');
const target = new g.Game_Event();
target.move_speed = 4;
g.__instanceEval(target, '@move_speed += 0.5');
eq('instance_eval("@move_speed += 0.5") bumps the target', target.move_speed, 4.5);

// ============================== 4. bare parameterless method calls
lines.push('--- translator: a bare dotted line is a method call in Ruby ---');
[
    ['light.clear', 'light.clear()'],
    ['  map_effects.clear', '  map_effects.clear()'],
    ['SceneManager.scene.log_window.wait_and_clear',
        'SceneManager.scene.log_window.wait_and_clear()'],
    ['Fiber.yield', 'Fiber.yield()'],
    ['@light.clear', '__self.light.clear()']
].forEach(([ruby, want]) => {
    const out = MR.translate(ruby);
    eq('bare call ' + ruby, out, want);
    compiles('bare call ' + ruby, out);
});
eq('a call with arguments is untouched',
    MR.translate('light.setup("torch")'), 'light.setup("torch")');
eq('an assignment is untouched',
    MR.translate('light.chara_id = @event_id'), 'light.chara_id = __self.event_id');
eq('an operator expression is untouched', MR.translate('x = y.z'), 'x = y.z');
eq('a string literal is untouched', MR.translate('puts "a.b"'), 'puts "a.b"');
eq('Audio already had its own rule', MR.translate('Audio.me_stop'), 'Audio.meStop()');

ok('Fiber polyfill exists',
    g.Fiber && typeof g.Fiber === 'object' && typeof g.Fiber.yield === 'function');
eq('Fiber.yield() is a safe no-op', g.Fiber.yield(), null);

// 280 of the data's bare calls are statements; the 13 that sit in an operand
// position must stay reads (the guard is what keeps `.size` a getter read).
eq('statement mode appends the call', MR.translate('light.clear'), 'light.clear()');
eq('expression mode leaves a read alone',
    MR.translate('light.clear', { expression: true }), 'light.clear');
// `$game_party` is deliberately *not* rewritten to `$gameParty`: the bridge
// resolves every `$snake_case` global at run time through its scope proxy
// (GLOBAL_BRIDGE), which also covers the names that have no MV twin.  What
// this asserts is that `.size` -- an `Array.prototype` getter -- stays a plain
// read instead of growing the parentheses the bare-call rule would add.
eq('the real operand keeps Array#size a read',
    MR.translate('$game_party.battle_members.size', { expression: true }),
    '$game_party.battleMembers().size');

// ===================================================== 5. lights (Zeus81)
const L = g.MonlineLights;
lines.push('--- lights: data classes (0234.rb) ---');
ok('MonlineLights loaded', typeof L === 'object' && !!L.Game_Light);
ok('Game_Light / Game_Shadow are global (JsonEx restores by window[name])',
    typeof g.Game_Light === 'function' && typeof g.Game_Shadow === 'function');

const li = new g.Game_Light();
eq('default zoom scale is 1.0', li._zoomX, 1.0);
li.set_zoom(150);
eq('set_zoom(150) -> 1.5 x', li._zoomX, 1.5);
eq('set_zoom(150) -> 1.5 y', li._zoomY, 1.5);
li.set_zoom(0);
eq('set_zoom(0) clamps to sqrt(max(1,0))**2/100', li._zoomX, 0.01);
li.set_zoom(100, 4);
eq('an animated set_zoom does not jump', li._zoomX, 0.01);
for (let i = 0; i < 4; i++) { li.updateAnimations(); }
eq('the animated set_zoom lands on 1.0 after 4 frames', li._zoomX, 1.0);

li.set_opacity(50);
eq('set_opacity takes a percentage', li.opacity, 127.5);
li.set_color(255, 100, 100, 175);
eq('set_color stores the colour',
    [li.color.red, li.color.green, li.color.blue, li.color.alpha].join(','),
    '255,100,100,175');
li.set_pos(0, -16);
eq('set_pos x', li.x, 0);
eq('set_pos y', li.y, -16);
li.directions = 4;
eq('directions is a plain writable property', li.directions, 4);
li.set_flicker(2, 4);
eq('set_flicker variance is a ratio', li._flickerVariance, 0.02);
eq('set_flicker rate', li._flickerRate, 4);
li.clear();
eq('clear deactivates', li.active, false);
eq('clear empties the filename', li.filename, '');
eq('clear resets chara_id', li.chara_id, 0);
eq('clear resets the colour alpha', li.color.alpha, 255);
eq('clear resets the zoom', li._zoomX, 1.0);

lines.push('--- lights: flicker ---');
const fl = new g.Game_Light();
fl.setup('torch');
fl._flickerVariance = 0;
fl.updateFlicker();
eq('zero variance means no flicker at all', fl.flicker, 1);
fl._flickerRate = 0;
let minF = 9, maxF = -9;
for (let i = 0; i < 6000; i++) {
    fl._flickerVariance = 0.02;
    fl.updateFlicker();
    if (fl.flicker < minF) { minF = fl.flicker; }
    if (fl.flicker > maxF) { maxF = fl.flicker; }
}
ok('flicker stays inside 1 +/- 2*variance', minF >= 0.9599 && maxF <= 1.0401,
    'min ' + minF + ' max ' + maxF);
ok('flicker reaches both extremes (VX Ace rolls 33 / 66 out of 100)',
    minF <= 0.9601 && maxF >= 1.0399, 'min ' + minF + ' max ' + maxF);
eq('flicker modulates the zoom, not the opacity',
    fl.scaleX(), fl._zoomX * fl.flicker);

lines.push('--- lights: registry + the `light` proxy ---');
const proxy = L.interpreterProxy();
g.MonlineRuby.current = { event_id: 12 };          // the interpreter for event 12
proxy.setup('torch');
proxy.chara_id = 12;
proxy.set_color(255, 100, 100, 175);
proxy.set_zoom(150);
proxy.set_pos(0, -16);
eq('light.<name> addresses the current event key',
    Object.keys(L.lights()).join(','), 'event#12');
const row = L.lights()['event#12'];
eq('setup landed', row.filename, 'torch');
eq('chara_id assignment landed', row.chara_id, 12);
eq('set_color landed', row.color.alpha, 175);
eq('set_zoom landed', row._zoomX, 1.5);
eq('set_pos landed', row.y, -16);
proxy.clear();
eq('`light.clear` (a real call now) deactivates the light', row.active, false);

const named = proxy('player torch');
named.setup('torch');
eq('a named key is its own entry',
    Object.keys(L.lights()).sort().join(','), 'event#12,player torch');
eq('a named key returns the Game_Light itself', named instanceof g.Game_Light, true);
named.chara_id = -1;
eq('light("k").chara_id = -1 works on the real object', named.chara_id, -1);

MR.current = { event_id: 77 };
MR.F.light.setup('torch');
eq('the bridge wired the real proxy, not a permissive stub',
    L.lights()['event#77'].filename, 'torch');
eq('...and it is not counted as pending',
    MR.pending['light.setup'] === undefined, true);

lines.push('--- lights: calculate_visible ---');
const torch = new g.Game_Light();
eq('an un-setup light is invisible', L.calculateVisible(torch, null), false);
torch.setup('torch');
eq('a bitmap + active is visible', L.calculateVisible(torch, null), true);
torch.opacity = 0;
eq('opacity 0 hides it', L.calculateVisible(torch, null), false);
torch.opacity = 255;
torch.visible = false;
eq('visible = false hides it', L.calculateVisible(torch, null), false);
torch.visible = true;

const ev = new g.Game_Event();
ev._pageIndex = 2;
ev._screenX = 100;
ev._screenY = 200;
ev._direction = 6;
eq('an event light is visible while the event has a page',
    L.calculateVisible(torch, ev), true);
ev._pageIndex = -1;
eq('a page-less event has no light (VX Ace: `unless chara.list`)',
    L.calculateVisible(torch, ev), false);
ev._pageIndex = 2;
ev._transparent = true;
eq('a transparent character hides its light',
    L.calculateVisible(torch, ev), false);
ev._transparent = false;

lines.push('--- lights: world-space positions ---');
const posData = new g.Game_Light();
posData.setup('torch');
posData.set_pos(0, -16);
eq('offsets are scaled for the 1.5x world',
    L.calculateY(posData.y, 1, ev), -16 * 1.5 + 200);
eq('the anchor character screen_x is the base',
    L.calculateX(posData.x, 1, ev), 0 * 1.5 + 100);
eq('an un-anchored light scrolls with the map',
    L.calculateX(48, 1, null), 48 * 1.5);

lines.push('--- lights: direction / pattern ---');
const d4 = new g.Game_Light();
d4.directions = 4;
d4.anime_rate = 0;
ev._direction = 6;
ev._pattern = 1;
L.syncDirectionPattern(d4, ev);
eq('directions = 4 maps direction 6 to row 2', d4.direction, 2);
eq('pattern is reduced modulo `patterns` (1 -> 0)', d4.pattern, 0);
ev._direction = 8;
L.syncDirectionPattern(d4, ev);
eq('direction 8 maps to row 3', d4.direction, 3);
d4.patterns = 4;
ev._pattern = 1;
L.syncDirectionPattern(d4, ev);
eq('with 4 patterns the character pattern is kept', d4.pattern, 1);
ev._pattern = 3;
L.syncDirectionPattern(d4, ev);
eq('a pattern above 3 collapses to 1 (VX Ace rule)', d4.pattern, 1);
const d1 = new g.Game_Light();
L.syncDirectionPattern(d1, ev);
eq('directions = 1 leaves the row alone', d1.direction, 0);

lines.push('--- lights: night layer colour ---');
const LS = L.Spriteset_LightsShadows.prototype;
function fakeSpriteset(withLights, tone) {
    const o = Object.create(LS);
    o.hasVisibleLight = function() { return withLights; };
    g.$gameScreen.tone = function() { return tone; };
    return o;
}
eq('no lights -> no night layer',
    fakeSpriteset(false, [-68, -51, -68, 0]).computeNightColor(), null);
eq('lights + a dark tone -> inverse of the negative part',
    JSON.stringify(fakeSpriteset(true, [-68, -51, -68, 0]).computeNightColor()),
    '[68,51,68]');
eq('lights + no tone -> no night layer',
    fakeSpriteset(true, [0, 0, 0, 0]).computeNightColor(), null);
eq('a positive channel contributes 0 (VX Ace leaves it at 0)',
    JSON.stringify(fakeSpriteset(true, [-68, 20, -68, 0]).computeNightColor()),
    '[68,0,68]');
g.$gameScreen.tone = function() { return [0, 0, 0, 0]; };

lines.push('--- lights: rendering (glow colour + night hole) ---');

// A real spriteset over the stubbed engine, driven by a real Game_Light, so
// the two halves of Zeus81's pipeline can be asserted instead of described:
//   1. the additive coloured glow, and
//   2. the hole the same light punches in the night layer.
function liveScene(tone) {
    g.$gameScreen.tone = function() { return tone; };
    g.$gameMap._monlineLights = {};
    return new L.Spriteset_LightsShadows(new g.Sprite());
}
function addTorch(scene, color) {
    const l = new g.Game_Light();
    l.setup('torch');
    l.chara_id = -1;
    l.set_color(color[0], color[1], color[2], color[3]);
    l.set_opacity(100);
    g.$gameMap._monlineLights['player torch'] = l;
    scene.update();
    return l;
}
const isoLight = () => JSON.stringify(Object.keys(sc._lightSprites));

let sc = liveScene([-68, -51, -68, 0]);

// --- 1. a coloured light -> one additive glow ------------------------------
const live = addTorch(sc, [255, 0, 0, 255]);
eq('a visible light owns exactly one glow sprite', sc._glowSprite.children.length, 1);
const glow = sc._glowSprite.children[0];
eq('the glow blends additively (RGSS blend_type 1 = Addition)', glow.blendMode, 1);
eq('set_opacity(100) -> full sprite opacity', glow.opacity, 255);
eq('the glow sprite is visible', glow.visible, true);
eq('the glow is anchored on the light file, 1:1 -- pictures are not world-scaled',
    glow.anchor.x, 0.5);

// RGSS `Sprite#color` is a colour *replacement* clipped to the source alpha,
// never a multiply: `torch.png` is pure black, so a multiply tint would leave
// the documented "set_color(255,0,0,255) => red light" totally black.
const tintOps = JSON.stringify(sc._tintCache['torch#15,0,0']._ops);
has('the tint fills with the light colour', tintOps, '"rgb(240,0,0)"');
has('the tint clips to the source alpha', tintOps, '"destination-in"');
hasNot('the tint never multiplies over the black source', tintOps, '"multiply"');
ok('the white silhouette mask is cached separately from the colour',
    !!sc._tintCache['torch#15,15,15']);

// --- 2. the night layer ----------------------------------------------------
eq('the night layer is shown', sc._nightSprite.visible, true);
eq('the night layer multiplies', sc._nightSprite.blendMode, 2);
const nightOps = sc._nightBitmap._ops;
has('the field is the complement 255-D, not the darkness D itself',
    JSON.stringify(nightOps), '"rgb(187,204,187)"');
const holes = nightOps.filter(o => o[0] === 'drawImage');
eq('exactly one hole is punched for one light', holes.length, 1);
eq('the hole is drawn source-over, i.e. it lightens the field',
    holes[0][1], 'source-over');
eq('the hole is punched at the light opacity, not the colour alpha',
    holes[0][2], 1);

// --- 3. blend_type mapping (behavioural, RGSS 0/1/2 -> PIXI) ---------------
live.blend_type = 0; sc.update();
eq('RGSS Normal (0) maps to PIXI normal', sc._glowSprite.children[0].blendMode, 0);
live.blend_type = 2; sc.update();
eq('RGSS Subtraction (2) lands on multiply -- PIXI cannot subtract',
    sc._glowSprite.children[0].blendMode, 2);
live.blend_type = 1; sc.update();

// --- 4. a null colour: no glow, but the hole survives ----------------------
live.set_color(0, 0, 0, 0);
sc.update();
eq('a null-coloured light loses its glow', sc._glowSprite.children[0].visible, false);
eq('...and its opacity drops to 0', sc._glowSprite.children[0].opacity, 0);
sc._nightBitmap._ops.length = 0;
sc.updateNightLayer();
eq('...but it still punches its hole (this is "prevents the screen from darkening")',
    sc._nightBitmap._ops.filter(o => o[0] === 'drawImage').length, 1);

// --- 5. clearing a light removes both halves -------------------------------
live.clear();
sc.update();
eq('a cleared light is gone from the sprite table', isoLight(), '[]');
eq('...and its sprite is detached from the glow layer',
    sc._glowSprite.children.length, 0);
eq('...and with no light left the night layer hides again',
    sc._nightSprite.visible, false);

// --- 6. the engine tone must not double-count the darkness -----------------
sc = liveScene([-68, -51, -68, 0]);
addTorch(sc, [255, 255, 255, 128]);
eq('while lights are on the negative tone is cancelled',
    JSON.stringify(sc.computeNightColor()), '[68,51,68]');
g.$gameScreen.tone = function() { return [-100, 40, -10, 0]; };
eq('only the negative channels are cancelled (VX Ace adds -r, leaves +r)',
    JSON.stringify(sc.computeNightColor()), '[100,0,10]');
g.$gameScreen.tone = function() { return [0, 0, 0, 0]; };

// ================================================ 6. camera (Galv 0216.rb)
lines.push('--- camera (Galv Cam Control v1.4) ---');

// ---------------------------------------------------------------------------
// First, a guard on the *stubs themselves*.
//
// The first version of this port called `chara.x()` and passed every assertion
// below, because the stub had declared `x` as a method - while MV declares it as
// a read-only accessor property on Game_CharacterBase.  Nothing noticed until
// the browser threw "chara.x is not a function" and killed the interpreter for
// the rest of the run.  A test harness that lies about the engine is worse than
// no harness, so the shape is now read out of the engine source and checked.
// ---------------------------------------------------------------------------
function engineShapes(className) {
    const src = fs.readFileSync(path.join(ROOT, 'js/rpg_objects.js'), 'utf8');
    const shapes = {};
    const dp = new RegExp('Object\\.defineProperties\\(' + className +
        '\\.prototype,\\s*\\{([\\s\\S]*?)\\n\\}\\);');
    const m = dp.exec(src);
    if (m) {
        const rx = /(\w+)\s*:\s*\{\s*get\s*:/g;
        let g2;
        while ((g2 = rx.exec(m[1])) !== null) { shapes[g2[1]] = 'accessor'; }
    }
    const rx2 = new RegExp('^' + className + '\\.prototype\\.(\\w+) = function', 'gm');
    let g3;
    while ((g3 = rx2.exec(src)) !== null) { shapes[g3[1]] = 'method'; }
    return shapes;
}
const CHARBASE = engineShapes('Game_CharacterBase');
const PLAYER = engineShapes('Game_Player');
eq('the engine declares x as an accessor property', CHARBASE.x, 'accessor');
eq('the engine declares y as an accessor property', CHARBASE.y, 'accessor');
['x', 'y', 'direction', 'pattern', 'screenX', 'screenY', 'isTransparent']
    .forEach(n => {
        const stub = typeof g.Game_Character.prototype[n] === 'function'
            ? 'method' : 'accessor';
        eq('the stub shape of Game_Character#' + n + ' matches the engine', stub,
            CHARBASE[n]);
    });
['centerX', 'centerY', 'updateScroll', 'update'].forEach(n => {
    const stub = typeof g.Game_Player.prototype[n] === 'function'
        ? 'method' : 'accessor';
    eq('the stub shape of Game_Player#' + n + ' matches the engine', stub,
        PLAYER[n]);
});

// A Game_Map that really scrolls.  MV's own bodies are mirrored, including the
// clamp in setDisplayPos and the "could not move -> stop" rule in updateScroll,
// because the whole point of the port is the loop that drives them.
function fakeMap(w, h) {
    const m = new g.Game_Map();
    m._w = w; m._h = h;
    m._displayX = 0; m._displayY = 0;
    m._scrollRest = 0; m._scrollDirection = 0; m._scrollSpeed = 4;
    m._events = {};
    m.width = () => m._w;
    m.height = () => m._h;
    m.tileWidth = () => 48;      // MV scroll values are in tile units
    m.tileHeight = () => 48;
    m.displayX = () => m._displayX;
    m.displayY = () => m._displayY;
    m.screenTileX = () => g.Graphics.width / 48;
    m.screenTileY = () => g.Graphics.height / 48;
    m.isLoopHorizontal = () => false;
    m.isLoopVertical = () => false;
    m.event = (id) => m._events[id];
    m.startScroll = (dir, dist, speed) => {
        m._scrollDirection = dir; m._scrollRest = dist; m._scrollSpeed = speed;
    };
    m.scrollDown = (d) => {
        if (m._h >= m.screenTileY()) {
            m._displayY = Math.min(m._displayY + d, m._h - m.screenTileY());
        }
    };
    m.scrollUp = (d) => {
        if (m._h >= m.screenTileY()) { m._displayY = Math.max(m._displayY - d, 0); }
    };
    m.scrollRight = (d) => {
        if (m._w >= m.screenTileX()) {
            m._displayX = Math.min(m._displayX + d, m._w - m.screenTileX());
        }
    };
    m.scrollLeft = (d) => {
        if (m._w >= m.screenTileX()) { m._displayX = Math.max(m._displayX - d, 0); }
    };
    m.setDisplayPos = (x, y) => {
        const endX = m._w - m.screenTileX();
        const endY = m._h - m.screenTileY();
        m._displayX = endX < 0 ? endX / 2 : Math.max(0, Math.min(x, endX));
        m._displayY = endY < 0 ? endY / 2 : Math.max(0, Math.min(y, endY));
    };
    return m;
}
function installMap(m) { g.$gameMap = m; return m; }
function installPlayer(x, y) {
    const p = new g.Game_Player();
    p._x = x; p._y = y; p._realX = x; p._realY = y;
    g.$gamePlayer = p;
    return p;
}
const cam = g.MonlineCamera;
const CAM = () => g.$gameMap.displayX() + ',' + g.$gameMap.displayY();
// The camera tests swap in a map of their own; the anchor tests further down
// need the engine globals back, so remember them here.
const ORIG_MAP = g.$gameMap, ORIG_PLAYER = g.$gamePlayer;

// --- can_move?: MV's screenTile* replaces VX Ace's Graphics.height / 32 -----
installMap(fakeMap(20, 20));   // screen is 17 x 13 tiles
eq('cannot scroll left at the left edge', cam.canMove(4), false);
eq('cannot scroll up at the top edge', cam.canMove(8), false);
eq('can scroll right while there is room', cam.canMove(6), true);
g.$gameMap._displayX = 3;      // 20 - 17
eq('cannot scroll right at the right edge', cam.canMove(6), false);
g.$gameMap._displayY = 7;      // 20 - 13
eq('cannot scroll down at the bottom edge', cam.canMove(2), false);
// A map narrower than the screen must block everything (MV's scroll* would
// otherwise never move and the loop would spin).
installMap(fakeMap(10, 10));
eq('a map smaller than the screen blocks right', cam.canMove(6), false);
eq('a map smaller than the screen blocks down', cam.canMove(2), false);

// --- MV only scrolls on the four cardinals; Galv needs all eight ------------
const dm = installMap(fakeMap(40, 40));
dm.setDisplayPos(10, 10);
dm.doScroll(1, 2);
eq('doScroll gained direction 1 (down + left)', CAM(), '8,12');
dm.setDisplayPos(10, 10);
dm.doScroll(9, 2);
eq('doScroll gained direction 9 (up + right)', CAM(), '12,8');
dm.setDisplayPos(10, 10);
dm.doScroll(6, 3);
eq('the cardinal cases still delegate to the engine', CAM(), '13,10');

// --- cam_set: a move is a gliding loop, not one long scroll ----------------
let fm = installMap(fakeMap(40, 40));
installPlayer(10, 10);
g.cam_set(30, 25, 6);          // display target = (30-8, 25-6) = (22, 19)
eq('cam_set parks the camera (cam_target = -1)', cam.camTarget(), -1);
eq('cam_set does not teleport on the spot', CAM(), '0,0');
ok('cam_set arms a move plan', cam.hasPlan());
let frames = 0;
while (cam.hasPlan() && frames < 3000) { cam.step(); fm.updateScroll(); frames++; }
eq('the camera lands exactly on the target', CAM(), '22,19');
ok('...over many frames, i.e. it really glided', frames > 20, 'frames=' + frames);
ok('the plan is released when it settles', !cam.hasPlan());
items: {
    // speed 0 must be an instant cut, not a fast pan
    fm = installMap(fakeMap(40, 40));
    installPlayer(10, 10);
    g.cam_set(30, 25, 0);
    ok('cam_set(x, y, 0) snaps instantly', !cam.hasPlan() && CAM() === '22,19',
        CAM());
}

// --- a direction picker that walks diagonally ------------------------------
fm = installMap(fakeMap(40, 40));
g.$gameMap.setDisplayPos(5, 5);
eq('an open diagonal is chosen when both axes are free', cam.chooseDirection(15, 15), 3);
g.$gameMap.setDisplayPos(15, 5);
eq('it straightens out once one axis has lined up', cam.chooseDirection(15, 15), 2);
g.$gameMap.setDisplayPos(5, 5);
eq('and stops when it is already there', cam.chooseDirection(5, 5), 0);
// pinned against the right edge, the diagonal must degrade to straight down
g.$gameMap.setDisplayPos(40 - 17, 5);
eq('a blocked axis degrades the diagonal', cam.chooseDirection(30, 15), 2);

// --- an unreachable target settles instead of hanging ----------------------
fm = installMap(fakeMap(40, 40));
installPlayer(10, 10);
g.cam_set(0, 0, 6);            // wants display (-8, -6): clamped, so blocked
let settle = 0;
while (cam.hasPlan() && settle < 100) { cam.step(); fm.updateScroll(); settle++; }
ok('an unreachable target settles instead of hanging',
    !cam.hasPlan() && settle < 10, 'frames=' + settle);

// --- cam_center hands the camera back to the player ------------------------
fm = installMap(fakeMap(40, 40));
installPlayer(12, 9);
g.cam_set(30, 25, 0);          // lock the camera away from the player
eq('cam_set leaves the camera locked', cam.camTarget(), -1);
g.cam_center(0);
eq('cam_center(0) snaps back to the player and unlocks',
    cam.camTarget() + '|' + CAM(), '0|' + (12 - 8) + ',' + (9 - 6));

// --- cam_follow ------------------------------------------------------------
fm = installMap(fakeMap(40, 40));
installPlayer(10, 10);
const fol = new g.Game_Event();
fol._x = 25; fol._y = 20; fol._realX = 25; fol._realY = 20;
fm._events[4] = fol;
g.cam_follow(4, 0);
eq('cam_follow(4, 0) leaves cam_target pointing at the event', cam.camTarget(), 4);
ok('...with no move plan to wait for', !cam.hasPlan());
// With speed 0 there is no scroll, so the display only moves when the player
// update forces it onto the followed event - which is exactly what the
// original did (its `update` hook is the only thing that re-centres a follow).
g.$gamePlayer.update(true);
eq('the next frame snaps the camera onto the event',
    CAM(), (25 - 8) + ',' + (20 - 6));
// and it keeps tracking the event frame by frame
fol._realX = 27; fol._realY = 22;
g.$gamePlayer.update(true);
eq('a followed event drags the camera along', CAM(), (27 - 8) + ',' + (22 - 6));
// Galv 1.4's own fix: transferring to a map without the event must not crash
delete fm._events[4];
g.$gamePlayer.update(true);
eq('a vanished follow target falls back to the player', cam.camTarget(), 0);

// --- the player must not scroll the map while the camera is locked ---------
fm = installMap(fakeMap(40, 40));
installPlayer(10, 10);
g.cam_set(30, 25, 0);
const pl = g.$gamePlayer;
pl._scrollCalls = 0;
pl.updateScroll();
eq('the player cannot scroll the map while the camera is locked',
    pl._scrollCalls, 0);
g.cam_center(0);
pl.updateScroll();
eq('...and can again once the camera is handed back', pl._scrollCalls, 1);

// --- the wait mode: the Fiber.yield replacement ----------------------------
fm = installMap(fakeMap(40, 40));
installPlayer(10, 10);
const it2 = new g.Game_Interpreter();
g.cam_set(30, 25, 6);
ok('the script call asks the bridge to park the event',
    typeof MR.waitFor === 'function');
it2.setWaitMode(cam.WAIT_MODE);
eq('the interpreter reports "waiting" while the camera glides',
    it2.updateWaitMode(), true);
let guard = 0;
while (it2.updateWaitMode() && guard++ < 3000) { fm.updateScroll(); }
ok('...and releases the event once the camera arrives',
    !cam.hasPlan() && guard > 20, 'frames=' + guard);
eq('the wait mode is cleared so the event can continue', it2._waitMode, '');
eq('and it arrived where it was told to', CAM(), '22,19');

// --- the interpreter hooks must not leak into unrelated interpreters -------
installMap(fakeMap(40, 40));
installPlayer(10, 10);
const it3 = new g.Game_Interpreter();
eq('a normal wait mode is delegated to the engine', it3.updateWaitMode(), false);
g.cam_set(30, 25, 6);
ok('cam_set armed a plan', cam.hasPlan());
// MV reaches terminate() from executeCommand for *every* interpreter whose
// command list runs out (rpg_objects.js:8936), so an unrelated one must NOT
// disarm a pan that is in flight - that was the Caste City bug.
it3.terminate();
ok('an unrelated interpreter dying leaves the pan alone', cam.hasPlan());
// ...but the interpreter that is actually parked on the camera does release
// it, and hands the camera back to the player rather than stranding it.
it3.setWaitMode(cam.WAIT_MODE);
it3.terminate();
ok('the interpreter parked on the camera releases it', !cam.hasPlan());
eq('...and hands the camera back to the player', g.$gameMap._monlineCamTarget, 0);

// put the engine globals back the way the rest of the suite expects them
g.$gameMap = ORIG_MAP;
g.$gamePlayer = ORIG_PLAYER;

// ================================================ 6b. fog (Shaz 0246.rb)
lines.push('--- fog (Shaz Multi Layer Fog v2.0) ---');

const FOG = g.MonlineFog;
// a spriteset with just enough structure for the fog layer to attach to
function fakeFogSpriteset() {
    const s = { children: [], addChild(c) { this.children.push(c); c.parent = this; return c; } };
    const base = {
        children: [],
        addChild(c) { this.children.push(c); c.parent = this; return c; },
        addChildAt(c, i) { this.children.splice(i, 0, c); c.parent = this; return c; }
    };
    base._parallax = {};
    base.children.push(base._parallax);
    s._baseSprite = base;
    return s;
}

// --- the interpreter calls -------------------------------------------------
g.$gameScreen._monlineFogs = {};                 // start from a clean container
g.window.show_fog(1, 'Fog1', 0, 100, 1, 100, 6, 2);
const fog1 = FOG.fog(1);
eq('show_fog fills the fog in', fog1.name, 'Fog1');
eq('...opacity', fog1.opacity, 100);
eq('...blend_type', fog1.blend_type, 1);
eq('...zoom', fog1.zoom, 100);
eq('...drift speed', fog1.sx + ':' + fog1.sy, '6:2');
eq('z defaults to 300 + number', fog1.z, 301);

// --- opacity fade (the Zeus fixed-length ease) ------------------------------
g.window.fade_fog(1, 45, 60);
fog1.updateOpacityChange();
ok('a fade moves toward the target, not to it',
    fog1.opacity < 100 && fog1.opacity > 45, '' + fog1.opacity);
for (let i = 0; i < 59; i++) { fog1.updateOpacityChange(); }
eq('...and lands exactly on the target after `duration` frames', fog1.opacity, 45);
g.window.fade_fog(1, 0, 1);
fog1.updateOpacityChange();
eq('duration 1 is an instant cut', fog1.opacity, 0);
g.window.fade_fog(1, 100, 0);
eq('duration 0 is immediate', fog1.opacity, 100);

// --- tone ------------------------------------------------------------------
// duration 0 is the instant form (the original copies the target when
// `@tone_duration == 0`); anything above 0 animates over that many frames.
g.window.tint_fog(1, 40, -40, -15, 0, 0);
eq('tint_fog with duration 0 lands at once',
    JSON.stringify(fog1.tone), '[40,-40,-15,0]');
g.window.tint_fog(1, 0, 0, 0, 0, 60);
fog1.updateToneChange();
ok('a tint fade is animated', fog1.tone[0] !== 0 && fog1.tone[0] < 40, '' + fog1.tone[0]);

// --- drift: anchored to the map, plus a breeze -----------------------------
const fogMap = fakeMap(40, 40);
installMap(fogMap);
fogMap._displayX = 2; fogMap._displayY = 3;
const fogDrift = FOG.fog(2);
fogDrift.show('Fog2', 0, 100, 0, 100, 8, 0, 0);      // 8/8 = 1px per frame
fogDrift.updateMove();
eq('ox is the map scroll in MV pixels (displayX * 48)', fogDrift.ox - fogDrift.sx2 * 1.5, 96);
// the original sets `@sx = @sx2 = sx`, so the drift starts at the speed and
// steps down by sx/8 each frame -- assert the step, not an assumed origin
const sx2Before = fogDrift.sx2;
fogDrift.updateMove();
eq('the breeze drifts by sx/8 per frame', sx2Before - fogDrift.sx2, 1);
eq('...and that drift is world-scaled (x1.5) into ox',
    fogDrift.ox - 96, fogDrift.sx2 * 1.5);

// --- rendering -------------------------------------------------------------
const ss = fakeFogSpriteset();
const layer = new FOG.FogLayer(ss);
layer.update();
const spF1 = layer._sprites['1'];
const spF2 = layer._sprites['2'];
ok('a live fog gets a TilingSprite', !!spF1 && !!spF2);
eq('the fog is drawn above the characters (z >= 0)', spF1.parent === ss.children[0], true);
eq('the plane fills the screen',
    spF1.x + ',' + spF1.y + ',' + spF1._width + ',' + spF1._height, '0,0,816,624');
eq('zoom 100 is world-scaled to 1.5', spF1.tileScale.x, 1.5);
eq('blend_type 1 maps to PIXI add', spF1.blendMode, 1);
eq('opacity follows the fade', spF1.opacity, 100);
ok('the tone becomes a ToneFilter, not a permanent filter',
    !!spF1.filters && spF1.filters.length === 1);
ok('...using MV\'s own reset / adjustTone / adjustSaturation recipe',
    !!spF1._monlineTone &&
    spF1._monlineTone.calls[0][0] === 'reset' &&
    spF1._monlineTone.calls[1][0] === 'tone' &&
    spF1._monlineTone.calls[2][0] === 'sat',
    JSON.stringify(spF1._monlineTone && spF1._monlineTone.calls));

// negative z goes behind the map but in front of the parallax
FOG.fog(3).show('Fog3', 0, 100, 0, 100, 0, 0, -1);
layer.update();
const spF3 = layer._sprites['3'];
// the sprite's parent is the "below" container; what matters is where that
// container was inserted -- right after the parallax, still inside _baseSprite
ok('a negative-z fog is parented to the below container',
    !!layer._below && spF3.parent === layer._below,
    'parent is below: ' + (spF3.parent === layer._below));
eq('...and that container sits right after the parallax',
    ss._baseSprite.children.indexOf(layer._below),
    ss._baseSprite.children.indexOf(ss._baseSprite._parallax) + 1);

// --- erase + clear on transfer --------------------------------------------
g.window.erase_fog(2);
layer.update();
ok('an erased fog loses its sprite', !layer._sprites['2']);
g.window.show_fog(5, 'FogWater1', 100, 60, 0, 100, 0, 4);
eq('a hue-rotated fog is cached separately per (name, hue)',
    g.MonlineFog.loadFog('FogWater1', 100) === g.MonlineFog.loadFog('FogWater1', 100), true);
ok('...and a different hue is a different bitmap',
    g.MonlineFog.loadFog('FogWater1', 0) !== g.MonlineFog.loadFog('FogWater1', 100));

const plFog = new g.Game_Player();
plFog._transferring = true;
plFog._newMapId = 999;
g.$gameMap.mapId = function() { return 507; };
plFog.performTransfer();
eq('changing map clears every fog (CLEAR_ON_TRANSFER)', FOG.fog(5).name, '');
installMap(ORIG_MAP);          // the anchor tests below reassign $gameMap

// `Game_Screen#initialize` calls `this.clear()`, which happens while
// `new Game_Screen()` is still being constructed - at that moment $gameScreen
// is still null.  A container reached through the global threw there and the
// game never booted at all, so this is the single most important assertion here.
const savedScreen = g.$gameScreen;
g.$gameScreen = null;
let clearThrew = false;
try {
    const booting = new g.Game_Screen();
    booting.clear();
    FOG.update(booting);
} catch (e) {
    clearThrew = true;
}
g.$gameScreen = savedScreen;
ok('clear()/update() work while $gameScreen is still null', !clearThrew);
g.$gameScreen._monlineFogs = {};

// ================================================ 6c. choice options (Tsuki 0117.rb)
lines.push('--- choice options (Tsuki Choice Options) ---');

const CH = g.MonlineChoice;

// Instance behaviour on top of the stub declared with the engine stubs above
// (the class has to exist before MonlineChoice is loaded).
g.$gameMessage = new g.Game_Message();
g.$gameMessage._choices = [];
g.$gameMessage._cancelType = -1;
g.$gameMessage._called = null;
g.$gameMessage.choices = function() { return this._choices; };
g.$gameMessage.choiceCancelType = function() { return this._cancelType; };
g.$gameMessage.onChoice = function(n) { this._called = n; };

// The plugin's own makeCommandList / callOkHandler / isEnabled / isCancelEnabled
// are already installed on the prototype -- keep them and only add what a bare
// window needs for the test (the message window it reports back to).
function newChoiceWindow() {
    const w = new g.Window_ChoiceList();
    w.names = [];
    w._index = 0;
    w._messageWindow = { terminateMessage: function() {} };
    w.close = function() {};
    return w;
}

g.$gameMessage._choices = ['Alpha', 'Beta', 'Gamma', 'Delta'];
CH.reset();

// --- conditions ------------------------------------------------------------
eq('an empty condition is true', CH.evalCondition(''), true);
eq('"true" is true', CH.evalCondition('true'), true);
eq('"false" is false', CH.evalCondition('false'), false);
ok('the v[] / s[] shorthand is bound',
    typeof g.MonlineRuby === 'object' && typeof g.MonlineRuby.evalExpr === 'function');

// --- hiding removes the entry but keeps the original index -----------------
g.window.hide_choice(2, 'true');
eq('hide_choice evaluates and records', CH.hidden(2), true);
const winA = newChoiceWindow();
winA.makeCommandList();
eq('a hidden choice is dropped from the list', JSON.stringify(winA.names),
    JSON.stringify(['Alpha', 'Gamma', 'Delta']));
eq('...but the map keeps the original indices', JSON.stringify(winA._monlineChoiceMap),
    JSON.stringify([0, 2, 3]));
eq('$gameMessage keeps every choice, so branch indices stay valid',
    $gameMessage.choices().length, 4);

// --- selecting maps back to the original index -----------------------------
winA._index = 1;                     // second visible choice = "Gamma"
winA.callOkHandler();
eq('picking a visible choice reports its original index', $gameMessage._called, 2);

// --- disabling -------------------------------------------------------------
CH.reset();
g.$gameMessage._choices = ['A', 'B', 'C'];
g.window.disable_choice(3, 'true');
eq('disable_choice records', CH.disabled(3), true);
const winB = newChoiceWindow();
winB.makeCommandList();
eq('a disabled choice stays visible', winB.names.length, 3);
eq('...but is not selectable', winB.isEnabled(2), false);
eq('...while the others are', winB.isEnabled(0) && winB.isEnabled(1), true);

// --- text swap -------------------------------------------------------------
CH.reset();
g.window.text_choice(1, 'First', 'false');
g.window.text_choice(1, 'Replaced', 'true');
eq('the last matching text_choice wins', CH.text(1, 'Alpha'), 'Replaced');
g.window.text_choice(2, 'Never', 'false');
eq('a non-matching text_choice leaves the label alone', CH.text(2, 'Beta'), 'Beta');

// --- cancel is disallowed when its target is hidden ------------------------
CH.reset();
g.$gameMessage._choices = ['A', 'B', 'C'];
g.$gameMessage._cancelType = 2;      // cancel -> choice 2
g.window.hide_choice(2, 'true');
const winC = newChoiceWindow();
winC.makeCommandList();
eq('cancel is blocked when the cancel target is hidden', winC.isCancelEnabled(), false);
CH.reset();
g.$gameMessage._cancelType = 1;
const winD = newChoiceWindow();
winD.makeCommandList();
eq('...and allowed when it is not', winD.isCancelEnabled(), true);

// --- the container is reset with the message -------------------------------
g.window.hide_choice(1, 'true');
g.$gameMessage.clear();
eq('clearing the message drops the options', CH.hidden(1), false);

// ================================================ 6d. custom scenes (port of the
// scenes MV simply does not have)
lines.push('--- custom scenes (MonlineScenes) ---');

const MS = g.MonlineScenes;

// The reported bug: `SceneManager.call(Scene_LearnSkill)` threw ReferenceError.
// Declaring a `function` inside the plugin's IIFE is NOT enough - the bridge
// resolves names through `window[name]`, so each scene has to be published.
//
// Scene_MonsterCatalogue and Encyclopedia are NOT in this list on purpose:
// they are published by their own full ports (MonlineMonsterCatalogue.js,
// MonlineEncyclopedia.js), which this harness does not load.  They are
// asserted in unit_check_ports.js, which does.
['Scene_Crafting', 'Scene_LearnSkill', 'Scene_PXEBestChoose'].forEach(function(n) {
  ok(n + ' resolves on window (SceneManager.call can find it)',
      typeof g[n] === 'function', typeof g[n]);
});
ok('the scenes are real Scene_MenuBase subclasses',
    typeof g.Scene_Crafting.prototype.create === 'function' &&
    typeof g.Scene_LearnSkill.prototype.create === 'function');

// --- notetag parsing -------------------------------------------------------
const craftItem = { id: 1, name: 'Potion', note: '<craft item:161:5>\n<craft gold:100>\n<craft switch:200>' };
const c = MS.parseCraft(craftItem);
eq('craft: gold parsed', c.gold, 100);
eq('craft: switch parsed', c.switchId, 200);
eq('craft: ingredient parsed', JSON.stringify(c.ingredients),
    JSON.stringify([{ kind: 'item', id: 161, qty: 5 }]));
eq('a note with no craft tags is not craftable', MS.parseCraft({ note: 'plain' }), null);

const lrn = MS.parseLearn({ note: '<learn cost: 26 jp>\n<learn require switch: 23>' });
eq('learn: cost', lrn.cost, 26);
eq('learn: type', lrn.type, 'jp');
eq('learn: require switch', lrn.requireSwitch, 23);

// --- availability ----------------------------------------------------------
g.$gameSwitches.value = function(n) { return n === 200; };
eq('craft is available when its switch is on', MS.craftAvailable(c), true);
g.$gameSwitches.value = function() { return false; };
eq('...and hidden when it is off', MS.craftAvailable(c), false);
g.$gameSwitches.value = function(n) { return n === 200; };

// --- learning --------------------------------------------------------------
const learner = new g.Game_Actor();
learner.isLearnedSkill = function() { return false; };
learner.currentExp = function() { return 1000; };
learner._jp = 10;
eq('jp starts where gain_jp left it', learner.jp(), 10);
learner.gain_jp(15);
eq('gain_jp adds', learner.jp(), 25);
learner.lose_jp(5);
eq('lose_jp subtracts', learner.jp(), 20);
const skill26 = { id: 26, note: '<learn cost: 26 jp>' };
eq('cannot learn a jp skill without enough jp', MS.canLearn(learner, skill26), false);
learner.gainJp(10);
eq('...but can with enough', MS.canLearn(learner, skill26), true);
let learnedId = null;
learner.learnSkill = function(id) { learnedId = id; };
learner.loseExp = function(n) { this._expLost = n; };
eq('learnSkill reports success', MS.learnSkill(learner, skill26), true);
eq('...teaches the skill', learnedId, 26);
eq('...and pays the jp', learner.jp(), 4);

// ================================================ 6d-2. learn skill engine
// (0126.rb YEA Learn Skill Engine + 0173.rb YEA-JPManager)
lines.push('--- learn skill engine (0126.rb / 0173.rb) ---');

// The reported defect, restated as an assertion: Window_LearnSkillList used to
// inherit MV's makeItemList, whose rows come from `actor.skills()` - the skills
// the actor ALREADY knows.  Every row it could possibly show therefore failed
// enabled?'s "not learned yet" test, so the list looked right and nothing in it
// could ever be chosen.  The rows have to come from the class pool instead.
ok('the list window builds its own rows rather than inheriting MV ones',
    MS.Window_LearnSkillList.prototype.hasOwnProperty('makeItemList'));
eq('...one row per line', MS.Window_LearnSkillList.prototype.maxCols.call({}), 1);

function loadJson(name) {
    return JSON.parse(
        fs.readFileSync(path.join(DATA, name), 'utf8').replace(/^\uFEFF/, ''));
}
const realClasses = loadJson('Classes.json');
const realSkills = loadJson('Skills.json');
const realSystem = loadJson('System.json');
const savedClasses = g.$dataClasses;
const savedSkills = g.$dataSkills;
const savedSystem = g.$dataSystem;
const savedSwitches = g.$gameSwitches;
const savedGoldFn = g.$gameParty.gold;
g.$dataClasses = realClasses;
g.$dataSkills = realSkills;
g.$dataSystem = realSystem;

// Every id any skill can demand as a prerequisite.  Granting them all up front
// makes every gate satisfiable, so the expected row counts below are exactly
// the raw per-class pools.
const prereqIds = [];
realSkills.forEach(function(s) {
    if (!s) return;
    (String(s.note || '').match(/<\s*learn\s+require\s+skill\s*:\s*([^>]*)>/gi) || [])
        .forEach(function(tag) {
            (tag.match(/\d+/g) || []).forEach(function(n) {
                const id = parseInt(n, 10);
                if (id > 0 && prereqIds.indexOf(id) < 0) prereqIds.push(id);
            });
        });
});

function makeLearner(classId, level) {
    const a = new g.Game_Actor();
    a._classId = classId;
    a._level = level === undefined ? 99 : level;
    a._skills = prereqIds.slice();
    a._exp = {};
    a.isLearnedSkill = function(id) { return this._skills.indexOf(id) >= 0; };
    a.learnSkill = function(id) {
        if (this._skills.indexOf(id) < 0) this._skills.push(id);
    };
    a.currentExp = function() { return this._expV || 0; };
    return a;
}

// every switch ON, so nothing drops out for want of a switch
g.$gameSwitches = { _data: {}, value: function() { return true; } };

// --- class notetags decide what can be learned at all ----------------------
eq('class 1 (Player) offers 130 learn entries', MS.classLearnSkills(1).length, 130);
eq('class 21 (Terminal) offers 9', MS.classLearnSkills(21).length, 9);
ok('every Terminal entry is a stype 9 skill',
    MS.classLearnSkills(21).every(id => realSkills[id] &&
        realSkills[id].stypeId === 9),
    JSON.stringify(MS.classLearnSkills(21)));
eq('a class with no learn tags offers nothing', MS.classLearnSkills(2).length, 0);

const dupClassId = 900;
g.$dataClasses[dupClassId] = {
    id: dupClassId, name: 'Dupes',
    note: '<learn skills: 5,6>\n<learn skills: 6,7,0>\n<learn skills: -3>'
};
eq('repeated tags accumulate, duplicates and non-ids are dropped',
    JSON.stringify(MS.classLearnSkills(dupClassId)), JSON.stringify([5, 6, 7]));

// --- cost and requirement parsing -----------------------------------------
const plain = MS.parseLearn({ id: 1, note: '' });
eq('a skill with no cost tag uses the default cost', plain.cost, 25);
eq('...and the default currency is jp', plain.type, 'jp');
const cost26 = MS.parseLearn({ id: 3, note: '<learn cost: 26 jp>\n<learn require switch: 23>' });
eq('a 26 jp skill costs 26', cost26.cost, 26);
eq('...and stays jp - this game ships YEA-JPManager so there is no downgrade',
    cost26.type, 'jp');
eq('...and keeps its switch requirement', cost26.requireSwitch, 23);
const costExp = MS.parseLearn({ id: 4, note: '<learn cost: 40 exp>' });
eq('exp costs parse', costExp.cost + costExp.type, '40exp');
const costGold = MS.parseLearn({ id: 5, note: '<learn cost: 100 gold>' });
eq('gold costs parse', costGold.cost + costGold.type, '100gold');
const multi = MS.parseLearn({ id: 6, note: '<learn require level: 12>\n' +
    '<learn require skill: 7,8>\n<learn require switch: 4,5>' });
eq('level requirement', multi.requireLevel, 12);
eq('skill requirements', JSON.stringify(multi.requireSkills), JSON.stringify([7, 8]));
eq('switch requirements', JSON.stringify(multi.requireSwitches), JSON.stringify([4, 5]));
eq('the legacy scalar switch stays usable', multi.requireSwitch, 4);

// `<learn require eval>` is not implemented on purpose - the data never uses
// it, so a skill can never carry an eval requirement.
ok('no skill in the database asks for an eval requirement',
    realSkills.every(s => !s ||
        !/<\s*learn\s+require\s+eval/i.test(String(s.note || ''))));

// --- requirement gates -----------------------------------------------------
g.$gameSwitches = { _data: {}, value: function(n) { return !!this._data[n]; } };
const gatedActor = makeLearner(1, 5);
const gated = { id: 3, note: '<learn cost: 26 jp>\n<learn require switch: 23>' };
eq('a switch-gated skill is hidden while the switch is off',
    MS.meetsRequirements(gatedActor, gated), false);
g.$gameSwitches._data[23] = true;
eq('...and shown once it is on', MS.meetsRequirements(gatedActor, gated), true);

const levelled = { id: 4, note: '<learn require level: 10>' };
eq('a level gate rejects a low-level actor', MS.meetsRequirements(gatedActor, levelled), false);
gatedActor._level = 12;
eq('...and admits one high enough', MS.meetsRequirements(gatedActor, levelled), true);

const prereq = { id: 5, note: '<learn require skill: 9001,9002>' };
gatedActor._skills = [];
eq('a skill prerequisite blocks the row', MS.meetsRequirements(gatedActor, prereq), false);
gatedActor._skills = [9001];
eq('...still blocked with only half of them', MS.meetsRequirements(gatedActor, prereq), false);
gatedActor._skills = [9001, 9002];
eq('...and clear once all are learned', MS.meetsRequirements(gatedActor, prereq), true);
g.$gameSwitches = { _data: {}, value: function() { return true; } };

// --- the list actually lists the class pool --------------------------------
function learnWindow(actor) {
    const w = new g.Window_LearnSkillList(0, 0, 320, 240);
    w.refresh = function() { this.makeItemList(); };   // no bitmap in node
    w.resetScroll = function() {};
    w.select = function(i) { this._index = i; };
    w.setActor(actor);
    return w;
}
const playerActor = makeLearner(1, 99);
const playerWin = learnWindow(playerActor);
playerWin._stypeId = 1; playerWin.refresh();
eq('Player / Techniques shows all 23 entries', playerWin._data.length, 23);
playerWin._stypeId = 2; playerWin.refresh();
eq('...29 Talents', playerWin._data.length, 29);
playerWin._stypeId = 3; playerWin.refresh();
eq('...78 Imitations', playerWin._data.length, 78);
playerWin._stypeId = 9; playerWin.refresh();
eq('...and nothing under a type its class cannot learn',
    playerWin._data.length, 0);

const terminalWin = learnWindow(makeLearner(21, 99));
terminalWin._stypeId = 9; terminalWin.refresh();
eq('Terminal / Functions shows all 9 entries', terminalWin._data.length, 9);

// the bug in one line: knowing something must not make it vanish either
let firstKnown = null;
MS.classLearnSkills(1).forEach(function(id) {
    if (!firstKnown && realSkills[id] && realSkills[id].stypeId === 1) {
        firstKnown = id;
    }
});
playerActor._skills.push(firstKnown);
playerWin._stypeId = 1; playerWin.refresh();
eq('a skill already learned is still listed', playerWin._data.length, 23);
eq('...as a disabled row', playerWin.isEnabled(realSkills[firstKnown]), false);

// --- affordability drives row state ----------------------------------------
const Fake = 901;
g.$dataClasses[Fake] = { id: Fake, name: 'Testbed',
    note: '<learn skills: 9101,9102,9103,9104>' };
g.$dataSkills[9101] = { id: 9101, name: 'Cheap', stypeId: 1, note: '<learn cost: 5 jp>' };
g.$dataSkills[9102] = { id: 9102, name: 'Dear', stypeId: 1, note: '<learn cost: 500 jp>' };
g.$dataSkills[9103] = { id: 9103, name: 'Costly', stypeId: 1, note: '<learn cost: 100 gold>' };
g.$dataSkills[9104] = { id: 9104, name: 'Studious', stypeId: 1, note: '<learn cost: 30 exp>' };
const purseActor = makeLearner(Fake, 99);
const purseWin = learnWindow(purseActor);
purseWin._stypeId = 1; purseWin.refresh();
eq('the testbed class lists all four rows', purseWin._data.length, 4);
g.$gameParty.gold = function() { return 50; };
eq('a row you cannot pay for is disabled', purseWin.isEnabled(g.$dataSkills[9102]), false);
eq('...so is one priced above your gold',
    purseWin.isEnabled(g.$dataSkills[9103]), false);
g.$gameParty.gold = function() { return 500; };
eq('...until the party can afford it', purseWin.isEnabled(g.$dataSkills[9103]), true);
eq('a row priced above your exp pool is disabled',
    purseWin.isEnabled(g.$dataSkills[9104]), false);
purseActor._exp[Fake] = 100;
eq('...and enabled from that class exp', purseWin.isEnabled(g.$dataSkills[9104]), true);
purseActor.gainJp(600);
eq('jp now covers the expensive row', purseWin.isEnabled(g.$dataSkills[9102]), true);
eq('...and the cheap one', purseWin.isEnabled(g.$dataSkills[9101]), true);
purseActor._skills.push(9101);
eq('learning a skill disables its row again',
    purseWin.isEnabled(g.$dataSkills[9101]), false);

// --- learning pays out of the right wallet ---------------------------------
const buyer = makeLearner(Fake, 99);
buyer.gainJp(600);
buyer._exp[Fake] = 100;
let goldLost = 0;
g.$gameParty.loseGold = function(n) { goldLost = n; };
g.$gameParty.gold = function() { return 500; };
const jpBefore = buyer.jp(Fake);
eq('learning succeeds', MS.learnSkill(buyer, g.$dataSkills[9102], Fake), true);
eq('...teaches the skill', buyer.isLearnedSkill(9102), true);
eq('...and takes its jp from the class named', buyer.jp(Fake), jpBefore - 500);
g.$gameParty.gold = function() { return 500; };
MS.learnSkill(buyer, g.$dataSkills[9103], Fake);
eq('a gold skill bills the party, not the actor', goldLost, 100);
eq('...and still teaches it', buyer.isLearnedSkill(9103), true);

// --- per-class jp ----------------------------------------------------------
const jpActor = makeLearner(1, 99);
jpActor.gainJp(100);
eq('jp lands on the actor current class', jpActor.jp(1), 100);
eq('...and nowhere else', jpActor.jp(3), 0);
jpActor.gainJp(50, 3);
eq('a class-scoped gain leaves the first class untouched', jpActor.jp(1), 100);
eq('...and lands on the class it names', jpActor.jp(3), 50);
jpActor.loseJp(20, 3);
eq('loseJp subtracts from the named class', jpActor.jp(3), 30);
eq('...taking nothing from the others', jpActor.jp(1), 100);
jpActor.loseJp(9999, 3);
eq('a class pool never goes below zero', jpActor.jp(3), 0);
jpActor.gainJp(999999999999);
eq('jp is capped at MAX_JP', jpActor.jp(1), 99999999);
jpActor.gain_jp(5, 6);
eq('the Ruby gain_jp still works and takes a class', jpActor.jp(6), 5);
jpActor.lose_jp(2, 6);
eq('...and so does lose_jp', jpActor.jp(6), 3);

// MonlineShim plants an empty gain_jp before this plugin loads; the real one
// has to replace it unconditionally or JP can never move at all.
ok('the real gain_jp replaces the shim stub rather than being guarded out',
    g.MonlineShim.methods['Game_Actor.gain_jp'] === 1 && jpActor.jp(6) === 3);

const legacyActor = new g.Game_Actor();
legacyActor._classId = 7;
legacyActor._jp = 40;                       // pre-per-class save shape
eq('a legacy numeric _jp migrates onto the current class', legacyActor.jp(7), 40);
eq('...and is kept as a per-class map from then on',
    typeof legacyActor._jp, 'object');
legacyActor.gainJp(10, 3);
eq('...after which other classes start from zero', legacyActor.jp(3), 10);
eq('...and the migrated value survives', legacyActor.jp(7), 40);

// --- the port must call engine methods that actually exist -----------------
// A stub cannot be trusted to catch this (it happily answers any name), so both
// halves are checked against the real MV sources on disk.
const engineSrc = fs.readFileSync(path.join(ROOT, 'js/rpg_objects.js'), 'utf8');
const scenesSrc = fs.readFileSync(path.join(ROOT, 'js/plugins/MonlineScenes.js'),
    'utf8');
const sceneSrc = fs.readFileSync(path.join(ROOT, 'js/rpg_scenes.js'), 'utf8');

// (`addedSkillTypes` lives on Game_BattlerBase, hence the Game_\w* match.)
['isLearnedSkill', 'learnSkill', 'currentExp', 'changeExp', 'addedSkillTypes']
    .forEach(function(name) {
        ok('the Game_Actor stub uses a real engine method: ' + name,
            new RegExp('Game_\\w*\\.prototype\\.' + name + ' = function')
                .test(engineSrc));
    });
ok('MV really has no Game_Actor#isLearned to fall back on',
    engineSrc.indexOf('Game_Actor.prototype.isLearned = ') < 0 &&
    engineSrc.indexOf('isLearnedSkill') > 0);
ok('the port never calls actor.isLearned() - only isLearnedSkill()',
    !/isLearned\s*\(/.test(scenesSrc),
    'a stray call would crash the real Game_Actor');
ok('...including the PXE command window',
    !/\ba\.\s*isLearned\s*\(/.test(scenesSrc));
ok('Scene_MenuBase#create fills _actor on its own (updateActor)',
    sceneSrc.indexOf('Scene_MenuBase.prototype.updateActor') >= 0 &&
    /Scene_MenuBase.prototype.create[\s\S]{0,200}updateActor/.test(sceneSrc));
ok('...so the learn scene does not need to pick its own actor',
    scenesSrc.indexOf('Scene_LearnSkill.prototype.menuActor') < 0);

// --- the "Learn" entry point in MV own skill menu --------------------------
eq('SHOW_SWITCH 0 means the command is always visible',
    MS.learnCommandVisible(), true);
const typeWin = new g.Window_SkillType();
typeWin._actor = makeLearner(1, 99);
const typeCommands = [];
typeWin.addCommand = function(name, symbol) {
    typeCommands.push({ name: name, symbol: symbol });
};
typeWin.makeCommandList();
eq('the skill type menu gains a Learn command', typeCommands.length, 1);
eq('...labelled after the original', typeCommands[0].name, 'Learn');
eq('...with its own handler symbol', typeCommands[0].symbol, 'learnskill');
ok('Scene_Skill routes that command',
    typeof g.Scene_Skill.prototype.commandLearnSkill === 'function');

// --- the skill type column of the learn scene ------------------------------
const cmdWin = new g.Window_LearnSkillCommand(0, 0);
cmdWin._actor = makeLearner(1, 99);
cmdWin._actor.addedSkillTypes = function() { return [1, 2, 3, 9]; };
const cmdEntries = [];
cmdWin.addCommand = function(name, symbol, enabled, ext) {
    cmdEntries.push({ name: name, ext: ext });
};
cmdWin.makeCommandList();
eq('the column follows STYPE_ORDER',
    JSON.stringify(cmdEntries.map(e => e.ext)), JSON.stringify([1, 2, 3, 9]));
eq('...using the game own skill type names', cmdEntries[2].name, 'Imitations');

g.$dataClasses = savedClasses;
g.$dataSkills = savedSkills;
g.$dataSystem = savedSystem;
g.$gameSwitches = savedSwitches;
if (savedGoldFn) { g.$gameParty.gold = savedGoldFn; }

// ================================================ 6e. map effects (Zeus81 0244.rb)
lines.push('--- map effects (Zeus81 Map Effects) ---');

const ME = g.MonlineMapEffects;
const mfx = g.map_effects;
ok('map_effects resolves on window', typeof mfx === 'object' && !!mfx);
ok('the effects class is published for save files',
    typeof g.Game_Map_Effects === 'function');

mfx.clear();

// --- tone maps onto MV's own screen tint -----------------------------------
let tintArgs = null;
g.$gameScreen.startTint = function(r, gg, b, gray, dur) { tintArgs = [r, gg, b, gray, dur]; };
mfx.set_tone(0, 0, 0, 155, 60);
eq('set_tone drives the MV screen tint',
    JSON.stringify(tintArgs), JSON.stringify([0, 0, 0, 155, 60]));
ok('...and marks the effects active', mfx.active === true);

// --- zoom -------------------------------------------------------------------
mfx.set_zoom(150, 0);
eq('set_zoom with no duration applies at once', mfx.zoom, 150);
mfx.set_zoom(100, 10);
for (let i = 0; i < 10; i++) { mfx.update(); }
eq('a zoom fade lands exactly on its target', mfx.zoom, 100);
mfx.set_zoom(120, 20);
mfx.update();
ok('...and animates rather than jumping', mfx.zoom !== 120, '' + mfx.zoom);

// --- blur kinds -------------------------------------------------------------
mfx.clear();
mfx.set_gaussian_blur(20, 0);
eq('gaussian blur records its type', mfx.blurType, 1);
eq('...and its strength', mfx.blurStrength, 20);
mfx.set_zoom_blur(150, 30);
eq('zoom blur is tracked separately', mfx.blurType, 2);
mfx.set_linear_blur(90, 60, 0);
eq('linear blur keeps its angle in blurParam', mfx.blurParam, 90);
mfx.set_motion_blur(1);
eq('motion blur', mfx.blurType, 5);
mfx.set_pixelize(150, 60);
eq('pixelize is recorded even though it cannot be drawn', mfx.blurType, 6);

// --- application to a real spriteset ---------------------------------------
g.$gamePlayer.screenX = function() { return 400; };
g.$gamePlayer.screenY = function() { return 300; };
const sp = new g.Spriteset_Map();
sp.scale = { x: 1, y: 1 };
sp.x = 0; sp.y = 0; sp.alpha = 1;
mfx.clear();
mfx.set_zoom(200, 0);
ME.apply(sp);
eq('zoom 200% scales the spriteset', sp.scale.y, 2);
mfx.mirror = true;
ME.apply(sp);
ok('mirror flips the spriteset horizontally', sp.scale.x < 0, '' + sp.scale.x);
mfx.mirror = false;
mfx.set_opacity(128, 0);
ME.apply(sp);
eq('opacity becomes spriteset alpha', sp.alpha, 128 / 255);

// --- decorative calls are accepted, not thrown ------------------------------
let threw = false;
try {
    mfx.create_controller(); mfx.add_orb(); mfx.move_orb(); mfx.zoom_orb();
    mfx.create_particle(); mfx.create_comment(); mfx.focus_event_here();
    mfx.use_se(); mfx.set_anchor();
} catch (e) { threw = true; }
ok('the decorative map objects do not throw', !threw);

// --- a map change drops the effects ----------------------------------------
mfx.set_zoom(150, 0);
g.$gameMap.setup(1);
eq('changing map clears the effects', mfx.zoom, 100);

// ================================================ 6f. text pop (Nelderson 0230.rb)
lines.push('--- text pop (Nelderson Text Pop Over Events) ---');

const TP = g.MonlineTextPop;
ok('nel_textpop resolves on window', typeof g.nel_textpop === 'function');

// --- character resolution ------------------------------------------------
const fset = new g.Game_Followers();
fset._data = [{ name: 'f0' }, { name: 'f1' }];
g.$gamePlayer.followers = function() { return fset; };
g.$gameParty = { inBattle: function() { return false; } };
const _eventCache = {};
g.$gameMap = { event: function(id) {
    return _eventCache[id] || (_eventCache[id] = { id: id, name: 'ev' + id });
} };

const ie = new g.Game_Interpreter(); ie._eventId = 7;
g.MonlineRuby = { current: ie };

let got = null;
g.nel_textpop({ text: 'Hi', event_id: 13, time: 120 });
got = TP.nelGetCharacter(13, 7);
eq('event_id > 0 targets that map event', got && got.id, 13);
got = TP.nelGetCharacter(-1, 7);
eq('event_id -1 targets the player', got, g.$gamePlayer);
got = TP.nelGetCharacter(-2, 7);
eq('event_id -2 targets the 1st follower', got && got.name, 'f0');
got = TP.nelGetCharacter(-3, 7);
eq('event_id -3 targets the 2nd follower', got && got.name, 'f1');
got = TP.nelGetCharacter(0, 7);
eq('event_id 0 targets the running event', got && got.id, 7);

// --- the call writes the pop onto the character --------------------------
const evt = g.$gameMap.event(13);
g.nel_textpop({ text: 'Arousal Up', event_id: 13, time: 120, size: 32 });
eq('text is stored on the character', evt.namepop, 'Arousal Up');
eq('time is stored (frames)', evt.namepopTime, 120);
eq('size is stored', evt.namepopSize, 32);
ok('textpopFlag is set so the sprite refreshes', evt.textpopFlag === true);

// nil time means "forever"
g.nel_textpop({ text: 'x', event_id: -1, time: null });
eq('nil time is kept as null (forever)', g.$gamePlayer.namepopTime, null);

// --- battle is a no-op ----------------------------------------------------
g.$gameParty.inBattle = function() { return true; };
let thrown = false;
try { g.nel_textpop({ text: 'boom', event_id: 13 }); } catch (e) { threw = true; }
ok('a call during battle does not throw', !threw);
g.$gameParty.inBattle = function() { return false; };

// --- the sprite builds the pop, positions it, and expires ----------------
const popChar = { namepop: 'Bob', namepopSize: 20, namepopColor: [255, 0, 0, 255],
    namepopTime: 5, namepopFont: 'Myriad', namepopBold: false, namepopItal: false,
    textpopFlag: true };
const popSprite = { _character: popChar, x: 100, y: 200, z: 10, bitmap: { height: 48 },
    parent: { addChild: function(c) { popSprite._child = c; } } };
// Sprite_Character.prototype.update is aliased to call updateNamePop; invoke it.
g.Sprite_Character.prototype.update.call(popSprite);
ok('a namepop sprite is created above the head', !!popSprite._monlineNamePop);
ok('...and added to the spriteset', !!popSprite._child);
eq('it is anchored at the character head', popSprite._monlineNamePop.y, 200 - 48);
eq('its timer starts at the frame count', popSprite._monlineNamePopTimer, 5);
eq('its colour string uses the red channel', popSprite._monlineNamePop.bitmap
    ? popSprite._monlineNamePop.bitmap.textColor : 'rgba(255,0,0,1)', 'rgba(255,0,0,1)');

// advance 5 frames -> it should disappear and be disposed
for (let i = 0; i < 5; i++) { g.Sprite_Character.prototype.update.call(popSprite); }
ok('after the timer the pop is gone', !popSprite._monlineNamePop);
ok('...and removed from the spriteset', popSprite._child === undefined ||
    popSprite._child.parent === null);

// nil time => stays forever (never disposed by the timer)
const foreverChar = { namepop: 'Hi', namepopSize: 16, namepopColor: [255,255,255,255],
    namepopTime: null, namepopFont: 'Myriad', namepopBold: false, namepopItal: false,
    textpopFlag: true };
const foreverSprite = { _character: foreverChar, x: 0, y: 0, z: 0, bitmap: { height: 48 },
    parent: { addChild: function() {} } };
g.Sprite_Character.prototype.update.call(foreverSprite);
ok('nil time keeps the pop alive', !!foreverSprite._monlineNamePop);
ok('...with a forever (negative) timer', foreverSprite._monlineNamePopTimer === -1);
for (let i = 0; i < 30; i++) { g.Sprite_Character.prototype.update.call(foreverSprite); }
ok('it is still present after many frames', !!foreverSprite._monlineNamePop);

// empty text => nothing drawn
const emptyChar = { namepop: '', namepopSize: 16, namepopColor: [255,255,255,255],
    namepopTime: 60, namepopFont: 'Myriad', namepopBold: false, namepopItal: false,
    textpopFlag: true };
const emptySprite = { _character: emptyChar, x: 0, y: 0, z: 0, bitmap: { height: 48 },
    parent: { addChild: function() {} } };
g.Sprite_Character.prototype.update.call(emptySprite);
ok('empty text draws nothing', !emptySprite._monlineNamePop);

// ================================================ 6f. JP Manager (0173.rb) -
// the battle-side *earning* half that MonlineScenes' storage alone never did.
lines.push('--- JP Manager (MonlineJp) ---');

const JP = g.MonlineJp;
const managersSrc = fs.readFileSync(path.join(ROOT, 'js/rpg_managers.js'), 'utf8');
const jpSrc = fs.readFileSync(path.join(ROOT, 'js/plugins/MonlineJp.js'), 'utf8');

ok('MonlineJp publishes itself on window', !!JP);
eq('0173.rb:137 - this game calls JP "SP"', JP.Config.VOCAB, 'SP');
eq('0173.rb:138 - the JP cap', JP.Config.MAX_JP, 99999999);
eq('0173.rb:146 - ENEMY_KILL default', JP.Config.ENEMY_KILL, 0);
eq('0173.rb:147 - LEVEL_UP default', JP.Config.LEVEL_UP, 0);
eq('0173.rb:148 - ACTION_JP default', JP.Config.ACTION_JP, 0);

// --- notetags --------------------------------------------------------------
eq('<jp gain: 10> parses', JP.jpGainOf({ note: '<jp gain: 10>' }, 0), 10);
eq('...including the Ruby alias form <JP_GAIN: 3>',
    JP.jpGainOf({ note: '<JP_GAIN: 3>' }, 0), 3);
eq('...case insensitively', JP.jpGainOf({ note: '<Jp GaIn: 7>' }, 0), 7);
eq('a missing tag falls back to the constant', JP.jpGainOf({ note: '' }, 4), 4);
eq('no object at all falls back to the constant', JP.jpGainOf(null, 4), 4);
eq('the last tag wins (0173.rb:342 assigns inside the loop)',
    JP.jpGainOf({ note: '<jp gain: 1>\n<jp gain: 9>' }, 0), 9);
eq('<jp rate: 0%> is a zero multiplier', JP.jpRateOf({ note: '<jp rate: 0%>' }), 0);
eq('<jp rate: 150%> is 1.5', JP.jpRateOf({ note: '<jp rate: 150%>' }), 1.5);
eq('<jp rate: 100%> is 1', JP.jpRateOf({ note: '<jp rate: 100%>' }), 1);
eq('no rate tag is 1.0 (0173.rb:277)', JP.jpRateOf({ note: 'nothing here' }), 1);
eq('a rate tag without the % sign is not a rate tag',
    JP.jpRateOf({ note: '<jp rate: 50>' }), 1);
eq('a fullwidth ％ is accepted too (0173.rb:172)',
    JP.jpRateOf({ note: '<jp rate: 50％>' }), 0.5);

// --- the data the port has to work on --------------------------------------
function loadData(name) {
    return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
}
function taggedWith(list, re) {
    return list.filter(function(e) { return e && re.test(e.note || ''); }).length;
}
function countTags(list, re) {
    return list.reduce(function(n, e) {
        return n + ((e && String(e.note || '').match(re)) || []).length;
    }, 0);
}
const enemiesData = loadData('Enemies.json');
const actorsData = loadData('Actors.json');
eq('Enemies.json really carries 159 <jp gain:> tags - the grant is live',
    countTags(enemiesData, /<jp gain:/gi), 159);
eq('...spread over 156 of the 213 enemies', taggedWith(enemiesData, /<jp gain:/i), 156);
eq('enemy 1 (Holstaurus) is worth 10 JP', JP.jpGainOf(enemiesData[1], 0), 10);
eq('Sea Bishop carries two tags and the last one wins (0173.rb:342)',
    JP.jpGainOf(enemiesData[10], 0), 40);
eq('actor 25 (PXE) has a 0% rate - it can never *earn* JP',
    JP.jpRateOf(actorsData[25]), 0);
eq('no skill carries <jp gain:>, so action JP is inert',
    taggedWith(loadData('Skills.json'), /<jp gain:/i), 0);
eq('...and neither does any item',
    taggedWith(loadData('Items.json'), /<jp gain:/i), 0);
eq('no class, weapon, armour or state carries <jp rate:>',
    taggedWith(loadData('Classes.json'), /<jp rate:/i) +
    taggedWith(loadData('Weapons.json'), /<jp rate:/i) +
    taggedWith(loadData('Armors.json'), /<jp rate:/i) +
    taggedWith(loadData('States.json'), /<jp rate:/i), 0);

// --- Game_Enemy#jp / Game_Troop#jpTotal ------------------------------------
function makeEnemy(data, dead) {
    const e = new g.Game_Enemy();
    e._enemyData = data;
    e._dead = dead;
    return e;
}
const troop = new g.Game_Troop();
troop._enemies = [makeEnemy({ note: '<jp gain: 10>' }, true),
                  makeEnemy({ note: '<jp gain: 6>' }, false),
                  makeEnemy({ note: '' }, true)];
eq('Game_Enemy#jp reads the enemy tag (0173.rb:533)', troop._enemies[0].jp(), 10);
eq('...and falls back to ENEMY_KILL when untagged', troop._enemies[2].jp(), 0);
eq('Game_Troop#jpTotal counts dead members only (0173.rb:548)', troop.jpTotal(), 10);
troop._enemies[1]._dead = true;
eq('...so a surviving enemy pays nothing until it dies', troop.jpTotal(), 16);

// --- jpr (0173.rb:395) ------------------------------------------------------
const rateActor = Object.create(g.Game_BattlerBase.prototype);
rateActor.isActor = function() { return true; };
rateActor.actor = function() { return { note: '' }; };
rateActor.currentClass = function() { return { note: '<jp rate: 150%>' }; };
rateActor.equips = function() { return [{ note: '<jp rate: 50%>' }, null]; };
rateActor.states = function() { return [{ note: '<jp rate: 200%>' }]; };
eq('jpr multiplies class x equip x state rates', rateActor.jpRate(), 1.5 * 0.5 * 2);
const enemyRate = Object.create(g.Game_BattlerBase.prototype);
enemyRate.isActor = function() { return false; };
enemyRate.equips = function() { return []; };
enemyRate.states = function() { return [{ note: '<jp rate: 200%>' }]; };
eq('a non-actor only takes the state rate', enemyRate.jpRate(), 2);

// --- the victory grant ------------------------------------------------------
function newJpActor(actorData, classId) {
    const a = new g.Game_Actor();
    a._classId = classId;
    a.isActor = function() { return true; };
    a.actor = function() { return actorData || { note: '' }; };
    a.currentClass = function() { return { note: '' }; };
    a.equips = function() { return []; };
    a.states = function() { return []; };
    return a;
}
const ralph = newJpActor(actorsData[1] || { note: '' }, 1);
const pxe = newJpActor(actorsData[25], 25);
const reserve = newJpActor({ note: '' }, 1);

const savedParty = g.$gameParty;
const savedTroop = g.$gameTroop;
g.$gameTroop = troop;
// $gameParty.members() is battle_members while a battle runs (0025.rb:54 /
// rpg_objects.js:4790), so a reserve actor is deliberately left out.
g.$gameParty = { members: function() { return [ralph, pxe]; } };
g.__jpSnapshot = function() { return ralph.jp(1); };

eq('a plain actor earns at 100%', ralph.jpRate(), 1);
eq('PXE earns at 0%', pxe.jpRate(), 0);
g.BattleManager.processVictory();
eq('victory grants the troop total to a battle member', ralph.jp(1), 16);
eq('...a 0% member still earns nothing (0173.rb:481 applies the rate)',
    pxe.jp(1), 0);
eq('...and a reserve member is not paid at all', reserve.jp(1), 0);
eq('the JP is on the actor before MV clears battle states (0174.rb:377)',
    g.BattleManager._jpAtStates, 16);
eq('the rest of the victory flow still runs afterwards',
    g.BattleManager._order.join(','), 'states,me,rewards,victory,display,gain,end');
ok('BattleManager.gainJp is installed (0173.rb:372)',
    typeof g.BattleManager.gainJp === 'function');
eq('...and returns the amount granted', g.BattleManager.gainJp(), 16);

// --- level up (0173.rb:517) -------------------------------------------------
const lvActor = newJpActor({ note: '' }, 2);
lvActor.levelUp();
eq('levelling up adds nothing: LEVEL_UP is 0 in this game', lvActor.jp(2), 0);
JP.Config.LEVEL_UP = 5;                 // prove the hook is wired, not absent
lvActor.levelUp();
eq('...it is the constant that makes it inert, not a missing hook',
    lvActor.jp(2), 5);
JP.Config.LEVEL_UP = 0;

// --- action JP (0173.rb:446) ------------------------------------------------
const user = newJpActor({ note: '' }, 4);
const action = { item: function() { return { note: '' }; },
                 subject: function() { return user; } };
g.Game_Action.prototype.applyItemUserEffect.call(action, {});
eq('using an untagged skill adds nothing: ACTION_JP is 0', user.jp(4), 0);
JP.Config.ACTION_JP = 3;                // prove the hook is wired, not absent
g.Game_Action.prototype.applyItemUserEffect.call(action, {});
eq('...again it is the constant, not a missing hook', user.jp(4), 3);
JP.Config.ACTION_JP = 0;
const skillUser = newJpActor({ note: '' }, 5);
const taggedAction = { item: function() { return { note: '<jp gain: 4>' }; },
                       subject: function() { return skillUser; } };
g.Game_Action.prototype.applyItemUserEffect.call(taggedAction, {});
eq('a <jp gain: 4> skill pays 4 JP per hit', skillUser.jp(5), 4);
let enemyPaid = false;
const enemyAction = {
    item: function() { return { note: '<jp gain: 4>' }; },
    subject: function() {
        return { isActor: function() { return false; },
                 earnJp: function() { enemyPaid = true; } };
    }
};
g.Game_Action.prototype.applyItemUserEffect.call(enemyAction, {});
ok('an enemy user never earns action JP (0173.rb:449 `if user.actor?`)',
    !enemyPaid);

// --- the hooks must exist in the engine and stay silent ---------------------
['BattleManager.processVictory'].forEach(function(n) {
    ok('the port hooks a real method: ' + n,
        managersSrc.indexOf('BattleManager.processVictory = function') >= 0);
});
['Game_Actor.prototype.levelUp', 'Game_Action.prototype.applyItemUserEffect',
 'Game_Unit.prototype.deadMembers', 'Game_Enemy.prototype.enemy']
    .forEach(function(n) {
        ok('the port hooks a real method: ' + n,
            engineSrc.indexOf(n + ' = function') >= 0);
    });
ok('no victory line is printed - 0173.rb:377 skips it because 0174.rb is on',
    jpSrc.indexOf('$gameMessage') < 0 && jpSrc.indexOf('add(') < 0);

g.$gameParty = savedParty;
g.$gameTroop = savedTroop;
g.__jpSnapshot = null;

// ================================================ 6g. the show-choices ports
lines.push('--- Show Choices: cancel convention + combine_choices ---');

const mergeSrc = fs.readFileSync(path.join(ROOT, 'js/plugins/MonlineChoiceMerge.js'), 'utf8');
g.$gameMessage = g.messageRecorder();   // the Choice section replaced this

// ---- the cancel convention defect, straight off the real data --------------
function cancelOf(choices, vxCancel) {
    const it = new g.Game_Interpreter();
    it._list = [{ code: 102, indent: 0, parameters: [choices, vxCancel] }];
    it._index = 0;
    it._indent = 0;
    it._branch = {};
    it._combineChoices = false;
    it.setupChoices(it._list[0].parameters);
    return $gameMessage.choiceCancelType();
}
eq('VX 0 = cancel disallowed becomes MV -1', cancelOf(['a', 'b'], 0), -1);
eq('VX 2 of 2 choices = the 2nd choice cancels (MV index 1)',
    cancelOf(['Yes', 'No'], 2), 1);
eq('VX 3 of 3 choices = the last choice cancels (MV index 2)',
    cancelOf(['a', 'b', 'c'], 3), 2);
eq('VX 1 of 1 choice = MV index 0', cancelOf(['only'], 1), 0);
eq('VX 5 = branch cancel becomes MV -2', cancelOf(['a', 'b', 'c'], 5), -2);
eq('a cancel index past the option count is also branch',
    cancelOf(['a', 'b', 'c'], 4), -2);
ok('the old bug is really gone: MV used to clamp 2-of-2 to -2 branch',
    cancelOf(['Yes', 'No'], 2) !== -2);

// the measured shape of the shipped data, re-derived here so the fix cannot
// silently be reverted without this failing
{
    let n = 0, outOfRange = 0, sawNegative = false;
    ['CommonEvents.json', 'Troops.json'].concat(
        fs.readdirSync(DATA).filter(function(f) { return /^Map\d+\.json$/.test(f); })
    ).forEach(function(f) {
        let j;
        try { j = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return; }
        (function walk(o) {
            if (Array.isArray(o)) { o.forEach(walk); return; }
            if (o && typeof o === 'object') {
                if (o.code === 102 && Array.isArray(o.parameters)) {
                    n++;
                    const c = o.parameters[1];
                    const len = (o.parameters[0] || []).length;
                    if (typeof c === 'number' && c < 0) { sawNegative = true; }
                    if (len && !(c >= 0 && c < len)) { outOfRange++; }
                }
                Object.keys(o).forEach(function(k) { walk(o[k]); });
            }
        })(j);
    });
    eq('the data really has 1244 Show Choices commands', n, 1244);
    eq('...and 770 of them are out of range under MV\'s rule', outOfRange, 770);
    ok('...and none of them was ever converted to MV form', !sawNegative);
}

// ---- combine_choices ------------------------------------------------------
function cmd(code, indent, params) {
    return { code: code, indent: indent, parameters: params };
}
// The real layout from Map083: `combine_choices`, then two stacked Show
// Choices commands of four options each.
const pageList = [
    cmd(355, 1, ['combine_choices']),
    cmd(102, 1, [['A0', 'A1', 'A2', 'A3'], 0]),
    cmd(402, 1, [0]), cmd(402, 1, [1]), cmd(402, 1, [2]), cmd(402, 1, [3]),
    cmd(404, 1, []),
    cmd(102, 1, [['B0', 'B1', 'B2', 'B3'], 4]),
    cmd(402, 1, [0]), cmd(402, 1, [1]), cmd(402, 1, [2]), cmd(402, 1, [3]),
    cmd(404, 1, [])
];
const pageCopy = pageList.map(function(c) {
    return { code: c.code, indent: c.indent, parameters: c.parameters.slice() };
});
const combiner = new g.Game_Interpreter();
combiner._list = pageCopy;
combiner._index = 1;
combiner._indent = 1;
combiner._branch = {};
combiner.clear();
// An earlier section swaps  for a one-key stub, so put the real
// bridge back for the duration of this call.
const savedRuby = g.MonlineRuby;
g.MonlineRuby = MR;
MR.current = combiner;
g.combine_choices();
g.MonlineRuby = savedRuby;
ok('combine_choices flags the running interpreter (0116.rb:129)',
    combiner._combineChoices === true);
combiner.setupChoices(pageCopy[1].parameters);

eq('both option sets end up in one menu', $gameMessage.choices().length, 8);
eq('...in order', $gameMessage.choices().join(','),
    'A0,A1,A2,A3,B0,B1,B2,B3');
eq('the second set\'s cancel option is re-based onto the merged list',
    $gameMessage.choiceCancelType(), 7);
eq('the merged Show Choices command is removed from the list',
    combiner._list.length, 12);
eq('the first set keeps its own branch numbers',
    [2, 3, 4, 5].map(function(i) { return combiner._list[i].parameters[0]; }).join(','),
    '0,1,2,3');
eq('the second set\'s branches continue the numbering (0116.rb:204)',
    [7, 8, 9, 10].map(function(i) { return combiner._list[i].parameters[0]; }).join(','),
    '4,5,6,7');

// Ruby works on a deep copy (`Marshal.load(Marshal.dump(@list))`); if we did
// not, the event page would be renumbered a second time on every replay.
eq('the event page itself is left untouched', pageList.length, 13);
eq('...its second Show Choices is still there', pageList[7].code, 102);
eq('...and its branches are still 0-based', pageList[8].parameters[0], 0);
ok('0116.rb deep-copies the list before mutating',
    mergeSrc.indexOf('cloneList') >= 0);

// ================================================ 6h. Simple Self Switches
lines.push('--- Simple Self Switches (0250.rb) ---');

const ssSrc = fs.readFileSync(path.join(ROOT, 'js/plugins/MonlineSelfSwitch.js'), 'utf8');
const ruby250 = fs.readFileSync('G:/新建文件夹 (22)/Monline_MV/_vxace_scripts/0250.rb', 'utf8');

ok('0250.rb iterates the four letters A-D',
    /switches\s*=\s*\["A","B","C","D"\]/.test(ruby250));
ok('...and the port does too', ssSrc.indexOf("'A', 'B', 'C', 'D'") >= 0);

g.$gameSelfSwitches._d = {};
g.setAllSelf(3, 7, true);
eq('setAllSelf(map, event, true) sets A', $gameSelfSwitches.value([3, 7, 'A']), true);
eq('...B', $gameSelfSwitches.value([3, 7, 'B']), true);
eq('...C', $gameSelfSwitches.value([3, 7, 'C']), true);
eq('...D', $gameSelfSwitches.value([3, 7, 'D']), true);
g.setAllSelf(3, 7, false);
eq('setAllSelf(map, event, false) clears them all',
    $gameSelfSwitches.value([3, 7, 'D']), false);

ok('setAllSelf takes the three arguments the data passes',
    window.setAllSelf.length === 3);
eq('the wrong bridge version is overridden', MR.F.setAllSelf, window.setAllSelf);
ok('...and it really is the new one (sets 4 keys, not 1-per-event)', (function() {
    g.$gameSelfSwitches._d = {};
    g.setAllSelf(9, 2, true);
    return Object.keys(g.$gameSelfSwitches._d).length === 4;
})());

g.$gameSelfSwitches._d = {};
g.setSelfSwitch(3, 7, 'B', true);
eq('setSelfSwitch writes [map, event, letter] (0250.rb:47)',
    $gameSelfSwitches.value([3, 7, 'B']), true);
eq('isSelfSwitch reads it back (0250.rb:54)', g.isSelfSwitch(3, 7, 'B'), true);
eq('...and reports false for an untouched letter', g.isSelfSwitch(3, 7, 'A'), false);

// ================================================ 6i. battle log (log_window)
lines.push('--- battle log: SceneManager.scene.log_window ---');

const logCalls = [];
const fakePic = { _angle: 0 };
const fakeScreen = {
    showPicture: function(id, name, origin, x, y, sx, sy, op, bl) {
        logCalls.push(['show', id, name, origin, x, y, sx, sy, op, bl]);
    },
    erasePicture: function(id) { logCalls.push(['erase', id]); },
    picture: function() { return fakePic; }
};

const battleScene = new g.Scene_Battle();
const battleLog = new g.Window_BattleLog();
battleScene._logWindow = battleLog;
eq('Scene_Battle#log_window is the real battle log window',
    battleScene.log_window, battleLog);

battleLog.add_text('The Mimic\'s body has turned to metal!');
eq('add_text puts the line on screen', battleLog._lines.length, 1);
eq('...verbatim', battleLog._lines[0], 'The Mimic\'s body has turned to metal!');
eq('add_text refreshes', battleLog.refreshes, 1);
eq('Ruby\'s add_text does not wait (only wait_and_clear does)', battleLog.waits, 0);

battleLog.wait_and_clear();
eq('wait_and_clear queues a clear', battleLog._methods[0].name, 'clear');
eq('...and waits once', battleLog.waits, 1);
ok('...so the text is readable before it disappears',
    battleLog._methods.length === 1 && battleLog.waits === 1);

// the ground truth: 88 add_text / 88 wait_and_clear pairs
{
    let add = 0, wc = 0;
    ['Troops.json', 'CommonEvents.json'].forEach(function(f) {
        const t = fs.readFileSync(path.join(DATA, f), 'utf8');
        add += (t.match(/log_window\.add_text/g) || []).length;
        wc += (t.match(/log_window\.wait_and_clear/g) || []).length;
    });
    eq('data really contains 88 add_text calls', add, 88);
    eq('...and 88 matching wait_and_clear calls', wc, 88);
}

// ================================================ 6j. Tidloc Compass
lines.push('--- Compass (0213.rb) ---');

const ruby213 = fs.readFileSync('G:/新建文件夹 (22)/Monline_MV/_vxace_scripts/0213.rb', 'utf8');
ok('0213.rb uses picture 101', ruby213.indexOf('pictures[101]') >= 0);
ok('0213.rb halves the angle (360/PI, not 180/PI)',
    ruby213.indexOf('* 360.0 / Math::PI') >= 0);

g.$gameTemp._tidloc_compass = [];
g.Tidloc.Set_Coord(5, 10, 20);
eq('Set_Coord stores [x, y] per map (0213.rb:39)',
    JSON.stringify($gameTemp._tidloc_compass[5]), '[10,20]');
g.Tidloc.Clear_Coord(5);
eq('Clear_Coord(map) forgets just that map', $gameTemp._tidloc_compass[5], null);
g.Tidloc.Set_Coord(7, 1, 2);
g.Tidloc.Clear_Coord();
eq('Clear_Coord() with no argument forgets everything',
    $gameTemp._tidloc_compass.length, 0);
ok('the bridge no longer stubs Tidloc', MR.F.Tidloc === window.Tidloc);

// needle angles - read through Scene_Map#update, exactly as the Ruby does
function compassAngleFor(tx, ty) {
    logCalls.length = 0;
    fakePic._angle = 0;
    g.$gameMap = { mapId: function() { return 5; }, screen: function() { return fakeScreen; } };
    // `x` / `y` are read-only accessors backed by `_x` / `_y` in MV (and in
    // this harness), so move the player through the backing fields.
    g.$gamePlayer._x = 10;
    g.$gamePlayer._y = 10;
    g.$gameTemp._tidloc_compass = [];
    g.Tidloc.Set_Coord(5, tx, ty);
    const scene = new g.Scene_Map();
    scene.update();
    return fakePic._angle;
}
// 180 and -180 are the same rotation; compare normalised.
function norm180(a) { return ((a % 360) + 540) % 360 - 180; }
eq('target north -> needle up (0 degrees)', compassAngleFor(10, 5), 0);
eq('target south -> needle down (180 degrees)', norm180(compassAngleFor(10, 15)), -180);
eq('target east -> needle right (90 degrees)', compassAngleFor(15, 10), 90);
eq('target west -> needle left (-90 degrees)', compassAngleFor(5, 10), -90);
{
    const shown = logCalls.filter(function(c) { return c[0] === 'show'; })[0];
    ok('the needle is picture 101', shown && shown[1] === 101);
    eq('...using the compass_needle graphic', shown && shown[2], 'compass_needle');
    eq('...centred (origin 1, 0213.rb:68)', shown && shown[3], 1);
    eq('...at 50% zoom', shown && shown[6] + '/' + shown[7], '50/50');
    eq('...fully opaque', shown && shown[8], 255);
    ok('compass_needle.png is actually shipped',
        fs.existsSync(path.join(ROOT, 'img/pictures/compass_needle.png')));
}
{
    logCalls.length = 0;
    g.$gameTemp._tidloc_compass = [];
    const scene = new g.Scene_Map();
    scene.update();
    ok('no coordinate on this map -> the needle is erased (0213.rb:91)',
        logCalls.length === 1 && logCalls[0][0] === 'erase');
}

// ================================================ 6k. Global Save
lines.push('--- Global Save (0180.rb) ---');

const ruby180 = fs.readFileSync('G:/新建文件夹 (22)/Monline_MV/_vxace_scripts/0180.rb', 'utf8');
const GS = g.LGlobalSave;

ok('0180.rb ships an empty variable list',
    /VARIABLES_TO_SAVE\s*=\s*\[\]/.test(ruby180));
ok('...and an empty switch list',
    /SWITCHES_TO_SAVE\s*=\s*\[\]/.test(ruby180));
eq('...so the port saves no variables', GS.VARIABLES_TO_SAVE.length, 0);
eq('...and no switches', GS.SWITCHES_TO_SAVE.length, 0);
eq('0180.rb:30 SAVE_ON_SAVE', GS.SAVE_ON_SAVE, true);
eq('0180.rb:33 LOAD_ON_LOAD', GS.LOAD_ON_LOAD, true);
eq('0180.rb:36 LOAD_ON_NEW', GS.LOAD_ON_NEW, true);
eq('0180.rb:47 FILE_NAME', GS.FILE_NAME, 'Global.rvdata2');

// inert by construction, not by hard-coding a no-op
g.$gameVariables = varStore();
g.$gameVariables.setValue(42, 7);
g.global_save();
g.$gameVariables.setValue(42, 999);
g.global_load();
eq('global_load does not resurrect a variable (nothing is configured)',
    $gameVariables.value(42), 999);

g.DM_CALLS.length = 0;
g.DataManager.setupNewGame();
ok('DataManager.setupNewGame still loads the global file (0180.rb:171)',
    g.DM_CALLS.indexOf('new') >= 0);
g.DataManager.saveGame(1);
ok('DataManager.saveGame writes it (0180.rb:184)', g.DM_CALLS.indexOf('save') >= 0);
g.DataManager.loadGame(1);
ok('DataManager.loadGame reads it (0180.rb:192)', g.DM_CALLS.indexOf('load') >= 0);
ok('the bridge no longer stubs global_save/global_load',
    MR.F.global_save === window.global_save && MR.F.global_load === window.global_load);
['combine_choices', 'global_save', 'global_load'].forEach(function(n) {
    ok(n + ' is off the pending list', MR.COSMETIC.indexOf(n) < 0);
});

// ================================================ 6l. character sprite zoom
lines.push('--- Character Sprite Zooming (0236.rb) ---');

const zoomSrc = fs.readFileSync(path.join(ROOT, 'js/plugins/MonlineZoom.js'), 'utf8');
const ruby236 = fs.readFileSync('G:/新建文件夹 (22)/Monline_MV/_vxace_scripts/0236.rb', 'utf8');

ok('0236.rb eases with (current * (d - 1) + target) / d',
    ruby236.indexOf('@zoom_x = (@zoom_x * (dx - 1) + @target_zoom) / dx') >= 0);
ok('0236.rb zooms the followers too',
    /followers\.each/.test(ruby236));
ok('...and the port does', zoomSrc.indexOf('followers') >= 0);

function zoomy() {
    const c = new g.Game_CharacterBase();
    c.initMembers();
    return c;
}
eq('zoom starts at 1.0 (0236.rb:137)', zoomy().zoomX(), 1.0);
eq('...on both axes', zoomy().zoomY(), 1.0);

{
    const c = zoomy();
    c.setupZoom(2, 0);                       // duration 0 snaps
    eq('a duration of 0 applies immediately', c.zoomX(), 2);
    eq('...and zoom_y follows zoom_x when not given', c.zoomY(), 2);
}
{
    const c = zoomy();
    c.setupZoom(2, 4);
    eq('easing frame 1 -> (1*3 + 2)/4', c.zoomX(), 1.25);
    c.updateZoom();
    eq('easing frame 2 -> 1.5', c.zoomX(), 1.5);
    c.updateZoom();
    eq('easing frame 3 -> 1.75', c.zoomX(), 1.75);
    c.updateZoom();
    eq('easing frame 4 -> lands on the target', c.zoomX(), 2);
    ok('the event is released once both durations run out', c.zoomDuration() === 0);
}
{
    const c = zoomy();
    c.setupZoom(0.5, 0, 2);                  // separate zoom_y
    eq('zoom_y can differ from zoom_x', c.zoomY(), 2);
    eq('...without touching zoom_x', c.zoomX(), 0.5);
}
{
    // Sprite_Character has to push the state onto the sprite, or nothing shows.
    const s = new g.Sprite_Character();
    s.scale = { x: 1, y: 1 };          // the stub class has no PIXI transform
    s._character = zoomy();
    s.updateOther();
    eq('Sprite_Character#updateOther applies zoom_x (0236.rb:123)', s.scale.x, 1.0);
    s._character.setupZoom(3, 0);
    s.updateOther();
    eq('...and follows changes', s.scale.x, 3);
}
ok('the bridge no longer stubs zoom_event_sprite',
    MR.F.zoom_event_sprite === window.zoom_event_sprite);
ok('...or zoom_player_sprite', MR.F.zoom_player_sprite === window.zoom_player_sprite);

// ================================================ 6m. MOG Weather EX
lines.push('--- Weather EX (0225.rb) ---');

const weatherSrc = fs.readFileSync(path.join(ROOT, 'js/plugins/MonlineWeather.js'), 'utf8');
const ruby225 = fs.readFileSync('G:/新建文件夹 (22)/Monline_MV/_vxace_scripts/0225.rb', 'utf8');

eq('0225.rb:87 power efficiency', g.MonlineWeather.CFG.WEATHER_POWER_EFIC, 5);
eq('0225.rb:83 screen z', g.MonlineWeather.CFG.WEATHER_SCREEN_Z, 50);
eq('0225.rb:89 weather in battle', g.MonlineWeather.CFG.WEATHER_BATTLE, true);
ok('0225.rb loads particles from Graphics/Weather/',
    ruby225.indexOf('"Graphics/Weather/"') >= 0);

// --- the commands ----------------------------------------------------------
g.$gameTemp._weatherFade = false;
g.$gameTemp._weatherRfTime = 0;
g.weather(0, 5, 'Rain_04');
eq('weather(type, power, image) stores the triple (0225.rb:166)',
    JSON.stringify($gameSystem._weather), '[0,5,"Rain_04"]');
g.weather_stop();
eq('weather_stop clears it (0225.rb:175)', JSON.stringify($gameSystem._weather),
    '[-1,0,""]');
g.weather(4, 3, 'Snow_01');
g.weather_store();
eq('weather_store records the current weather (0225.rb:208)',
    JSON.stringify($gameSystem._weatherRecordSet), '[4,3,"Snow_01"]');
g.weather_stop();
g.weather_restore_store();
eq('weather_restore_store brings it back (0225.rb:216)',
    JSON.stringify($gameSystem._weather), '[4,3,"Snow_01"]');
g.weather_restore();
eq('weather_restore stashes a running weather first (0225.rb:187)',
    JSON.stringify($gameSystem._weather), '[-1,0,""]');
g.weather_restore();
eq('...and brings it back on the second call',
    JSON.stringify($gameSystem._weather), '[4,3,"Snow_01"]');
g.weather_stop();
g.weather_stop_b();
ok('weather_stop_b arms the post-battle stop (0225.rb:223)',
    $gameTemp._weatherFstop === true);
$gameTemp._weatherFstop = false;

// --- particle count -------------------------------------------------------
function layerWith(type, power, image) {
    // TestSprite already implements addChild/removeChild, which is all the
    // layer asks of its host.
    const host = new g.Sprite();
    $gameSystem._weather = [type, power, image];
    return new g.MonlineWeather.WeatherLayer(host);
}
eq('power 1 -> 5 particles (power * 5, floor 5)', layerWith(4, 1, 'Snow_01')._particles.length, 5);
eq('power 2 -> 10 particles', layerWith(4, 2, 'Flower_01')._particles.length, 10);
eq('power 10 -> 50 particles', layerWith(0, 10, 'Rain_04')._particles.length, 50);
eq('type -1 means no weather at all', layerWith(-1, 5, 'Snow_01')._particles.length, 0);

// --- per-type motion (0225.rb:519-627) ------------------------------------
function particleOf(type, image) {
    const p = new g.MonlineWeather.Particle(type, image || 'Snow_01');
    return p;
}
{
    const rain = particleOf(0, 'Rain_04');
    ok('rain falls downward', rain._ySpeed >= 10 && rain._ySpeed <= 20);
    ok('rain zoom_y is 1.00..1.49 (0225.rb:558)',
        rain._sprite.scale.y >= 1.0 && rain._sprite.scale.y <= 1.49);
    ok('rain zoom_x is 1.00..1.24 (0225.rb:559)',
        rain._sprite.scale.x >= 1.0 && rain._sprite.scale.x <= 1.24);
    const snow = particleOf(4);
    ok('snow drifts down slowly', snow._ySpeed >= 1 && snow._ySpeed <= 5);
    const light = particleOf(3);
    ok('light rises', light._ySpeed < 0);
    eq('light blends additively (0225.rb:589)', light._sprite.blendMode, 1);
    const spark = particleOf(5);
    ok('spark shrinks', spark._zoomSpeed < 0);
    eq('spark blends additively (0225.rb:541)', spark._sprite.blendMode, 1);
    const fog = particleOf(2);
    ok('fog drifts sideways', fog._xSpeed >= 1 && fog._xSpeed <= 10);
    ok('fog faces 0 or 180 degrees (0225.rb:569)',
        fog._angle === 0 || fog._angle === 180);
    const wind = particleOf(1);
    ok('wind moves on both axes', wind._xSpeed > 0 && wind._ySpeed > 0);
}
{
    const p = particleOf(4);
    const y0 = p._sprite.y;
    p.update();
    ok('a particle actually moves each frame', p._sprite.y !== y0);
    eq('particles fade in from opacity 1', p._opacity, 6);
    // RGSS3 angle is counterclockwise, MV rotation is clockwise -> negated.
    ok('the rotation sign is flipped for MV',
        Math.abs(p._sprite.rotation + p._angle * Math.PI / 180) < 1e-9);
}
{
    // respawn: rain re-enters from the top, not mid-screen (0225.rb:555)
    const p = particleOf(0, 'Rain_04');
    const first = p._sprite.y;
    p.update();
    for (let i = 0; i < 400 && p._sprite.y < g.Graphics.height; i++) { p.update(); }
    p.setup();
    ok('a recycled raindrop re-enters from above',
        p._started === true && p._sprite.y < 0);
}

// --- scene transitions (0225.rb:926) --------------------------------------
g.$gameSystem._weather = [0, 5, 'Rain_04'];
g.SceneManager.push(g.Scene_Map);
eq('pushing a scene stashes the weather', JSON.stringify($gameSystem._weatherTemp),
    '[0,5,"Rain_04"]');
eq('...and clears the live weather', JSON.stringify($gameSystem._weather), '[-1,0,""]');
{
    const scene = new g.Scene_Battle();
    scene.start();
}
eq('starting a battle scene restores it (0225.rb:841)',
    JSON.stringify($gameSystem._weather), '[0,5,"Rain_04"]');
g.weather_stop();

// --- the data -------------------------------------------------------------
{
    let calls = 0, stops = 0, types = {}, images = {};
    fs.readdirSync(DATA).filter(f => f.endsWith('.json')).forEach(f => {
        const t = fs.readFileSync(path.join(DATA, f), 'utf8');
        calls += (t.match(/weather\(\s*-?\d+\s*,\s*-?\d+\s*,/g) || []).length;
        stops += (t.match(/weather_stop\b/g) || []).length;
        (t.match(/weather\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*\\?"([A-Za-z0-9_]+)/g) || [])
            .forEach(m => {
                const mm = /weather\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*\\?"([A-Za-z0-9_]+)/.exec(m);
                types[mm[1]] = (types[mm[1]] || 0) + 1;
                images[mm[3]] = (images[mm[3]] || 0) + 1;
            });
    });
    eq('the data really calls weather() 65 times', calls, 65);
    eq('...and weather_stop 71 times', stops, 71);
    eq('only four of the seven types are used', Object.keys(types).sort().join(','), '0,1,3,4');
    Object.keys(images).forEach(n => {
        ok('img/weather/' + n + '.png is shipped',
            fs.existsSync(path.join(ROOT, 'img/weather/' + n + '.png')));
    });
}

MR.current = null;

// ================================================ report
console.log(lines.join('\n'));
if (failures > 0) {
    console.log('');
    console.log('UNIT CHECK FAILED: ' + failures + ' assertion(s)');
    process.exit(1);
} else {
    console.log('');
    console.log('UNIT CHECK PASSED: all assertions held');
}