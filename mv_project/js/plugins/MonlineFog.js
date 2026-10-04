//=============================================================================
// MonlineFog.js
//=============================================================================
/*:
 * @plugindesc VX Ace "Multi Layer Fog v2.0" (Shaz) ported to MV.
 * @author Monline port
 *
 * @help
 * Port of the VX Ace script `Multi Layer Fog v2.0` by Shaz (source script
 * 0246.rb).  The game drives it from Show-Text-less event commands:
 *
 *     show_fog(1, "Fog1", 0, 100, 1, 100, 6, 2)   // number, name, hue, opacity,
 *                                                // blend, zoom, speed-x, speed-y
 *     fade_fog(1, 45, 60)      // number, opacity, duration
 *     tint_fog(1, 40, -40, -15, 0, 1)  // number, r, g, b, gray, duration
 *     erase_fog(1)
 *
 * Measured usage in this project: 285 show_fog, 405 fade_fog, 115 tint_fog.
 * Every `show_fog` call passes all eight arguments, `zoom` is always 100 and
 * `hue` is only ever 0 or 100 - so the hue bitmap cache stays tiny.
 *
 * ---------------------------------------------------------------------------
 * What the original does
 * ---------------------------------------------------------------------------
 * `$game_screen.fogs` is a sparse container of `Game_Fog`s indexed by number.
 * Each fog is drawn as a **Plane** - a bitmap that tiles to fill the whole
 * viewport - so a small fog texture covers the screen without ever running out.
 *
 *   * `ox/oy` scroll the plane: `display_x * 32 + sx2`, where `sx2` drifts by
 *     `-sx / 8.0` every frame.  The `display_x` term anchors the fog to the map
 *     (it slides as you walk) and `sx/sy` add a continuous breeze on top.
 *   * `zoom_x/zoom_y = zoom / 100`.
 *   * tone and opacity animate with the Zeus-style fixed-length ease
 *     `value = (value * (duration - 1) + target) / duration`.
 *   * `z` defaults to `300 + number`, i.e. above the characters; a negative z
 *     puts it behind the map but in front of the parallax (at -100).
 *   * fogs are cleared on transfer (`CLEAR_ON_TRANSFER`) and also drawn in
 *     battle (`BATTLE_FOGS`).
 *
 * ---------------------------------------------------------------------------
 * How this port reproduces it
 * ---------------------------------------------------------------------------
 * MV has no `Plane`, so each fog is a `TilingSprite`:
 *   * `Plane#ox/oy`  -> `TilingSprite#origin` (MV's `updateTransform` turns it
 *     into `tilePosition = -origin`).
 *   * `Plane#zoom_x/zoom_y` -> `tileScale`.
 *   * the fog texture was ported at 1:1 while the world is x1.5, so the zoom
 *     and the drift are both multiplied by `WORLD_SCALE` to keep the fog the
 *     same size and speed *relative to the world it floats over*.
 *
 * Per-fog tone uses MV's own `ToneFilter` (the same recipe
 * `Spriteset_Base#updateWebGLToneChanger` uses: `reset()`, `adjustTone()`,
 * `adjustSaturation(-gray)`), which is the exact RGSS tone semantics.
 *
 * Known gaps (recorded, not hidden):
 *   * under the **canvas** renderer PIXI ignores filters, so a tinted fog falls
 *     back to its untinted art.  MV defaults to WebGL, and `_shots/probe_fog.js`
 *     checks the path that is actually in use.
 *   * `z` is never passed by this game's data, so the fog is always drawn above
 *     the characters; the negative-z "behind the map" branch is implemented but
 *     never exercised.
 */

var MonlineFog = MonlineFog || {};

