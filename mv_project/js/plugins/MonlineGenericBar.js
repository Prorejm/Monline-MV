//=============================================================================
// MonlineGenericBar.js
//=============================================================================
/*:
 * @plugindesc Port of Holy87 "Generic Bars on Maps" (0208.rb): set_bar / show_bar / set_bar_value / flash_bar / snooze_bar / remove_bar.
 * @author Monline port
 *
 * @help
 * 0208.rb draws a free-floating progress bar straight onto the map, with no
 * window skin, and the game leans on it constantly:
 *
 *     color_Pink = Color.new(255,120,210)
 *     set_bar(:Succ, "Control", color_Pink, 10, 10)
 *     set_bar_value(:Succ, privar)
 *     show_bar(:Succ)
 *     flash_bar(:Succ)          # 136 call sites
 *     snooze_bar(:Succ)         # 18
 *     remove_bar(:slut)         # 12
 *
 * Measured call volume: set_bar_value 224, flash_bar 136, snooze_bar 18,
 * remove_bar 12, set_bar 8, show_bar 8.  Before this port every one of those
 * was a no-op (the shim only neutralised `snooze_bar`/`remove_bar`, and the
 * rest fell through to the bridge's auto-stub), so the "Control" / "Mind" /
 * "Cake Progress" meters that drive several scenes were simply invisible.
 *
 * ---------------------------------------------------------------------------
 * Geometry, straight from the Ruby
 * ---------------------------------------------------------------------------
 *   H87_GBSettings: colour [0,120,250], x 10, y 10, w 200, h 40, BarHeight 10
 *   @sp = 5 (spacing), @lb = BarHeight
 *
 *   background bitmap  (w+4, h+4)
 *     fill_rect(2, 2, w, h, Color.new(0,0,0,150))
 *     blur
 *     fill_rect(sp, h-(sp+lb), w-sp*2, lb, Color.new(r/2, g/2, b/2))
 *     draw_text(sp, sp, w-sp, 24, title)
 *     sprite at (x-2, y-2)
 *
 *   bar bitmap  (1, lb) filled with the bar colour
 *     sprite at (rect.x + sp, rect.y + rect.height - sp - lb - 4)
 *     zoom_x is used AS the width in pixels (the source bitmap is 1px wide),
 *     eased: dist = target - zoom_x; zoom_x += dist/2
 *
 * Positions are literal, not scaled: the port ships the VX Ace imagery at its
 * original pixel size on a 1.5x larger screen everywhere else too (see
 * MonlineIconSet), so scaling only the bars would make them disagree with the
 * rest of the UI.
 */
//=============================================================================

