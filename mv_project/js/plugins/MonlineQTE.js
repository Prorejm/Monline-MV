//=============================================================================
// MonlineQTE.js
//=============================================================================
/*:
 * @plugindesc Port of CP's Minigame Pack (0258.rb): MashQTE / TriggerQTE / MatchQTE / TargetQTE.
 * @author Monline port
 *
 * @help
 * The carnival scenes in this game are built on 0258.rb:
 *
 *     MashQTE.play(40, 330, :C)        # tap Z 40 times before the bell
 *     TargetQTE.play(1.0, 120, 7)      # stop the slider in the green zone
 *     TargetQTE.play(1.0, 120, 10)
 *     TargetQTE.play(1.0, 120, 13)
 *
 * and then read the outcome from the event:
 *
 *     If: Switch 300 is ON      # GameSwitch = 300, set true on a win
 *     Variable 84 += 1          # GameVariable = 84, the hit count
 *
 * Measured usage: TargetQTE 3, MashQTE 1.  Before this port `TargetQTE` and
 * `MashQTE` did not exist at all, so the expression `TargetQTE.play(...)`
 * threw, the whole 355 block died, and the carnival stalls were dead ends.
 *
 * ---------------------------------------------------------------------------
 * Engine differences handled here
 * ---------------------------------------------------------------------------
 *   * Ruby's `MashQTE.play` ends with `Fiber.yield`, i.e. the event parks until
 *     the minigame returns.  MV's interpreter pauses on its own while another
 *     scene is on top, so `SceneManager.push` is the whole mechanism.
 *   * `Graphics.snap_to_bitmap` + `Bitmap#blur` become
 *     `SceneManager.snapForBackground()` / `SceneManager.backgroundBitmap()` /
 *     `Bitmap#blur`; `Sprite#color.set` becomes `Sprite#setBlendColor`.
 *   * `Cache.system("")` returns RGSS3's 32x32 empty bitmap - the script relies
 *     on that for its optional backdrop images, so the port does the same.
 *   * `Input.trigger?(:X / :Y / :Z)` are the A / S / D keys, which MV does not
 *     map; they are registered on `Input.keyMapper` (shared with
 *     MonlineChainCommands).
 *   * `wait(n)` is a blocking frame loop in Ruby; here it is a frame counter
 *     that the scene's update drains before returning to the map.
 */
//=============================================================================

