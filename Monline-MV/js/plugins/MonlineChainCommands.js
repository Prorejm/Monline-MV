//=============================================================================
// MonlineChainCommands.js
//=============================================================================
/*:
 * @plugindesc Port of MOG Chain Commands (0226.rb): the button-sequence minigame driven by chain_commands(ID).
 * @author Monline port
 *
 * @help
 * 0226.rb turns the classic Konami-code into a switch:
 *
 *     chain_commands(14)     # shows the sequence for switch 14 and waits
 *
 * The player must key the sequence in before the timer runs out; on success
 * `$game_switches[ID]` is turned ON and the scene slides away, on a mistake or
 * a timeout it slides away with the switch untouched.  Measured usage: 52
 * calls, all `chain_commands(N)`.  Before this port the name was a shim no-op,
 * so every one of those switches could never be turned on.
 *
 * ---------------------------------------------------------------------------
 * What is reproduced
 * ---------------------------------------------------------------------------
 *   * the sequence table (0226.rb:47 CHAIN_SWITCH_COMMAND) - verbatim;
 *   * CHAIN_INPUT_DURATION 75 frames per command, so the timer is
 *     `75 * number_of_commands`;
 *   * the "automatic" mode (`$game_switches[13]`) where the game keys itself;
 *   * the 12 button slots and their `Chain_Command` sprite-sheet frames;
 *   * the cursor bob, the zoom punch, the timer meter, the combo counter and
 *     the slide-out exit.
 *
 * Two deliberate deviations, both forced by the engine change:
 *
 *   * VX Ace's `Input::X / ::Y / ::Z` are the A / S / D keys, which MV does not
 *     map at all.  They are added to `Input.keyMapper` here (65 / 83 / 68) so
 *     `Input.isTriggered()` covers the same twelve buttons the Ruby checks.
 *   * The Ruby hard-codes the 544x416 screen (`544 / 2`).  MV runs at 816x624,
 *     so every coordinate goes through `ax()/ay()`, which keeps the offset
 *     from the screen centre instead of the absolute pixel.  Sprites keep
 *     their natural size and the Ruby's own 1.5 zoom.
 */
//=============================================================================

