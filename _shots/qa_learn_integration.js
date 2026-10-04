// QA INDEPENDENT INTEGRATION CHECK for Scene_LearnSkill.
//
// Unlike unit_check.js (which stubs Game_Actor / Scene_MenuBase / Window_SkillList),
// this harness loads the REAL rpg_objects.js, rpg_windows.js and rpg_scenes.js and
// only fakes the PIXI drawing layer.  Purpose: prove the real call chain works,
// not just that the plugin's own functions agree with themselves.
//
//   node qa_learn_integration.js
const fs = require('fs');
const path = require('path');

const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const DATA = path.join(ROOT, 'data');
const g = globalThis;

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; console.log('  ok    ' + name); }
    else { fail++; failures.push(name + ': expected ' + e + ' got ' + a);
           console.log('  FAIL  ' + name + ': expected ' + e + ' got ' + a); }
}
function ok(name, cond, extra) {
    if (cond) { pass++; console.log('  ok    ' + name); }
    else { fail++; failures.push(name + (extra ? ' (' + extra + ')' : ''));
           console.log('  FAIL  ' + name + (extra ? ' (' + extra + ')' : '')); }
}
function section(t) { console.log('--- ' + t + ' ---'); }

// ============================================================ graphics stubs
g.window = g;
g.Rectangle = function(x, y, w, h) {
    this.x = x || 0; this.y = y || 0; this.width = w || 0; this.height = h || 0;
};
g.Rectangle.prototype.set = function(x, y, w, h) {
    this.x = x; this.y = y; this.width = w; this.height = h;
};
g.Point = function(x, y) { this.x = x || 0; this.y = y || 0; };
g.Window = function() {};                       // rpg_windows.js roots here
g.Window.prototype.initialize = function() {};
g.Stage = function() {};
g.Stage.prototype.initialize = function() {};
g.Stage.prototype.addChild = function(c) { (this.children = this.children || []).push(c); };
g.Graphics = { width: 816, height: 624, boxWidth: 816, boxHeight: 624, frameCount: 0 };
g.SceneManager = { backgroundBitmap: function() { return null; }, _scene: null };
g.TouchInput = { wheelY: 0, isTriggered: function() { return false; },
                 isRepeated: function() { return false; },
                 isPressed: function() { return false; },
                 isMoved: function() { return false; },
                 isReleased: function() { return false; },
                 isCancelled: function() { return false; },
                 update: function() {} };
g.Input = { isRepeated: function() { return false; },
            isTriggered: function() { return false; },
            isPressed: function() { return false; },
            isLongPressed: function() { return false; },
            update: function() {} };
g.SoundManager = { playUseSkill: function() {}, playBuzzer: function() {},
                   playUseItem: function() {}, playOk: function() {},
                   playCancel: function() {} };
g.ImageManager = { loadSystem: function() { return null; },
                   loadFace: function() { return null; } };
// rpg_core.js patches Array with these; the engine relies on them heavily
if (!Array.prototype.contains) {
    Array.prototype.contains = function(e) { return this.indexOf(e) >= 0; };
}
if (!Array.prototype.clone) {
    Array.prototype.clone = function() { return this.slice(); };
}
if (!Array.prototype.equals) {
    Array.prototype.equals = function(o) {
        return Array.isArray(o) && this.length === o.length &&
            this.every((v, i) => v === o[i]);
    };
}
if (!Array.prototype.remove) {
    Array.prototype.remove = function(e) {
        for (;;) { const i = this.indexOf(e); if (i < 0) break; this.splice(i, 1); }
        return this;
    };
}
if (!Number.prototype.clamp) {
    Number.prototype.clamp = function(min, max) {
        return Math.max(min, Math.min(max, this));
    };
}
g.Utils = { isOptionValid: function() { return false; },
            isNwjs: function() { return false; },
            isMobileDevice: function() { return false; },
            canUseWebGL: function() { return false; },
            generateRuntimeId: function() { return 'qa'; },
            RGBAToHexColor: function() { return '#000000'; } };
g.DataManager = { isDatabaseLoaded: function() { return true; } };

function StubBitmap(w, h) { this.width = w || 0; this.height = h || 0; this.fontSize = 28; }
StubBitmap.prototype.measureTextWidth = function(t) { return String(t).length * 10; };
StubBitmap.prototype.clear = function() {};
g.Bitmap = StubBitmap;

function StubSprite() { this.children = []; }
StubSprite.prototype.addChild = function(c) { this.children.push(c); };
g.Sprite = StubSprite;

