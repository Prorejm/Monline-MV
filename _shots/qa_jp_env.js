//=============================================================================
// QA / Edward - REAL-engine harness for the JP port.
//
// Deliberately NOT the stub harness used by unit_check.js: this one loads the
// project's actual rpg_objects.js and rpg_managers.js, the actual data files
// and the actual plugins in the actual plugins.js order, so that a passing
// assertion means "the real BattleManager really paid JP", not "a stub did".
//
//   const env = require('./qa_jp_env').build({ jpTransform: fn });
//
// jpTransform (optional) rewrites the *text* of MonlineJp.js before it is
// evaluated - that is how the mutation tests flip a constant without ever
// touching the file on disk.
//=============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'G:/新建文件夹 (22)/Monline_MV/Monline-MV';
const JS = path.join(ROOT, 'js');
const DATA = path.join(ROOT, 'data');
const PLUGINS = path.join(JS, 'plugins');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function readJson(p) { return JSON.parse(read(p)); }

function noop(name, log) {
    const fn = function() { if (log) log.push(name); return undefined; };
    return fn;
}

/**
 * Everything the engine only touches for pixels / sound / scenes.  None of it
 * is on the JP path; it exists purely so the real files can be evaluated.
 */
function installBrowserStubs(g) {
    g.window = g;
    g.navigator = { userAgent: 'node', language: 'ja-JP',
                    maxTouchPoints: 0, hardwareConcurrency: 1 };
    g.document = {
        createElement: function() { return fakeCanvas(); },
        addEventListener: function() {},
        body: { appendChild: function() {} },
        documentElement: { style: {} },
        currentScript: { src: '' },
        getElementById: function() { return null; },
        querySelector: function() { return null; },
        head: { appendChild: function() {} }
    };
    g.location = { href: 'file:///game/index.html', search: '' };
    g.performance = { now: function() { return Date.now(); } };
    g.requestAnimationFrame = function() { return 0; };
    g.localStorage = {
        _d: {},
        getItem: function(k) { return this._d[k] === undefined ? null : this._d[k]; },
        setItem: function(k, v) { this._d[k] = String(v); },
        removeItem: function(k) { delete this._d[k]; },
        clear: function() {}
    };
    g.alert = function() {};
    g.console = console;

    // --- audio / input / resource managers: silent no-ops
    g.AudioManager = {
        playSe: noop('se'), playMe: noop('me'), playBgm: noop('bgm'),
        playBgs: noop('bgs'), replayBgmAndBgs: noop('replay'),
        stopAll: noop('stopAll'), playVictory: noop('victoryAudio'),
        saveBgm: noop('saveBgm'), replayBgm: noop('replayBgm'), replayBgs: noop('r')
    };
    g.SoundManager = { playUseItem: noop('useItem'), playEquip: noop('equip'),
                       playEscape: noop('escape'), playActorCollapse: noop('ac'),
                       playEnemyCollapse: noop('ec'), playCursor: noop('c'),
                       playOk: noop('ok'), playCancel: noop('cancel'),
                       playBuzzer: noop('buzzer'), playSave: noop('save'),
                       playLoad: noop('load'), playSystemSound: noop('sys'),
                       preloadImportantSounds: noop('pre') };
    g.Input = { update: noop('i'), isPressed: function() { return false; },
                isTriggered: function() { return false; },
                isRepeated: function() { return false; },
                isLongPressed: function() { return false; },
                dir4: function() { return 0; }, clear: noop('clear') };
    g.TouchInput = { update: noop('t'), isTriggered: function() { return false; },
                     isPressed: function() { return false; }, x: 0, y: 0 };
    g.Graphics = { width: 816, height: 624, frameCount: 0, boxWidth: 816,
                   boxHeight: 624, isWebGL: function() { return false; },
                   _errorPrinter: null, _errorShowed: false };
    g.ImageManager = {};
    ['loadBitmap', 'loadSystem', 'loadEnemy', 'loadCharacter', 'loadFace',
     'loadActor', 'loadAnimation', 'loadBattleback1', 'loadBattleback2',
     'loadParallax', 'loadPicture', 'loadSvActor', 'loadSvEnemy',
     'loadTitle1', 'loadTitle2', 'reserveAnimation'].forEach(function(k) {
        g.ImageManager[k] = function() { return g.Bitmap ? new g.Bitmap() : null; };
    });
    g.SceneManager = {
        _scene: null, _nextScene: null, _stack: [],
        goto: noop('goto'), push: noop('push'), pop: noop('pop'),
        isSceneChanging: function() { return false; },
        isCurrentSceneBusy: function() { return false; },
        isNextScene: function() { return false; },
        snap: noop('snap'), snapForBackground: noop('snapbg'),
        backgroundBitmap: function() { return null; },
        _updateScene: noop('u')
    };
    g.StorageManager = { save: noop('s'), load: noop('l'), exists: function() { return false; } };
    g.PluginManager = { _scripts: [], loadScript: function(n) { this._scripts.push(n); },
                        parameters: function() { return {}; },
                        setParameters: noop('sp'), checkErrors: noop('ce') };
    g.WebAudio = { initialize: function() { return false; },
                   _autoInitialize: false, _initialized: false };
    g.Decrypter = { checkImgIgnore: noop('ci'), hasEncryptedImages: false,
                    decryptImg: noop('di'), _ignoreList: [] };
    g.JsonEx = { _maxDepth: 100,
                 stringify: function(o) { return JSON.stringify(o); },
                 parse: function(s) { return JSON.parse(s); },
                 makeDeepCopy: function(o) { return JSON.parse(JSON.stringify(o)); } };
    g.Utils = { isOptionValid: function() { return true; },
                isNwjs: function() { return false; },
                isMobileDevice: function() { return false; },
                canPlayOgg: function() { return true; },
                canPlayWebm: function() { return true; },
                canUseWebGL: function() { return false; },
                canUseCanvas: function() { return true; },
                rgbToCssColor: function() { return '#000'; },
                checkRMVersion: function() { return true; } };

    function fakeCanvas() {
        return {
            width: 0, height: 0, style: {},
            getContext: function() { return fakeCtx(); },
            addEventListener: function() {}, removeEventListener: function() {},
            toDataURL: function() { return ''; }
        };
    }
    function fakeCtx() {
        return new Proxy({}, {
            get: function(t, k) {
                if (k === 'canvas') { return { width: 0, height: 0 }; }
                if (k === 'getImageData') {
                    return function(x, y, w, h) {
                        return { data: new Uint8ClampedArray(Math.max(w * h * 4, 4)),
                                 width: w, height: h };
                    };
                }
                if (k === 'measureText') { return function() { return { width: 0 }; }; }
                return function() { return undefined; };
            },
            set: function() { return true; }
        });
    }
    // rpg_core.js normally provides this (rpg_managers.js:793 does
    // `ImageManager.cache = new CacheMap(ImageManager)` at load time).
    g.CacheMap = function CacheMap(manager) {
        this.manager = manager;
        this._inner = {};
    };
    g.CacheMap.prototype.setItem = function(k, v) { this._inner[k] = v; return v; };
    g.CacheMap.prototype.getItem = function(k) { return this._inner[k]; };
    g.CacheMap.prototype.add = function(k) { return this.getItem(k); };
    g.CacheMap.prototype.get = function(k) { return this.getItem(k); };
    g.CacheMap.prototype.reserve = function(k) { return this.getItem(k); };
    g.CacheMap.prototype.release = function() {};
    g.CacheMap.prototype.clear = function() { this._inner = {}; };
    g.CacheMap.prototype.isReady = function() { return true; };
    g.CacheMap.prototype.update = function() {};

    g.Bitmap = function Bitmap() { this.initialize.apply(this, arguments); };
    g.Bitmap.prototype.initialize = function() {};
    g.Bitmap.prototype.isReady = function() { return true; };
    g.Bitmap.prototype.width = 0;
    g.Bitmap.prototype.height = 0;
    g.Bitmap.prototype.addLoadListener = function(fn) {
        if (typeof fn === 'function') { fn(this); }
        return this;
    };
    g.Bitmap.prototype.blt = function() {};
    g.Bitmap.prototype.drawText = function() {};
    g.Bitmap.prototype.fillRect = function() {};
    g.Bitmap.prototype.clear = function() {};
    g.Bitmap.prototype.textSize = function() { return { width: 0, height: 0 }; };
    g.Bitmap.prototype.measureTextWidth = function() { return 0; };
    g.Bitmap.load = function() { return new g.Bitmap(); };
    g.Bitmap.snap = function() { return new g.Bitmap(); };
    g.Bitmap.prototype.checkDirty = function() {};
    g.Bitmap.prototype.update = function() {};
    ['rotateHue', 'adjustTone', 'blur', 'clearRect', 'drawCircle', 'fillAll',
     'gradientFillRect', 'resize', 'setDirty'
    ].forEach(function(m) { g.Bitmap.prototype[m] = function() {}; });

    // --- scene / window base classes MonlineScenes.js inherits from.  Only
    // their prototype objects are needed at load time; nothing on the JP path
    // ever runs them.
    function base(name, parent) {
        const C = function() { this.initialize.apply(this, arguments); };
        C.name = name;
        C.prototype = parent ? Object.create(parent.prototype) : {};
        C.prototype.constructor = C;
        C.prototype.initialize = function() {};
        return C;
    }
    g.PIXI = { Container: base('Container'), Sprite: base('Sprite'),
               Point: function(x, y) { this.x = x; this.y = y; },
               Rectangle: function(x, y, w, h) { this.x = x; this.y = y;
                                                 this.width = w; this.height = h; },
               Graphics: base('Graphics'),
               filters: {} };
    g.Stage = base('Stage');
    g.Sprite = base('Sprite');
    g.ScreenSprite = base('ScreenSprite');
    g.TilingSprite = base('TilingSprite');
    g.Window = base('Window');
    g.Window_Base = base('Window_Base', g.Window);
    g.Window_Selectable = base('Window_Selectable', g.Window_Base);
    g.Window_Command = base('Window_Command', g.Window_Selectable);
    g.Window_ItemList = base('Window_ItemList', g.Window_Selectable);
    g.Window_SkillList = base('Window_SkillList', g.Window_Selectable);
    g.Scene_Base = base('Scene_Base', g.Stage);
    g.Scene_MenuBase = base('Scene_MenuBase', g.Scene_Base);
    g.Scene_ItemBase = base('Scene_ItemBase', g.Scene_MenuBase);
    ['addChild', 'removeChild', 'setFrame', 'refresh', 'activate', 'deactivate',
     'update', 'select', 'drawText', 'drawTextEx', 'contents', 'resetFontSettings',
     'isOpenAndActive', 'close', 'open', 'show', 'hide', 'move', 'setHandler',
     'drawItem', 'callHandler', 'callOkHandler', 'processHandling', 'setTopRow',
     'setBottomRow', 'topRow', 'maxTopRow', 'itemHeight', 'maxItems', 'index',
     'cursorUp', 'cursorDown', 'playOkSound', 'updateHelp', 'isCursorMovable',
     'forceSelect', 'setHelpWindowItem', 'clearCommandList', 'makeCommandList',
     'addCommand', 'drawIcon', 'changeTextColor', 'resetTextColor',
     'drawActorName', 'drawTextEx', 'itemRect', 'itemRectForText', 'lineHeight',
     'contentsWidth', 'contentsHeight', 'textWidth', 'changePaintOpacity',
     'drawCurrencyValue', 'drawCost', 'isEnabled', 'currentExt',
     'setStatusType', 'setCategory', 'drawHorzLine', 'drawDarkRect'].forEach(
        function(m) {
            [g.Window_Base, g.Window_Selectable, g.Window_Command,
             g.Window_ItemList, g.Window_SkillList].forEach(function(C) {
                if (!C.prototype[m]) { C.prototype[m] = function() {}; }
            });
        });
    g.TextManager = new Proxy({}, {
        get: function(t, k) {
            if (typeof k === 'string' && /^[a-z]/.test(k)) { return String(k); }
            return function() { return String(k); };
        }
    });
}