var MonlineGenericBar = MonlineGenericBar || {};

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // Configuration - verbatim from 0208.rb:69 H87_GBSettings
    //-------------------------------------------------------------------------
    var CFG = {
        Default_Color: [0, 120, 250],
        DefaultX: 10,
        DefaultY: 10,
        DefaultWidth: 200,
        DefaultHeight: 40,
        BarHeight: 10
    };

    var SP = 5;                 // 0208.rb:270 `@sp = 5`
    var DEFAULT_KEY = 'default';

    function num(v, fallback) {
        var n = parseFloat(v);
        return isNaN(n) ? fallback : n;
    }
    function clamp255(v) {
        var n = Math.round(num(v, 0));
        return n < 0 ? 0 : (n > 255 ? 255 : n);
    }
    function css(r, g, b, a) {
        return 'rgba(' + clamp255(r) + ',' + clamp255(g) + ',' + clamp255(b) +
               ',' + (clamp255(a === undefined ? 255 : a) / 255).toFixed(3) + ')';
    }
    function isColor(v) {
        return !!(v && typeof v === 'object' && typeof v.red === 'number');
    }
    function colorOf(v) {
        if (isColor(v)) { return v; }
        if (Object.prototype.toString.call(v) === '[object Array]' && v.length >= 3) {
            return { red: v[0], green: v[1], blue: v[2],
                     alpha: v.length > 3 ? v[3] : 255 };
        }
        return defaultColor();
    }
    function defaultColor() {
        return { red: CFG.Default_Color[0], green: CFG.Default_Color[1],
                 blue: CFG.Default_Color[2], alpha: 255 };
    }
    function keyOf(name) {
        if (name === undefined || name === null || name === '') { return DEFAULT_KEY; }
        return String(name);
    }

    //-------------------------------------------------------------------------
    // Game_System - the bar settings live here so they survive a save/load
    // (0208.rb:91).  One record per bar, laid out exactly like the Ruby array:
    //
    //   0 x        1 y         2 width     3 height   4 title
    //   5 colour   6 visible   7 percent   8 changed  9 width-settled
    //-------------------------------------------------------------------------
    function records() {
        var s = $gameSystem;
        if (!s) { return null; }
        if (!s._barSettings) { s._barSettings = {}; }
        return s._barSettings;
    }

    function resetRecord(key) {
        // 0208.rb:104 reset_bar_h
        return [CFG.DefaultX, CFG.DefaultY, CFG.DefaultWidth, CFG.DefaultHeight,
                '', defaultColor(), false, 0, false, false];
    }

    Game_System.prototype.generic_bar_settings = function (bar) {
        var st = records();
        if (!st) { return resetRecord(DEFAULT_KEY); }
        var k = keyOf(bar);
        if (!st[k]) { st[k] = resetRecord(k); }
        return st[k];
    };
    Game_System.prototype.bar_settings = Game_System.prototype.generic_bar_settings;

    Game_System.prototype.active_bars = function () {
        var st = records();
        return st || {};
    };

    // 0208.rb:163
    Game_System.prototype.generic_bar_set = function (letter, colore, x, y, bar) {
        var st = records();
        if (!st) { return; }
        var k = keyOf(bar);
        if (!st[k]) {
            // 0208.rb:165-168 - note the Ruby resets :default here (it calls
            // `reset_bar_h` with no argument) and then adds the named bar.
            st[DEFAULT_KEY] = resetRecord(DEFAULT_KEY);
            addActiveBar(k);
        }
        var rec = st[k] || (st[k] = resetRecord(k));
        if (x !== undefined && x !== null) { rec[0] = num(x, rec[0]); }
        if (y !== undefined && y !== null) { rec[1] = num(y, rec[1]); }
        rec[4] = letter === undefined || letter === null ? '' : String(letter);
        rec[5] = colorOf(colore);
        rec[8] = true;                      // flag di modifica per refresh
    };

    // 0208.rb:178
    Game_System.prototype.set_bar = function (bar, text, colore, x, y) {
        this.generic_bar_set(text, colore, x, y, bar);
    };

    // 0208.rb:191 - `:default` is pre-created by the spriteset, never by this.
    function addActiveBar(name) {
        var k = keyOf(name);
        if (k === DEFAULT_KEY) { return; }
        var st = records();
        if (!st) { return; }
        if (st[k]) { return; }
        st[k] = resetRecord(k);
        var scene = currentScene();
        if (scene && typeof scene.addGenbar === 'function') { scene.addGenbar(k); }
    }

    // 0208.rb:201
    function removeActiveBar(name) {
        var k = keyOf(name);
        if (k === DEFAULT_KEY) { return; }
        var st = records();
        if (st) { delete st[k]; }
        var scene = currentScene();
        if (scene && typeof scene.removeGenbar === 'function') { scene.removeGenbar(k); }
    }

    // 0208.rb:209 / :219
    Game_System.prototype.show_generic_bar = function (bar) {
        var rec = this.generic_bar_settings(bar);
        if (rec[6]) { return; }
        rec[6] = true;
        rec[8] = true;
    };
    Game_System.prototype.hide_generic_bar = function (bar) {
        var rec = this.generic_bar_settings(bar);
        if (!rec[6]) { return; }
        rec[6] = false;
        rec[8] = true;
    };

    // 0208.rb:229 - clamped to 0..100 like the Ruby
    Game_System.prototype.bar_percentage = function (value, bar) {
        var rec = this.generic_bar_settings(bar);
        var v = num(value, 0);
        if (v < 0) { v = 0; }
        if (v > 100) { v = 100; }
        rec[7] = v;
        rec[9] = false;                     // width must be re-eased
    };
    // 0208.rb:240
    Game_System.prototype.get_bar_percentage = function (bar) {
        var rec = this.generic_bar_settings(bar);
        return rec[7] || 0;
    };
    // 0208.rb:248
    Game_System.prototype.bar_resize = function (w, h, bar) {
        var rec = this.generic_bar_settings(bar);
        rec[2] = num(w, rec[2]);
        rec[3] = num(h, rec[3]);
        rec[8] = true;
    };

    function currentScene() {
        try {
            return (typeof SceneManager !== 'undefined') ? SceneManager.scene : null;
        } catch (e) {
            return null;
        }
    }

    //-------------------------------------------------------------------------
    // Barra_Generica (0208.rb:258)
    //-------------------------------------------------------------------------
    function GenericBar(container, name) {
        this._name = keyOf(name);
        this._lb = CFG.BarHeight;
        this._container = container;
        this._snoozeTime = 0;
        this._snoozeStr = 0;
        this._flashTime = 0;
        this._flashDur = 0;
        this._flashColor = null;
        this._rect = new Sprite();
        this._barSprite = new Sprite();
        container.addChild(this._rect);
        container.addChild(this._barSprite);
        this.resetSettings(false);
    }

    // 0208.rb:278
    GenericBar.prototype.resetSettings = function (update) {
        var rec = this.record();
        this._x = num(rec[0], CFG.DefaultX);
        this._y = num(rec[1], CFG.DefaultY);
        this._w = num(rec[2], CFG.DefaultWidth);
        this._h = num(rec[3], CFG.DefaultHeight);
        this._letter = rec[4] || '';
        this._color = colorOf(rec[5]);
        this._visible = !!rec[6];
        this.build(update);
    };

    GenericBar.prototype.record = function () {
        return $gameSystem ? $gameSystem.generic_bar_settings(this._name) :
                             resetRecord(this._name);
    };

    // 0208.rb:293 start -> create_main_graphic + create_bar
    GenericBar.prototype.build = function (update) {
        var bw = this._w + 4;
        var bh = this._h + 4;

        // ---- create_main_graphic (0208.rb:300) ----
        if (!this._rectBmp || this._rectBmp.width !== bw ||
            this._rectBmp.height !== bh) {
            this._rectBmp = new Bitmap(bw, bh);
            this._rect.bitmap = this._rectBmp;
        }
        var bmp = this._rectBmp;
        bmp.clear();
        bmp.fillRect(2, 2, this._w, this._h, css(0, 0, 0, 150));
        bmp.blur();
        var back = { red: Math.floor(this._color.red / 2),
                     green: Math.floor(this._color.green / 2),
                     blue: Math.floor(this._color.blue / 2) };
        bmp.fillRect(SP, this._h - (SP + this._lb), this._w - SP * 2, this._lb,
                     css(back.red, back.green, back.blue, 255));
        bmp.fontSize = 20;
        bmp.drawText(this._letter, SP, SP, this._w - SP, 24, 'left');

        this._rect.x = this._x - 2;
        this._rect.y = this._y - 2;
        this._rect.opacity = this._visible ? 255 : 0;
        this._baseRectX = this._rect.x;
        this._baseRectY = this._rect.y;

        // ---- create_bar (0208.rb:317) ----
        this._barBmp = new Bitmap(1, this._lb);
        this._barBmp.fillRect(0, 0, 1, this._lb,
                              css(this._color.red, this._color.green,
                                  this._color.blue, this._color.alpha));
        this._barSprite.bitmap = this._barBmp;
        this._barSprite.x = this._rect.x + SP;
        this._barSprite.y = this._rect.y + bh - SP - this._lb - 4;
        this._barSprite.scale.x = 1;
        this._barSprite.opacity = this._visible ? 255 : 0;
        this._baseBarX = this._barSprite.x;
        this._baseBarY = this._barSprite.y;

        var rec = this.record();
        rec[9] = false;
    };

    GenericBar.prototype.setVisible = function (vis) {
        this._visible = !!vis;
        this._rect.opacity = this._visible ? 255 : 0;
        this._barSprite.opacity = this._visible ? 255 : 0;
    };

    // 0208.rb:341
    GenericBar.prototype.flash = function (time, color) {
        this._flashDur = Math.max(num(time, 30), 1);
        this._flashTime = this._flashDur;
        this._flashColor = colorOf(color || { red: 255, green: 255, blue: 255,
                                              alpha: 255 });
    };

    // 0208.rb:348
    GenericBar.prototype.snooze = function (time, str) {
        var s = num(str, 5);
        var t = num(time, 20);
        if (s < 0) { s = 0; }
        if (t < 0) { t = 0; }
        if (s > 20) { s = 20; }
        this._snoozeStr = s;
        this._snoozeTime = t;
    };

    // 0208.rb:358
    GenericBar.prototype.update = function () {
        var rec = this.record();
        if (rec[8]) {
            this.resetSettings(true);
            rec[8] = false;
            return;
        }
        if (this._visible) {
            this.barUpdate();
            this.snoozeUpdate();
            this.effectsUpdate();
        } else {
            this.effectsUpdate();
        }
    };

    // 0208.rb:406
    GenericBar.prototype.barUpdate = function () {
        var rec = this.record();
        if (rec[9]) { return; }
        var percent = num(rec[7], 0);
        var width = this._w - SP * 2;
        var larg = (width / 100) * percent;
        var distanza = larg - this._barSprite.scale.x;
        this._barSprite.scale.x += distanza / 2;
        if (distanza < 1 && distanza > -1) { rec[9] = true; }
    };

    // 0208.rb:373
    GenericBar.prototype.snoozeUpdate = function () {
        if (this._snoozeTime <= 0) { return; }
        var rx = 0, ry = 0;
        if (this._snoozeTime % 2 === 0) {
            // `rand(n)` is 0..n-1 in Ruby; RGSS draws the sprite at (x - ox).
            rx = Math.floor(Math.random() * this._snoozeStr) -
                 Math.floor(this._snoozeStr / 2);
            ry = Math.floor(Math.random() * this._snoozeStr) -
                 Math.floor(this._snoozeStr / 2);
        }
        this._barSprite.x = this._baseBarX - rx;
        this._barSprite.y = this._baseBarY - ry;
        this._rect.x = this._baseRectX - rx;
        this._rect.y = this._baseRectY - ry;
        this._snoozeTime -= 1;
        if (this._snoozeTime === 0) {
            this._barSprite.x = this._baseBarX;
            this._barSprite.y = this._baseBarY;
            this._rect.x = this._baseRectX;
            this._rect.y = this._baseRectY;
        }
    };

    // 0208.rb:399 - flash decay.  MV's Sprite has no #flash, so the blend
    // colour is driven manually at the same alpha ramp RGSS uses.
    GenericBar.prototype.effectsUpdate = function () {
        if (this._flashTime > 0) {
            var k = this._flashTime / this._flashDur;
            var c = this._flashColor || { red: 255, green: 255, blue: 255 };
            var a = Math.round(255 * k);
            var col = [c.red, c.green, c.blue, a];
            this._rect.setBlendColor(col);
            this._barSprite.setBlendColor(col);
            this._flashTime -= 1;
            if (this._flashTime <= 0) {
                this._rect.setBlendColor([0, 0, 0, 0]);
                this._barSprite.setBlendColor([0, 0, 0, 0]);
            }
        }
    };

    GenericBar.prototype.dispose = function () {
        if (this._rect && this._rect.parent) { this._rect.parent.removeChild(this._rect); }
        if (this._barSprite && this._barSprite.parent) {
            this._barSprite.parent.removeChild(this._barSprite);
        }
        this._rect = null;
        this._barSprite = null;
        this._rectBmp = null;
        this._barBmp = null;
    };

    //-------------------------------------------------------------------------
    // Spriteset_Map (0208.rb:429)
    //-------------------------------------------------------------------------
    function BarLayer(spriteset) {
        this._spriteset = spriteset;
        this._container = new Sprite();
        // The Ruby draws into Scene_Map's viewport, i.e. above the tilemap and
        // the pictures; 300 keeps it clear of both.
        this._container.z = 300;
        spriteset.addChild(this._container);
        this._bars = {};
        this.create();
    }

    // 0208.rb:457
    BarLayer.prototype.create = function () {
        this._bars[DEFAULT_KEY] = new GenericBar(this._container, DEFAULT_KEY);
        var st = records() || {};
        Object.keys(st).forEach(function (k) {
            if (k === DEFAULT_KEY || !st[k]) { return; }
            this.add(k);
        }, this);
    };

    BarLayer.prototype.add = function (name) {
        var k = keyOf(name);
        if (this._bars[k]) { return this._bars[k]; }
        this._bars[k] = new GenericBar(this._container, k);
        return this._bars[k];
    };

    BarLayer.prototype.remove = function (name) {
        var k = keyOf(name);
        var b = this._bars[k];
        if (!b) { return; }
        b.setVisible(false);
        b.dispose();
        delete this._bars[k];
    };

    BarLayer.prototype.get = function (name) { return this._bars[keyOf(name)]; };

    BarLayer.prototype.update = function () {
        Object.keys(this._bars).forEach(function (k) {
            this._bars[k].update();
        }, this);
    };

    BarLayer.prototype.dispose = function () {
        Object.keys(this._bars).forEach(function (k) { this._bars[k].dispose(); }, this);
        this._bars = {};
        if (this._container && this._container.parent) {
            this._container.parent.removeChild(this._container);
        }
        this._container = null;
        this._spriteset = null;
    };

    function layer() {
        var scene = currentScene();
        if (scene && scene._spriteset && scene._spriteset._monlineBars) {
            return scene._spriteset._monlineBars;
        }
        return null;
    }
    MonlineGenericBar.layer = layer;
    MonlineGenericBar.records = records;

    function attach(proto) {
        var _createUpper = proto.createUpperLayer;
        proto.createUpperLayer = function () {
            _createUpper.call(this);
            this._monlineBars = new BarLayer(this);
        };
        var _update = proto.update;
        proto.update = function () {
            _update.call(this);
            if (this._monlineBars) { this._monlineBars.update(); }
        };
        var _dispose = proto.dispose;
        proto.dispose = function () {
            if (this._monlineBars) {
                this._monlineBars.dispose();
                this._monlineBars = null;
            }
            _dispose.call(this);
        };
    }
    attach(Spriteset_Map.prototype);

    //-------------------------------------------------------------------------
    // Scene_Map delegation (0208.rb:644) + the empty Scene_Base versions
    //-------------------------------------------------------------------------
    Scene_Map.prototype.addGenbar = function (name) {
        if (this._spriteset && this._spriteset._monlineBars) {
            this._spriteset._monlineBars.add(name);
        }
    };
    Scene_Map.prototype.removeGenbar = function (name) {
        if (this._spriteset && this._spriteset._monlineBars) {
            this._spriteset._monlineBars.remove(name);
        }
    };
    Scene_Map.prototype.barFlash = function (time, color, bar) {
        var l = layer();
        if (!l) { return; }
        var b = l.get(bar);
        if (b) { b.flash(time, color); }
    };
    Scene_Map.prototype.barSnooze = function (time, str, bar) {
        var l = layer();
        if (!l) { return; }
        var b = l.get(bar);
        if (b) { b.snooze(time, str); }
    };

    //-------------------------------------------------------------------------
    // Game_Interpreter script calls (0208.rb:516)
    //-------------------------------------------------------------------------
    function barName(v) { return keyOf(v); }

    // 0208.rb:520 - `set_bar(:name, "Text", color, x, y)` vs `set_bar("Text")`
    function set_bar(a, b, c, d, e) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length > 1 && !isColor(args[1])) {
            return setCustomBar(a, b, c, d, e);
        }
        return setGenbar(a, b, c, d);
    }
    // 0208.rb:530
    function setGenbar(text, color, x, y) {
        if (!$gameSystem) { return false; }
        $gameSystem.generic_bar_set(text, color === undefined ? defaultColor() : color,
                                    x, y, DEFAULT_KEY);
        return true;
    }
    // 0208.rb:536
    function setCustomBar(barNameArg, letter, color, x, y) {
        if (!$gameSystem) { return false; }
        $gameSystem.generic_bar_set(letter,
                                    color === undefined ? defaultColor() : color,
                                    x, y, barName(barNameArg));
        return true;
    }
    // 0208.rb:542 / :548
    function hide_bar(name) {
        if (!$gameSystem) { return false; }
        $gameSystem.hide_generic_bar(barName(name));
        return true;
    }
    function show_bar(name) {
        if (!$gameSystem) { return false; }
        $gameSystem.show_generic_bar(barName(name));
        return true;
    }
    // 0208.rb:554 - one argument means the default bar
    function set_bar_value(a, b) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length > 1) { return barValue(args[1], args[0]); }
        return barValue(args[0]);
    }
    // 0208.rb:560
    function barValue(value, name) {
        if (!$gameSystem) { return false; }
        $gameSystem.bar_percentage(value, barName(name));
        return true;
    }
    // 0208.rb:566
    function resize_bar(a, b, c) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length > 2) { return barResize(args[1], args[2], args[0]); }
        return barResize(args[0], args[1]);
    }
    function barResize(w, h, name) {
        if (!$gameSystem) { return false; }
        $gameSystem.bar_resize(w, h, barName(name));
        return true;
    }
    // 0208.rb:578
    function add_bar(name) {
        addActiveBar(name);
        return true;
    }
    // 0208.rb:584
    function remove_bar(name) {
        removeActiveBar(name);
        return true;
    }
    // 0208.rb:590
    function flash_bar(a, b, c) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length === 0 || typeof args[0] !== 'number') {
            return flashBarOld(args[0], args[1], args[2]);
        }
        return flashBarOld(DEFAULT_KEY, args[0], args[1]);
    }
    // 0208.rb:600
    function flashBarOld(bar, time, color) {
        var scene = currentScene();
        if (scene && typeof scene.barFlash === 'function') {
            scene.barFlash(time === undefined ? 30 : time,
                           color === undefined ? { red: 255, green: 255,
                                                   blue: 255, alpha: 255 } : color,
                           barName(bar));
        }
        return true;
    }
    // 0208.rb:606
    function snooze_bar(a, b, c) {
        var args = Array.prototype.slice.call(arguments);
        if (args.length === 0 || typeof args[0] !== 'number') {
            return snoozeBarOld(args[0], args[1], args[2]);
        }
        return snoozeBarOld(DEFAULT_KEY, args[0], args[1]);
    }
    // 0208.rb:616
    function snoozeBarOld(bar, time, str) {
        var scene = currentScene();
        if (scene && typeof scene.barSnooze === 'function') {
            scene.barSnooze(time === undefined ? 15 : time,
                            str === undefined ? 5 : str,
                            barName(bar));
        }
        return true;
    }
    function get_bar_value(name) {
        return $gameSystem ? $gameSystem.get_bar_percentage(barName(name)) : 0;
    }

    var API = {
        set_bar: set_bar, set_genbar: setGenbar, set_custom_bar: setCustomBar,
        show_bar: show_bar, hide_bar: hide_bar,
        set_bar_value: set_bar_value, bar_value: barValue,
        resize_bar: resize_bar, bar_resize: barResize,
        add_bar: add_bar, remove_bar: remove_bar,
        flash_bar: flash_bar, flash_bar_old: flashBarOld,
        snooze_bar: snooze_bar, snooze_bar_old: snoozeBarOld,
        get_bar_value: get_bar_value
    };
    Object.keys(API).forEach(function (k) { window[k] = API[k]; });

    MonlineGenericBar.CFG = CFG;
    MonlineGenericBar.GenericBar = GenericBar;
    MonlineGenericBar.BarLayer = BarLayer;
    MonlineGenericBar.api = API;

    // MonlineShim / the bridge may already hold placeholders for these names.
    if (window.MonlineShim && window.MonlineShim.functions) {
        Object.keys(API).forEach(function (k) {
            var i = window.MonlineShim.functions.indexOf(k);
            if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
        });
    }
    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        Object.keys(API).forEach(function (k) { F[k] = API[k]; });
        if (window.MonlineRuby.COSMETIC) {
            window.MonlineRuby.COSMETIC = window.MonlineRuby.COSMETIC.filter(function (n) {
                return !(n in API);
            });
        }
    }

    console.log('[MonlineGenericBar] loaded');
})();