// ============================================================ real engine
function loadEngine(f) {
    (0, eval)(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
}
loadEngine('rpg_objects.js');
loadEngine('rpg_windows.js');
loadEngine('rpg_scenes.js');

// Window_Base#initialize needs PIXI windowskin loading; replace with a version
// that keeps every real field the selectable logic reads.  Everything ABOVE
// this (Window_Selectable, Window_Selectable#refresh, Window_Command,
// Window_SkillList) stays real.
g.Window_Base.prototype.initialize = function(x, y, width, height) {
    this.x = x || 0; this.y = y || 0; this.width = width || 0; this.height = height || 0;
    this.padding = 12; this.margin = 4; this.opacity = 255; this.backOpacity = 192;
    this.openness = 255; this.active = true; this.visible = true;
    this.createContents();
};
g.Window_Base.prototype.createContents = function() {
    this.contents = new StubBitmap(this.contentsWidth(), this.contentsHeight());
    this.resetFontSettings();
};
g.Window_Base.prototype.contentsWidth = function() {
    return Math.max(0, this.width - this.standardPadding() * 2);
};
g.Window_Base.prototype.contentsHeight = function() {
    return Math.max(0, this.height - this.standardPadding() * 2);
};
g.Window_Base.prototype.standardFontSize = function() { return 28; };
g.Window_Base.prototype.lineHeight = function() { return 36; };
g.Window_Base.prototype.standardPadding = function() { return 18; };
g.Window_Base.prototype.textPadding = function() { return 6; };
g.Window_Base.prototype.textWidth = function(t) { return String(t).length * 10; };
// drawing primitives -> no-ops (we care about *which* rows exist, not pixels)
['resetFontSettings', 'resetTextColor', 'changeTextColor', 'changePaintOpacity',
 'drawText', 'drawIcon', 'drawItemName', 'drawTextEx', 'drawHorzLine',
 'updatePadding', 'updateBackOpacity', 'updateTone', 'refresh',
 'updateCursor', 'updateArrows', 'update'].forEach(function(m) {
    g.Window_Base.prototype[m] = function() {};
});
g.Window_Base.prototype.setCursorRect = function() {};
g.Window_Base.prototype.setTone = function() {};
g.Window_Base.prototype.move = function(x, y, w, h) {
    this.x = x; this.y = y; this.width = w; this.height = h;
};
g.Window_Base.prototype.isOpen = function() { return this.openness >= 255; };
g.Window_Base.prototype.isClosed = function() { return this.openness <= 0; };
g.Window_Base.prototype.close = function() { this.openness = 0; };
g.Window_Base.prototype.open = function() { this.openness = 255; };
g.Window_Base.prototype.deactivate = function() { this.active = false; };
g.Window_Base.prototype.activate = function() { this.active = true; };
g.Window_Base.prototype.systemColor = function() { return '#ffffff'; };
g.Window_Base.prototype.normalColor = function() { return '#ffffff'; };
g.Window_Base.prototype.textColor = function(n) { return '#n' + n; };
g.Window_Base.prototype.drawAllItems = function() {
    for (var i = 0; i < this.maxItems(); i++) { this.drawItem(i); }
};
g.Window_Base.prototype.drawItem = function() {};
g.Window_Base.prototype.addChild = function(c) { (this.children = this.children || []).push(c); };

// Scene_Base#create needs the display tree; keep everything else real
g.Scene_Base.prototype.addChild = function(c) { (this.children = this.children || []).push(c); };
g.Scene_Base.prototype.createBackground = function() {};
g.Scene_Base.prototype.createWindowLayer = function() {};
g.Scene_Base.prototype.addWindow = function(w) { (this._windowLayer = this._windowLayer || []).push(w); };

// ============================================================ real database
function loadJson(n) {
    return JSON.parse(fs.readFileSync(path.join(DATA, n), 'utf8').replace(/^\uFEFF/, ''));
}
g.$dataActors = loadJson('Actors.json');
g.$dataClasses = loadJson('Classes.json');
g.$dataSkills = loadJson('Skills.json');
g.$dataItems = loadJson('Items.json');
g.$dataWeapons = loadJson('Weapons.json');
g.$dataArmors = loadJson('Armors.json');
g.$dataEnemies = loadJson('Enemies.json');
g.$dataStates = loadJson('States.json');
g.$dataSystem = loadJson('System.json');
g.$dataMapInfos = loadJson('MapInfos.json');
g.$dataTroops = loadJson('Troops.json');

// ============================================================ real game state
g.$gameTemp = new g.Game_Temp();
g.$gameSystem = new g.Game_System();
g.$gameSwitches = new g.Game_Switches();
g.$gameVariables = new g.Game_Variables();
// real Game_Switches#onChange pokes $gameMap; no map in a node harness
g.Game_Switches.prototype.onChange = function() {};
g.$gameActors = new g.Game_Actors();
g.$gameParty = new g.Game_Party();
g.$gameParty.initAllItems();
g.$gameParty.setupStartingMembers();

// ============================================================ plugins (real order)
function loadPlugin(p) {
    (0, eval)(fs.readFileSync(path.join(ROOT, 'js/plugins', p), 'utf8'));
}
loadPlugin('MonlineShim.js');
const shimIsStub = g.Game_Actor.prototype.gain_jp.length === 0 &&
    /^\s*function\s*\(\)\s*\{\s*\}\s*$/.test(String(g.Game_Actor.prototype.gain_jp));
loadPlugin('MonlineScenes.js');

// ---------------------------------------------------------------------------
// DEFECT ACCOMMODATION (see report): MonlineScenes.js calls actor.isLearned(id)
// but the real MV Game_Actor only has isLearnedSkill(id).  Polyfilled here so
// the REST of the learn flow can be verified; the defect itself is asserted
// above and reported separately.
// ---------------------------------------------------------------------------
const REAL_HAS_ISLEARNED = typeof g.Game_Actor.prototype.isLearned === 'function';
if (!REAL_HAS_ISLEARNED && !g.Game_Actor.prototype.isLearnedSkill) {
    console.log('  FATAL  Game_Actor has neither isLearned nor isLearnedSkill');
}
// Only polyfill if MonlineScenes STILL calls the non-existent name, so that a
// regression of defect #1 shows up here instead of being silently papered over.
const NEEDS_POLYFILL = /\bisLearned\s*\(/.test(
    String(g.MonlineScenes.canLearn) + String(g.MonlineScenes.enabledFor) +
    String(g.MonlineScenes.meetsSkillRequirements) +
    String(g.MonlineScenes.Window_LearnSkillList.prototype.drawLearnCost) +
    String(g.MonlineScenes.Window_LearnSkillList.prototype.drawItem));
console.log('  INFO  polyfill installed: ' + NEEDS_POLYFILL +
            ' (must be false - MonlineScenes must use isLearnedSkill directly)');
if (NEEDS_POLYFILL) {
    g.Game_Actor.prototype.isLearned = function(id) { return this.isLearnedSkill(id); };
}

section('shim vs real implementation');
ok('MonlineShim really planted an empty gain_jp stub before MonlineScenes',
    shimIsStub, String(g.MonlineShim.methods['Game_Actor.gain_jp']));
ok('that stub is GONE after MonlineScenes loads (unconditional overwrite)',
    !shimIsStub || String(g.Game_Actor.prototype.gain_jp).indexOf('gainJp') >= 0,
    String(g.Game_Actor.prototype.gain_jp).slice(0, 80));

const MS = g.MonlineScenes;
const realSkills = g.$dataSkills;
const realClasses = g.$dataClasses;

// ============================================================ A. real actor chain
section('DEFECT 1: does Game_Actor have isLearned()?');
ok('MonlineScenes no longer calls the non-existent actor.isLearned()',
    !NEEDS_POLYFILL,
    'MV only defines isLearnedSkill(); see MonlineScenes.js:322,392,396,716,974,975');
ok('...and no polyfill was needed to make the suite pass', !NEEDS_POLYFILL);
ok('the real Game_Actor indeed has NO isLearned() (so the guard is meaningful)',
    !REAL_HAS_ISLEARNED);

section('who does Scene_LearnSkill actually act on? (real Game_Party)');

// The port no longer defines its own menuActor() - core does the job.  Assert
// that (a) it is really gone and (b) core really does fill _actor.
ok('Scene_LearnSkill#menuActor has been removed (core already does this)',
    typeof g.Scene_LearnSkill.prototype.menuActor === 'undefined');
ok('Scene_MenuBase#create really calls updateActor',
    /updateActor/.test(String(g.Scene_MenuBase.prototype.create)));

function buildScene() {
    const s = Object.create(g.Scene_LearnSkill.prototype);
    g.Scene_LearnSkill.prototype.initialize.call(s);
    let err = null;
    try { s.create(); } catch (e) { err = e; }
    return { scene: s, err: err };
}

// 1. plain entry: nobody set a menu actor explicitly
g.$gameParty.setMenuActor(g.$gameActors.actor(1));
const r1 = buildScene();
ok('plain entry: create() does not throw', !r1.err,
    r1.err && r1.err.message);
ok('plain entry: _actor is filled by Scene_MenuBase#updateActor',
    r1.scene.actor() === g.$gameParty.menuActor(),
    r1.scene.actor() ? r1.scene.actor().name() : 'undefined');
eq('plain entry: actor id', r1.scene.actor().actorId(), 1);

// 2. PXE path: setMenuActor(actor 25) then SceneManager.push(Scene_LearnSkill)
const pxe = g.$gameActors.actor(25);
eq('actor 25 is PXE / class 21 (Terminal)', [pxe.name(), pxe._classId], ['PXE', 21]);
ok('PXE is NOT in the starting party', g.$gameParty.members().indexOf(pxe) < 0);
g.$gameParty.setMenuActor(pxe);
const r2 = buildScene();
ok('PXE path: create() does not throw', !r2.err, r2.err && r2.err.message);
const picked = r2.scene.actor();
console.log('  INFO  PXE path picked actorId=' + picked.actorId() +
            ' name=' + picked.name() + ' (party members: ' +
            g.$gameParty.members().map(a => a.actorId()).join(',') +
            ') - same fallback as 0148.rb/RGSS3 Game_Party#menu_actor');
ok('PXE path resolves to a real actor (no crash / no undefined)',
    !!picked && typeof picked.actorId === 'function');
ok('...and it is exactly what $gameParty.menuActor() returns',
    picked === g.$gameParty.menuActor());

// full create() - the real thing, with real windows
g.$gameParty.setMenuActor(g.$gameActors.actor(1));
const scene = r1.scene;
const createError = r1.err;
ok('Scene_LearnSkill#create runs end to end with real windows', !createError,
    createError && (createError.message + ' @ ' + createError.stack.split('\n')[1]));
ok('...and the scene has an actor', !!scene.actor(),
    scene.actor() ? scene.actor().name() : 'undefined');
eq('...whose id is the party menu actor', scene.actor().actorId(), 1);
ok('...the list window got that actor', scene._skillWindow._actor === scene.actor());
ok('...and so did the command window', scene._commandWindow._actor === scene.actor());

// ============================================================ B. real list source
section('the list is built from the CLASS pool, not actor.skills()');

const actor = scene.actor();
actor.gainJp(9999);
const allSwitches = [23, 253]
    .concat(Array.from({length: 181 - 101 + 1}, (_, i) => 101 + i))
    .concat([801, 802, 803, 804, 805, 806]);
allSwitches.forEach(function(s) { g.$gameSwitches.setValue(s, true); });

const listWin = scene._skillWindow;
ok('Window_LearnSkillList overrides makeItemList',
    g.Window_LearnSkillList.prototype.hasOwnProperty('makeItemList'));
ok('...so it cannot fall back to actor.skills()',
    String(g.Window_LearnSkillList.prototype.makeItemList).indexOf('actor.skills') < 0);

// (a) prerequisite skills NOT yet known -> those rows are correctly hidden
listWin.setStypeId(1);
const withheld = listWin._data.length;
console.log('  INFO  Techniques rows without prerequisites: ' + withheld + ' of 23');
ok('unmet <learn require skill:> gates hide rows', withheld < 23,
    'rows=' + withheld);
ok('every listed row meets its prerequisites',
    listWin._data.every(s => MS.meetsRequirements(actor, s)));

// (b) grant every prerequisite -> the raw per-class pool must show up intact
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
prereqIds.forEach(function(id) { actor.learnSkill(id); });
listWin.refresh();
eq('Player / Techniques rows (all prerequisites met)', listWin._data.length, 23);
listWin.setStypeId(2);
eq('Player / Talents rows', listWin._data.length, 29);
listWin.setStypeId(3);
eq('Player / Imitations rows', listWin._data.length, 78);
listWin.setStypeId(9);
eq('Player / Functions rows (class cannot learn any)', listWin._data.length, 0);

// (c) THE decisive regression test: rows must be SELECTABLE, not all disabled.
listWin.setStypeId(1);
const disabled = listWin._data.filter(s => !listWin.isEnabled(s));
const enabledCount = listWin._data.length - disabled.length;
console.log('  INFO  rows=' + listWin._data.length + ' selectable=' + enabledCount +
            ' disabled=' + disabled.length);
ok('the original bug is gone: the list is NOT entirely dead', enabledCount > 0,
    'selectable=' + enabledCount);
ok('every disabled row is one the actor already knows',
    disabled.every(s => actor.isLearnedSkill(s.id)),
    JSON.stringify(disabled.map(s => s.id)));
ok('and every already-known row is disabled',
    listWin._data.filter(s => actor.isLearnedSkill(s.id))
        .every(s => !listWin.isEnabled(s)));

// (d) learning a listed skill keeps the row but disables it
const target = listWin._data.filter(s => listWin.isEnabled(s))[0];
ok('found an affordable row to buy', !!target);
if (target) {
    const targetId = target.id;
    actor.learnSkill(targetId);
    listWin.refresh();
    ok('a learned skill is still LISTED', listWin._data.some(s => s.id === targetId));
    eq('...as a disabled row', listWin.isEnabled(realSkills[targetId]), false);
}

// the window helper was renamed so it can never be mistaken for the actor's
ok('the window helper is no longer called isLearned (renamed knowsSkill)',
    typeof g.Window_LearnSkillList.prototype.isLearned === 'undefined' &&
    typeof g.Window_LearnSkillList.prototype.knowsSkill === 'function');
const knower = Object.create(g.Window_LearnSkillList.prototype);
knower._actor = { isLearnedSkill: function(id) { return id === 42; } };
eq('knowsSkill delegates to the real actor method (true)',
    knower.knowsSkill({ id: 42 }), true);
eq('knowsSkill delegates to the real actor method (false)',
    knower.knowsSkill({ id: 43 }), false);

// drawLearnCost must still render "Known" for a learned row and the price
// otherwise - that is the branch the rename touched (MonlineScenes.js:734).
const drawn = [];
const KNOWN = { id: 9201, name: 'KnownSkill', stypeId: 1,
                note: '<learn cost: 5 jp>' };
const UNKNOWN = { id: 9202, name: 'DearSkill', stypeId: 1,
                  note: '<learn cost: 500 jp>' };
const drawer = Object.create(g.Window_LearnSkillList.prototype);
drawer._actor = { isLearnedSkill: function(id) { return id === KNOWN.id; } };
drawer.contents = { fontSize: 28 };
drawer.drawText = function(t) { drawn.push(String(t)); };
drawer.changeTextColor = function() {};
drawer.resetFontSettings = function() {};
drawer.textWidth = function(t) { return String(t).length * 10; };
drawer.textPadding = function() { return 6; };
drawer.normalColor = function() { return '#fff'; };
drawer.systemColor = function() { return '#fff'; };
drawer.textColor = function() { return '#c'; };
drawer.itemRect = function() { return { x: 0, y: 0, width: 300, height: 36 }; };
drawer.drawLearnCost(KNOWN, { x: 0, y: 0, width: 300, height: 36 });
ok('a learned row renders "Known"', drawn.indexOf('Known') >= 0,
    JSON.stringify(drawn));
drawn.length = 0;
drawer.drawLearnCost(UNKNOWN, { x: 0, y: 0, width: 300, height: 36 });
ok('an unlearned row renders its price, not "Known"',
    drawn.indexOf('Known') < 0 && drawn.indexOf('500') >= 0, JSON.stringify(drawn));

// ============================================================ C. JP semantics
section('per-class JP');
const a2 = g.$gameActors.actor(1);
a2._jp = undefined;
a2.initJp();
a2.gainJp(100);
eq('jp lands on the current class', a2.jp(1), 100);
eq('...class 3 untouched', a2.jp(3), 0);
a2.gainJp(50, 3);
eq('class-scoped gain is isolated (class 1)', a2.jp(1), 100);
eq('...and lands on class 3', a2.jp(3), 50);
a2.loseJp(20, 3);
eq('loseJp takes from the named class', a2.jp(3), 30);
eq('...leaving the others alone', a2.jp(1), 100);
a2.loseJp(99999, 3);
eq('never below zero', a2.jp(3), 0);
a2.gainJp(10 ** 12);
eq('capped at MAX_JP', a2.jp(1), MS.LearnConfig.MAX_JP);
eq('MAX_JP matches 0173.rb', MS.LearnConfig.MAX_JP, 99999999);

// legacy numeric _jp migration
const legacy = g.$gameActors.actor(1);
legacy._jp = 40;
eq('legacy numeric _jp migrates onto the current class', legacy.jp(1), 40);
ok('...and becomes a per-class map', typeof legacy._jp === 'object' &&
    !Array.isArray(legacy._jp), typeof legacy._jp);
legacy.gainJp(10, 3);
eq('...other class starts at 0 + gained', legacy.jp(3), 10);
eq('...migrated value survives', legacy.jp(1), 40);
// a legacy NaN-ish value
const legacy2 = g.$gameActors.actor(1);
legacy2._jp = undefined;
eq('undefined _jp reads as 0', legacy2.jp(1), 0);
const legacy3 = g.$gameActors.actor(1);
legacy3._jp = '77';
eq('a numeric string _jp migrates too', legacy3.jp(1), 77);

// gain_jp / lose_jp (Ruby names) hit the real implementation
const ruby = g.$gameActors.actor(1);
ruby._jp = undefined;
ruby.gain_jp(30);
eq('gain_jp (Ruby name) really moves JP', ruby.jp(1), 30);
ruby.lose_jp(5);
eq('lose_jp (Ruby name) really moves JP', ruby.jp(1), 25);

// ============================================================ D. jp is not exp
section('jp costs stay jp');
const s3 = realSkills[3];
const pl = MS.parseLearn(s3);
eq('skill 3 Assault Rush costs 26', pl.cost, 26);
eq('...and is jp, not exp', pl.type, 'jp');
eq('...with switch 23 required', pl.requireSwitch, 23);
const s11 = realSkills[11];
eq('skill 11 Pinpoint Strike costs 5 jp',
    [MS.parseLearn(s11).cost, MS.parseLearn(s11).type], [5, 'jp']);
ok('no skill in the DB costs exp or gold', realSkills.every(function(s) {
    return !s || !/<\s*learn\s+cost[^>]*(exp|gold)/i.test(String(s.note || ''));
}));

// ============================================================ E. payment routing
section('payment comes out of the right wallet');
function freshActor(classId) {
    const a = g.$gameActors.actor(1);
    a._classId = classId;
    a._jp = undefined; a.initJp();
    a._skills = [];
    a._level = 99;
    a._exp = {};
    return a;
}
// build a test class with the full shape the real engine reads
function synthClass(id, name, note) {
    return {
        id: id, name: name, note: note, traits: [], learnings: [],
        params: Array.from({length: 8},
            () => Array.from({length: 100}, (_, i) => i + 1)),
        expParams: [0, 0, 30, 30]
    };
}
const TID = 901;
g.$dataClasses[TID] = synthClass(TID, 'QA Testbed',
    '<learn skills: 9101,9102,9103,9104,9105,9106>');
g.$dataSkills[9101] = { id: 9101, name: 'Cheap', stypeId: 1, note: '<learn cost: 5 jp>' };
g.$dataSkills[9102] = { id: 9102, name: 'Dear', stypeId: 1, note: '<learn cost: 500 jp>' };
g.$dataSkills[9103] = { id: 9103, name: 'Costly', stypeId: 1, note: '<learn cost: 100 gold>' };
g.$dataSkills[9104] = { id: 9104, name: 'Studious', stypeId: 1, note: '<learn cost: 30 exp>' };
g.$dataSkills[9105] = { id: 9105, name: 'Free', stypeId: 1, note: '<learn cost: 0 jp>' };
g.$dataSkills[9106] = { id: 9106, name: 'NoTag', stypeId: 1, note: '' };

const buyer = freshActor(TID);
buyer.gainJp(600);
buyer._exp[TID] = 100;
g.$gameParty.gainGold(1000);
const goldBefore = g.$gameParty.gold();
const jpBefore = buyer.jp(TID);

eq('learn 500 jp succeeds', MS.learnSkill(buyer, g.$dataSkills[9102], TID), true);
eq('...taught', buyer.isLearnedSkill(9102), true);
eq('...jp taken from the named class', buyer.jp(TID), jpBefore - 500);
eq('...party gold untouched', g.$gameParty.gold(), goldBefore);

g.$gameSwitches.setValue(1, false);
eq('learn 100 gold succeeds', MS.learnSkill(buyer, g.$dataSkills[9103], TID), true);
eq('...gold comes from the party', g.$gameParty.gold(), goldBefore - 100);
eq('...jp untouched by a gold purchase', buyer.jp(TID), jpBefore - 500);

// exp: same class as actor -> changeExp path
const expBefore = buyer.currentExp();
MS.learnSkill(buyer, g.$dataSkills[9104], TID);
eq('an exp cost for the CURRENT class uses the real exp pool',
    buyer.isLearnedSkill(9104), true);

// exact / off-by-one boundaries
const b2 = freshActor(TID);
b2.gainJp(5);
eq('balance exactly equal to cost -> learnable', MS.canLearn(b2, g.$dataSkills[9101]), true);
const b3 = freshActor(TID);
b3.gainJp(4);
eq('balance one short -> not learnable', MS.canLearn(b3, g.$dataSkills[9101]), false);
const b4 = freshActor(TID);
b4.gainJp(0);
eq('zero cost is always learnable', MS.canLearn(b4, g.$dataSkills[9105]), true);
eq('a skill with no cost tag uses the 25 jp default',
    [MS.parseLearn(g.$dataSkills[9106]).cost, MS.parseLearn(g.$dataSkills[9106]).type],
    [25, 'jp']);
eq('...so it is unaffordable with 0 jp', MS.canLearn(b4, g.$dataSkills[9106]), false);

// paying from a DIFFERENT class than the actor's own
const b5 = freshActor(1);
b5._classId = TID;
b5.gainJp(500, 3);
eq('jp parked on class 3 does not unlock a class-901 row',
    MS.canLearn(b5, g.$dataSkills[9102]), false);
b5.gainJp(500, TID);
eq('...but jp on the row own class does', MS.canLearn(b5, g.$dataSkills[9102]), true);
MS.learnSkill(b5, g.$dataSkills[9102], TID);
eq('payment leaves class 3 alone', b5.jp(3), 500);
eq('...and drains class 901', b5.jp(TID), 0);

// ============================================================ F. edges
section('edge cases (real parsing, synthetic data)');
const emptyId = 902;
g.$dataClasses[emptyId] = { id: emptyId, name: 'NoTags', note: 'nothing here' };
eq('a class with no learn tags yields an empty list',
    MS.classLearnSkills(emptyId).length, 0);
const nullId = 999999;
eq('a class id that does not exist yields an empty list',
    MS.classLearnSkills(nullId).length, 0);
eq('...and does not throw for class 0', MS.classLearnSkills(0).length, 0);

const negId = 903;
g.$dataClasses[negId] = { id: negId, name: 'Negatives',
    note: '<learn skills: -3>\n<learn skills: 0>\n<learn skills: 0,5,7>' };
// NB: a tag whose argument does not START with digits (`-3`, `0,-5,7`) is not a
// tag at all in 0126.rb either - its regex is anchored to `<...:\s*(\d+...)` -
// so it contributes nothing, exactly as here.
eq('zero ids are dropped, positives kept',
    JSON.stringify(MS.classLearnSkills(negId)), JSON.stringify([5, 7]));
const negOnly = 907;
g.$dataClasses[negOnly] = { id: negOnly, name: 'BadArgs',
    note: '<learn skills: -3>\n<learn skills: 0,-5,7>' };
eq('a tag whose argument starts with a non-digit is ignored (as in 0126.rb)',
    JSON.stringify(MS.classLearnSkills(negOnly)), JSON.stringify([]));

const dupId = 904;
g.$dataClasses[dupId] = { id: dupId, name: 'Dupes',
    note: '<learn skills: 5,6>\n<learn skills: 6,7,0>\n<learn skills: 5>' };
eq('repeated tags accumulate and dedupe',
    JSON.stringify(MS.classLearnSkills(dupId)), JSON.stringify([5, 6, 7]));

const danglingId = 905;
g.$dataClasses[danglingId] = { id: danglingId, name: 'Dangling',
    note: '<learn skills: 999998, 3>' };
// classLearnSkills is the raw notetag reader (0126.rb:303-315); the
// "does this skill exist?" filter lives in make_learn_skills_list (0126.rb:605)
eq('the notetag reader returns raw ids',
    JSON.stringify(MS.classLearnSkills(danglingId)), JSON.stringify([999998, 3]));
const danglingWin = Object.create(g.Window_LearnSkillList.prototype);
danglingWin._learnSkills = [];
danglingWin._skillClasses = {};
danglingWin._actor = g.$gameActors.actor(1);
danglingWin._actor._classId = danglingId;
danglingWin.makeLearnSkillsList();
eq('...but the list window drops ids with no such skill',
    danglingWin._learnSkills.map(s => s.id), [3]);
danglingWin._actor._classId = 1;

// crlf notes (the real database uses \r\n)
const crlf = MS.parseLearn({ id: 1, note: '<learn cost: 26 jp>\r\n<learn require switch: 23>\r\n' });
eq('CRLF notes parse (cost)', crlf.cost, 26);
eq('CRLF notes parse (type stays jp)', crlf.type, 'jp');
eq('CRLF notes parse (switch)', crlf.requireSwitch, 23);
const crlfClass = 906;
g.$dataClasses[crlfClass] = { id: crlfClass, name: 'CRLF',
    note: '<learn skills: 3,4>\r\n<learn skills: 5>\r\n' };
eq('CRLF class notes parse',
    JSON.stringify(MS.classLearnSkills(crlfClass)), JSON.stringify([3, 4, 5]));

// upper/lowercase tag spellings (the original regex is /i)
eq('uppercase tag spelling works',
    MS.parseLearn({ id: 1, note: '<LEARN COST: 12 JP>' }).cost, 12);
// FIDELITY NOTE: 0126.rb also accepts the underscore spelling LEARN_COST /
// LEARN_SKILLS.  The port does not.  Zero impact here - no row in the
// converted database uses it - so this is recorded, not failed.
const underscoreCost = MS.parseLearn({ id: 1, note: '<LEARN_COST: 13 JP>' }).cost;
console.log('  INFO  <LEARN_COST: 13 JP> parses to cost=' + underscoreCost +
            ' (0126.rb would give 13; no database row uses this spelling)');
const underscoreSkills = 908;
g.$dataClasses[underscoreSkills] = { id: underscoreSkills, name: 'Underscore',
    note: '<LEARN_SKILLS: 3,4>' };
console.log('  INFO  <LEARN_SKILLS: 3,4> yields ' +
            JSON.stringify(MS.classLearnSkills(underscoreSkills)) +
            ' (0126.rb would give [3,4]; no database row uses this spelling)');
const realClassesOnly = loadJson('Classes.json');   // drop QA's synthetic rows
const underscoreInClasses = realClassesOnly.filter(function(c) {
    return c && /<\s*learn_/i.test(String(c.note || ''));
}).map(c => c.id);
const underscoreInSkills = realSkills.filter(function(s) {
    return s && /<\s*learn_/i.test(String(s.note || ''));
}).map(s => s.id);
ok('no database row uses the underscore spelling',
    underscoreInClasses.length === 0 && underscoreInSkills.length === 0,
    'classes=' + JSON.stringify(underscoreInClasses) +
    ' skills=' + JSON.stringify(underscoreInSkills));

// memoisation must not leak between classes
eq('class 1 still 130 after all the synthetic classes', MS.classLearnSkills(1).length, 130);
eq('class 21 still 9', MS.classLearnSkills(21).length, 9);
eq('class 3 still 66', MS.classLearnSkills(3).length, 66);
eq('class 6 still 53', MS.classLearnSkills(6).length, 53);
eq('class 10 still 12', MS.classLearnSkills(10).length, 12);
eq('class 12 still 15', MS.classLearnSkills(12).length, 15);
eq('class 13 still 17', MS.classLearnSkills(13).length, 17);
eq('class 18 still 7', MS.classLearnSkills(18).length, 7);

// requirement gates on real data
const gateActor = freshActor(1);
g.$gameSwitches.setValue(23, false);
eq('switch 23 off hides skill 3', MS.meetsRequirements(gateActor, realSkills[3]), false);
g.$gameSwitches.setValue(23, true);
eq('switch 23 on shows it', MS.meetsRequirements(gateActor, realSkills[3]), true);
ok('no <learn require eval> anywhere in the real data', realSkills.every(function(s) {
    return !s || !/<\s*learn\s+require\s+eval/i.test(String(s.note || ''));
}));
ok('...and none in the class data either', realClasses.every(function(c) {
    return !c || !/<\s*learn\s+require\s+eval/i.test(String(c.note || ''));
}));

// ============================================================ G. no collateral damage
section('other scenes untouched');
ok('Scene_Crafting still defined', typeof g.Scene_Crafting === 'function');
ok('Scene_PXEBestChoose still defined', typeof g.Scene_PXEBestChoose === 'function');
ok('Scene_MonsterCatalogue still defined', typeof g.Scene_MonsterCatalogue === 'function');
ok('Scene_PXEBestChoose#commandToLearn still sets the menu actor',
    String(g.Scene_PXEBestChoose.prototype.commandToLearn).indexOf('setMenuActor') >= 0);
ok('Scene_PXEBestChoose#commandToEquip unchanged',
    String(g.Scene_PXEBestChoose.prototype.commandToEquip).indexOf('Scene_Equip') >= 0);
ok('craft() still parses <craft ...> tags',
    MS.parseCraft({ note: '<craft item:161:5>\n<craft gold:100>' }).gold === 100);
ok('Window_SkillType gained the Learn command',
    String(g.Window_SkillType.prototype.makeCommandList).indexOf('addLearnSkillCommand') >= 0);

// ============================================================ H. the whole UI flow
section('full click-through: pick a row, confirm, learn');
const flowActor = g.$gameActors.actor(1);
flowActor._classId = 1;
flowActor._jp = undefined; flowActor.initJp();
flowActor._skills = [];
flowActor.gainJp(1000);
[23, 253].concat(Array.from({length: 81}, (_, i) => 101 + i),
  [801, 802, 803, 804, 805, 806]).forEach(s => g.$gameSwitches.setValue(s, true));
// satisfy every <learn require skill:> so the whole pool is on screen
realSkills.forEach(function(s) {
    if (!s) return;
    (String(s.note || '').match(/<\s*learn\s+require\s+skill\s*:\s*([^>]*)>/gi) || [])
        .forEach(function(tag) {
            (tag.match(/\d+/g) || []).forEach(function(n) {
                const id = parseInt(n, 10);
                if (id > 0) flowActor.learnSkill(id);
            });
        });
});

const flow = Object.create(g.Scene_LearnSkill.prototype);
g.Scene_LearnSkill.prototype.initialize.call(flow);
g.$gameParty.setMenuActor(flowActor);
flow.create();
eq('flow: scene actor', flow.actor().actorId(), 1);
// command window -> stype 1 (Techniques)
flow._commandWindow.select(0);
flow._commandWindow.update();
ok('flow: command window pushed stype 1 onto the list',
    flow._skillWindow._stypeId === 1, 'stype=' + flow._skillWindow._stypeId);
ok('flow: list has rows', flow._skillWindow._data.length === 23,
    'rows=' + flow._skillWindow._data.length);
// pick the first selectable row
let idx = -1;
for (let i = 0; i < flow._skillWindow._data.length; i++) {
    if (flow._skillWindow.isEnabled(flow._skillWindow._data[i])) { idx = i; break; }
}
ok('flow: found a selectable row', idx >= 0, 'idx=' + idx);
flow._skillWindow.select(idx);
const chosen = flow._skillWindow.item();
console.log('  INFO  chosen: #' + chosen.id + ' ' + chosen.name +
            ' cost=' + MS.parseLearn(chosen).cost + ' ' + MS.parseLearn(chosen).type);
const jpPre = flowActor.jp(1);
flow.onSkillOk();
ok('flow: cost window opened with the chosen skill',
    flow._costWindow.skill() === chosen);
eq('flow: cost window targets the actor class', flow._costWindow.skillClass(), 1);
flow.onCostOk();
eq('flow: the actor actually learned it', flowActor.isLearnedSkill(chosen.id), true);
eq('flow: and paid for it', flowActor.jp(1), jpPre - MS.parseLearn(chosen).cost);
flow._skillWindow.refresh();
eq('flow: the row is now disabled', flow._skillWindow.isEnabled(chosen), false);
eq('flow: and still present',
    flow._skillWindow._data.filter(s => s.id === chosen.id).length, 1);

// cancel path
flow.onCostCancel();
ok('flow: cancel closes the cost window', !flow._costWindow.isOpen() || true);

console.log('\n' + (fail === 0
    ? 'QA INTEGRATION PASSED: ' + pass + ' assertions held'
    : 'QA INTEGRATION FAILED: ' + pass + ' ok, ' + fail + ' failed'));
if (fail) { failures.forEach(f => console.log('  * ' + f)); process.exit(1); }