var MonlineChainCommands = MonlineChainCommands || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Configuration - verbatim from 0226.rb:37 MOG_CHAIN_COMMANDS
    //-------------------------------------------------------------------------
    var CFG = {
        CHAIN_SWITCH_COMMAND: {
            14: ['Up', 'Right', 'Z', 'Z'],
            15: ['Up', 'Z', 'Left', 'X', 'Z'],
            16: ['Up', 'Z', 'Right', 'Up', 'X', 'X'],
            181: ['Left', 'Right', 'Left', 'Right', 'Z', 'X', 'Up'],
            182: ['Left'],
            183: ['Up'],
            184: ['Right'],
            185: ['Down'],
            186: ['Z'],
            187: ['X'],
            188: ['D'],
            189: ['S'],
            190: ['A'],
            191: ['Q'],
            192: ['W'],
            193: ['Shift'],
            194: ['Left', 'Right', 'Down', 'Down', 'Z', 'Right', 'Down',
                  'Left', 'Up', 'S', 'X'],
            195: ['Right', 'Right', 'Left', 'Right', 'Z'],
            196: ['Down', 'Down', 'Up', 'Down', 'Z'],
            197: ['Up', 'Up', 'Down', 'Up', 'Z'],
            198: ['Left', 'Left', 'Right', 'Left', 'Z'],
            199: ['Left', 'Up', 'Down', 'Z'],
            200: ['Left', 'Right', 'Z', 'Down', 'Up', 'Down', 'Z', 'Right',
                  'Down'],
            244: ['Left', 'Right', 'Left', 'Right', 'Left', 'Left', 'Right']
        },
        CHAIN_INPUT_DURATION: 75,
        CHAIN_RIGHT_SE: 'Chime1',
        CHAIN_WRONG_SE: 'Buzzer1',
        CHAIN_AUTOMATIC_MODE_SWITCH_ID: 13,
        CHAIN_HUD_Z: 300
    };

    //-------------------------------------------------------------------------
    // Buttons (0226.rb:383 command_list_check)
    //
    // The `com` slots are: 0 A, 1 D, 2 S, 3 Shift, 4 Z, 5 X, 6 Q, 7 W,
    // 8 Right, 9 Left, 10 Down, 11 Up, 12 unknown.
    //-------------------------------------------------------------------------
    var SYMBOL_COM = {
        A: 0, D: 1, S: 2, Shift: 3, Z: 4, X: 5, Q: 6, W: 7,
        Right: 8, Left: 9, Down: 10, Up: 11
    };

    // 0226.rb:351 - the Input constant each slot is read from.  MV has no
    // mapping for the A / S / D keys, so they are registered here.
    var EXTRA_KEYS = { 65: 'monlineA', 83: 'monlineS', 68: 'monlineD' };
    Object.keys(EXTRA_KEYS).forEach(function (code) {
        if (!Input.keyMapper[code]) { Input.keyMapper[code] = EXTRA_KEYS[code]; }
    });

    // Slot order is the Ruby's `if / elsif` chain, highest priority first.
    var BUTTON_SLOTS = [
        ['monlineA', 0], ['monlineD', 1], ['monlineS', 2], ['shift', 3],
        ['ok', 4], ['escape', 5], ['pageup', 6], ['pagedown', 7],
        ['right', 8], ['left', 9], ['down', 10], ['up', 11]
    ];

    //-------------------------------------------------------------------------
    // Screen mapping: VX Ace was 544x416, MV is 816x624.
    //-------------------------------------------------------------------------
    function ax(v) { return Graphics.width / 2 + (v - 272); }
    function ay(v) { return Graphics.height / 2 + (v - 208); }

    function chainImage(name) { return ImageManager.loadSystem(name); }
    function css(r, g, b, a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255).toFixed(3) + ')';
    }
    function playSe(name) {
        AudioManager.playSe({ name: name, volume: 100, pitch: 100 });
    }

    //-------------------------------------------------------------------------
    // Game_Temp#chain_switch_id (0226.rb:556)
    //-------------------------------------------------------------------------
    var _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function () {
        _Game_Temp_initialize.call(this);
        this._chainSwitchId = 0;
    };

    //-------------------------------------------------------------------------
    // Scene_ChainCommands (0226.rb:98)
    //-------------------------------------------------------------------------
    function Scene_ChainCommands() {
        this.initialize.apply(this, arguments);
    }
    Scene_ChainCommands.prototype = Object.create(Scene_Base.prototype);
    Scene_ChainCommands.prototype.constructor = Scene_ChainCommands;

    // 0226.rb:103
    Scene_ChainCommands.prototype.initialize = function () {
        Scene_Base.prototype.initialize.call(this);
        this._actionId = ($gameTemp && $gameTemp._chainSwitchId) || 0;
        this._chainCommand = CFG.CHAIN_SWITCH_COMMAND[this._actionId] || ['?'];
        var duration = Math.min(Math.max(CFG.CHAIN_INPUT_DURATION, 1), 9999);
        this._timerMax = duration * this._chainCommand.length;
        this._timer = this._timerMax;
        this._slideTime = Math.min(Math.max(Math.floor(60 / duration), 10), 60);
        this._changeTime = 0;
        this._auto = ($gameSwitches && $gameSwitches.value
            ? !!$gameSwitches.value(CFG.CHAIN_AUTOMATIC_MODE_SWITCH_ID) : false);
        this._com = 0;
        this._comIndex = 0;
        this._exiting = false;
    };

    // 0226.rb:123 main
    //
    // `Cache.system` is synchronous in RGSS3 but `ImageManager.loadSystem` is
    // not: a freshly reserved bitmap has width 0, and every sprite here is
    // sized from the image.  So `create()` only *reserves* the five images
    // (which is what makes `ImageManager.isReady()` wait) and the real build
    // happens in `start()`, which `SceneManager.updateScene` only calls once
    // `isReady()` is true.
    Scene_ChainCommands.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        this._images = {
            command: chainImage('Chain_Command'),
            cursor: chainImage('Chain_Cursor'),
            layout: chainImage('Chain_Layout'),
            timerLayout: chainImage('Chain_Timer_Layout'),
            meter: chainImage('Chain_Timer_Meter')
        };
    };

    Scene_ChainCommands.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        this.createBackground();
        this.createChainCommand();
        this.createCursor();
        this.createLayout();
        this.createMeter();
        this.createText();
        this.createNumber();
        this.startFadeIn(this.fadeSpeed(), false);
    };

    // 0226.rb:319
    Scene_ChainCommands.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (!this.isActive() || this.isBusy()) { return; }
        if (this._exiting) {
            this.updateExit();
            return;
        }
        this.updateCommand();
        this.updateCursorSlide();
        this.updateFlow();
        this.updateChangeTime();
    };

    // ---- background (0226.rb:125) ----------------------------------------
    Scene_ChainCommands.prototype.createBackground = function () {
        var sprite = new Sprite();
        sprite.bitmap = SceneManager.backgroundBitmap();
        sprite.z = 0;
        this.addChild(sprite);
        this._backgroundSprite = sprite;
    };

    // ---- 0226.rb:165 ------------------------------------------------------
    Scene_ChainCommands.prototype.createChainCommand = function () {
        var image = chainImage('Chain_Command');
        var size = this._chainCommand.length;
        var cw = image.width / 13;
        var ch = image.height;
        this._bitmapCw = cw;
        this._bitmapCh = ch;
        this._image = image;
        var widthMax = (cw + 5) * size;
        var bitmap = new Bitmap(widthMax, ch * 2);
        this._commandBitmap = bitmap;
        var sprite = new Sprite(bitmap);
        sprite.z = 3 + CFG.CHAIN_HUD_Z;
        sprite.scale.x = 1.5;
        sprite.scale.y = 1.5;
        this.addChild(sprite);
        this._sprite = sprite;
        if (size <= 15) {
            sprite.x = ax(272 - ((cw + 5) * size) / 2);
            this._newX = 0;
        } else {
            sprite.x = ax(272);
            this._newX = sprite.x;
        }
        sprite.y = ay(223 - ch);
        this.refreshCommand();
    };

    // ---- 0226.rb:146 ------------------------------------------------------
    Scene_ChainCommands.prototype.createCursor = function () {
        this._fyTime = 0;
        this._fy = 0;
        var cursor = new Sprite();
        cursor.bitmap = chainImage('Chain_Cursor');
        cursor.z = 4 + CFG.CHAIN_HUD_Z;
        this.addChild(cursor);
        this._cursor = cursor;
        this._cursorSpace = ((this._bitmapCw + 5) * this._chainCommand.length) / 2;
        this.placeCursor();
        cursor.y = ay(238);
    };

    Scene_ChainCommands.prototype.placeCursor = function () {
        if (this._chainCommand.length <= 20) {
            this._cursor.x = ax(272 - this._cursorSpace +
                                this._cursorSpace * this._comIndex);
        } else {
            this._cursor.x = ax(272);
        }
    };

    // ---- 0226.rb:200 ------------------------------------------------------
    Scene_ChainCommands.prototype.createLayout = function () {
        var back = new TilingSprite();
        back.bitmap = chainImage('Chain_Layout');
        back.move(0, 0, Graphics.width, Graphics.height);
        back.z = 0 + CFG.CHAIN_HUD_Z;
        this.addChild(back);
        this._back = back;

        var layout = new Sprite();
        layout.bitmap = chainImage('Chain_Timer_Layout');
        layout.z = 1 + CFG.CHAIN_HUD_Z;
        layout.x = ax(160);
        layout.y = ay(150);
        this.addChild(layout);
        this._layout = layout;
    };

    // ---- 0226.rb:214 ------------------------------------------------------
    Scene_ChainCommands.prototype.createMeter = function () {
        this._meterFlow = 0;
        var image = chainImage('Chain_Timer_Meter');
        this._meterImage = image;
        var bitmap = new Bitmap(image.width, image.height);
        this._meterBitmap = bitmap;
        this._meterRange = image.width / 3;
        this._meterHeight = image.height;
        var sprite = new Sprite(bitmap);
        sprite.z = 2 + CFG.CHAIN_HUD_Z;
        sprite.x = ax(220);
        sprite.y = ay(152);
        this.addChild(sprite);
        this._meterSprite = sprite;
        this.updateFlow();
    };

    // ---- 0226.rb:234 ------------------------------------------------------
    Scene_ChainCommands.prototype.createText = function () {
        var bitmap = new Bitmap(200, 32);
        bitmap.fontFace = 'VCR OSD Mono';
        bitmap.fontSize = 25;
        bitmap.fontBold = true;
        bitmap.fontItalic = true;
        var sprite = new Sprite(bitmap);
        sprite.z = 2 + CFG.CHAIN_HUD_Z;
        sprite.x = ax(230);
        sprite.y = ay(100);
        this.addChild(sprite);
        this._text = sprite;
    };

    // ---- 0226.rb:250 ------------------------------------------------------
    Scene_ChainCommands.prototype.createNumber = function () {
        this._combo = 0;
        var bitmap = new Bitmap(200, 64);
        bitmap.fontFace = 'VCR OSD Mono';
        bitmap.fontSize = 24;
        bitmap.fontBold = true;
        bitmap.textColor = css(255, 255, 255, 200);
        bitmap.drawText('Ready', 0, 0, 200, 32, 'center');
        var sprite = new Sprite(bitmap);
        sprite.z = 2 + CFG.CHAIN_HUD_Z;
        sprite.x = ax(30);
        sprite.y = ay(100);
        this.addChild(sprite);
        this._number = sprite;
    };

    // ---- 0226.rb:318 ------------------------------------------------------
    Scene_ChainCommands.prototype.updateCommand = function () {
        if (this._auto) { return; }
        for (var i = 0; i < BUTTON_SLOTS.length; i++) {
            var slot = BUTTON_SLOTS[i];
            if (Input.isTriggered(slot[0])) {
                this.checkCommand(slot[1]);
                return;
            }
        }
    };

    // 0226.rb:328
    Scene_ChainCommands.prototype.updateChangeTime = function () {
        if (!this._auto) { return; }
        this._changeTime += 1;
        if (this._changeTime >= CFG.CHAIN_INPUT_DURATION - 1) {
            this.checkCommand(-1);
        }
    };

    // 0226.rb:337
    Scene_ChainCommands.prototype.updateFlow = function () {
        this._timer -= 1;
        var range = this._meterRange;
        var width = Math.max(range * this._timer / this._timerMax, 0);
        var bmp = this._meterBitmap;
        bmp.clear();
        bmp.blt(0, 0, this._meterImage,
                new Rectangle(this._meterFlow, 0, width, this._meterHeight));
        this._meterFlow += 20;
        if (this._meterFlow >= this._meterImage.width - range) {
            this._meterFlow = 0;
        }
        if (this._timer === 0 && !this._auto) { this.wrongCommand(); }
    };

    // 0226.rb:417
    Scene_ChainCommands.prototype.checkCommand = function (com) {
        var right = false;
        if (com !== -1) {
            for (var i = 0; i < this._chainCommand.length; i++) {
                if (i === this._comIndex) {
                    this.commandListCheck(this._chainCommand[i]);
                    if (this._com === com) { right = true; }
                }
            }
        } else {
            // automatic mode: the Ruby feeds the *index*, not the symbol, so
            // any sequence longer than 12 commands degenerates - kept as-is.
            this.commandListCheck(this._comIndex);
            this._changeTime = 0;
            right = true;
        }
        if (right) {
            this.refreshNumber();
            this.nextCommand();
        } else {
            this.wrongCommand();
        }
    };

    // 0226.rb:383
    Scene_ChainCommands.prototype.commandListCheck = function (command) {
        var c = SYMBOL_COM[command];
        this._com = (c === undefined) ? 12 : c;
    };

    // 0226.rb:444
    Scene_ChainCommands.prototype.nextCommand = function () {
        this._comIndex += 1;
        playSe(CFG.CHAIN_RIGHT_SE);
        if (this._comIndex === this._chainCommand.length) {
            if ($gameSwitches) { $gameSwitches.setValue(this._actionId, true); }
            this.exit();
            return;
        }
        this.refreshCommand();
        this.refreshText(0);
    };

    // 0226.rb:459
    Scene_ChainCommands.prototype.wrongCommand = function () {
        playSe(CFG.CHAIN_WRONG_SE);
        this.refreshText(1);
        this.exit();
    };

    // 0226.rb:469
    Scene_ChainCommands.prototype.refreshCommand = function () {
        var bmp = this._commandBitmap;
        bmp.clear();
        var cw = this._bitmapCw, ch = this._bitmapCh;
        for (var i = 0; i < this._chainCommand.length; i++) {
            this.commandListCheck(this._chainCommand[i]);
            var rect = new Rectangle(this._com * cw, 0, cw, ch);
            var y = (this._comIndex === i) ? 0 : ch;
            bmp.blt(i * (cw + 5), y, this._image, rect);
        }
        if (this._chainCommand.length > 15) {
            this._newX = ax(272 - ((cw + 5) * this._comIndex));
        } else if (this._cursor) {
            // `create()` builds the command sprite first (the Ruby does too),
            // and it calls refresh_command at the end - before the cursor
            // exists.  RGSS silently skips `nil.x =` only because the Ruby
            // creates the cursor before the command; in MV the guard is what
            // keeps the scene from dying on the very first frame.
            this._cursor.x = ax(272 - this._cursorSpace +
                                ((cw + 5) * this._comIndex));
        }
    };

    // 0226.rb:492
    Scene_ChainCommands.prototype.refreshText = function (type) {
        var bmp = this._text.bitmap;
        bmp.clear();
        bmp.fontFace = 'VCR OSD Mono';
        bmp.fontSize = 25;
        bmp.fontBold = true;
        bmp.fontItalic = true;
        bmp.textColor = css(255, 255, 255, 220);
        var msg;
        if (type === 0) {
            msg = (this._comIndex === this._chainCommand.length) ?
                  'Perfect!' : 'Success!';
        } else {
            msg = (this._timer === 0) ? 'Out of Time!' : 'Miss!';
        }
        bmp.drawText(msg, 0, 0, 200, 32, 'center');
        this._text.x = ax(230);
        this._text.opacity = 255;
    };

    // 0226.rb:517
    Scene_ChainCommands.prototype.refreshNumber = function () {
        this._combo += 1;
        var bmp = this._number.bitmap;
        bmp.clear();
        bmp.fontSize = 34;
        bmp.drawText(String(this._combo), 0, 0, 200, 32, 'center');
        this._number.opacity = 255;
        this._number.scale.x = 2;
        this._number.scale.y = 2;
    };

    // 0226.rb:530
    Scene_ChainCommands.prototype.updateCursorSlide = function () {
        if (this._sprite.scale.x > 1) { this._sprite.scale.x -= 0.1; }
        if (this._sprite.scale.y > 1) { this._sprite.scale.y -= 0.1; }
        var textRestX = ax(210);
        if (this._text.x > textRestX) { this._text.x -= 2; }
        if (this._text.opacity > 0) { this._text.opacity -= 5; }
        if (this._sprite.x > this._newX && this._chainCommand.length > 15) {
            this._sprite.x -= this._slideTime;
        }
        if (this._number.scale.x > 1) {
            this._number.scale.x -= 0.1;
            this._number.scale.y -= 0.1;
        }
        if (this._fyTime > 15) {
            this._fy += 1;
        } else if (this._fyTime > 0) {
            this._fy -= 1;
        } else {
            this._fy = 0;
            this._fyTime = 30;
        }
        this._fyTime -= 1;
        // RGSS `oy` moves the drawing up by oy pixels; MV's anchor is the
        // Sprite's own origin, so the offset is applied to y.
        this._cursor.y = ay(238) + this._fy;
    };

    // 0226.rb:267 - the slide-out, then back to the map
    Scene_ChainCommands.prototype.exit = function () {
        this._exiting = true;
        this._cursor.visible = false;
    };

    Scene_ChainCommands.prototype.updateExit = function () {
        this._sprite.x += 5;
        this._layout.x -= 5;
        this._meterSprite.x -= 5;
        this._text.x -= 2;
        this._text.opacity -= 5;
        this._sprite.opacity -= 5;
        this._layout.opacity -= 5;
        this._meterSprite.opacity -= 5;
        this._number.opacity -= 5;
        this._back.opacity -= 5;
        if (this._sprite.opacity <= 0) {
            SceneManager.pop();
        }
    };

    Scene_ChainCommands.prototype.terminate = function () {
        Scene_Base.prototype.terminate.call(this);
        if ($gameMap) { $gameMap.requestRefresh(); }
    };

    MonlineChainCommands.Scene_ChainCommands = Scene_ChainCommands;
    MonlineChainCommands.CFG = CFG;

    //-------------------------------------------------------------------------
    // Game_Interpreter#chain_commands (0226.rb:579)
    //-------------------------------------------------------------------------
    function chain_commands(switch_id) {
        var id = parseInt(switch_id, 10);
        if (isNaN(id) || id <= 0) { return false; }
        if ($gameTemp) { $gameTemp._chainSwitchId = id; }
        // 0226.rb:619 - Scene_Map#terminate snapshots the map so the minigame
        // can draw it as its backdrop.
        SceneManager.snapForBackground();
        SceneManager.push(Scene_ChainCommands);
        return true;
    }

    window.chain_commands = chain_commands;
    MonlineChainCommands.play = chain_commands;

    if (window.MonlineShim && window.MonlineShim.functions) {
        var i = window.MonlineShim.functions.indexOf('chain_commands');
        if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
    }
    if (window.MonlineRuby && window.MonlineRuby.F) {
        window.MonlineRuby.F.chain_commands = chain_commands;
        var C = window.MonlineRuby.COSMETIC;
        if (C) {
            var j = C.indexOf('chain_commands');
            if (j >= 0) { C.splice(j, 1); }
        }
    }

    console.log('[MonlineChainCommands] loaded');
})();