/**
 * @param {object} opts
 *   opts.jpTransform   (string)=>string  rewrite MonlineJp.js text (mutations)
 *   opts.pluginOrder   array of plugin file names to load (default: shim,
 *                      scenes, jp - the tail of plugins.js in real order)
 * @return {object} the vm sandbox / global object
 */
function build(opts) {
    opts = opts || {};
    // both copies of the project have to behave identically, so the suite can
    // be pointed at either one
    const root = opts.root || ROOT;
    const js = path.join(root, 'js');
    const data = path.join(root, 'data');
    const plugins = path.join(js, 'plugins');
    const g = {};
    vm.createContext(g);
    installBrowserStubs(g);

    const log = [];
    g.__qaLog = log;

    // ---- 1a. the PIXI-free head of the REAL rpg_core.js (JsExtensions,
    // Utils, CacheEntry, CacheMap, ImageCache, RequestQueue).  Taken from the
    // project file rather than stubbed so rpg_managers.js sees the same
    // classes it sees in the browser.
    const coreLines = read(path.join(js, 'rpg_core.js')).split(/\r?\n/);
    // ...plus ResourceHandler at the tail, which MonlineAssetGuard.js reaches
    // for at load time.  Everything in between needs PIXI and is skipped.
    const coreHead = coreLines.slice(11, 620).join('\n') + '\n' +
                     coreLines.slice(9274).join('\n');
    vm.runInContext(coreHead, g, { filename: 'rpg_core.js[12..620 + tail]' });

    // ---- 1b. the real engine
    vm.runInContext(read(path.join(js, 'rpg_objects.js')), g,
                    { filename: 'rpg_objects.js' });
    // MonlineScenes.js reaches into real MV windows/scenes at load time, so
    // take them from the project rather than inventing them.
    ['rpg_windows.js', 'rpg_scenes.js', 'rpg_sprites.js'].forEach(function(f) {
        if (fs.existsSync(path.join(js, f))) {
            try {
                vm.runInContext(read(path.join(js, f)), g, { filename: f });
            } catch (e) {
                log.push('WARN could not load ' + f + ': ' + e.message);
            }
        }
    });
    vm.runInContext(read(path.join(js, 'rpg_managers.js')), g,
                    { filename: 'rpg_managers.js' });

    // ---- 2. the real data files
    ['Actors', 'Classes', 'Skills', 'Items', 'Weapons', 'Armors', 'Enemies',
     'States', 'Troops', 'System', 'MapInfos', 'Animations', 'Tilesets',
     'CommonEvents'].forEach(function(n) {
        const p = path.join(data, n + '.json');
        if (fs.existsSync(p)) {
            g['$data' + n] = vm.runInContext('(' + read(p) + ')', g,
                                             { filename: n + '.json' });
        }
    });

    // ---- 3. the plugins, in plugins.js order (shim 4 -> scenes 12 -> jp 13)
    // feed PluginManager the real parameters first: Community_Basic.js:76
    // dereferences parameters['renderingMode'] while it loads.
    const params = {};
    if (fs.existsSync(path.join(js, 'plugins.js'))) {
        const pj = {};
        vm.createContext(pj);
        vm.runInContext(read(path.join(js, 'plugins.js')), pj,
                        { filename: 'plugins.js' });
        (pj.$plugins || []).forEach(function(p) {
            params[p.name] = p.parameters || {};
        });
    }
    g.__pluginParams = params;
    g.PluginManager.parameters = function(name) { return params[name] || {}; };

    const order = opts.pluginOrder ||
        ['MonlineShim.js', 'MonlineScenes.js', 'MonlineJp.js'];
    order.forEach(function(name) {
        let src = read(path.join(plugins, name));
        if (name === 'MonlineJp.js' && opts.jpTransform) {
            src = opts.jpTransform(src);
        }
        vm.runInContext(src, g, { filename: name });
    });

    // ---- 3b. AudioManager / SoundManager live in rpg_managers.js, so they
    // overwrote the stubs.  Silence every function on them (recording the
    // name so the log still shows they were reached) - none of it is on the
    // JP path, and it keeps the real BattleManager flow intact instead of
    // short-circuiting the methods that call it.
    ['AudioManager', 'SoundManager', 'WebAudio'].forEach(function(ns) {
        const obj = g[ns];
        if (!obj) { return; }
        Object.keys(obj).forEach(function(k) {
            if (typeof obj[k] === 'function') {
                obj[k] = function() { log.push(ns + '.' + k); };
            }
        });
    });

    // ---- 4. globals the engine normally gets from Scene_Boot
    g.$gameTemp = new g.Game_Temp();
    g.$gameSystem = new g.Game_System();
    g.$gameScreen = new g.Game_Screen();
    g.$gameMessage = new g.Game_Message();
    g.$gameSwitches = new g.Game_Switches();
    g.$gameVariables = new g.Game_Variables();
    g.$gameSelfSwitches = new g.Game_SelfSwitches();
    g.$gameActors = new g.Game_Actors();
    g.$gameParty = new g.Game_Party();
    g.$gameTroop = new g.Game_Troop();
    g.$gameMap = new g.Game_Map();
    g.$gamePlayer = new g.Game_Player();

    return g;
}

