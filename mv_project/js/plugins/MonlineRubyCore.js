//=============================================================================
// MonlineRubyCore.js
//=============================================================================
/*:
 * @plugindesc RGSS3 core value classes the event scripts use: Color.new / Tone.new (43 measured call sites).
 * @author Monline port
 *
 * @help
 * The VX Ace event scripts build RGSS value objects directly:
 *
 *     color_Pink   = Color.new(255,120,210)
 *     color_Purple = Color.new(225,50,255)
 *     color_Yellow = Color.new(225,255,77)
 *     :color => Color.new(225,150,255)
 *
 * `MonlineRuby.translate` turns the trailing symbol arguments into strings but
 * leaves `Color.new(...)` alone (it is not a name it knows), so the call
 * resolved against the sandbox scope, found nothing, and got the bridge's
 * last-resort auto-stub - which is a *function*, so `Color.new(...)` threw
 * "Color.new is not a function" and killed the whole 355 block.  Everything
 * after the line (the actual `set_bar(...)`, `light(...)`, `nel_textpop(...)`)
 * never ran.
 *
 * This file provides the two RGSS3 classes the data actually uses:
 *
 *     Color.new(r, g, b, a = 255)      # red/green/blue/alpha, #set(r,g,b,a)
 *     Tone.new(r, g, b, gray = 0)      # red/green/blue/gray,  #set(r,g,b,gray)
 *
 * Both are callable as `Color.new(...)` (Ruby spelling) and as
 * `new Color(...)` (JS spelling), because `X.new` in Ruby is just a class
 * method and the translator does not rewrite it either way.
 */
//=============================================================================

(function () {
    'use strict';

    //-------------------------------------------------------------------------
    // RGSS3 Color
    //-------------------------------------------------------------------------
    function Color(r, g, b, a) {
        if (!(this instanceof Color)) { return new Color(r, g, b, a); }
        this.red = num(r, 0);
        this.green = num(g, 0);
        this.blue = num(b, 0);
        this.alpha = (a === undefined || a === null) ? 255 : num(a, 255);
    }

    Color.prototype.set = function (r, g, b, a) {
        this.red = num(r, 0);
        this.green = num(g, 0);
        this.blue = num(b, 0);
        if (a !== undefined && a !== null) { this.alpha = num(a, 255); }
        return this;
    };
    Color.prototype.toArray = function () {
        return [this.red, this.green, this.blue, this.alpha];
    };
    /** CSS colour string, alpha 0..1 - what MV's Bitmap#fillRect wants. */
    Color.prototype.toCss = function () {
        return 'rgba(' + clamp255(this.red) + ',' + clamp255(this.green) + ',' +
               clamp255(this.blue) + ',' + (clamp255(this.alpha) / 255).toFixed(3) + ')';
    };
    Color.prototype.toString = function () { return this.toCss(); };
    Color.new = function (r, g, b, a) { return new Color(r, g, b, a); };

    //-------------------------------------------------------------------------
    // RGSS3 Tone
    //-------------------------------------------------------------------------
    function Tone(r, g, b, gray) {
        if (!(this instanceof Tone)) { return new Tone(r, g, b, gray); }
        this.red = num(r, 0);
        this.green = num(g, 0);
        this.blue = num(b, 0);
        this.gray = num(gray, 0);
    }
    Tone.prototype.set = function (r, g, b, gray) {
        this.red = num(r, 0);
        this.green = num(g, 0);
        this.blue = num(b, 0);
        if (gray !== undefined && gray !== null) { this.gray = num(gray, 0); }
        return this;
    };
    Tone.prototype.toArray = function () {
        return [this.red, this.green, this.blue, this.gray];
    };
    Tone.new = function (r, g, b, gray) { return new Tone(r, g, b, gray); };

    //-------------------------------------------------------------------------
    // helpers shared with the other port plugins
    //-------------------------------------------------------------------------
    function num(v, fallback) {
        var n = parseFloat(v);
        return isNaN(n) ? fallback : n;
    }
    function clamp255(v) {
        var n = Math.round(num(v, 0));
        return n < 0 ? 0 : (n > 255 ? 255 : n);
    }

    //-------------------------------------------------------------------------
    // Game_Map#screen -> $game_screen (RGSS3)
    //-------------------------------------------------------------------------
    // VX Ace's Game_Map owns the screen object, so event scripts and engine
    // scripts alike say `$game_map.screen`:
    //     0021.rb:665  $game_map.screen.start_flash_for_damage
    //     0026.rb:81   @screen.start_tone_change($game_map.screen.tone, 0)
    // MV split it into a separate global ($gameScreen) and Game_Map has no
    // `screen` at all, so every port that kept the Ruby spelling threw
    // "$gameMap.screen is not a function" - which killed Scene_Map.update
    // outright (MonlineCompass's eraseNeedle runs on every map without a
    // compass coordinate, i.e. almost all of them).
    if (typeof Game_Map !== 'undefined' && !Game_Map.prototype.screen) {
        Game_Map.prototype.screen = function () { return $gameScreen; };
    }

    window.Color = Color;
    window.Tone = Tone;

    window.MonlineRubyCore = { Color: Color, Tone: Tone, clamp255: clamp255 };

    // The sandbox scope: without this, `with(scope)` + the Proxy `has` trap
    // would claim `Color` and hand the script an auto-stub function instead of
    // the class above.
    if (window.MonlineRuby && window.MonlineRuby.F) {
        window.MonlineRuby.F.Color = Color;
        window.MonlineRuby.F.Tone = Tone;
    }

    console.log('[MonlineRubyCore] loaded');
})();