var MonlineQTE = MonlineQTE || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Configuration - verbatim from 0258.rb:94 CPMinigame
    //-------------------------------------------------------------------------
    var CFG = {
        BlurBack: true,
        DimBack: true,
        DimSetting: [16, 16, 16, 128],
        GameSwitch: 300,
        GameVariable: 84,
        BarBackColor: [0, 0, 0, 64],

        ButtonImages: 'MiniGameButtons',
        DefMPresses: 20,
        DefMTime: 240,
        DefMButton: 'C',
        MBackImage: '',
        MashImage: '',
        MashOffset: 0,
        ButtonZoom: 2.0,
        MashBarColor: [128, 197, 118],
        MashSuccess: ['Chime2', 80, 115],
        MashFailure: ['Stare', 80, 95],

        DefTMatch: 5,
        DefTTime: 150,
        DefTButtons: ['LEFT', 'RIGHT', 'UP', 'DOWN'],
        TBackImage: 'MiniGameButtonBG',
        TriggerBarColor: [245, 198, 75],
        TriggerButtonGood: ['Switch1', 70, 130],
        TriggerButtonBad: ['Cancel1', 75, 85],
        TriggerSuccess: ['Chime2', 80, 115],
        TriggerFailure: ['Stare', 80, 95],
        TriggerWrong: 3,

        DefSMatch: 4,
        DefSTime: 204,
        DefSButtons: ['LEFT', 'RIGHT', 'UP', 'DOWN'],
        SBackImage: 'MiniGameButtonBG',
        SPointerOffset: 0,
        MatchBarColor: [192, 15, 45],
        MatchButtonGood: ['Switch1', 70, 130],
        MatchButtonBad: ['Cancel1', 75, 85],
        MatchSuccess: ['Chime2', 80, 115],
        MatchFailure: ['Stare', 80, 95],
        MatchWrong: 3,

        DefXZoom: 1.5,
        DefXTime: 120,
        DefXSpeed: 7,
        XBackImage: '',
        XBarImage: 'MiniGameTarget',
        TargetImage: 'MiniGameTargetText',
        TargetSlider: 'MiniGameTargetSlider',
        SliderOffset: 35,
        TargetButton: 'C',
        TargetArea: 0.15,
        TargetButtonBad: ['Cancel2', 85, 125],
        TargetSuccess: ['Chime2', 80, 115],
        TargetFailure: ['Stare', 80, 95],
        TargetWrong: 2
    };

    // 0258.rb:289 ButtonIndex
    var ButtonIndex = {
        UPLEFT: 0, UP: 1, UPRIGHT: 2, L: 3, R: 4, ARROW: 5, TAP: 6,
        LEFT: 7, CENTER: 8, RIGHT: 9, X: 10, Y: 11, Z: 12, GOOD: 13,
        DOWNLEFT: 14, DOWN: 15, DOWNRIGHT: 16, A: 17, B: 18, C: 19, BAD: 20
    };

    // RGSS Input constant -> MV button name (0258.rb:607 / :768 / chain script)
    var BUTTON_INPUT = {
        LEFT: 'left', RIGHT: 'right', UP: 'up', DOWN: 'down',
        A: 'shift', B: 'escape', C: 'ok',
        X: 'monlineA', Y: 'monlineS', Z: 'monlineD',
        L: 'pageup', R: 'pagedown'
    };
    var EXTRA_KEYS = { 65: 'monlineA', 83: 'monlineS', 68: 'monlineD' };
    Object.keys(EXTRA_KEYS).forEach(function (code) {
        if (!Input.keyMapper[code]) { Input.keyMapper[code] = EXTRA_KEYS[code]; }
    });
    MonlineQTE.buttonInput = function (sym) {
        return BUTTON_INPUT[String(sym).toUpperCase()] || BUTTON_INPUT[String(sym)];
    };

    var sharedBackground = null;      // 0258.rb:295 @@background_image

    function css(c) {
        return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' +
               (((c.length > 3 ? c[3] : 255) | 0) / 255).toFixed(3) + ')';
    }
    function playSe(spec) {
        AudioManager.playSe({ name: spec[0], volume: spec[1], pitch: spec[2] });
    }
    function emptyBitmap() {
        // RGSS3's Cache.empty_bitmap - what `Cache.system("")` returns.
        return new Bitmap(32, 32);
    }
    function systemImage(name) {
        return name ? ImageManager.loadSystem(name) : null;
    }
    function rectOf(bmp) { return new Rectangle(0, 0, bmp.width, bmp.height); }

    /**
     * RGSS `Sprite#ox / #oy` are in *bitmap* pixels and are applied before the
     * zoom; MV's `anchor` is a fraction of the unscaled frame.  Every `ox/oy`
     * assignment in the Ruby goes through here so the two mean the same thing.
     */
    function setOrigin(sprite, ox, oy) {
        var w = sprite.width || 1;
        var h = sprite.height || 1;
        sprite.anchor.x = ox / w;
        sprite.anchor.y = oy / h;
    }

    //-------------------------------------------------------------------------
    // Scene_CPMinigame (0258.rb:286)
    //-------------------------------------------------------------------------
    function Scene_CPMinigame() { this.initialize.apply(this, arguments); }
    Scene_CPMinigame.prototype = Object.create(Scene_Base.prototype);
    Scene_CPMinigame.prototype.constructor = Scene_CPMinigame;

    Scene_CPMinigame.prototype.initialize = function () {
        Scene_Base.prototype.initialize.call(this);
        this._startWait = 0;
        this._finishWait = 0;
    };

    // 0258.rb:297
    Scene_CPMinigame.getBackgroundImage = function () {
        SceneManager.snapForBackground();
        sharedBackground = SceneManager.backgroundBitmap();
        if (sharedBackground && CFG.BlurBack) { sharedBackground.blur(); }
    };

    Scene_CPMinigame.prototype.create = function () {
        Scene_Base.prototype.create.call(this);
        // reserve every image the game can ask for; `isReady()` then gates the
        // build until they are all decoded.
        this._reserved = [
            systemImage(CFG.ButtonImages),
            systemImage(CFG.MBackImage),
            systemImage(CFG.MashImage),
            systemImage(CFG.TBackImage),
            systemImage(CFG.SBackImage),
            systemImage(CFG.XBarImage),
            systemImage(CFG.TargetImage),
            systemImage(CFG.TargetSlider)
        ].filter(function (b) { return !!b; });
    };

    Scene_CPMinigame.prototype.start = function () {
        Scene_Base.prototype.start.call(this);
        this.createBackground();
        this.createGameSprites();
        this.startFadeIn(this.fadeSpeed(), false);
        this._startWait = 5;                  // 0258.rb:310 post_start
    };

    Scene_CPMinigame.prototype.update = function () {
        Scene_Base.prototype.update.call(this);
        if (!this.isActive() || this.isBusy()) { return; }
        if (this._finishWait > 0) {
            this._finishWait -= 1;
            if (this._finishWait === 0) { SceneManager.pop(); }
            return;
        }
        if (this._startWait > 0) { this._startWait -= 1; return; }
        this.updateGame();
    };

    // 0258.rb:319
    Scene_CPMinigame.prototype.createBackground = function () {
        var sprite = new Sprite();
        sprite.bitmap = sharedBackground;
        if (CFG.DimBack) { sprite.setBlendColor(CFG.DimSetting.slice()); }
        sprite.z = 0;
        this.addChild(sprite);
        this._backgroundSprite = sprite;
    };

    // 0258.rb:331
    Scene_CPMinigame.prototype.getButtonImage = function (button) {
        var sheet = ImageManager.loadSystem(CFG.ButtonImages);
        var index = ButtonIndex[button];
        var bitmap = new Bitmap(sheet.width / 7, sheet.height / 3);
        if (index === undefined) { return bitmap; }
        var src = new Rectangle((index % 7) * bitmap.width,
                                Math.floor(index / 7) * bitmap.height,
                                bitmap.width, bitmap.height);
        bitmap.blt(0, 0, sheet, src);
        return bitmap;
    };

    // 0258.rb:344
    Scene_CPMinigame.prototype.minigameSuccess = function () {
        this.setCompleteVariable();
        if ($gameSwitches) { $gameSwitches.setValue(CFG.GameSwitch, true); }
        this._finishWait = 40;                // 0258.rb:347 wait(40)
    };
    Scene_CPMinigame.prototype.minigameFailure = function () {
        this.setCompleteVariable();
        if ($gameSwitches) { $gameSwitches.setValue(CFG.GameSwitch, false); }
        this._finishWait = 40;
    };
    Scene_CPMinigame.prototype.setCompleteVariable = function () {};

    Scene_CPMinigame.prototype.createGameSprites = function () {};
    Scene_CPMinigame.prototype.updateGame = function () {};
    Scene_CPMinigame.prototype.timerText = function (frames) {
        // 0258.rb:442 - `((timer + 5) / 6).to_f / 10`, integer division
        return Math.floor((frames + 5) / 6) / 10;
    };

    //-------------------------------------------------------------------------
    // MashQTE (0258.rb:369)
    //-------------------------------------------------------------------------
    function MashQTE() { this.initialize.apply(this, arguments); }
    MashQTE.prototype = Object.create(Scene_CPMinigame.prototype);
    MashQTE.prototype.constructor = MashQTE;

    var preparedM = [CFG.DefMPresses, CFG.DefMTime, CFG.DefMButton];

    MashQTE.play = function (presses, time, button) {
        Scene_CPMinigame.getBackgroundImage();
        preparedM = [presses === undefined ? CFG.DefMPresses : presses,
                     time === undefined ? CFG.DefMTime : time,
                     button === undefined ? CFG.DefMButton : button];
        SceneManager.push(MashQTE);
        return true;
    };

    MashQTE.prototype.createGameSprites = function () {
        this.createBackSprite();
        this.createTapBar();
        this.createButtonSprite();
        this.createTapSprite();
        this.createNumberSprites();
    };

    MashQTE.prototype.createBackSprite = function () {
        var bit1 = systemImage(CFG.MBackImage) || emptyBitmap();
        var bit2 = systemImage(CFG.MashImage) || emptyBitmap();
        var wd = bit1.width;
        var ht = Math.max(bit1.height, bit2.height);
        this._menuBack = new Sprite();
        this.addChild(this._menuBack);
        this._menuBack.bitmap = new Bitmap(wd, ht);
        setOrigin(this._menuBack, wd / 2, ht / 2);          // ox, oy = w/2, h/2
        this._menuBack.x = Graphics.width / 2;
        this._menuBack.y = Graphics.height / 2 - 4;
        this._menuBack.bitmap.blt(0, (ht - bit1.height) / 2, bit1, rectOf(bit1));
        this._menuBack.bitmap.blt(0, (ht - bit2.height) / 2, bit2, rectOf(bit2));
    };

    MashQTE.prototype.createTapBar = function () {
        this._tapBar = new Sprite();
        this.addChild(this._tapBar);
        this._tapBar.bitmap = new Bitmap(this._menuBack.width,
                                         this._menuBack.height + 8);
        // ox, oy = @menu_back.ox, @menu_back.oy
        setOrigin(this._tapBar, this._menuBack.width / 2, this._menuBack.height / 2);
        this._tapBar.x = this._menuBack.x;
        this._tapBar.y = this._menuBack.y;
        this._tappedTimes = [0, 0, preparedM[0]];
        this._tapBar.bitmap.fillRect(0, this._tapBar.height - 8,
                                     this._tapBar.width, 8, css(CFG.BarBackColor));
    };

    MashQTE.prototype.createButtonSprite = function () {
        var z = CFG.ButtonZoom;
        this._buttonSprite = new Sprite();
        this.addChild(this._buttonSprite);
        this._buttonSprite.bitmap = this.getButtonImage(preparedM[2]);
        setOrigin(this._buttonSprite, this._buttonSprite.width / 2,
                  this._buttonSprite.height / 2);
        // x = @menu_back.x - @menu_back.ox - (@button_sprite.ox * zoom)
        this._buttonSprite.x = this._menuBack.x - this._menuBack.width / 2 -
                               (this._buttonSprite.width / 2) * z;
        this._buttonSprite.y = this._menuBack.y + 4;
        this._buttonSprite.scale.x = z;
        this._buttonSprite.scale.y = z;
    };

    MashQTE.prototype.createTapSprite = function () {
        this._tapSprite = new Sprite();
        this.addChild(this._tapSprite);
        this._tapSprite.bitmap = this.getButtonImage('TAP');
        setOrigin(this._tapSprite, this._tapSprite.width / 2,
                  this._tapSprite.height);                   // oy = height
        this._tapSprite.x = this._buttonSprite.x + CFG.MashOffset;
        this._tapSprite.scale.x = CFG.ButtonZoom;
        this._tapSprite.scale.y = CFG.ButtonZoom;
        this._tapSprite.y = this._buttonSprite.y - 8 * CFG.ButtonZoom;
        this._tapSprite.z = 50;
        this._tapCounter = 0;
    };

    MashQTE.prototype.createNumberSprites = function () {
        this._numberSprite = new Sprite();
        this.addChild(this._numberSprite);
        this._numberSprite.bitmap = new Bitmap(this._menuBack.width,
                                               this._menuBack.height);
        setOrigin(this._numberSprite, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._numberSprite.x = this._menuBack.x;
        this._numberSprite.y = this._menuBack.y;
        this._timerValue = preparedM[1];
        var v = this.timerText(this._timerValue);
        this._numberSprite.bitmap.drawText(v + ' ', 0, 0,
                                           this._menuBack.width,
                                           this._menuBack.height, 'right');
    };

    MashQTE.prototype.updateGame = function () {
        this.updateTapSprite();
        this.updateTimerSprite();
        this.updateTapCount();
    };

    MashQTE.prototype.updateTapSprite = function () {
        this._tapCounter += 1;
        if (this._tapCounter % 32 === 0) {
            this._tapSprite.y = this._buttonSprite.y - 8 * CFG.ButtonZoom;
        } else if ((this._tapCounter + 16) % 32 === 0) {
            this._tapSprite.y = this._buttonSprite.y;
        }
    };

    MashQTE.prototype.updateTimerSprite = function () {
        this._timerValue -= 1;
        var v = this.timerText(this._timerValue);
        this._numberSprite.bitmap.clear();
        this._numberSprite.bitmap.drawText(v + ' ', 0, 0,
                                           this._menuBack.width,
                                           this._menuBack.height, 'right');
        if (v <= 0) { this.minigameFailure(); }
    };

    MashQTE.prototype.updateTapCount = function () {
        var name = MonlineQTE.buttonInput(preparedM[2]) || 'ok';
        if (Input.isTriggered(name)) { this._tappedTimes[1] += 1; }
        if (this._tappedTimes[0] !== this._tappedTimes[1]) {
            this._tappedTimes[0] = this._tappedTimes[1];
            var bmp = this._tapBar.bitmap;
            bmp.clear();
            var w = (this._tapBar.width - 2) *
                    (this._tappedTimes[1] / this._tappedTimes[2]);
            bmp.fillRect(0, bmp.height - 8, bmp.width, 8, css(CFG.BarBackColor));
            bmp.fillRect(1, bmp.height - 7, w, 6, css(CFG.MashBarColor));
        }
        if (this._tappedTimes[1] >= this._tappedTimes[2]) { this.minigameSuccess(); }
    };

    MashQTE.prototype.minigameSuccess = function () { playSe(CFG.MashSuccess); Scene_CPMinigame.prototype.minigameSuccess.call(this); };
    MashQTE.prototype.minigameFailure = function () { playSe(CFG.MashFailure); Scene_CPMinigame.prototype.minigameFailure.call(this); };
    MashQTE.prototype.setCompleteVariable = function () {
        if ($gameVariables) { $gameVariables.setValue(CFG.GameVariable, this._tappedTimes[1]); }
    };

    //-------------------------------------------------------------------------
    // TriggerQTE (0258.rb:515)
    //-------------------------------------------------------------------------
    function TriggerQTE() { this.initialize.apply(this, arguments); }
    TriggerQTE.prototype = Object.create(Scene_CPMinigame.prototype);
    TriggerQTE.prototype.constructor = TriggerQTE;

    var preparedT = [CFG.DefTMatch, CFG.DefTTime, CFG.DefTButtons];

    TriggerQTE.play = function (match, time, buttons) {
        Scene_CPMinigame.getBackgroundImage();
        preparedT = [match === undefined ? CFG.DefTMatch : match,
                     time === undefined ? CFG.DefTTime : time,
                     buttons === undefined ? CFG.DefTButtons : buttons];
        SceneManager.push(TriggerQTE);
        return true;
    };

    TriggerQTE.prototype.createGameSprites = function () {
        this.createQtePattern();
        this.createMenuSprite();
        this.createMenuTop();
        this.createTimeBar();
        this.createNumberSprites();
    };

    TriggerQTE.prototype.createQtePattern = function () {
        this._pattern = [];
        var pool = preparedT[2] || CFG.DefTButtons;
        for (var i = 0; i < preparedT[0]; i++) {
            this._pattern.push(pool[Math.floor(Math.random() * pool.length)]);
        }
    };

    TriggerQTE.prototype.createMenuSprite = function () {
        var temp = this.getButtonImage('A');
        var wd = temp.width * (this._pattern.length + 2);
        var bit0 = systemImage(CFG.TBackImage) || emptyBitmap();
        this._menuBack = new Sprite();
        this.addChild(this._menuBack);
        this._menuBack.bitmap = new Bitmap(wd, Math.max(bit0.height, temp.height));
        this._menuBack.bitmap.stretchBlt(
            new Rectangle(0, (this._menuBack.height - bit0.height) / 2,
                          wd, bit0.height), bit0, rectOf(bit0));
        this._topEdge = (this._menuBack.height - temp.height) / 2;
        for (var i = 0; i < this._pattern.length; i++) {
            var bit = this.getButtonImage(this._pattern[i]);
            this._menuBack.bitmap.blt(bit.width * i, this._topEdge, bit, rectOf(bit));
        }
        setOrigin(this._menuBack, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._menuBack.x = Graphics.width / 2;
        this._menuBack.y = Graphics.height / 2 - 4;
    };

    TriggerQTE.prototype.createMenuTop = function () {
        this._correct = 0;
        this._menuTop = new Sprite();
        this.addChild(this._menuTop);
        this._menuTop.bitmap = new Bitmap(this._menuBack.width, this._menuBack.height);
        this._menuTop.z = 50;
        setOrigin(this._menuTop, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._menuTop.x = this._menuBack.x;
        this._menuTop.y = this._menuBack.y;
    };

    TriggerQTE.prototype.createTimeBar = function () {
        this._timeBar = new Sprite();
        this.addChild(this._timeBar);
        this._timeBar.bitmap = new Bitmap(this._menuBack.width, this._menuBack.height + 8);
        setOrigin(this._timeBar, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._timeBar.x = this._menuBack.x;
        this._timeBar.y = this._menuBack.y;
        this._timeBar.bitmap.fillRect(0, this._timeBar.height - 8,
                                      this._timeBar.width, 8, css(CFG.BarBackColor));
        this._timeBar.bitmap.fillRect(1, this._timeBar.height - 7,
                                      this._timeBar.width, 6, css(CFG.TriggerBarColor));
    };

    TriggerQTE.prototype.createNumberSprites = function () {
        this._numberSprite = new Sprite();
        this.addChild(this._numberSprite);
        this._numberSprite.bitmap = new Bitmap(this._menuBack.width, this._menuBack.height);
        setOrigin(this._numberSprite, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._numberSprite.x = this._menuBack.x;
        this._numberSprite.y = this._menuBack.y;
        this._timerValue = preparedT[1];
        var v = this.timerText(this._timerValue);
        this._numberSprite.bitmap.drawText(v + ' ', 0, 0,
                                           this._menuBack.width,
                                           this._menuBack.height, 'right');
    };

    TriggerQTE.prototype.updateGame = function () {
        this.updateTimerSprite();
        this.updateTriggerCount();
    };

    TriggerQTE.prototype.updateTimerSprite = function () {
        this._timerValue -= 1;
        var v = this.timerText(this._timerValue);
        this._numberSprite.bitmap.clear();
        this._numberSprite.bitmap.drawText(v + ' ', 0, 0,
                                           this._menuBack.width,
                                           this._menuBack.height, 'right');
        var w = (this._timeBar.width - 2) * (this._timerValue / preparedT[1]);
        var bmp = this._timeBar.bitmap;
        bmp.clear();
        bmp.fillRect(0, bmp.height - 8, bmp.width, 8, css(CFG.BarBackColor));
        bmp.fillRect(1, bmp.height - 7, w, 6, css(CFG.TriggerBarColor));
        if (v <= 0) { this.minigameFailure(); }
    };

    TriggerQTE.prototype.updateTriggerCount = function () {
        var full = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'A', 'B', 'C', 'X', 'Y', 'Z', 'L', 'R'];
        for (var i = 0; i < full.length; i++) {
            var name = MonlineQTE.buttonInput(full[i]);
            if (!name) { continue; }
            if (Input.isTriggered(name)) {
                if (full[i] === this._pattern[this._correct]) { this.onTriggerRight(); }
                else { this.onTriggerWrong(); }
                break;
            }
        }
    };

    TriggerQTE.prototype.onTriggerRight = function () {
        var bit = this.getButtonImage('GOOD');
        this._menuTop.bitmap.blt(bit.width * this._correct, this._topEdge, bit, rectOf(bit));
        this._correct += 1;
        if (this._correct >= this._pattern.length) { this.minigameSuccess(); return; }
        playSe(CFG.TriggerButtonGood);
    };

    TriggerQTE.prototype.onTriggerWrong = function () {
        if (CFG.TriggerWrong === 1) {
            playSe(CFG.TriggerButtonBad);
        } else if (CFG.TriggerWrong === 2) {
            playSe(CFG.TriggerButtonBad);
            this._correct = 0;
            this._menuTop.bitmap.clear();
        } else if (CFG.TriggerWrong === 3) {
            var bit = this.getButtonImage('BAD');
            this._menuTop.bitmap.blt(bit.width * this._correct, this._topEdge, bit, rectOf(bit));
            this.minigameFailure();
        }
    };

    TriggerQTE.prototype.minigameSuccess = function () { playSe(CFG.TriggerSuccess); Scene_CPMinigame.prototype.minigameSuccess.call(this); };
    TriggerQTE.prototype.minigameFailure = function () { playSe(CFG.TriggerFailure); Scene_CPMinigame.prototype.minigameFailure.call(this); };
    TriggerQTE.prototype.setCompleteVariable = function () {
        if ($gameVariables) { $gameVariables.setValue(CFG.GameVariable, this._correct); }
    };

    //-------------------------------------------------------------------------
    // MatchQTE (0258.rb:679)
    //-------------------------------------------------------------------------
    function MatchQTE() { this.initialize.apply(this, arguments); }
    MatchQTE.prototype = Object.create(Scene_CPMinigame.prototype);
    MatchQTE.prototype.constructor = MatchQTE;

    var preparedS = [CFG.DefSMatch, CFG.DefSTime, CFG.DefSButtons];

    MatchQTE.play = function (match, time, buttons) {
        Scene_CPMinigame.getBackgroundImage();
        preparedS = [match === undefined ? CFG.DefSMatch : match,
                     time === undefined ? CFG.DefSTime : time,
                     buttons === undefined ? CFG.DefSButtons : buttons];
        SceneManager.push(MatchQTE);
        return true;
    };

    MatchQTE.prototype.createGameSprites = function () {
        this.createQtePattern();
        this.createMenuSprite();
        this.createMenuTop();
        this.createPointer();
        this.createTimeBar();
    };

    MatchQTE.prototype.createQtePattern = function () {
        this._pattern = [];
        this._matches = [];
        var pool = preparedS[2] || CFG.DefSButtons;
        for (var i = 0; i < preparedS[0]; i++) {
            this._pattern.push(pool[Math.floor(Math.random() * pool.length)]);
        }
    };

    MatchQTE.prototype.createMenuSprite = function () {
        var temp = this.getButtonImage('A');
        var wd = temp.width * (this._pattern.length + 2);
        var bit0 = systemImage(CFG.SBackImage) || emptyBitmap();
        this._menuBack = new Sprite();
        this.addChild(this._menuBack);
        this._menuBack.bitmap = new Bitmap(wd, Math.max(bit0.height, temp.height));
        this._menuBack.bitmap.stretchBlt(
            new Rectangle(0, (this._menuBack.height - bit0.height) / 2,
                          wd, bit0.height), bit0, rectOf(bit0));
        this._topEdge = (this._menuBack.height - temp.height) / 2;
        for (var i = 0; i < this._pattern.length; i++) {
            var bit = this.getButtonImage(this._pattern[i]);
            this._menuBack.bitmap.blt(bit.width * (i + 1), this._topEdge, bit, rectOf(bit));
        }
        setOrigin(this._menuBack, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._menuBack.x = Graphics.width / 2;
        this._menuBack.y = Graphics.height / 2 - 4;
    };

    MatchQTE.prototype.createMenuTop = function () {
        this._menuTop = new Sprite();
        this.addChild(this._menuTop);
        this._menuTop.bitmap = new Bitmap(this._menuBack.width, this._menuBack.height);
        this._menuTop.z = 50;
        setOrigin(this._menuTop, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._menuTop.x = this._menuBack.x;
        this._menuTop.y = this._menuBack.y;
    };

    MatchQTE.prototype.createPointer = function () {
        this._pointer = new Sprite();
        this.addChild(this._pointer);
        this._pointer.bitmap = this.getButtonImage('ARROW');
        // ox = @menu_back.ox - offset ; oy = @menu_back.oy + @pointer.height
        setOrigin(this._pointer, this._menuBack.width / 2 - CFG.SPointerOffset,
                  this._menuBack.height / 2 + this._pointer.height);
        this._pointer.x = this._menuBack.x;
        this._pointer.y = this._menuBack.y;
    };

    MatchQTE.prototype.createTimeBar = function () {
        this._timeBar = new Sprite();
        this.addChild(this._timeBar);
        this._timeBar.bitmap = new Bitmap(this._menuBack.width, this._menuBack.height + 8);
        setOrigin(this._timeBar, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._timeBar.x = this._menuBack.x;
        this._timeBar.y = this._menuBack.y;
        this._timerValue = 0;
        this._pos = 0;
        this._timeBar.bitmap.fillRect(0, this._timeBar.height - 8,
                                      this._timeBar.width, 8, css(CFG.BarBackColor));
    };

    MatchQTE.prototype.updateGame = function () {
        this.updateTimerSprite();
        this.updateMatchCount();
    };

    MatchQTE.prototype.updateTimerSprite = function () {
        this._timerValue += 1;
        var bmp = this._timeBar.bitmap;
        var w = (this._timeBar.width - 2) * (this._timerValue / preparedS[1]);
        bmp.clear();
        bmp.fillRect(0, bmp.height - 8, bmp.width, 8, css(CFG.BarBackColor));
        bmp.fillRect(1, bmp.height - 7, w, 6, css(CFG.MatchBarColor));
        this._pos = Math.floor(this._timerValue / (preparedS[1] / (preparedS[0] + 2)));
        this._pos = Math.min(this._pos, preparedS[0] + 1);
        if (this._timerValue >= preparedS[1]) { this.checkMinigameValue(); return; }
        this._pointer.x = this._menuBack.x + (this._pos * this._pointer.width);
        this.checkLastPos();
    };

    MatchQTE.prototype.updateMatchCount = function () {
        if (this._pos === 0 || !this._pattern[this._pos - 1] ||
            this._matches[this._pos - 1] !== undefined) { return; }
        var full = ['LEFT', 'RIGHT', 'UP', 'DOWN', 'A', 'B', 'C', 'X', 'Y', 'Z', 'L', 'R'];
        for (var i = 0; i < full.length; i++) {
            var name = MonlineQTE.buttonInput(full[i]);
            if (!name) { continue; }
            if (Input.isTriggered(name)) {
                this._matches[this._pos - 1] = full[i];
                if (full[i] === this._pattern[this._pos - 1]) { this.onTriggerRight(); }
                else { this.onTriggerWrong(); }
                break;
            }
        }
    };

    MatchQTE.prototype.checkLastPos = function () {
        if (this._pos < 2 || this._matches[this._pos - 2] !== undefined) { return; }
        this._matches[this._pos - 2] = false;
        if (CFG.MatchWrong !== 1) { this.onTriggerWrong(this._pos - 1); }
    };

    MatchQTE.prototype.onTriggerRight = function () {
        playSe(CFG.MatchButtonGood);
        var bit = this.getButtonImage('GOOD');
        this._menuTop.bitmap.blt(bit.width * this._pos, this._topEdge, bit, rectOf(bit));
    };

    MatchQTE.prototype.onTriggerWrong = function (pos) {
        var p = (pos === undefined) ? this._pos : pos;
        if (CFG.MatchWrong === 1) {
            playSe(CFG.TriggerButtonBad);
        } else if (CFG.MatchWrong === 2) {
            this.fillInWrongTrigger(p);
        } else if (CFG.MatchWrong === 3) {
            var bit = this.getButtonImage('BAD');
            this._menuTop.bitmap.blt(bit.width * p, this._topEdge, bit, rectOf(bit));
            this.minigameFailure();
        }
    };

    MatchQTE.prototype.fillInWrongTrigger = function (pos) {
        playSe(CFG.MatchButtonBad);
        var bit = this.getButtonImage('BAD');
        this._menuTop.bitmap.blt(bit.width * pos, this._topEdge, bit, rectOf(bit));
    };

    MatchQTE.prototype.checkMinigameValue = function () {
        for (var i = 0; i < this._pattern.length; i++) {
            if (this._matches[i] !== this._pattern[i]) { return this.minigameFailure(); }
        }
        return this.minigameSuccess();
    };

    MatchQTE.prototype.minigameSuccess = function () { playSe(CFG.MatchSuccess); Scene_CPMinigame.prototype.minigameSuccess.call(this); };
    MatchQTE.prototype.minigameFailure = function () { playSe(CFG.MatchFailure); Scene_CPMinigame.prototype.minigameFailure.call(this); };
    MatchQTE.prototype.setCompleteVariable = function () {
        var n = 0;
        for (var i = 0; i < this._pattern.length; i++) {
            if (this._pattern[i] === this._matches[i]) { n += 1; }
        }
        if ($gameVariables) { $gameVariables.setValue(CFG.GameVariable, n); }
    };

    //-------------------------------------------------------------------------
    // TargetQTE (0258.rb:912)
    //-------------------------------------------------------------------------
    function TargetQTE() { this.initialize.apply(this, arguments); }
    TargetQTE.prototype = Object.create(Scene_CPMinigame.prototype);
    TargetQTE.prototype.constructor = TargetQTE;

    var preparedX = [CFG.DefXZoom, CFG.DefXTime, CFG.DefXSpeed];

    TargetQTE.play = function (zoom, time, speed) {
        Scene_CPMinigame.getBackgroundImage();
        preparedX = [zoom === undefined ? CFG.DefXZoom : zoom,
                     time === undefined ? CFG.DefXTime : time,
                     speed === undefined ? CFG.DefXSpeed : speed];
        SceneManager.push(TargetQTE);
        return true;
    };

    TargetQTE.prototype.createGameSprites = function () {
        this.createMenuSprite();
        this.createSliderSprite();
        this.createNumberSprites();
    };

    // 0258.rb:928
    TargetQTE.prototype.createMenuSprite = function () {
        var bit0 = systemImage(CFG.XBackImage) || emptyBitmap();
        var bit1 = ImageManager.loadSystem(CFG.XBarImage);
        var bit2 = ImageManager.loadSystem(CFG.TargetImage);
        var mh = Math.max(bit0.height, bit2.height);
        var offx = bit1.height + ((mh - bit0.height) / 2);
        this._menuBack = new Sprite();
        this.addChild(this._menuBack);
        this._menuBack.bitmap = new Bitmap(bit1.width, bit1.height + mh);
        this._menuBack.bitmap.stretchBlt(
            new Rectangle(0, offx, bit1.width, bit0.height), bit0, rectOf(bit0));
        this._menuBack.bitmap.blt(0, offx, bit2, rectOf(bit2));
        var sx = (bit1.width * preparedX[0] - bit1.width) / 2;
        var sw = bit1.width - sx * 2;
        this._menuBack.bitmap.stretchBlt(
            new Rectangle(0, 0, bit1.width, bit1.height), bit1,
            new Rectangle(sx, 0, sw, bit1.height));
        this._hiSection = (bit1.width / 2) / preparedX[2];
        this._loSection = -this._hiSection;
        setOrigin(this._menuBack, this._menuBack.width / 2,
                  this._menuBack.height / 2);
        this._menuBack.x = Graphics.width / 2;
        this._menuBack.y = Graphics.height / 2;
    };

    // 0258.rb:950
    TargetQTE.prototype.createSliderSprite = function () {
        this._slider = new Sprite();
        this.addChild(this._slider);
        this._slider.bitmap = ImageManager.loadSystem(CFG.TargetSlider);
        this._slider.z = 50;
        // ox = width / 2 ; oy = @menu_back.oy + height - SliderOffset
        setOrigin(this._slider, this._slider.width / 2,
                  this._menuBack.height / 2 + this._slider.height - CFG.SliderOffset);
        this._slider.x = this._menuBack.x + this._loSection * preparedX[2];
        this._slider.y = this._menuBack.y;
        this._pos = this._loSection;
    };

    // 0258.rb:961
    TargetQTE.prototype.createNumberSprites = function () {
        var bit = ImageManager.loadSystem(CFG.XBarImage);
        this._numberSprite = new Sprite();
        this.addChild(this._numberSprite);
        this._numberSprite.bitmap = new Bitmap(this._menuBack.width,
                                               this._menuBack.height - bit.height);
        setOrigin(this._numberSprite, this._menuBack.width / 2, 0);   // oy = 0
        this._numberSprite.x = this._menuBack.x;
        this._numberSprite.y = this._menuBack.y;
        this._timerValue = preparedX[1];
        var v = this.timerText(this._timerValue);
        this._numberSprite.bitmap.drawText(v + ' ', 0, 0,
                                           this._menuBack.width,
                                           this._menuBack.height - bit.height, 'right');
    };

    TargetQTE.prototype.updateGame = function () {
        this.updateSliderSprite();
        this.updateTimerSprite();
        this.updateTapCount();
    };

    // 0258.rb:981
    TargetQTE.prototype.updateSliderSprite = function () {
        if (this._pos === this._loSection) { this._dir = 1; }
        else if (this._pos === this._hiSection) { this._dir = -1; }
        this._pos += this._dir;
        this._slider.x = this._menuBack.x + this._pos * preparedX[2];
    };

    // 0258.rb:991
    TargetQTE.prototype.updateTimerSprite = function () {
        this._timerValue -= 1;
        var v = this.timerText(this._timerValue);
        this._numberSprite.bitmap.clear();
        this._numberSprite.bitmap.drawText(v + ' ', 0, 0,
                                           this._numberSprite.width,
                                           this._numberSprite.height, 'right');
        if (v <= 0) { this.minigameFailure(); }
    };

    // 0258.rb:999
    TargetQTE.prototype.updateTapCount = function () {
        var name = MonlineQTE.buttonInput(CFG.TargetButton) || 'ok';
        if (!Input.isTriggered(name)) { return; }
        var spot = Math.abs(this._pos * preparedX[2]);
        var area = (this._menuBack.width * preparedX[0] * CFG.TargetArea) / 2;
        if (area >= spot) { this.minigameSuccess(); }
        else { this.onTargetWrong(); }
    };

    // 0258.rb:1011
    TargetQTE.prototype.onTargetWrong = function () {
        if (CFG.TargetWrong === 1) {
            playSe(CFG.TargetButtonBad);
            this._pos = this._loSection;
        } else if (CFG.TargetWrong === 2) {
            this.minigameFailure();
        }
    };

    TargetQTE.prototype.minigameSuccess = function () { playSe(CFG.TargetSuccess); Scene_CPMinigame.prototype.minigameSuccess.call(this); };
    TargetQTE.prototype.minigameFailure = function () { playSe(CFG.TargetFailure); Scene_CPMinigame.prototype.minigameFailure.call(this); };

    //-------------------------------------------------------------------------
    // Publish - the event scripts call these as `MashQTE.play(...)`.
    // Scene_CPMinigame goes out too: it is a top level class in 0258.rb, so a
    // script that pokes at the base scene directly has to be able to find it.
    //-------------------------------------------------------------------------
    window.Scene_CPMinigame = Scene_CPMinigame;
    window.MashQTE = MashQTE;
    window.TriggerQTE = TriggerQTE;
    window.MatchQTE = MatchQTE;
    window.TargetQTE = TargetQTE;

    MonlineQTE.Scene_CPMinigame = Scene_CPMinigame;
    MonlineQTE.MashQTE = MashQTE;
    MonlineQTE.TriggerQTE = TriggerQTE;
    MonlineQTE.MatchQTE = MatchQTE;
    MonlineQTE.TargetQTE = TargetQTE;
    MonlineQTE.CFG = CFG;

    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        F.Scene_CPMinigame = Scene_CPMinigame;
        F.MashQTE = MashQTE;
        F.TriggerQTE = TriggerQTE;
        F.MatchQTE = MatchQTE;
        F.TargetQTE = TargetQTE;
    }

    console.log('[MonlineQTE] loaded');
})();