/**
 * Build a value INSIDE the vm context.
 * MV adds Array#contains / #clone / #equals to the *context's* Array.prototype
 * (rpg_core.js:70-131); an array made out here in the node realm does not have
 * them, which makes Game_Actor#isBattleMember blow up.  Anything handed to the
 * engine therefore has to be born in there.
 */
function inContext(g, literal) {
    return vm.runInContext('(' + literal + ')', g);
}

/** Put exactly these actor ids in the party (battle order = array order). */
function setParty(g, ids) {
    const idArray = inContext(g, JSON.stringify(ids));
    g.$gameParty._actors = idArray;
    ids.forEach(function(id) { g.$gameActors.actor(id); });
    return ids.map(function(id) { return g.$gameActors.actor(id); });
}

/** Build a synthetic troop out of the given enemy ids and put it in play. */
function setTroop(g, enemyIds) {
    const tid = 90000;
    const members = enemyIds.map(function(id) {
        return { enemyId: id, x: 100, y: 100, hidden: false };
    });
    g.$dataTroops[tid] = inContext(g, JSON.stringify({
        id: tid, name: 'QA troop', pages: [], members: members
    }));
    g.$gameTroop.setup(tid);
    return g.$gameTroop;
}

/** Kill an enemy the way MV does: death state applied, still on the field. */
function kill(g, enemy) {
    enemy.appear();
    enemy.addState(enemy.deathStateId());
    return enemy;
}

/** Total JP an actor holds on its current class. */
function jpOf(actor) {
    return actor.jp();
}

module.exports = {
    build: build,
    inContext: inContext,
    setParty: setParty,
    setTroop: setTroop,
    kill: kill,
    jpOf: jpOf,
    read: read,
    ROOT: ROOT,
    JS: JS,
    DATA: DATA,
    PLUGINS: PLUGINS
};
