//=============================================================================
// MonlineLights.js
//=============================================================================
/*:
 * @plugindesc VX Ace "Zeus Lights & Shadows v1.3" (Zeus81) ported to MV.
 * @author Monline port
 *
 * @help
 * Port of the VX Ace script `Zeus Lights & Shadows v1.3` by Zeus81 (source
 * script 0234.rb in the original project).  The game drives it from the map
 * events, roughly 7300 script-command calls:
 *
 *     light.setup("torch")
 *     light.chara_id = @event_id
 *     light.set_color(255, 100, 100, 175)
 *     light.set_zoom(100)
 *     light.set_pos(0, -16)
 *     light.set_flicker(2, 4)
 *     light.directions = 4
 *     light.clear
 *     light("player torch").set_opacity(0, 120)
 *
 * How the original works, and how this port reproduces it:
 *
 *  1. A "night layer" - a screen-sized sprite filled with the *inverse of the
 *     negative screen tone* - is drawn over the map with `blend_type = 2`
 *     (RGSS *subtract*, per the script's own header).  Every visible light is
 *     then blitted into that bitmap at its opacity **with no colour at all**,
 *     punching a hole in the darkness: `Bitmap#blt` never reads `sprite.color`,
 *     so a null-coloured light is invisible by day yet still "prevents the
 *     screen from darkening at night".  Because the darkness lives in the
 *     layer, the engine's own tone is cancelled for those channels while lights
 *     are on - a flat tone subtraction cannot be un-subtracted.
 *
 *     PIXI cannot subtract, so the port uses MULTIPLY with the complement
 *     (`255 - D`).  Both leave black alone and agree at full white; the hole
 *     semantics are identical.
 *
 *  2. Every light is *also* a real additive sprite above the night layer
 *     (`blend_type = 1`), tinted by its `color`.  That is what gives a torch
 *     its colour: RGSS `Sprite#color` replaces the sprite's RGB with
 *     `lerp(src, color, color.alpha/255)`, so on the pure-black-with-alpha-mask
 *     `torch.png` it degenerates to a flat fill of the light's colour clipped
 *     to the sprite alpha - which is how `set_color(255,0,0,255)` becomes
 *     "=> red light" while the day-invisible null colour stays black.
 *
 *  3. Positions are in *world* pixels.  The port renders the world at 1.5x
 *     (VX Ace 544x416 @ 32px tiles -> MV 816x624 @ 48px tiles, and every world
 *     asset was upscaled to match), so light bitmaps and light offsets are
 *     multiplied by WORLD_SCALE.  Without it a torch would light 4 tiles
 *     instead of 6.
 *
 * Known, deliberate gaps (the data never exercises them):
 *   - `Sprite#wave_*` has no MV counterpart; the properties are stored and
 *     `set_wave` does not crash, but no wave is applied.  The source data
 *     never calls `set_wave`.
 *   - Shadows are not rendered.  The data never calls `shadow` or
 *     `set_shadowable`, and MV tilesets do not carry VX Ace's shadow bits.
 *     The data classes and the API exist so a script cannot crash on them.
 *   - `angle` / `mirror` are applied to the additive sprite only.  The
 *     original's `Bitmap#blt` ignored them too.
 */

var MonlineLights = MonlineLights || {};

