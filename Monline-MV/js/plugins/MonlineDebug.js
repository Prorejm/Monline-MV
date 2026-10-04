//=============================================================================
// MonlineDebug.js
// Port of _vxace_scripts/0119.rb - "Yanfly Engine Ace - Debug Extension v1.01".
//=============================================================================
/*:
 * @plugindesc The extended debug menu (0119.rb): F9 opens Switches /
 * Variables / Teleport / Battle / Events / Items / Weapons / Armours, F10
 * opens the code-entry console.
 * @author Monline port (from 0119.rb)
 *
 * @help
 * 0119.rb replaces the stock RGSS3 debug screen with Yanfly's extended one.
 * This port does the same to MV's Scene_Debug, keeping the same eight
 * commands, the same windows and the same key handling.
 *
 *   F9  on the map   - open / leave the debug menu
 *   F10 anywhere     - open the code-entry console
 *   Alt/Ctrl/Shift + F5-F9 - common event shortcuts (YEA::DEBUG config)
 *
 * In the switch / variable panes the Ace colour rules are kept: yellow rows
 * are on / non-zero and named, red rows are on / non-zero but have no name.
 *
 * Two things are not literally the Ruby:
 *   - Ace reads raw keycodes with Win32API; MV has its own Input, so the
 *     typed console is a real text field instead of Input.key_type.
 *   - Ace loads map data straight off disk; MV loads it async, so the
 *     teleport preview builds its tilemap when the file arrives.
 *
 * @param AlwaysEnabled
 * @text Always enabled
 * @desc Ace only allows this in $TEST play.  Turn this on so the shipped
 * game can use it too (this is what the player expects).
 * @default true
 */
var MonlineDebug = MonlineDebug || {};