(function() {
    'use strict';

    // VX Ace 32px grid / 544x416 -> MV 48px / 816x624.  The fog textures were
    // ported at 1:1 (like pictures), so anything measured in world pixels has
    // to be scaled here.
    var WORLD_SCALE = 48 / 32;

    var MAX_FOG = 100;      // practical bound on the sparse container

    //-------------------------------------------------------------------------
    // Game_Fog
    //-------------------------------------------------------------------------
    function Game_Fog(number) {
        this._number = number;
        this.clear();
    }

    Game_Fog.prototype.clear = function() {
        this.name = '';
        this.hue = 90;
        this.opacity = 64.0;
        this.blend_type = 0;
        this.zoom = 200;
        this.sx = 0;
        this.sy = 0;
        this.sx2 = 0;
        this.sy2 = 0;
        this.ox = 0;
        this.oy = 0;
        this.tone = [0, 0, 0, 0];
        this.toneTarget = [0, 0, 0, 0];
        this.toneDuration = 0;
        this.opacityTarget = 64.0;
        this.opacityDuration = 0;
        this.z = 300 + this._number;
    };

    Game_Fog.prototype.show = function(name, hue, opacity, blendType, zoom,
                                       sx, sy, z) {
        this.name = name;
        this.hue = (hue === undefined || hue === null) ? 90 : hue;
        this.opacity = (opacity === undefined || opacity === null) ? 64.0 : opacity;
        this.blend_type = blendType || 0;
        this.zoom = (zoom === undefined || zoom === null) ? 200 : zoom;
        this.sx = this.sx2 = sx || 0;
        this.sy = this.sy2 = sy || 0;
        this.z = (z === undefined || z === null) ? 300 + this._number : z;
        this.ox = this.oy = 0;
        this.opacityTarget = this.opacity;
        this.opacityDuration = 0;
    };

    Game_Fog.prototype.erase = function() {
        this.name = '';
    };

    Game_Fog.prototype.startToneChange = function(tone, duration) {
        this.toneTarget = tone.slice();
        this.toneDuration = duration;
        if (this.toneDuration === 0) { this.tone = this.toneTarget.slice(); }
    };

    Game_Fog.prototype.startOpacityChange = function(opacity, duration) {
        this.opacityTarget = opacity * 1.0;
        this.opacityDuration = duration;
        if (this.opacityDuration === 0) { this.opacity = this.opacityTarget; }
    };

    /** The Zeus-style fixed-length ease. */
    function nextValue(value, target, duration) {
        return (value * (duration - 1) + target) / duration;
    }

    Game_Fog.prototype.update = function() {
        this.updateMove();
        this.updateToneChange();
        this.updateOpacityChange();
    };

    Game_Fog.prototype.updateMove = function() {
        this.sx2 -= this.sx / 8.0;
        this.sy2 -= this.sy / 8.0;
        var map = $gameMap;
        this.ox = map.displayX() * map.tileWidth() + this.sx2 * WORLD_SCALE;
        this.oy = map.displayY() * map.tileHeight() + this.sy2 * WORLD_SCALE;
    };

    Game_Fog.prototype.updateToneChange = function() {
        if (this.toneDuration === 0) { return; }
        var d = this.toneDuration;
        var t = this.toneTarget;
        for (var i = 0; i < 4; i++) {
            this.tone[i] = nextValue(this.tone[i], t[i], d);
        }
        this.toneDuration -= 1;
    };

    Game_Fog.prototype.updateOpacityChange = function() {
        if (this.opacityDuration === 0) { return; }
        this.opacity = nextValue(this.opacity, this.opacityTarget,
                                 this.opacityDuration);
        this.opacityDuration -= 1;
    };

    // $gameScreen goes into the save file, so the fogs do too.  JsonEx restores
    // prototypes by looking the class name up on `window`, so without this a
    // loaded save hands back plain objects with no `update` and the game throws
    // on the very next frame after loading.
    window.Game_Fog = Game_Fog;
    MonlineFog.Game_Fog = Game_Fog;

    //-------------------------------------------------------------------------
    // The container, hung off $gameScreen so it travels with the save data
    // ($gameScreen is serialised by DataManager.makeSaveContents).
    //-------------------------------------------------------------------------
    // The container has to be reached through the *instance*, never the global.
    // `Game_Screen#initialize` calls `this.clear()`, which runs while
    // `new Game_Screen()` is still being constructed - at that point
    // `$gameScreen` is still null, so a global lookup throws and the game never
    // boots at all.  Every hook therefore passes its own `screen` down.
    function fogsOf(screen) {
        if (!screen) { return {}; }
        if (!screen._monlineFogs) { screen._monlineFogs = {}; }
        return screen._monlineFogs;
    }
    MonlineFog.fogsOf = fogsOf;

    function fogs() { return fogsOf($gameScreen); }
    MonlineFog.fogs = fogs;

    function fog(number) {
        var n = Math.max(0, Math.floor(number || 0));
        var store = fogs();
        if (!store[n]) { store[n] = new Game_Fog(n); }
        return store[n];
    }
    MonlineFog.fog = fog;

    MonlineFog.update = function(screen) {
        var store = fogsOf(screen || $gameScreen);
        for (var k in store) {
            if (!store.hasOwnProperty(k)) { continue; }
            var fog = store[k];
            // a save written by an older build can hold plain objects; never let
            // a stray entry stop the frame
            if (fog && typeof fog.update === 'function') { fog.update(); }
        }
    };
    MonlineFog.clearAll = function(screen) {
        var store = fogsOf(screen || $gameScreen);
        for (var k in store) {
            if (!store.hasOwnProperty(k)) { continue; }
            var fog = store[k];
            if (!fog) { continue; }
            if (typeof fog.erase === 'function') { fog.erase(); } else { fog.name = ''; }
        }
    };

    //-------------------------------------------------------------------------
    // Interpreter script calls
    //-------------------------------------------------------------------------
    window.show_fog = function(number, name, hue, opacity, blendType,
                              zoom, sx, sy, z) {
        fog(number).show(name, hue, opacity, blendType, zoom, sx, sy, z);
        return true;
    };
    window.tint_fog = function(number, red, green, blue, gray, duration) {
        fog(number).startToneChange([red || 0, green || 0, blue || 0, gray || 0],
                                    duration || 0);
        return true;
    };
    window.fade_fog = function(number, opacity, duration) {
        fog(number).startOpacityChange(opacity || 0, duration || 0);
        return true;
    };
    window.erase_fog = function(number) {
        fog(number).erase();
        return true;
    };

    //-------------------------------------------------------------------------
    // Hue-rotated bitmap cache
    //
    // RGSS `Cache.fog(name, hue)` returns a pre-rotated bitmap, cached per
    // (name, hue) - so the rotation is a one-off cost, never per frame.
    //-------------------------------------------------------------------------
    var hueCache = {};

    // `key` is the fog's file name - MV's Bitmap carries no usable name, so it
    // has to be passed in or every fog would share one cache entry.
    function hueBitmap(base, key, hue) {
        var deg = ((hue % 360) + 360) % 360;
        if (deg === 0) { return base; }
        var ck = key + '#' + deg;
        if (hueCache[ck]) { return hueCache[ck]; }
        var out = new Bitmap(base.width, base.height);
        try {
            var ctx = out._context;
            ctx.clearRect(0, 0, base.width, base.height);
            ctx.drawImage(base._canvas, 0, 0);
            // standard YIQ-style hue rotation
            var rad = deg * Math.PI / 180;
            var c = Math.cos(rad), s = Math.sin(rad);
            var m = [
                0.299 + 0.701 * c + 0.168 * s, 0.587 - 0.587 * c + 0.330 * s, 0.114 - 0.114 * c - 0.497 * s,
                0.299 - 0.299 * c - 0.328 * s, 0.587 + 0.413 * c + 0.035 * s, 0.114 - 0.114 * c + 0.292 * s,
                0.299 - 0.300 * c + 1.250 * s, 0.587 - 0.588 * c - 1.050 * s, 0.114 + 0.886 * c - 0.203 * s
            ];
            var img = ctx.getImageData(0, 0, base.width, base.height);
            var d = img.data;
            for (var i = 0; i < d.length; i += 4) {
                var r = d[i], g = d[i + 1], b = d[i + 2];
                d[i] = Math.max(0, Math.min(255, m[0] * r + m[1] * g + m[2] * b));
                d[i + 1] = Math.max(0, Math.min(255, m[3] * r + m[4] * g + m[5] * b));
                d[i + 2] = Math.max(0, Math.min(255, m[6] * r + m[7] * g + m[8] * b));
            }
            ctx.putImageData(img, 0, 0);
            out._setDirty();
        } catch (e) {
            return base;
        }
        hueCache[ck] = out;
        return out;
    }
    MonlineFog.hueBitmap = hueBitmap;

    // MV has no `loadFog`; the script's own folder is `img/fogs/`.
    function loadFog(name, hue) {
        if (!name) { return null; }
        var base = ImageManager.loadBitmap('img/fogs/', name, 0, true);
        return base && base.width > 0 ? hueBitmap(base, name, hue) : base;
    }
    MonlineFog.loadFog = loadFog;

    //-------------------------------------------------------------------------
    // Rendering: one TilingSprite per live fog
    //-------------------------------------------------------------------------
    function FogLayer(spriteset) {
        this._spriteset = spriteset;
        this._sprites = {};
        this._above = null;
        this._below = null;
    }

    FogLayer.prototype.containerAbove = function(s) {
        if (!this._above) {
            this._above = new Sprite();
            s.addChild(this._above);
        }
        return this._above;
    };

    /**
     * Behind the map but in front of the parallax.  MV keeps the parallax as a
     * child of `_baseSprite`, ahead of the tilemap, so a container inserted
     * right after the parallax sits where a negative-z fog belongs.
     */
    FogLayer.prototype.containerBelow = function(s) {
        if (!this._below) {
            this._below = new Sprite();
            var base = s._baseSprite;
            if (base) {
                var idx = base.children.indexOf(base._parallax);
                base.addChildAt(this._below, idx >= 0 ? idx + 1 : 0);
            } else {
                s.addChildAt(this._below, 0);
            }
        }
        return this._below;
    };

    FogLayer.prototype.update = function() {
        var store = fogs();
        var seen = {};
        for (var k in store) {
            if (!store.hasOwnProperty(k)) { continue; }
            var fog = store[k];
            if (!fog || !fog.name) { continue; }
            seen[k] = true;
            this.refresh(this._spriteset, k, fog);
        }
        // drop sprites whose fog was erased
        for (var key in this._sprites) {
            if (!this._sprites.hasOwnProperty(key) || seen[key]) { continue; }
            var sp = this._sprites[key];
            if (sp && sp.parent) { sp.parent.removeChild(sp); }
            delete this._sprites[key];
        }
    };

    FogLayer.prototype.refresh = function(s, key, fog) {
        var sprite = this._sprites[key];
        if (!sprite) {
            sprite = new TilingSprite();
            this._sprites[key] = sprite;
        }
        var parent = fog.z < 0 ? this.containerBelow(s) : this.containerAbove(s);
        if (sprite.parent !== parent) { parent.addChild(sprite); }

        var base = ImageManager.loadBitmap('img/fogs/', fog.name, 0, true);
        if (!base || !base.isReady() || !(base.width > 0)) {
            sprite.visible = false;
            return;
        }
        var bitmap = hueBitmap(base, fog.name, fog.hue);
        if (sprite.bitmap !== bitmap) {
            sprite.bitmap = bitmap;
            sprite.move(0, 0, Graphics.width, Graphics.height);
        }
        sprite.visible = true;
        sprite.origin.x = fog.ox;
        sprite.origin.y = fog.oy;
        var z = (fog.zoom / 100) * WORLD_SCALE;
        sprite.tileScale.x = z;
        sprite.tileScale.y = z;
        sprite.blendMode = fog.blend_type === 1 ? 1 : 0;
        sprite.opacity = Math.round(fog.opacity);

        var t = fog.tone;
        var toned = t[0] !== 0 || t[1] !== 0 || t[2] !== 0 || t[3] !== 0;
        if (toned) {
            if (!sprite._monlineTone) { sprite._monlineTone = new ToneFilter(); }
            sprite._monlineTone.reset();
            sprite._monlineTone.adjustTone(t[0], t[1], t[2]);
            sprite._monlineTone.adjustSaturation(-t[3]);
            if (!sprite.filters || !sprite.filters.length) {
                sprite.filters = [sprite._monlineTone];
            }
        } else if (sprite.filters && sprite.filters.length) {
            sprite.filters = null;
        }
    };

    FogLayer.prototype.dispose = function() {
        for (var key in this._sprites) {
            if (!this._sprites.hasOwnProperty(key)) { continue; }
            var sp = this._sprites[key];
            if (sp && sp.parent) { sp.parent.removeChild(sp); }
        }
        this._sprites = {};
    };

    MonlineFog.FogLayer = FogLayer;

    //-------------------------------------------------------------------------
    // Engine hooks
    //-------------------------------------------------------------------------
    var _Game_Screen_update = Game_Screen.prototype.update;
    Game_Screen.prototype.update = function() {
        _Game_Screen_update.apply(this, arguments);
        MonlineFog.update(this);
    };

    // `initialize` calls `clear`, so this runs before $gameScreen is assigned.
    var _Game_Screen_clear = Game_Screen.prototype.clear;
    Game_Screen.prototype.clear = function() {
        _Game_Screen_clear.apply(this, arguments);
        MonlineFog.clearAll(this);
    };

    // CLEAR_ON_TRANSFER: wipe the fogs when the player actually changes map.
    var _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function() {
        if (this.isTransferring() && this.newMapId() !== $gameMap.mapId()) {
            MonlineFog.clearAll();
        }
        _Game_Player_performTransfer.apply(this, arguments);
    };

    // Map scene
    var _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _Spriteset_Map_createLowerLayer.call(this);
        this._monlineFog = new FogLayer(this);
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        if (this._monlineFog) { this._monlineFog.update(); }
    };

    var _Spriteset_Map_dispose = Spriteset_Map.prototype.dispose;
    Spriteset_Map.prototype.dispose = function() {
        if (this._monlineFog) {
            this._monlineFog.dispose();
            this._monlineFog = null;
        }
        _Spriteset_Map_dispose.call(this);
    };

    // Battle scene (the original draws fogs in battle too)
    var _Spriteset_Battle_createLowerLayer = Spriteset_Battle.prototype.createLowerLayer;
    Spriteset_Battle.prototype.createLowerLayer = function() {
        _Spriteset_Battle_createLowerLayer.call(this);
        this._monlineFog = new FogLayer(this);
    };

    var _Spriteset_Battle_update = Spriteset_Battle.prototype.update;
    Spriteset_Battle.prototype.update = function() {
        _Spriteset_Battle_update.call(this);
        if (this._monlineFog) { this._monlineFog.update(); }
    };

    var _Spriteset_Battle_dispose = Spriteset_Battle.prototype.dispose;
    Spriteset_Battle.prototype.dispose = function() {
        if (this._monlineFog) {
            this._monlineFog.dispose();
            this._monlineFog = null;
        }
        _Spriteset_Battle_dispose.call(this);
    };

    //-------------------------------------------------------------------------
    // These are real now, so drop MonlineShim's placeholders - otherwise the
    // bridge keeps stubbing over them (see MonlineRuby.isRealPort).
    //-------------------------------------------------------------------------
    if (window.MonlineShim && window.MonlineShim.functions) {
        var implemented = ['show_fog', 'fade_fog', 'tint_fog', 'erase_fog'];
        window.MonlineShim.functions = window.MonlineShim.functions.filter(function(n) {
            return implemented.indexOf(n) < 0;
        });
        window.MonlineShim.fog = true;
    }
})();