(function() {
    'use strict';

    //-------------------------------------------------------------------------
    // Constants
    //-------------------------------------------------------------------------
    // VX Ace 32px grid / 544x416 screen -> MV 48px grid / 816x624 canvas.
    var WORLD_SCALE = 48 / 32;

    // Number of light bitmaps kept tinted + cached.  The key is quantised, so
    // one entry covers a whole range of animated colours.
    var TINT_CACHE_MAX = 128;

    // PIXI blend modes (identical numbering to MV's Graphics.BLEND_*).
    var BLEND_NORMAL = 0, BLEND_ADD = 1, BLEND_MULTIPLY = 2;

    function clamp255(v) {
        v = Math.round(Number(v) || 0);
        return v < 0 ? 0 : (v > 255 ? 255 : v);
    }

    //-------------------------------------------------------------------------
    // RGSS Color - only the four channels plus `set`, which is all the light
    // system ever touches.
    //-------------------------------------------------------------------------
    function Color(r, g, b, a) {
        this.red = r;
        this.green = g;
        this.blue = b;
        this.alpha = (a === undefined || a === null) ? 255 : a;
    }
    Color.prototype.set = function(r, g, b, a) {
        this.red = r;
        this.green = g;
        this.blue = b;
        this.alpha = (a === undefined || a === null) ? 255 : a;
        return this;
    };
    MonlineLights.Color = Color;

    //-------------------------------------------------------------------------
    // Zeus_Animation
    //
    //     animate(variable, target_value, duration)
    //     value = (value * (duration - 1) + target_value) / duration
    //
    // A fixed-length ease that lands exactly on the target: with duration 3
    // and target 3 the value goes 0 -> 1 -> 2 -> 3.  Durations are in frames.
    //-------------------------------------------------------------------------
    function nextValue(value, target, duration) {
        return (value * (duration - 1) + target) / duration;
    }

    //-------------------------------------------------------------------------
    // Game_LightShadowBase  (RGSS Game_Light_Shadow_Base)
    //-------------------------------------------------------------------------
    function Game_LightShadowBase() {
        this.clear();
    }

    Game_LightShadowBase.prototype.clear = function() {
        this.chara_id = 0;
        this.active = false;
        this.visible = true;
        this.filename = '';
        this.opacity = 255;
        this.color = new Color(0, 0, 0, 255);
        this.x = 0;
        this.y = 0;
        this.ox = 0.5;
        this.oy = 0.5;
        this.parallax_x = 1.0;
        this.parallax_y = 1.0;
        this.direction = 0;
        this.directions = 1;
        this.pattern = 0;
        this.patterns = 1;
        this.anime_rate = 0.0;
        this._zoom2 = Math.sqrt(100.0);
        this._zoomX = 1.0;
        this._zoomY = 1.0;
        this._anims = null;
    };

    Game_LightShadowBase.prototype.setup = function(filename) {
        this.active = true;
        this.filename = filename;
    };

    Game_LightShadowBase.prototype.update = function() {
        this.updateAnimations();
        this.updatePattern();
    };

    Game_LightShadowBase.prototype.updatePattern = function() {
        if (this.anime_rate > 0 && Graphics.frameCount % this.anime_rate < 1) {
            this.pattern += 1;
            this.pattern %= this.patterns;
        }
    };

    // -- animation ------------------------------------------------------------
    Game_LightShadowBase.prototype.animate = function(prop, target, duration) {
        if (!this._anims) { this._anims = {}; }
        if (!(duration >= 1)) {
            this.applyAnimValue(prop, target, 1);
            delete this._anims[prop];
        } else {
            this._anims[prop] = { target: target, left: Math.floor(duration) };
        }
    };

    Game_LightShadowBase.prototype.updateAnimations = function() {
        var anims = this._anims;
        if (!anims) { return; }
        var keys = Object.keys(anims);
        for (var i = 0; i < keys.length; i++) {
            var a = anims[keys[i]];
            if (!a) { continue; }
            this.applyAnimValue(keys[i], a.target, a.left);
            a.left -= 1;
            if (a.left <= 0) { delete anims[keys[i]]; }
        }
    };

    Game_LightShadowBase.prototype.applyAnimValue = function(prop, target, duration) {
        if (prop === 'color') {
            var c = this.color;
            c.red = nextValue(c.red, target.red, duration);
            c.green = nextValue(c.green, target.green, duration);
            c.blue = nextValue(c.blue, target.blue, duration);
            c.alpha = nextValue(c.alpha, target.alpha, duration);
        } else if (prop === '_zoom2') {
            // The only derived animated value in the original: zoom_x / zoom_y
            // are recomputed from zoom2, which is why set_zoom(z) eases even
            // though the stored value is a square root.
            this._zoom2 = nextValue(this._zoom2, target, duration);
            this._zoomX = this._zoomY = this._zoom2 * this._zoom2 / 100.0;
        } else {
            this[prop] = nextValue(Number(this[prop]) || 0, target, duration);
        }
    };

    // -- setters --------------------------------------------------------------
    Game_LightShadowBase.prototype.set_pos = function(x, y, duration) {
        this.animate('x', x, duration);
        this.animate('y', y, duration);
    };
    Game_LightShadowBase.prototype.set_origin = function(ox, oy, duration) {
        this.animate('ox', ox / 100.0, duration);
        this.animate('oy', oy / 100.0, duration);
    };
    Game_LightShadowBase.prototype.set_parallax = function(x, y, duration) {
        this.animate('parallax_x', x, duration);
        this.animate('parallax_y', y, duration);
    };
    Game_LightShadowBase.prototype.set_opacity = function(opacity, duration) {
        this.animate('opacity', opacity * 255 / 100, duration);
    };
    Game_LightShadowBase.prototype.set_color = function(r, g, b, a, duration) {
        this.animate('color', new Color(r, g, b, a), duration);
    };
    Game_LightShadowBase.prototype.set_zoom = function(zoom, duration) {
        // set_zoom(100) -> 1.0, set_zoom(150) -> 1.5, set_zoom(0) -> 0.01
        this.animate('_zoom2', Math.sqrt(Math.max(1, zoom)), duration);
    };
    // Wave is accepted and stored, but MV's Sprite has no wave support.
    Game_LightShadowBase.prototype.set_wave = function(amp, length, speed, duration) {
        this.animate('wave_amp', amp, duration);
        this.animate('wave_length', length, duration);
        this.animate('wave_speed', speed, duration);
    };

    //-------------------------------------------------------------------------
    // Game_Shadow  (registered with JsonEx by name, see below)
    //-------------------------------------------------------------------------
    function Game_Shadow() {
        this.clear();
    }
    Game_Shadow.prototype = Object.create(Game_LightShadowBase.prototype);
    Game_Shadow.prototype.constructor = Game_Shadow;

    Game_Shadow.prototype.clear = function() {
        Game_LightShadowBase.prototype.clear.call(this);
        this.size = null;
        this.shadowable = true;
    };
    Game_Shadow.prototype.setup = function(filenameOrWidth, height) {
        if (typeof filenameOrWidth === 'string') {
            this.size = null;
            Game_LightShadowBase.prototype.setup.call(this, filenameOrWidth);
        } else {
            Game_LightShadowBase.prototype.setup.call(this, '');
            if (!this.size) { this.size = { x: 0, y: 0, width: 0, height: 0 }; }
            this.size.x = 0;
            this.size.y = 0;
            this.size.width = Math.floor(Number(filenameOrWidth) || 0);
            this.size.height = Math.floor(Number(height) || 0);
        }
    };

    //-------------------------------------------------------------------------
    // Game_Light
    //-------------------------------------------------------------------------
    function Game_Light() {
        this.clear();
    }
    Game_Light.prototype = Object.create(Game_LightShadowBase.prototype);
    Game_Light.prototype.constructor = Game_Light;

    Game_Light.prototype.clear = function() {
        Game_LightShadowBase.prototype.clear.call(this);
        this.z = 0xC001;
        this.angle = 0.0;
        this.mirror = false;
        this.blend_type = 1;
        this.wave_amp = 0;
        this.wave_length = 180;
        this.wave_speed = 360;
        this.wave_phase = 0.0;
        this.flicker = 1.0;
        this._flickerVariance = 0.0;
        this._flickerRate = 4.0;
    };

    Game_Light.prototype.update = function() {
        Game_LightShadowBase.prototype.update.call(this);
        this.updateFlicker();
    };

    Game_Light.prototype.updateFlicker = function() {
        if (this._flickerVariance === 0) {
            this.flicker = 1;
            return;
        }
        var rate = this._flickerRate;
        if (rate === 0 || Graphics.frameCount % rate < 1) {
            var v = this._flickerVariance;
            var roll = Math.floor(Math.random() * 100);
            var value;
            if (roll === 33) { value = 1 - v * 2; }
            else if (roll === 66) { value = 1 + v * 2; }
            else { value = 1 - v + v * 2 * Math.random(); }
            this.animate('flicker', value, Math.floor(rate));
        }
    };

    // Flicker modulates the *zoom* in the original, not the opacity.
    Game_Light.prototype.scaleX = function() { return this._zoomX * this.flicker; };
    Game_Light.prototype.scaleY = function() { return this._zoomY * this.flicker; };

    Game_Light.prototype.set_angle = function(angle, duration) {
        this.animate('angle', angle, duration);
    };
    Game_Light.prototype.set_flicker = function(variance, refreshRate, duration) {
        this.animate('_flickerVariance', variance / 100.0, duration);
        this.animate('_flickerRate', refreshRate, duration);
    };

    // JsonEx._decode restores a prototype by looking the constructor name up on
    // `window`, so these two have to be global - otherwise a save made with
    // active lights would come back as plain objects with no methods.
    window.Game_LightShadowBase = Game_LightShadowBase;
    window.Game_Light = Game_Light;
    window.Game_Shadow = Game_Shadow;
    MonlineLights.Game_Light = Game_Light;
    MonlineLights.Game_Shadow = Game_Shadow;

    //-------------------------------------------------------------------------
    // $game_map.lights / $game_map.shadows
    //
    // Stored on $gameMap so MV's own save/load (which serialises $gameMap)
    // carries them, matching VX Ace where Game_Map#initialize owned @lights.
    //-------------------------------------------------------------------------
    function lightRegistry() {
        if (typeof $gameMap === 'undefined' || !$gameMap) { return null; }
        if (!$gameMap._monlineLights) { $gameMap._monlineLights = {}; }
        return $gameMap._monlineLights;
    }
    function shadowRegistry() {
        if (typeof $gameMap === 'undefined' || !$gameMap) { return null; }
        if (!$gameMap._monlineShadows) { $gameMap._monlineShadows = {}; }
        return $gameMap._monlineShadows;
    }
    MonlineLights.lights = function() { return lightRegistry() || {}; };
    MonlineLights.shadows = function() { return shadowRegistry() || {}; };

    /** The interpreter's `@event_id`, used for the default light key. */
    function currentEventId() {
        var c = window.MonlineRuby && window.MonlineRuby.current;
        if (!c) { return 0; }
        try {
            var v = c.event_id;
            if (typeof v === 'function') { v = v.call(c); }
            if (v !== undefined && v !== null) { return Number(v) || 0; }
            if (typeof c.eventId === 'function') { return Number(c.eventId()) || 0; }
        } catch (e) { /* fall through */ }
        return 0;
    }
    MonlineLights.currentEventId = currentEventId;

    function getLight(key) {
        var reg = lightRegistry();
        if (!reg) { return new Game_Light(); }
        if (key === undefined || key === null) { key = 'event#' + currentEventId(); }
        key = String(key);
        if (!reg[key] || typeof reg[key].update !== 'function') {
            // Re-link in case the object survived a save that predates this
            // plugin, or a hand-edited file lost its prototype marker.
            var raw = reg[key];
            if (raw && typeof raw === 'object') {
                Object.setPrototypeOf(raw, Game_Light.prototype);
                raw._anims = null;
                if (raw.opacity === undefined) { raw.opacity = 255; }
                if (!raw.color) { raw.color = new Color(0, 0, 0, 255); }
            } else {
                reg[key] = new Game_Light();
            }
        }
        return reg[key];
    }

    function getShadow(key) {
        var reg = shadowRegistry();
        if (!reg) { return new Game_Shadow(); }
        if (key === undefined || key === null) { key = 'event#' + currentEventId(); }
        key = String(key);
        if (!reg[key] || typeof reg[key].update !== 'function') {
            var raw = reg[key];
            if (raw && typeof raw === 'object') {
                Object.setPrototypeOf(raw, Game_Shadow.prototype);
                raw._anims = null;
            } else {
                reg[key] = new Game_Shadow();
            }
        }
        return reg[key];
    }
    MonlineLights.getLight = getLight;
    MonlineLights.getShadow = getShadow;

    //-------------------------------------------------------------------------
    // zls_get_character
    //-------------------------------------------------------------------------
    function zlsGetCharacter(id) {
        id = Math.round(Number(id) || 0);
        if (id === 0) { return null; }
        if (id === -1) { return $gamePlayer; }
        if (id === -2 || id === -3 || id === -4) {
            return $gamePlayer.followers().follower(-id - 2);
        }
        if (id === -5 || id === -6 || id === -7) {
            return $gameMap.vehicle(-id - 5);
        }
        return $gameMap.event(id);
    }
    MonlineLights.characterFor = zlsGetCharacter;

    //-------------------------------------------------------------------------
    // calculate_visible / synchronize_direction_pattern / calculate_x,y
    //-------------------------------------------------------------------------
    function calculateVisible(data, chara) {
        if (chara) {
            if (typeof chara.isTransparent === 'function' && chara.isTransparent()) {
                return false;
            }
            if (typeof Game_Event !== 'undefined' && chara instanceof Game_Event) {
                // VX Ace: `return false unless chara.list` - a page-less event
                // has no command list, so its lights stay dark.
                if (!(chara._pageIndex >= 0)) { return false; }
            } else if (typeof Game_Follower !== 'undefined' && chara instanceof Game_Follower) {
                if (typeof chara.isVisible === 'function' && !chara.isVisible()) {
                    return false;
                }
            }
        }
        if (!data.visible || !(data.opacity > 0)) { return false; }
        if (data.filename && data.filename.length > 0) { return true; }
        if (data.size) { return true; }
        return false;
    }
    MonlineLights.calculateVisible = calculateVisible;

    function syncDirectionPattern(data, chara) {
        var d = chara.direction();
        switch (data.directions) {
        case 2: data.direction = Math.floor((d - 1) / 4); break;
        case 4: data.direction = Math.floor((d - 1) / 2); break;
        case 8: data.direction = d - 1 - Math.floor(d / 5); break;
        }
        if (data.anime_rate === 0) {
            var p = (typeof chara.pattern === 'function') ? chara.pattern() : 1;
            data.pattern = (p < 3) ? p : 1;
            data.pattern %= Math.max(1, data.patterns);
        }
    }
    MonlineLights.syncDirectionPattern = syncDirectionPattern;

    function calculateX(x, parallaxX, chara) {
        var px = x * WORLD_SCALE;
        if (chara) { return px + chara.screenX(); }
        var tw = $gameMap.tileWidth();
        if (parallaxX !== 1 || !$gameMap.isLoopHorizontal()) {
            return px - $gameMap.displayX() * tw * parallaxX;
        }
        return $gameMap.adjustX(px / tw) * tw;
    }

    function calculateY(y, parallaxY, chara) {
        var py = y * WORLD_SCALE;
        if (chara) { return py + chara.screenY(); }
        var th = $gameMap.tileHeight();
        if (parallaxY !== 1 || !$gameMap.isLoopVertical()) {
            return py - $gameMap.displayY() * th * parallaxY;
        }
        return $gameMap.adjustY(py / th) * th;
    }
    MonlineLights.calculateX = calculateX;
    MonlineLights.calculateY = calculateY;

    // RGSS blend_type (documented in Zeus81's own header, _vxace_scripts/0235.rb
    // lines 287-292):  0 = Normal, 1 = Addition, 2 = Subtraction.
    // PIXI:            0 normal, 1 add, 2 multiply, 3 screen.
    //
    // `Subtraction` has no PIXI counterpart -- the WebGL renderer MV ships only
    // implements normal/add/multiply/screen, and the canvas renderer's
    // 'difference' composite would silently degrade to normal under WebGL.  It
    // maps to MULTIPLY, which is the closest "darken through the shape"
    // behaviour; a subtraction light is documented as "a black light or one
    // that darkens the screen", and multiply is the only mode that does that
    // with the light's own silhouette instead of painting it flat.
    function rgssBlendToPixi(b) {
        switch (Number(b)) {
        case 1: return BLEND_ADD;
        case 2: return BLEND_MULTIPLY;   // RGSS subtract, approximated
        case 3: return BLEND_MULTIPLY;
        default: return BLEND_NORMAL;
        }
    }

    //-------------------------------------------------------------------------
    // Spriteset_LightsShadows
    //-------------------------------------------------------------------------
    function Spriteset_LightsShadows(spriteset) {
        this._spriteset = spriteset;
        this._lightSprites = {};
        this._tintCache = {};
        this._tintOrder = [];

        // The night layer is drawn *outside* `_baseSprite` on purpose: the
        // engine's tone is applied as a PIXI filter on `_baseSprite` (WebGL) or
        // as a ToneSprite above it (canvas), and the darkness has to sit
        // outside the filtered subtree or it would be applied twice.
        //
        // Zeus81 uses `blend_type = 2` (RGSS *subtract*) on this layer, which
        // PIXI cannot express.  The equivalent it can express is MULTIPLY with
        // the complement: subtract  -> S - D
        //                               multiply -> S * (255 - D) / 255
        // Both leave black untouched, agree exactly at S = 255, and the hole
        // semantics are identical (D = 0 under a light restores the original
        // pixel).  The multiply form is merely a little brighter in the
        // midtones and never clips, which is the safe direction for a night
        // scene rendered with colours the original author never previewed.
        this._nightSprite = new Sprite();
        this._nightBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._nightSprite.bitmap = this._nightBitmap;
        this._nightSprite.x = 0;
        this._nightSprite.y = 0;
        this._nightSprite.blendMode = BLEND_MULTIPLY;
        this._nightSprite.opacity = 255;
        this._nightSprite.visible = false;
        spriteset.addChild(this._nightSprite);

        // Additive glow layer, also outside `_baseSprite` so the tone filter
        // cannot dim it.
        this._glowSprite = new Sprite();
        this._glowSprite.x = 0;
        this._glowSprite.y = 0;
        spriteset.addChild(this._glowSprite);
    }
    MonlineLights.Spriteset_LightsShadows = Spriteset_LightsShadows;

    Spriteset_LightsShadows.prototype.dispose = function() {
        var self = this;
        Object.keys(this._lightSprites).forEach(function(k) { self.destroyLight(k); });
        this._lightSprites = {};
        this._tintCache = {};
        this._tintOrder = [];
        if (this._nightSprite) {
            if (this._nightSprite.parent) { this._nightSprite.parent.removeChild(this._nightSprite); }
            if (this._nightBitmap) { this._nightBitmap = null; }
            this._nightSprite = null;
        }
        if (this._glowSprite) {
            if (this._glowSprite.parent) { this._glowSprite.parent.removeChild(this._glowSprite); }
            this._glowSprite = null;
        }
    };

    Spriteset_LightsShadows.prototype.update = function() {
        if (typeof $gameMap === 'undefined' || !$gameMap) { return; }
        this.ensureNightBitmap();
        this.updateLights();
        this.updateNightLayer();
    };

    Spriteset_LightsShadows.prototype.ensureNightBitmap = function() {
        if (this._nightBitmap && this._nightBitmap.width === Graphics.width
            && this._nightBitmap.height === Graphics.height) { return; }
        this._nightBitmap = new Bitmap(Graphics.width, Graphics.height);
        this._nightSprite.bitmap = this._nightBitmap;
    };

    /**
     * Live check used both by the renderer and by the tone override, so the
     * tone is cancelled on the very frame the first light appears.
     */
    Spriteset_LightsShadows.prototype.hasVisibleLight = function() {
        var reg = lightRegistry();
        if (!reg) { return false; }
        var keys = Object.keys(reg);
        for (var i = 0; i < keys.length; i++) {
            var d = reg[keys[i]];
            if (!d || !d.active) { continue; }
            if (calculateVisible(d, zlsGetCharacter(d.chara_id))) { return true; }
        }
        return false;
    };

    /** Own-property iteration so nothing from Object.prototype leaks in. */
    Spriteset_LightsShadows.prototype.lightKeys = function() {
        var reg = lightRegistry();
        return reg ? Object.keys(reg) : [];
    };

    Spriteset_LightsShadows.prototype.updateLights = function() {
        var self = this;
        var reg = lightRegistry();
        if (!reg) { return; }
        var keys = Object.keys(reg);
        keys.forEach(function(key) {
            var data = reg[key];
            if (!data || typeof data.update !== 'function') { return; }
            if (!data.active) {
                if (self._lightSprites[key]) { self.destroyLight(key); }
                return;
            }
            data.update();
            var chara = zlsGetCharacter(data.chara_id);
            var vis = calculateVisible(data, chara);
            if (!vis) {
                var hidden = self._lightSprites[key];
                if (hidden) {
                    hidden.visible = false;
                    if (hidden.sprite) { hidden.sprite.visible = false; }
                }
                return;
            }
            var pair = self._lightSprites[key] || self.createLight(key);
            self.refreshLight(pair, data, chara);
        });
    };

    Spriteset_LightsShadows.prototype.createLight = function(key) {
        // One sprite is enough because RGSS `Sprite#color` turned out to be a
        // colour *replacement*, not a multiply tint:
        //     rgb = lerp(src.rgb, color.rgb, color.alpha / 255)
        // Zeus81's own header settles the question -- `torch.png` is pure black
        // with an alpha mask, yet `set_color(255, 0, 0, 255)` is documented as
        // "=> red light" and a null colour as "invisible on the day, and will
        // only prevent the screen from darkening at night".  With a black
        // source the lerp degenerates to `rgb = color.rgb * (alpha / 255)`, so
        // the coloured glow is a flat fill of the light's colour clipped to the
        // sprite's alpha, and the alpha can ride on `sprite.opacity` instead of
        // costing one bitmap per intermediate animation frame.
        var sprite = new Sprite();
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
        this._glowSprite.addChild(sprite);
        var pair = {
            sprite: sprite,      // the additive glow on screen
            visible: false,      // is the *light* live this frame?
            raw: null,           // the untinted source, for the night hole
            name: null,
            holeOpacity: 0
        };
        this._lightSprites[key] = pair;
        return pair;
    };

    Spriteset_LightsShadows.prototype.destroyLight = function(key) {
        var pair = this._lightSprites[key];
        if (!pair) { return; }
        if (pair.sprite) {
            if (pair.sprite.parent) { pair.sprite.parent.removeChild(pair.sprite); }
            pair.sprite.bitmap = null;
        }
        delete this._lightSprites[key];
    };

    Spriteset_LightsShadows.prototype.refreshLight = function(pair, data, chara) {
        var sprite = pair.sprite;
        // Visibility is the *light's*, not the glow sprite's: a null-coloured
        // light is invisible by day yet must still punch its hole, because the
        // hole is what "prevents the screen from darkening at night".
        pair.visible = true;
        var raw = ImageManager.loadPicture(data.filename);
        if (!raw || !raw.isReady() || !(raw.width > 0)) {
            sprite.visible = false;
            pair.raw = null;
            return;
        }
        if (chara) { syncDirectionPattern(data, chara); }

        var patterns = Math.max(1, Math.floor(data.patterns) || 1);
        var directions = Math.max(1, Math.floor(data.directions) || 1);
        var w = Math.floor(raw.width / patterns);
        var h = Math.floor(raw.height / directions);
        if (w <= 0 || h <= 0) {
            sprite.visible = false;
            pair.raw = null;
            return;
        }
        var sx = (data.pattern % patterns) * w;
        var sy = (data.direction % directions) * h;
        sx = Math.max(0, Math.min(raw.width - w, sx));
        sy = Math.max(0, Math.min(raw.height - h, sy));

        var x = calculateX(data.x, data.parallax_x, chara);
        var y = calculateY(data.y, data.parallax_y, chara);
        var zx = data.scaleX() * WORLD_SCALE;
        var zy = data.scaleY() * WORLD_SCALE;
        var a = clamp255(data.color.alpha) / 255;

        // `data.opacity` is already 0..255 (set_opacity multiplied by 255/100),
        // so the two 0..255 factors multiply straight through.  A null colour
        // yields no bitmap at all: under ADD a black glow would be a no-op
        // anyway, and skipping the sprite is what makes "invisible on the day"
        // fall out for free.
        var tinted = this.tintedBitmap(data.filename, raw, data.color);

        sprite.visible = !!tinted;
        sprite.bitmap = tinted;
        sprite.setFrame(sx, sy, w, h);
        sprite.x = x;
        sprite.y = y;
        sprite.anchor.x = data.ox;
        sprite.anchor.y = data.oy;
        sprite.scale.x = (data.mirror ? -1 : 1) * zx;
        sprite.scale.y = zy;
        sprite.rotation = (data.angle || 0) * Math.PI / 180;
        sprite.blendMode = rgssBlendToPixi(data.blend_type);
        sprite.opacity = data.opacity * a;

        // cached for the night layer's hole punching.  The hole rides on the
        // light's opacity alone -- the original's `draw_layer_sprite` reads
        // `sprite.opacity` and never `sprite.color`, so lowering the colour
        // alpha dims the daylight glow without weakening the night hole.
        pair.name = data.filename;
        pair.raw = raw;
        pair.frame = { x: sx, y: sy, w: w, h: h };
        pair.holeOpacity = data.opacity / 255;
    };

    //-------------------------------------------------------------------------
    // Tinted bitmaps  (RGSS `Sprite#color`)
    //
    //   tinted = fill(color.rgb) clipped to raw's alpha
    //
    // The clip is canvas 'destination-in', which keeps the destination's RGB
    // and multiplies in the source's alpha -- exactly the operation described
    // above, and unlike 'multiply' it still works when the source is black.
    // A white fill gives the light's silhouette as a white mask, which is what
    // the night layer needs to punch its holes, so both callers share one cache.
    //
    // The cache key is quantised to 16 steps per channel, so an animated
    // set_color lands on a handful of entries instead of allocating a bitmap
    // for every intermediate frame.
    //-------------------------------------------------------------------------
    Spriteset_LightsShadows.prototype.tintedBitmap = function(name, raw, color) {
        var qr = clamp255(color.red) >> 4;
        var qg = clamp255(color.green) >> 4;
        var qb = clamp255(color.blue) >> 4;
        if (qr === 0 && qg === 0 && qb === 0) { return null; }   // null colour
        var key = name + '#' + qr + ',' + qg + ',' + qb;
        if (this._tintCache[key]) { return this._tintCache[key]; }

        var out = new Bitmap(raw.width, raw.height);
        try {
            var ctx = out._context;
            ctx.save();
            ctx.clearRect(0, 0, out.width, out.height);
            ctx.fillStyle = 'rgb(' + (qr << 4) + ',' + (qg << 4) + ',' + (qb << 4) + ')';
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(raw._canvas, 0, 0);
            ctx.restore();
            out._setDirty();
        } catch (e) {
            return null;
        }
        if (this._tintOrder.length >= TINT_CACHE_MAX) {
            // Simple cap: a light system never needs more than a screenful of
            // distinct tints, and dropping the whole cache is cheaper than
            // tracking recency.
            this._tintCache = {};
            this._tintOrder = [];
        }
        this._tintCache[key] = out;
        this._tintOrder.push(key);
        return out;
    };

    /** The white silhouette of a light file, memoised independently of colour. */
    Spriteset_LightsShadows.prototype.holeMask = function(name, raw) {
        return this.tintedBitmap(name, raw, { red: 255, green: 255, blue: 255, alpha: 255 });
    };

    //-------------------------------------------------------------------------
    // Night layer
    //-------------------------------------------------------------------------
    /**
     * The colour the night layer should multiply by, or null if the layer
     * should stay hidden.  Mirrors the original:
     *     @night_color.set(0, 0, 0)
     *     @night_color.red = -r if r < 0        (only when lights are visible)
     */
    Spriteset_LightsShadows.prototype.computeNightColor = function() {
        if (!this.hasVisibleLight()) { return null; }
        var tone = ($gameScreen && $gameScreen.tone) ? $gameScreen.tone() : null;
        if (!tone) { return null; }
        var r = Math.min(0, tone[0]);
        var g = Math.min(0, tone[1]);
        var b = Math.min(0, tone[2]);
        if (r === 0 && g === 0 && b === 0) { return null; }
        return [-r, -g, -b];
    };
    MonlineLights.computeNightColorFor = function() {
        var scene = SceneManager._scene;
        if (!scene || !scene._lightsShadows) { return null; }
        return scene._lightsShadows.computeNightColor();
    };

    Spriteset_LightsShadows.prototype.updateNightLayer = function() {
        var night = this.computeNightColor();
        if (!night) {
            this._nightSprite.visible = false;
            return;
        }
        var bmp = this._nightBitmap;
        var ctx = bmp._context;
        ctx.save();
        ctx.clearRect(0, 0, bmp.width, bmp.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        // The *complement* of the night colour -- see the constructor for why
        // the multiply form needs `255 - D` rather than `D`.
        ctx.fillStyle = 'rgb(' + (255 - clamp255(night[0])) + ','
                                 + (255 - clamp255(night[1])) + ','
                                 + (255 - clamp255(night[2])) + ')';
        ctx.fillRect(0, 0, bmp.width, bmp.height);
        ctx.restore();

        // Punch the holes.  Zeus81's `draw_layer_sprite` blits the *raw*
        // silhouette with the sprite's opacity and no colour -- `Bitmap#blt`
        // never reads `sprite.color`, which is exactly why a null-coloured
        // light still "prevents the screen from darkening at night" while
        // staying invisible during the day.  Source-over white is the
        // multiply-space spelling of that:  M = M*(1-a) + 255*a.
        var self = this;
        Object.keys(this._lightSprites).forEach(function(key) {
            var pair = self._lightSprites[key];
            if (!pair || !pair.visible || !pair.raw) { return; }
            var mask = self.holeMask(pair.name || '', pair.raw);
            if (!mask) { return; }
            self.bltLight(bmp, pair.sprite, pair.holeOpacity, mask);
        });
        this._nightSprite.visible = true;
    };

    /**
     * RGSS `Bitmap#blt(x, y, src_bitmap, src_rect, opacity)` / `stretch_blt`.
     * MV's Bitmap#blt has a different signature and no opacity argument, so the
     * destination rectangle is computed by hand and drawn with a temporary
     * globalAlpha.  Mirrored lights are handled by scaling about the centre,
     * which also keeps `x/y` anchored the way `Sprite#ox/oy` did.
     */
    Spriteset_LightsShadows.prototype.bltLight = function(layer, sprite, alpha, bitmap) {
        var bmp = bitmap || sprite.bitmap;
        if (!bmp || !(bmp.width > 0)) { return; }
        var f = sprite._frame;
        var sw = f ? f.width : bmp.width;
        var sh = f ? f.height : bmp.height;
        if (!(sw > 0) || !(sh > 0)) { return; }
        var fx = sprite.scale.x < 0 ? -1 : 1;
        var fy = sprite.scale.y < 0 ? -1 : 1;
        var dw = sw * Math.abs(sprite.scale.x);
        var dh = sh * Math.abs(sprite.scale.y);
        if (!(dw > 0) || !(dh > 0)) { return; }
        var left = sprite.x - sprite.anchor.x * dw;
        var top = sprite.y - sprite.anchor.y * dh;
        var ctx = layer._context;
        try {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            // blt cannot rotate, and neither does the original: `draw_layer_sprite`
            // only ever calls blt/stretch_blt, which is why the header notes that
            // the angle "works but only for daylights".
            ctx.translate(left + dw / 2, top + dh / 2);
            ctx.scale(fx, fy);
            ctx.drawImage(bmp._canvas, f ? f.x : 0, f ? f.y : 0, sw, sh,
                          -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
            layer._setDirty();
        } catch (e) { /* ignore a bad rect rather than kill the frame */ }
    };

    //-------------------------------------------------------------------------
    // Interpreter-facing API
    //
    // `light` is both callable (`light("player torch")`) and addressable
    // (`light.setup("torch")`, `light.chara_id = 3`).  Property access always
    // resolves against the *current event's* light, which is what the Ruby
    // default argument `key = "event#@event_id"` did.
    //-------------------------------------------------------------------------
    function makeProxy(defaultGetter) {
        var target = function(key) { return defaultGetter(key); };
        if (!window.Proxy) { return target; }
        var handler = {
            get: function(t, k) {
                if (typeof k === 'symbol') { return t[k]; }
                if (k === '__rubyStub') { return 'light'; }
                if (k === 'toString' || k === 'valueOf') {
                    return function() { return '[light]'; };
                }
                var obj = defaultGetter(null);
                var v = obj[k];
                if (typeof v === 'function' && k !== 'constructor') {
                    return function() { return obj[k].apply(obj, arguments); };
                }
                if (v === undefined) {
                    var MR = window.MonlineRuby;
                    if (MR && MR.pending) {
                        MR.pending['light.' + k] = (MR.pending['light.' + k] || 0) + 1;
                    }
                }
                return v;
            },
            set: function(t, k, v) {
                if (typeof k === 'string') { defaultGetter(null)[k] = v; return true; }
                t[k] = v;
                return true;
            },
            has: function() { return true; },
            apply: function(t, thisArg, args) { return defaultGetter(args[0]); }
        };
        return new Proxy(target, handler);
    }

    MonlineLights.interpreterProxy = function() { return makeProxy(getLight); };
    MonlineLights.interpreterShadowProxy = function() { return makeProxy(getShadow); };

    /** `set_shadowable(value, chara_id = @event_id)` */
    MonlineLights.set_shadowable = function(value, charaId) {
        if (charaId === undefined || charaId === null) { charaId = currentEventId(); }
        var chara = zlsGetCharacter(charaId);
        if (chara) { chara.shadowable = value; }
        return true;
    };

    //-------------------------------------------------------------------------
    // Game_Map#setup - clear everything anchored to a character, exactly like
    // Zeus81's aliased setup.  Screen/parallax anchored entries (chara_id < 0,
    // e.g. the player torch) deliberately survive a map change.
    //-------------------------------------------------------------------------
    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        if (this._monlineLights) {
            Object.keys(this._monlineLights).forEach(function(k) {
                var d = this._monlineLights[k];
                if (d && d.chara_id >= 0 && typeof d.clear === 'function') { d.clear(); }
            }, this);
        }
        if (this._monlineShadows) {
            Object.keys(this._monlineShadows).forEach(function(k) {
                var d = this._monlineShadows[k];
                if (d && d.chara_id >= 0 && typeof d.clear === 'function') { d.clear(); }
            }, this);
        }
        return _Game_Map_setup.apply(this, arguments);
    };

    //-------------------------------------------------------------------------
    // Spriteset_Map integration
    //-------------------------------------------------------------------------
    var _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _Spriteset_Map_createLowerLayer.call(this);
        this._lightsShadows = new Spriteset_LightsShadows(this);
    };

    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        _Spriteset_Map_update.call(this);
        if (this._lightsShadows) { this._lightsShadows.update(); }
    };

    var _Spriteset_Map_dispose = Spriteset_Map.prototype.dispose;
    Spriteset_Map.prototype.dispose = function() {
        if (this._lightsShadows) {
            this._lightsShadows.dispose();
            this._lightsShadows = null;
        }
        _Spriteset_Map_dispose.call(this);
    };

    // The night layer supplies the darkness itself, so while lights are on the
    // map the engine's own tone must stop double-counting the negative part.
    // This is Zeus81's `@viewport.tone.red += @night_color.red = -r if r < 0`.
    Spriteset_Map.prototype.updateToneChanger = function() {
        var tone = $gameScreen.tone();
        var night = this._lightsShadows ? this._lightsShadows.computeNightColor() : null;
        var effective = tone;
        if (night) {
            effective = [
                Math.max(0, tone[0]),
                Math.max(0, tone[1]),
                Math.max(0, tone[2]),
                tone[3]
            ];
        }
        if (!this._tone.equals(effective)) {
            this._tone = effective.clone();
            if (Graphics.isWebGL()) {
                this.updateWebGLToneChanger();
            } else {
                this.updateCanvasToneChanger();
            }
        }
    };
})();