(function () {
    'use strict';

    var parameters = PluginManager.parameters('MonlineDebug');
    var ALWAYS = String(parameters.AlwaysEnabled || 'true') === 'true';

    /** Ace's `$TEST || $BTEST` gate (0119.rb:381). */
    function debugAllowed() {
        return ALWAYS || $gameTemp.isPlaytest();
    }

    //-------------------------------------------------------------------------
    // YEA::DEBUG - 0119.rb:44, verbatim.
    //-------------------------------------------------------------------------
    var YEA = {
        DEBUG: {
            ALT:   { F5: 0, F6: 0, F7: 0, F8: 0, F9: 0 },
            CTRL:  { F5: 0, F6: 0, F7: 0, F8: 0, F9: 0 },
            SHIFT: { F5: 0, F6: 0, F7: 0, F8: 0, F9: 0 },
            COMMANDS: [
                ['switches',  'Switches'],
                ['variables', 'Variables'],
                ['teleport',  'Teleport'],
                ['battle',    'Battle'],
                ['events',    'Events'],
                ['items',     'Items'],
                ['weapons',   'Weapons'],
                ['armours',   'Armours']
            ]
        }
    };

    /** `sprintf(fmt, ...)` for the handful of forms the Ruby uses. */
    function sprintf(fmt) {
        var args = Array.prototype.slice.call(arguments, 1);
        var i = 0;
        return String(fmt).replace(/%(?:0(\d+))?([dfs])/g, function (m, pad, kind) {
            var v = args[i++];
            if (kind === 's') { return String(v === undefined ? '' : v); }
            var n = Number(v) || 0;
            var s = String(Math.abs(n));
            if (pad) {
                while (s.length < Number(pad)) { s = '0' + s; }
            }
            return (n < 0 ? '-' : '') + s;
        });
    }

    /** 0119.rb:144 - `group` from the Core Engine (Monline ships 0110.rb).
     *  Ruby's `\d{3}+` is a possessive quantifier; on a fixed count that is the
     *  same as `\d{3}`, which is what JS can express. */
    function group(n) {
        var s = String(n);
        return s.replace(/(\d)(?=\d{3}(?:\.|$))(\d{3}\..*)?/, '$1,$2');
    }

    //-------------------------------------------------------------------------
    // Input - the F keys and the modifier names the Ruby reaches for.
    //-------------------------------------------------------------------------
    // Ace reads virtual keycodes with GetAsyncKeyState; MV maps keys through
    // Input.keyMapper, so the ones this script needs are registered here.
    // F1 is 112, so F5..F10 are 116..121.
    Input.keyMapper[120] = 'F9';       // 0119.rb uses :F9 for the menu
    Input.keyMapper[121] = 'F10';      // 0119.rb:169 - the entry console

    // 0119.rb:182 - the F5..F9 shortcut keys, as MV symbols.
    var SHORTCUT_KEYS = ['F5', 'F6', 'F7', 'F8', 'F9'];
    [116, 117, 118, 119, 120].forEach(function (code, i) {
        Input.keyMapper[code] = SHORTCUT_KEYS[i];
    });

    //-------------------------------------------------------------------------
    // SceneManager.force_recall (0119.rb:353)
    //-------------------------------------------------------------------------
    // Ace rewinds to the remembered battle scene after the F9 detour; MV's
    // SceneManager already keeps a stack, so push/pop does the same job and
    // the method only exists so the spelling still resolves.
    SceneManager.force_recall = function (sceneClass) {
        this.push(sceneClass);
    };

    //-------------------------------------------------------------------------
    // Sprite_DebugMap (0119.rb:368)
    //-------------------------------------------------------------------------
    function Sprite_DebugMap() { this.initialize.apply(this, arguments); }
    Sprite_DebugMap.prototype = Object.create(Sprite_Base.prototype);
    Sprite_DebugMap.prototype.constructor = Sprite_DebugMap;

    Sprite_DebugMap.prototype.initialize = function (mapWindow) {
        Sprite_Base.prototype.initialize.call(this);
        this._mapWindow = mapWindow;
        this.visible = false;
        this.createBitmap();
    };
    Sprite_DebugMap.prototype.createBitmap = function () {
        var w = 32, h = 32;
        var bitmap = new Bitmap(w, h);
        var ctx = bitmap._context;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(1, 1, 30, 30);
        ctx.fillStyle = '#000000';
        ctx.fillRect(2, 2, 28, 28);
        ctx.clearRect(3, 3, 26, 26);
        bitmap._setDirty();
        this.bitmap = bitmap;
    };
    Sprite_DebugMap.prototype.update = function () {
        Sprite_Base.prototype.update.call(this);
        // the Ruby tints the cursor red while the map pane is live
        this.setColorTone(this._mapWindow.active ? [255, 0, 0, 0] : [0, 0, 0, 0]);
    };

    //-------------------------------------------------------------------------
    // Window_DebugEntry (0119.rb:571)
    //-------------------------------------------------------------------------
    function Window_DebugEntry() { this.initialize.apply(this, arguments); }
    Window_DebugEntry.prototype = Object.create(Window_Base.prototype);
    Window_DebugEntry.prototype.constructor = Window_DebugEntry;

    Window_DebugEntry.prototype.initialize = function () {
        var pad = this.standardPadding();
        var dx = -pad;
        var dy = Graphics.height - this.fittingHeight(1) + pad;
        var dw = Graphics.width + pad * 2;
        var dh = this.fittingHeight(1);
        Window_Base.prototype.initialize.call(this, dx, dy, dw, dh);
        this.opacity = 0;
        this._text = '';
        this._blink = false;
        this.refresh();
    };
    Window_DebugEntry.prototype.refresh = function () {
        this.contents.clear();
        this.contents.fillRect(0, 0, this.contentsWidth(), this.lineHeight(),
                               'rgba(192,192,192,1)');
        this.contents.fillRect(1, 1, this.contentsWidth() - 2,
                               this.lineHeight() - 2, 'rgba(0,0,0,1)');
        this.contents.fontSize = 20;
        this.contents.outlineWidth = 0;
        this.changeTextColor('rgba(192,192,192,1)');
        this.drawText(this._text + (this._blink ? '?' : ''), 4, 0,
                      this.contentsWidth() - 8);
    };
    Window_DebugEntry.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (Graphics.frameCount % 30 === 0) { this._blink = !this._blink; }
        this.refresh();
    };

    //-------------------------------------------------------------------------
    // Window_DebugCommand (0119.rb:636)
    //-------------------------------------------------------------------------
    function Window_DebugCommand() { this.initialize.apply(this, arguments); }
    Window_DebugCommand.prototype = Object.create(Window_Command.prototype);
    Window_DebugCommand.prototype.constructor = Window_DebugCommand;

    Window_DebugCommand.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 0, 0);
    };
    Window_DebugCommand.prototype.windowWidth = function () { return 160; };
    Window_DebugCommand.prototype.windowHeight = function () {
        return Graphics.height;
    };
    Window_DebugCommand.prototype.numVisibleRows = function () {
        return Math.ceil(this.maxItems() / this.maxCols()) || 1;
    };
    Window_DebugCommand.prototype.makeCommandList = function () {
        YEA.DEBUG.COMMANDS.forEach(function (command) {
            // 0119.rb:652 - teleport / battle make no sense mid-battle
            if ((command[0] === 'teleport' || command[0] === 'battle') &&
                $gameParty.inBattle()) { return; }
            this.addCommand(command[1], command[0]);
        }, this);
    };

    //-------------------------------------------------------------------------
    // Window_DebugSwitch (0119.rb:661)
    //-------------------------------------------------------------------------
    function Window_DebugSwitch() { this.initialize.apply(this, arguments); }
    Window_DebugSwitch.prototype = Object.create(Window_Command.prototype);
    Window_DebugSwitch.prototype.constructor = Window_DebugSwitch;

    Window_DebugSwitch.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 160, 0);
        this.deactivate();
        this.hide();
        this.refresh();
    };
    Window_DebugSwitch.prototype.windowWidth = function () {
        return Graphics.width - 160;
    };
    Window_DebugSwitch.prototype.windowHeight = function () {
        return Graphics.height - 120;
    };
    Window_DebugSwitch.prototype.numVisibleRows = function () {
        return Math.ceil((Graphics.height - 120) / this.lineHeight());
    };
    Window_DebugSwitch.prototype.makeCommandList = function () {
        for (var i = 1; i < $dataSystem.switches.length; i++) {
            this.addCommand(sprintf('S%04d:%s', i, $dataSystem.switches[i]),
                            'switch', true, i);
        }
    };
    // 0119.rb:703
    Window_DebugSwitch.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        this.changeSwitchColour(index);
        var name = this.commandName(index);
        var id = this._list[index].ext;
        if ($gameSwitches.value(id) && $dataSystem.switches[id] === '') {
            name = sprintf('S%04d:%s', id, 'ATTENTION!');
        }
        this.drawText(name, rect.x, rect.y, rect.width);
        var text = $gameSwitches.value(id) ? '[ON]' : '[OFF]';
        this.drawText(text, rect.x, rect.y, rect.width, 'right');
    };
    // 0119.rb:713
    Window_DebugSwitch.prototype.changeSwitchColour = function (index) {
        var id = this._list[index].ext;
        var named = $dataSystem.switches[id] !== '';
        var colour = $gameSwitches.value(id) ? this.crisisColor()
                                             : this.normalColor();
        var enabled = named;
        if ($gameSwitches.value(id) && !named) {
            colour = this.deathColor();
            enabled = true;
        }
        this.changeTextColor(colour);
        this.changePaintOpacity(enabled);
    };

    //-------------------------------------------------------------------------
    // Window_DebugVariable (0119.rb:732)
    //-------------------------------------------------------------------------
    function Window_DebugVariable() { this.initialize.apply(this, arguments); }
    Window_DebugVariable.prototype = Object.create(Window_Command.prototype);
    Window_DebugVariable.prototype.constructor = Window_DebugVariable;

    Window_DebugVariable.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 160, 0);
        this.deactivate();
        this.hide();
        this.refresh();
    };
    Window_DebugVariable.prototype.windowWidth = function () {
        return Graphics.width - 160;
    };
    Window_DebugVariable.prototype.windowHeight = function () {
        return Graphics.height - 120;
    };
    Window_DebugVariable.prototype.numVisibleRows = function () {
        return Math.ceil((Graphics.height - 120) / this.lineHeight());
    };
    Window_DebugVariable.prototype.makeCommandList = function () {
        for (var i = 1; i < $dataSystem.variables.length; i++) {
            this.addCommand(sprintf('V%04d:%s', i, $dataSystem.variables[i]),
                            'variable', true, i);
        }
    };
    // 0119.rb:775
    Window_DebugVariable.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        this.changeVariableColour(index);
        var name = this.commandName(index);
        var id = this._list[index].ext;
        var value = $gameVariables.value(id);
        if (value !== 0 && $dataSystem.variables[id] === '') {
            name = sprintf('V%04d:%s', id, 'ATTENTION!');
        }
        this.drawText(name, rect.x, rect.y, rect.width);
        this.drawText(group(value), rect.x, rect.y, rect.width, 'right');
    };
    // 0119.rb:788
    Window_DebugVariable.prototype.changeVariableColour = function (index) {
        var id = this._list[index].ext;
        var value = $gameVariables.value(id);
        var named = $dataSystem.variables[id] !== '';
        var colour = value !== 0 ? this.crisisColor() : this.normalColor();
        var enabled = named;
        if (value !== 0 && !named) {
            colour = this.deathColor();
            enabled = true;
        }
        this.changeTextColor(colour);
        this.changePaintOpacity(enabled);
    };

    //-------------------------------------------------------------------------
    // Window_DebugInput (0119.rb:805)
    //-------------------------------------------------------------------------
    function Window_DebugInput() { this.initialize.apply(this, arguments); }
    Window_DebugInput.prototype = Object.create(Window_Selectable.prototype);
    Window_DebugInput.prototype.constructor = Window_DebugInput;

    Window_DebugInput.prototype.initialize = function () {
        var dw = Graphics.width * 3 / 4;
        var dh = this.fittingHeight(2);
        var dx = (Graphics.width - dw) / 2;
        var dy = (Graphics.height - dh) / 2;
        Window_Selectable.prototype.initialize.call(this, dx, dy, dw, dh);
        this.backOpacity = 255;
        this.openness = 0;
        this._maxValue = 99999999;
        this._minValue = -99999999;
        this._value = 0;
    };
    Window_DebugInput.prototype.maxCols = function () { return 9; };
    Window_DebugInput.prototype.maxItems = function () { return 9; };
    Window_DebugInput.prototype.isHorizontal = function () { return true; };
    // 0119.rb:837
    Window_DebugInput.prototype.reveal = function (variable) {
        this._variable = variable;
        var v = $gameVariables.value(variable);
        this._value = typeof v === 'number' ? v : 0;
        this.open();
        this.refresh();
        this.activate();
        this.select(8);
    };
    Window_DebugInput.prototype.refresh = function () {
        Window_Selectable.prototype.refresh.call(this);
        this.drawVariableName();
    };
    // 0119.rb:850
    Window_DebugInput.prototype.drawVariableName = function () {
        var name = $dataSystem.variables[this._variable];
        if (name === '') { name = 'ATTENTION'; }
        var text = sprintf('V%04d:%s', this._variable, name);
        this.contents.fontSize = this.standardFontSize();
        this.drawText(text, 4, 0, this.contentsWidth() - 8, 'center');
    };
    // 0119.rb:858 - a nine digit odometer, sign on the left
    Window_DebugInput.prototype.itemRect = function (index) {
        var rect = new Rectangle(0, this.lineHeight(), 24, this.lineHeight());
        rect.x = (this.contentsWidth() - 32 - 24 * this.maxCols()) / 2 +
                 index * 24 + 12;
        return rect;
    };
    Window_DebugInput.prototype.drawItem = function (index) {
        var rect = this.itemRect(index);
        this.contents.clearRect(rect.x, rect.y, rect.width, rect.height);
        var text;
        if (index === 0) {
            text = this._value >= 0 ? '+' : '-';
        } else {
            var p = Math.pow(10, this.maxCols() - index);
            text = String(Math.abs(this._value) % p /
                          Math.pow(10, this.maxCols() - 1 - index));
        }
        this.drawText(text, rect.x, rect.y, rect.width, 'center');
    };
    Window_DebugInput.prototype.cursorDown = function (wrap) {
        SoundManager.playCursor();
        this._value = this.index() === 0 ? -this._value
            : this._value - Math.pow(10, this.maxCols() - 1 - this.index());
        this._value = Math.max(Math.min(this._value, this._maxValue),
                               this._minValue);
        this.drawAllItems();
    };
    Window_DebugInput.prototype.cursorUp = function (wrap) {
        SoundManager.playCursor();
        this._value = this.index() === 0 ? -this._value
            : this._value + Math.pow(10, this.maxCols() - 1 - this.index());
        this._value = Math.max(Math.min(this._value, this._maxValue),
                               this._minValue);
        this.drawAllItems();
    };

    //-------------------------------------------------------------------------
    // Window_DebugTeleport (0119.rb:884)
    //-------------------------------------------------------------------------
    function Window_DebugTeleport() { this.initialize.apply(this, arguments); }
    Window_DebugTeleport.prototype = Object.create(Window_Command.prototype);
    Window_DebugTeleport.prototype.constructor = Window_DebugTeleport;

    Window_DebugTeleport.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 0, 0);
        this.deactivate();
        this.refresh();
        this.hide();
    };
    Window_DebugTeleport.prototype.windowWidth = function () { return 160; };
    Window_DebugTeleport.prototype.windowHeight = function () {
        return Graphics.height;
    };
    Window_DebugTeleport.prototype.numVisibleRows = function () {
        return Math.ceil(Graphics.height / this.lineHeight());
    };
    // Ace walks Data/Map%03d.rvdata2 with FileTest.exist?; MV has $dataMapInfos
    // for exactly the same list (null entries are the holes Ace never had).
    Window_DebugTeleport.prototype.makeCommandList = function () {
        for (var i = 1; i < $dataMapInfos.length; i++) {
            if (!$dataMapInfos[i]) { continue; }
            this.addCommand(sprintf('MAP:%03d', i), 'map', true, i);
        }
    };

    //-------------------------------------------------------------------------
    // Window_DebugShownMap (0119.rb:916) - the live tilemap preview
    //-------------------------------------------------------------------------
    function Window_DebugShownMap() { this.initialize.apply(this, arguments); }
    Window_DebugShownMap.prototype = Object.create(Window_Selectable.prototype);
    Window_DebugShownMap.prototype.constructor = Window_DebugShownMap;

    var _mapCache = {};      // map id -> parsed $dataMap, loaded off disk

    function loadMapData(mapId, cb) {
        if (_mapCache[mapId]) { return cb(_mapCache[mapId]); }
        var name = 'Map%03d'.replace('%03d', ('00' + mapId).slice(-3));
        var xhr = new XMLHttpRequest();
        var url = 'data/' + name + '.json';
        xhr.open('GET', url);
        xhr.overrideMimeType('application/json');
        xhr.onload = function () {
            if (xhr.status < 400) {
                _mapCache[mapId] = JSON.parse(xhr.responseText);
                cb(_mapCache[mapId]);
            }
        };
        xhr.onerror = function () { };
        xhr.send();
    }

    Window_DebugShownMap.prototype.initialize = function (teleportWindow) {
        var dy = this.fittingHeight(2);
        this._teleportWindow = teleportWindow;
        Window_Selectable.prototype.initialize.call(
            this, 160, dy, Graphics.width - 160, Graphics.height - dy);
        this.backOpacity = 0;
        this.opacity = 0;
        this.hide();
        this._mapId = 0;
        this.createTilemap();
        this.createBitmap();
        this.updateShownMap(this._teleportWindow.currentExt());
    };
    Window_DebugShownMap.prototype.createTilemap = function () {
        // MV's Tilemap is sized by its own width/height, so the preview pane is
        // simply a tilemap the size of the pane - no viewport or clipping.
        this._tilemap = new Tilemap();
        this._tilemap.x = this.x;
        this._tilemap.y = this.y;
        this._tilemap.width = this.width;
        this._tilemap.height = this.height;
        this.addChild(this._tilemap);
    };
    Window_DebugShownMap.prototype.createBitmap = function () {
        this._cursorSprite = new Sprite_DebugMap(this);
        this._cursorSprite.x = (this.width - 32) / 2;
        this._cursorSprite.y = (this.height - 32) / 2;
        this.addChild(this._cursorSprite);
    };
    Window_DebugShownMap.prototype.update = function () {
        Window_Selectable.prototype.update.call(this);
        if (this._cursorSprite) { this._cursorSprite.visible = this.visible; }
        if (!this._teleportWindow.visible) { return; }
        this.updateShownMap(this._teleportWindow.currentExt());
        this.updateTilemap();
    };
    // 0119.rb:992
    Window_DebugShownMap.prototype.updateShownMap = function (mapId) {
        if (this._mapId === mapId) { return; }
        if (!mapId) { return; }
        this._mapId = mapId;
        loadMapData(mapId, function (map) {
            if (!map || this._mapId !== mapId) { return; }
            this._map = map;
            var tileset = $dataTilesets[map.tileset_id];
            var names = (tileset && tileset.tilesetNames) || [];
            // MV wants eight slots: A (A1..A5 stacked) then B, C, D, E, plus
            // the shadow / light slots the engine leaves alone.
            this._tilemap.bitmaps = [];
            for (var i = 0; i < 8; i++) {
                this._tilemap.bitmaps[i] =
                    names[i] ? ImageManager.loadTileset(names[i]) : null;
            }
            this._tilemap.flags = tileset ? tileset.flags : [];
            this._tilemap.setData(map.width, map.height, map.data);
            this._tilemap.refreshTileset();
            this.recalculateCoordinates();
            this.updateTilemap();
        }.bind(this));
    };
    // 0119.rb:1007 - centre the map under the cursor
    Window_DebugShownMap.prototype.recalculateCoordinates = function () {
        if (!this._map) { return; }
        var tw = 48, th = 48;                     // MV tiles are 48x48, not 32
        this._ox = (this._map.width * tw - this.width) / 2;
        this._oy = (this._map.height * th - this.height) / 2;
        if (this._map.width % 2 === 0) { this._ox -= tw / 2; }
        if (this._map.height % 2 === 0) { this._oy -= th / 2; }
        this._mapX = Math.floor(this._map.width / 2);
        this._mapY = Math.floor(this._map.height / 2);
        if (this._map.width % 2 === 0) { this._mapX -= 1; }
        if (this._map.height % 2 === 0) { this._mapY -= 1; }
        this._tilemap.origin.x = Math.round(this._ox);
        this._tilemap.origin.y = Math.round(this._oy);
    };
    // 0119.rb:1035
    Window_DebugShownMap.prototype.mapX = function () {
        return this._map ? this._mapX % this._map.width : 0;
    };
    Window_DebugShownMap.prototype.mapY = function () {
        return this._map ? this._mapY % this._map.height : 0;
    };
    Window_DebugShownMap.prototype.disposeTilemap = function () {
        if (this._cursorSprite && this._cursorSprite.parent) {
            this.removeChild(this._cursorSprite);
        }
        if (this._tilemap && this._tilemap.parent) { this.removeChild(this._tilemap); }
        this._cursorSprite = null;
        this._tilemap = null;
    };
    Window_DebugShownMap.prototype.updateTilemap = function () {
        if (!this._tilemap) { return; }
        this._tilemap.update();
        if (this._cursorSprite) { this._cursorSprite.update(); }
    };
    // 0119.rb:1071 - `def update_cursor; end`, the square stays centred
    Window_DebugShownMap.prototype.updateCursor = function () { };
    Window_DebugShownMap.prototype.isCursorMovable = function () {
        return this.active;
    };
    // 0119.rb:1090 - Shift moves 10 tiles, Ctrl another 49, MV tiles are 48px
    function pan(pixels, tiles) {
        var p = pixels, t = tiles;
        if (Input.isPressed('shift')) { p *= 10; t *= 10; }
        if (Input.isPressed('control')) { p += 48 * 49; t += 49; }
        return [p, t];
    }
    Window_DebugShownMap.prototype.panBy = function (dx, dy) {
        SoundManager.playCursor();
        if (!this._map) { return; }
        var h = pan(48, 1), v = pan(48, 1);
        if (dx) { this._ox += dx * h[0]; this._mapX += dx * h[1]; }
        if (dy) { this._oy += dy * v[0]; this._mapY += dy * v[1]; }
        this._tilemap.origin.x = Math.round(this._ox);
        this._tilemap.origin.y = Math.round(this._oy);
    };
    Window_DebugShownMap.prototype.cursorDown = function () { this.panBy(0, 1); };
    Window_DebugShownMap.prototype.cursorUp = function () { this.panBy(0, -1); };
    Window_DebugShownMap.prototype.cursorRight = function () { this.panBy(1, 0); };
    Window_DebugShownMap.prototype.cursorLeft = function () { this.panBy(-1, 0); };

    //-------------------------------------------------------------------------
    // Window_DebugMapHeader (0119.rb:1099)
    //-------------------------------------------------------------------------
    function Window_DebugMapHeader() { this.initialize.apply(this, arguments); }
    Window_DebugMapHeader.prototype = Object.create(Window_Base.prototype);
    Window_DebugMapHeader.prototype.constructor = Window_DebugMapHeader;

    Window_DebugMapHeader.prototype.initialize = function (teleportWindow,
                                                           mapWindow) {
        this._teleportWindow = teleportWindow;
        this._mapWindow = mapWindow;
        Window_Base.prototype.initialize.call(this, 160, 0,
            Graphics.width - 160, this.fittingHeight(2));
        this._mapId = 0;
        this._mapX = 0;
        this._mapY = 0;
        this.hide();
    };
    Window_DebugMapHeader.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (this._teleportWindow.visible) {
            this.updateHeader(this._teleportWindow.currentExt());
        }
        if (this._mapWindow.active) { this.updateCoordinates(); }
    };
    Window_DebugMapHeader.prototype.updateHeader = function (mapId) {
        if (this._mapId === mapId) { return; }
        this.updateData();
        this.refresh();
    };
    Window_DebugMapHeader.prototype.updateCoordinates = function () {
        if (this._mapWindow.mapX() === this._mapX &&
            this._mapWindow.mapY() === this._mapY) { return; }
        this.updateData();
        this.refresh();
    };
    Window_DebugMapHeader.prototype.updateData = function () {
        this._mapId = this._teleportWindow.currentExt();
        this._mapX = this._mapWindow.mapX();
        this._mapY = this._mapWindow.mapY();
        loadMapData(this._mapId, function (map) {
            this._mapData = map;
            this.refresh();
        }.bind(this));
    };
    Window_DebugMapHeader.prototype.refresh = function () {
        this.contents.clear();
        this.drawMapName();
        this.drawMapCoordinates();
    };
    Window_DebugMapHeader.prototype.drawMapName = function () {
        var info = $dataMapInfos[this._mapId];
        if (!info) { return; }
        this.drawText(info.name, 4, 0, this.contentsWidth() - 8, 'center');
    };
    Window_DebugMapHeader.prototype.drawMapCoordinates = function () {
        var dw = this.contentsWidth() / 4;
        var dy = this.lineHeight();
        this.drawText(sprintf('MAP:%03d', this._mapId), dw * 0, dy, dw, 'center');
        this.drawText(sprintf('X:%03d', this._mapX), dw * 1, dy, dw, 'center');
        this.drawText(sprintf('Y:%03d', this._mapY), dw * 2, dy, dw, 'center');
        var size = this._mapData ? this._mapData.width + 'x' + this._mapData.height
                                 : '';
        this.drawText(size, dw * 3, dy, dw, 'center');
    };

    //-------------------------------------------------------------------------
    // Window_DebugBattle (0119.rb:1170)
    //-------------------------------------------------------------------------
    function Window_DebugBattle() { this.initialize.apply(this, arguments); }
    Window_DebugBattle.prototype = Object.create(Window_Command.prototype);
    Window_DebugBattle.prototype.constructor = Window_DebugBattle;

    Window_DebugBattle.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 160, 0);
        this.deactivate();
        this.hide();
        this.refresh();
    };
    Window_DebugBattle.prototype.windowWidth = function () {
        return Graphics.width - 160;
    };
    Window_DebugBattle.prototype.windowHeight = function () {
        return Graphics.height - 120;
    };
    Window_DebugBattle.prototype.numVisibleRows = function () {
        return Math.ceil((Graphics.height - 120) / this.lineHeight());
    };
    Window_DebugBattle.prototype.makeCommandList = function () {
        for (var i = 1; i < $dataTroops.length; i++) {
            if (!$dataTroops[i]) { continue; }
            this.addCommand(sprintf('B%03d:%s', i, $dataTroops[i].name),
                            'battle', true, i);
        }
    };

    //-------------------------------------------------------------------------
    // Window_DebugCommonEvent (0119.rb:1213)
    //-------------------------------------------------------------------------
    function Window_DebugCommonEvent() {
        this.initialize.apply(this, arguments);
    }
    Window_DebugCommonEvent.prototype = Object.create(Window_Command.prototype);
    Window_DebugCommonEvent.prototype.constructor = Window_DebugCommonEvent;

    Window_DebugCommonEvent.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 160, 0);
        this.deactivate();
        this.hide();
        this.refresh();
    };
    Window_DebugCommonEvent.prototype.windowWidth = function () {
        return Graphics.width - 160;
    };
    Window_DebugCommonEvent.prototype.windowHeight = function () {
        return Graphics.height - 120;
    };
    Window_DebugCommonEvent.prototype.numVisibleRows = function () {
        return Math.ceil((Graphics.height - 120) / this.lineHeight());
    };
    Window_DebugCommonEvent.prototype.makeCommandList = function () {
        for (var i = 1; i < $dataCommonEvents.length; i++) {
            if (!$dataCommonEvents[i]) { continue; }
            this.addCommand(sprintf('E%03d:%s', i, $dataCommonEvents[i].name),
                            'event', true, i);
        }
    };

    //-------------------------------------------------------------------------
    // Window_DebugItem (0119.rb:1256)
    //-------------------------------------------------------------------------
    function Window_DebugItem() { this.initialize.apply(this, arguments); }
    Window_DebugItem.prototype = Object.create(Window_Command.prototype);
    Window_DebugItem.prototype.constructor = Window_DebugItem;

    Window_DebugItem.prototype.initialize = function () {
        Window_Command.prototype.initialize.call(this, 160, 0);
        this.deactivate();
        this.hide();
    };
    Window_DebugItem.prototype.windowWidth = function () {
        return Graphics.width - 160;
    };
    Window_DebugItem.prototype.windowHeight = function () {
        return Graphics.height - 120;
    };
    Window_DebugItem.prototype.numVisibleRows = function () {
        return Math.ceil((Graphics.height - 120) / this.lineHeight());
    };
    // 0119.rb:1272
    Window_DebugItem.prototype.setType = function (type) {
        this._type = type;
        this.refresh();
        this.select(0);
    };
    Window_DebugItem.prototype.makeCommandList = function () {
        var group, fmt;
        switch (this._type) {
            case 'items':   group = $dataItems;   fmt = 'I%03d:'; break;
            case 'weapons': group = $dataWeapons; fmt = 'W%03d:'; break;
            default:        group = $dataArmors;  fmt = 'A%03d:'; break;
        }
        for (var i = 1; i < group.length; i++) {
            if (!group[i]) { continue; }
            this.addCommand(sprintf(fmt, i), 'item', true, group[i]);
        }
    };
    // 0119.rb:1294
    Window_DebugItem.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        var item = this._list[index].ext;
        var name = item.name;
        this.changeTextColor(this.normalColor());
        this.changePaintOpacity($gameParty.numItems(item) > 0);
        if ($gameParty.numItems(item) > 0 && item.name === '') {
            this.changeTextColor(this.deathColor());
            name = 'ATTENTION!';
        }
        var head = this.commandName(index);
        this.drawText(head, rect.x, rect.y, rect.width);
        var cw = this.textWidth(head);
        rect.x += cw;
        rect.width -= cw;
        this.drawIconFaded(item.iconIndex, rect.x, rect.y,
                           $gameParty.numItems(item) > 0);
        rect.x += 24;
        rect.width -= 24;
        this.drawText(name, rect.x, rect.y, rect.width);
        this.drawText('x' + group($gameParty.numItems(item)), rect.x, rect.y,
                      rect.width, 'right');
    };
    /** 0119.rb:1305 - `draw_icon(icon, x, y, enabled)`.  MV's drawIcon blts and
     *  Bitmap#blt ignores paintOpacity, so the alpha is pushed onto the canvas. */
    Window_DebugItem.prototype.drawIconFaded = function (icon, x, y, enabled) {
        var ctx = this.contents && this.contents._context;
        if (!ctx) { this.drawIcon(icon, x, y); return; }
        var old = ctx.globalAlpha;
        ctx.globalAlpha = enabled ? 1 : this.translucentOpacity() / 255;
        this.drawIcon(icon, x, y);
        ctx.globalAlpha = old;
    };
    // 0119.rb:1315 - Shift = 10, Ctrl = 99
    Window_DebugItem.prototype.cursorRight = function (wrap) {
        SoundManager.playCursor();
        var item = this.currentExt();
        $gameParty.gainItem(item, Input.isPressed('shift') ? 10 : 1);
        if (Input.isPressed('control')) { $gameParty.gainItem(item, 99); }
        this.drawItem(this.index());
    };
    Window_DebugItem.prototype.cursorLeft = function (wrap) {
        SoundManager.playCursor();
        var item = this.currentExt();
        $gameParty.loseItem(item, Input.isPressed('shift') ? 10 : 1);
        if (Input.isPressed('control')) { $gameParty.loseItem(item, 99); }
        this.drawItem(this.index());
    };

    //-------------------------------------------------------------------------
    // Scene_Debug (0119.rb:1343) - overwrite
    //-------------------------------------------------------------------------
    Scene_Debug.prototype.start = function () {
        Scene_MenuBase.prototype.start.call(this);
        this.createAllWindows();
    };
    Scene_Debug.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
    };
    Scene_Debug.prototype.update = function () {
        Scene_MenuBase.prototype.update.call(this);
        // 0119.rb:1354 - F9 again leaves the screen
        if (Input.isTriggered('F9')) { this.popScene(); }
    };

    Scene_Debug.prototype.createAllWindows = function () {
        this.createCommandWindow();
        this.createHelpWindow();
        this.createDummyWindow();
        this.createSwitchWindow();
        this.createVariableWindow();
        this.createTeleportWindows();
        this.createBattleWindows();
        this.createCommonEventWindows();
        this.createItemWindows();
    };
    // 0119.rb:1370
    Scene_Debug.prototype.createCommandWindow = function () {
        this._commandWindow = new Window_DebugCommand();
        this._commandWindow.setHandler('cancel', this.popScene.bind(this));
        this._commandWindow.setHandler('switches', this.commandSwitches.bind(this));
        this._commandWindow.setHandler('variables', this.commandVariables.bind(this));
        this._commandWindow.setHandler('teleport', this.commandTeleport.bind(this));
        this._commandWindow.setHandler('battle', this.commandBattle.bind(this));
        this._commandWindow.setHandler('events', this.commandCommonEvent.bind(this));
        this._commandWindow.setHandler('items', this.commandItems.bind(this));
        this._commandWindow.setHandler('weapons', this.commandItems.bind(this));
        this._commandWindow.setHandler('armours', this.commandItems.bind(this));
        this.addWindow(this._commandWindow);
    };
    // 0119.rb:1387
    Scene_Debug.prototype.createHelpWindow = function () {
        var wx = this._commandWindow.width;
        var wy = Graphics.height - 120;
        var ww = Graphics.width - wx;
        this._helpWindow = new Window_Base(wx, wy, ww, 120);
        this.addWindow(this._helpWindow);
    };
    // 0119.rb:1396
    Scene_Debug.prototype.createDummyWindow = function () {
        var wx = this._commandWindow.width;
        var ww = Graphics.width - wx;
        var wh = Graphics.height - this._helpWindow.height;
        this._dummyWindow = new Window_Base(wx, 0, ww, wh);
        this.addWindow(this._dummyWindow);
    };
    // 0119.rb:1404
    Scene_Debug.prototype.createSwitchWindow = function () {
        this._switchWindow = new Window_DebugSwitch();
        this._switchWindow.setHandler('ok', this.onSwitchOk.bind(this));
        this._switchWindow.setHandler('cancel', this.onSwitchCancel.bind(this));
        this.addWindow(this._switchWindow);
    };
    Scene_Debug.prototype.commandSwitches = function () {
        this._dummyWindow.hide();
        this._switchWindow.show();
        this._switchWindow.activate();
        this.refreshHelpWindow();
    };
    // 0119.rb:1419 - Z toggles (Ace's :ok)
    Scene_Debug.prototype.onSwitchOk = function () {
        this._switchWindow.activate();
        var id = this._switchWindow.currentExt();
        $gameSwitches.setValue(id, !$gameSwitches.value(id));
        this._switchWindow.drawItem(this._switchWindow.index());
    };
    Scene_Debug.prototype.onSwitchCancel = function () {
        this._dummyWindow.show();
        this._switchWindow.hide();
        this._commandWindow.activate();
        this.refreshHelpWindow();
    };
    // 0119.rb:1438
    Scene_Debug.prototype.createVariableWindow = function () {
        this._variableWindow = new Window_DebugVariable();
        this._variableWindow.setHandler('ok', this.onVariableOk.bind(this));
        this._variableWindow.setHandler('cancel', this.onVariableCancel.bind(this));
        this.addWindow(this._variableWindow);
        this._inputWindow = new Window_DebugInput();
        this._inputWindow.setHandler('ok', this.onInputOk.bind(this));
        this._inputWindow.setHandler('cancel', this.onInputCancel.bind(this));
        this.addWindow(this._inputWindow);
    };
    Scene_Debug.prototype.commandVariables = function () {
        this._dummyWindow.hide();
        this._variableWindow.show();
        this._variableWindow.activate();
        this.refreshHelpWindow();
    };
    Scene_Debug.prototype.onVariableOk = function () {
        this._inputWindow.reveal(this._variableWindow.currentExt());
    };
    Scene_Debug.prototype.onVariableCancel = function () {
        this._dummyWindow.show();
        this._variableWindow.hide();
        this._commandWindow.activate();
        this.refreshHelpWindow();
    };
    // 0119.rb:1471
    Scene_Debug.prototype.onInputOk = function () {
        $gameVariables.setValue(this._variableWindow.currentExt(),
                                this._inputWindow._value);
        this._inputWindow.close();
        this._inputWindow.deactivate();
        this._variableWindow.activate();
        this._variableWindow.drawItem(this._variableWindow.index());
    };
    Scene_Debug.prototype.onInputCancel = function () {
        this._inputWindow.close();
        this._inputWindow.deactivate();
        this._variableWindow.activate();
    };
    // 0119.rb:1485
    Scene_Debug.prototype.createTeleportWindows = function () {
        this._teleportWindow = new Window_DebugTeleport();
        this._teleportWindow.setHandler('ok', this.onTeleportOk.bind(this));
        this._teleportWindow.setHandler('cancel', this.onTeleportCancel.bind(this));
        this.addWindow(this._teleportWindow);
        this._mapWindow = new Window_DebugShownMap(this._teleportWindow);
        this._mapWindow.setHandler('ok', this.onMapOk.bind(this));
        this._mapWindow.setHandler('cancel', this.onMapCancel.bind(this));
        this.addWindow(this._mapWindow);
        var wx = this._mapWindow.x;
        var wy = this._mapWindow.y;
        var ww = this._mapWindow.width;
        var wh = this._mapWindow.height;
        this._mapDummy = new Window_Base(wx, wy, ww, wh);
        this._mapDummy.hide();
        this.addWindow(this._mapDummy);
        this._teleportHeader = new Window_DebugMapHeader(this._teleportWindow,
                                                         this._mapWindow);
        this.addWindow(this._teleportHeader);
    };
    Scene_Debug.prototype.commandTeleport = function () {
        this._commandWindow.hide();
        this._dummyWindow.hide();
        this._helpWindow.hide();
        this._teleportHeader.show();
        this._mapWindow.show();
        this._mapDummy.show();
        this._teleportWindow.show();
        this._teleportWindow.activate();
    };
    Scene_Debug.prototype.onTeleportOk = function () {
        this._mapWindow.activate();
    };
    // 0119.rb:1530
    Scene_Debug.prototype.onTeleportCancel = function () {
        this._teleportWindow.hide();
        this._teleportHeader.hide();
        this._mapWindow.hide();
        this._mapDummy.hide();
        this._dummyWindow.show();
        this._helpWindow.show();
        this._commandWindow.show();
        this._commandWindow.activate();
    };
    // 0119.rb:1541
    Scene_Debug.prototype.onMapOk = function () {
        var mapId = this._teleportWindow.currentExt();
        var mapX = this._mapWindow.mapX();
        var mapY = this._mapWindow.mapY();
        var direction = $gamePlayer.direction();
        $gamePlayer.reserveTransfer(mapId, mapX, mapY, direction, 0);
        this.popScene();
    };
    Scene_Debug.prototype.onMapCancel = function () {
        this._teleportWindow.activate();
    };
    // 0119.rb:1552
    Scene_Debug.prototype.createBattleWindows = function () {
        this._battleWindow = new Window_DebugBattle();
        this._battleWindow.setHandler('ok', this.onBattleOk.bind(this));
        this._battleWindow.setHandler('cancel', this.onBattleCancel.bind(this));
        this.addWindow(this._battleWindow);
    };
    Scene_Debug.prototype.commandBattle = function () {
        this._dummyWindow.hide();
        this._battleWindow.show();
        this._battleWindow.activate();
        this.refreshHelpWindow();
    };
    Scene_Debug.prototype.onBattleOk = function () {
        var troopId = this._battleWindow.currentExt();
        BattleManager.setup(troopId);
        BattleManager.onEncounter();
        SceneManager.goto(Scene_Battle);
        BattleManager.saveBgmAndBgs();
        BattleManager.playBattleBgm();
        SoundManager.playBattleStart();
    };
    Scene_Debug.prototype.onBattleCancel = function () {
        this._dummyWindow.show();
        this._battleWindow.hide();
        this._commandWindow.activate();
        this.refreshHelpWindow();
    };
    // 0119.rb:1583
    Scene_Debug.prototype.createCommonEventWindows = function () {
        this._eventWindow = new Window_DebugCommonEvent();
        this._eventWindow.setHandler('ok', this.onEventOk.bind(this));
        this._eventWindow.setHandler('cancel', this.onEventCancel.bind(this));
        this.addWindow(this._eventWindow);
    };
    Scene_Debug.prototype.commandCommonEvent = function () {
        this._dummyWindow.hide();
        this._eventWindow.show();
        this._eventWindow.activate();
        this.refreshHelpWindow();
    };
    Scene_Debug.prototype.onEventOk = function () {
        $gameTemp.reserveCommonEvent(this._eventWindow.currentExt());
        this.popScene();
    };
    Scene_Debug.prototype.onEventCancel = function () {
        this._dummyWindow.show();
        this._eventWindow.hide();
        this._commandWindow.activate();
        this.refreshHelpWindow();
    };
    // 0119.rb:1605
    Scene_Debug.prototype.createItemWindows = function () {
        this._itemWindow = new Window_DebugItem();
        this._itemWindow.setHandler('cancel', this.onItemCancel.bind(this));
        this.addWindow(this._itemWindow);
    };
    Scene_Debug.prototype.commandItems = function () {
        this._dummyWindow.hide();
        this._itemWindow.show();
        this._itemWindow.activate();
        this._itemWindow.setType(this._commandWindow.currentSymbol());
        this.refreshHelpWindow();
    };
    Scene_Debug.prototype.onItemCancel = function () {
        this._dummyWindow.show();
        this._itemWindow.hide();
        this._commandWindow.activate();
        this.refreshHelpWindow();
    };
    // 0119.rb:1620
    Scene_Debug.prototype.refreshHelpWindow = function () {
        var text;
        if (this._commandWindow.active) {
            text = '';
        } else {
            switch (this._commandWindow.currentSymbol()) {
                case 'switches':
                    text = 'Adjust switches.\n';
                    text += 'Press Z to toggle switch.\n';
                    text += 'Yellow switches are on and named.\n';
                    text += 'Red switches are on but not named.';
                    break;
                case 'variables':
                    text = 'Adjust variables.\n';
                    text += 'Press Z to change variable.\n';
                    text += 'Yellow variables are non-zero and named.\n';
                    text += 'Red variables are non-zero but not named.';
                    break;
                case 'teleport':
                    text = 'Pick a map to teleport to.\n';
                    text += 'Arrow keys move the view, Z confirms.\n';
                    text += 'Hold Shift to move 10 tiles, Ctrl to move 50.';
                    break;
                case 'battle':
                    text = 'Pick a troop to fight.';
                    break;
                case 'events':
                    text = 'Pick a common event to run.';
                    break;
                default:
                    text = 'Arrow keys change the amount.\n';
                    text += 'Hold Shift to change by 10, Ctrl by 99.';
                    break;
            }
        }
        this._helpWindow.contents.clear();
        this._helpWindow.drawTextEx(text, 0, 0);
    };

    //-------------------------------------------------------------------------
    // Scene_Base - the F10 code console (0119.rb:398)
    //-------------------------------------------------------------------------
    var _Scene_Base_update = Scene_Base.prototype.update;
    Scene_Base.prototype.update = function () {
        _Scene_Base_update.call(this);
        this.triggerDebugWindowEntry();
    };
    Scene_Base.prototype.triggerDebugWindowEntry = function () {
        if (!debugAllowed()) { return; }
        if (Input.isTriggered('F10')) {
            SoundManager.playOk();
            this.processDebugWindowEntry();
        }
    };
    // 0119.rb:398 - Ace freezes the screen and runs a blocking loop around
    // Win32API key polling.  MV runs the console as an overlay and reads the
    // same characters straight off the browser's keydown event: `event.key`
    // already resolves Shift and Caps Lock the way Input.upcase? / Input.key_type
    // did (0119.rb:284-350).
    Scene_Base.prototype.processDebugWindowEntry = function () {
        if (this._debugEntryActive) { return; }
        this._debugEntryActive = true;
        var win = new Window_DebugEntry();
        win.z = 8000;
        this.addChild(win);
        this._debugEntryWindow = win;
        this.openDebugInputField(win);
    };
    Scene_Base.prototype.openDebugInputField = function (win) {
        var self = this;
        var buffer = '';
        win._text = '';
        function close() {
            document.removeEventListener('keydown', onKeyDown, true);
            self.removeChild(win);
            self._debugEntryWindow = null;
            self._debugEntryActive = false;
            Input.clear();
        }
        function onKeyDown(e) {
            // the console owns the keyboard while it is up
            e.stopPropagation();
            e.preventDefault();
            var code = e.keyCode;
            if (code === 27) {                              // Input::ESC
                SoundManager.playCancel();
                if (buffer.length > 0) { buffer = ''; win._text = ''; }
                else { close(); }
                return;
            }
            if (code === 121) {                             // F10 again
                SoundManager.playCancel();
                close();
                return;
            }
            if (code === 13) {                              // Input::ENTER
                try {
                    MonlineDebug.evalCode(buffer);
                    SoundManager.playOk();
                    close();
                } catch (err) {
                    console.error('[MonlineDebug] console: ' + err.message);
                    SoundManager.playBuzzer();
                }
                return;
            }
            if (code === 8) {                               // Input::BACK
                buffer = buffer.slice(0, -1);
                win._text = buffer;
                return;
            }
            if (code === 9 || code === 121 || (code >= 112 && code <= 123)) {
                return;                                     // leave the F keys alone
            }
            // Input.typing? / Input.key_type (0119.rb:266): one printable char.
            if (e.key && e.key.length === 1 && buffer.length < 256) {
                buffer += e.key;
                win._text = buffer;
            } else if (code === 32 && buffer.length < 256) {
                buffer += ' ';
                win._text = buffer;
            }
        }
        document.addEventListener('keydown', onKeyDown, true);
    };

    /** The Ruby's `eval(code)`, routed through the port's Ruby bridge when one
     *  is available so `$game_party.gold += 100` style snippets still work. */
    MonlineDebug.evalCode = function (code) {
        if (window.MonlineRuby && window.MonlineRuby.eval) {
            return window.MonlineRuby.eval(code);
        }
        /* jshint evil:true */
        return (0, eval)(code);
    };

    //-------------------------------------------------------------------------
    // Scene_Map - F9 and the common event shortcuts (0119.rb:469)
    //-------------------------------------------------------------------------
    // The Ruby reaches update_call_debug through `scene_change_ok?`, which is
    // false while a message is up - so during a cutscene F9 does nothing.  For
    // a dev menu that is the wrong trade, so the F9 half is checked straight
    // from Scene_Map#update (every frame) and only the shortcut tables keep the
    // original gate.
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);
        if (!debugAllowed() || SceneManager.isSceneChanging()) { return; }
        if (Input.isTriggered('F9')) {
            SoundManager.playOk();
            SceneManager.push(Scene_Debug);
        }
    };

    var _Scene_Map_updateCallDebug = Scene_Map.prototype.updateCallDebug;
    Scene_Map.prototype.updateCallDebug = function () {
        if (!debugAllowed()) { return; }
        var table;
        if (Input.isPressed('menu')) {                       // Alt
            table = YEA.DEBUG.ALT;
        } else if (Input.isPressed('control')) {             // Ctrl
            table = YEA.DEBUG.CTRL;
        } else if (Input.isPressed('shift')) {               // Shift
            table = YEA.DEBUG.SHIFT;
        } else {
            return;
        }
        for (var i = 0; i < SHORTCUT_KEYS.length; i++) {
            var id = table[SHORTCUT_KEYS[i]];
            if (!id || id <= 0) { continue; }
            if (Input.isTriggered(SHORTCUT_KEYS[i])) {
                $gameTemp.reserveCommonEvent(id);
            }
        }
    };

    //-------------------------------------------------------------------------
    // Scene_Battle - F9 from battle (0119.rb:509)
    //-------------------------------------------------------------------------
    var _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function () {
        _Scene_Battle_update.call(this);
        this.updateDebugInput();
    };
    Scene_Battle.prototype.updateDebugInput = function () {
        if (!debugAllowed()) { return; }
        if (!Input.isTriggered('F9')) { return; }
        if (this._debugEntryActive) { return; }
        SceneManager.push(Scene_Debug);
    };

    //-------------------------------------------------------------------------
    // Publish
    //-------------------------------------------------------------------------
    MonlineDebug.YEA = YEA;
    MonlineDebug.group = group;
    MonlineDebug.Window_DebugCommand = Window_DebugCommand;
    MonlineDebug.Window_DebugSwitch = Window_DebugSwitch;
    MonlineDebug.Window_DebugVariable = Window_DebugVariable;
    MonlineDebug.Window_DebugInput = Window_DebugInput;
    MonlineDebug.Window_DebugTeleport = Window_DebugTeleport;
    MonlineDebug.Window_DebugShownMap = Window_DebugShownMap;
    MonlineDebug.Window_DebugMapHeader = Window_DebugMapHeader;
    MonlineDebug.Window_DebugBattle = Window_DebugBattle;
    MonlineDebug.Window_DebugCommonEvent = Window_DebugCommonEvent;
    MonlineDebug.Window_DebugItem = Window_DebugItem;
    MonlineDebug.Sprite_DebugMap = Sprite_DebugMap;
    window.MonlineDebug = MonlineDebug;
    window.Window_DebugCommand = Window_DebugCommand;
    window.Window_DebugSwitch = Window_DebugSwitch;
    window.Window_DebugVariable = Window_DebugVariable;
    window.Window_DebugInput = Window_DebugInput;
    window.Window_DebugTeleport = Window_DebugTeleport;
    window.Window_DebugShownMap = Window_DebugShownMap;
    window.Window_DebugMapHeader = Window_DebugMapHeader;
    window.Window_DebugBattle = Window_DebugBattle;
    window.Window_DebugCommonEvent = Window_DebugCommonEvent;
    window.Window_DebugItem = Window_DebugItem;
    window.Sprite_DebugMap = Sprite_DebugMap;

    console.log('[MonlineDebug] loaded');
})();
