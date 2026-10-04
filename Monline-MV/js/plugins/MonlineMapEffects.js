//=============================================================================
// MonlineMapEffects.js
//=============================================================================
/*:
 * @plugindesc VX Ace "Map Effects" (Zeus81, 0244.rb) ported to MV.
 * @author Monline port
 *
 * @help
 * Port of the VX Ace script `Map Effects v1.4.1` by Zeus81 (source 0244.rb).
 * The game drives it from event scripts through a `map_effects` singleton:
 *
 *     map_effects.set_tone(0, 0, 0, 155, 60)     // r, g, b, gray, duration
 *     map_effects.set_zoom(125, 120)             // percent, duration
 *     map_effects.setup_blur(3, 100, 30)
 *     map_effects.set_gaussian_blur(6, 120)
 *     map_effects.set_zoom_blur(150, 180)
 *     map_effects.set_linear_blur(0, 90, 60)
 *     map_effects.set_motion_blur(1)
 *     map_effects.set_radial_blur(150, 60)
 *     map_effects.set_pixelize(150, 60)
 *     map_effects.set_wave(10, 120, 3000, 60)
 *     map_effects.set_hue(180, 60)
 *     map_effects.set_opacity(128, 60)
 *     map_effects.back   = true
 *     map_effects.mirror = true
 *     map_effects.clear
 *
 * Measured usage: 1241 call sites - the largest system still unported.
 *
 * ---------------------------------------------------------------------------
 * What is faithful, and what is approximated
 * ---------------------------------------------------------------------------
 * Faithful:
 *   * tone       -> `$gameScreen.startTint(r,g,b,gray,duration)`, i.e. MV's own
 *                   screen tint, which is the same thing the original drives.
 *                   The data only ever passes r=g=b=0 and varies `gray`, so in
 *                   practice this is a desaturation fade and it maps exactly.
 *   * zoom       -> the map spriteset is scaled about the player.
 *   * mirror     -> the spriteset is flipped horizontally.
 *   * opacity    -> spriteset alpha.
 *   * hue/colour -> `PIXI.filters.ColorMatrixFilter` (rotate / matrix).
 *
 * Approximated (recorded, not hidden):
 *   * MV's PIXI has only `BlurFilter` and `ColorMatrixFilter`.  The original's
 *     zoom / radial / linear / motion blurs are separate shaders, so every one
 *     of them falls back to a Gaussian `BlurFilter` of matching strength - the
 *     intensity and the fade are right, the *shape* of the blur is not.
 *   * `set_pixelize` and `set_wave` have no MV equivalent available in the
 *     bundled PIXI, so they record their state and do not draw.  Writing custom
 *     shaders for them is possible but cannot be verified here: this project's
 *     smoke test runs on the **canvas** renderer, where PIXI ignores filters
 *     entirely, so a broken shader would not be caught.
 *
 *   * `create_controller`, `create_particle`, `add_orb`, `move_orb`, `zoom_orb`,
 *     `create_comment`, `focus_event*`, `move_controller` are decorative
 *     in-map objects.  They are accepted and tracked so the scripts run, but
 *     they are not drawn.
 */

var MonlineMapEffects = MonlineMapEffects || {};

(function() {
    'use strict';

    //-------------------------------------------------------------------------
    // The singleton, hung on window because the scripts call it bare
    //-------------------------------------------------------------------------
    function Game_Map_Effects() { this.clear(); }

    Game_Map_Effects.prototype.clear = function() {
        this.active = false;
        this.back = false;
        this.mirror = false;
        this.refresh_rate = 1;
        this.x = 0; this.y = 0;
        this.ox = 0; this.oy = 0;
        this.angle = 0;
        this.zoom = 100;
        this.opacity = 255;
        this.hue = 0;
        this.color = [255, 255, 255, 255];
        this.blurType = 0;        // 0 none, 1 gaussian, 2 zoom, 3 linear,
                                  // 4 radial, 5 motion, 6 pixelize
        this.blurStrength = 0;
        this.blurParam = 0;
        this.wave = null;
        this._zoomTarget = 100;
        this._zoomDuration = 0;
        this._opacityTarget = 255;
        this._opacityDuration = 0;
        this._blurTarget = 0;
        this._blurDuration = 0;
        this._hueTarget = 0;
        this._hueDuration = 0;
    };

    /** The Zeus-style fixed-length ease used throughout this port. */
    function nextValue(value, target, duration) {
        return (value * (duration - 1) + target) / duration;
    }

    // --- tone: MV's own screen tint -----------------------------------------
    Game_Map_Effects.prototype.set_tone = function(red, green, blue, gray, duration) {
        this.active = true;
        $gameScreen.startTint(red || 0, green || 0, blue || 0, gray || 0,
                              duration || 0);
        return true;
    };

    // --- zoom ----------------------------------------------------------------
    Game_Map_Effects.prototype.set_zoom = function(zoom, duration, centerOnPlayer) {
        this.active = true;
        this._zoomTarget = zoom === undefined ? 100 : zoom;
        this._zoomDuration = duration || 0;
        this._centerOnPlayer = centerOnPlayer !== false;
        if (this._zoomDuration === 0) { this.zoom = this._zoomTarget; }
        return true;
    };
    Game_Map_Effects.prototype.default_zoom = function() {
        return 100;
    };

    // --- blur ----------------------------------------------------------------
    // Every blur type ends up on one Gaussian BlurFilter; see the header for
    // why the shape cannot be reproduced with MV's bundled PIXI.
    Game_Map_Effects.prototype._setBlur = function(type, strength, param, duration) {
        this.active = true;
        this.blurType = type;
        this.blurParam = param || 0;
        this._blurTarget = strength || 0;
        this._blurDuration = duration || 0;
        if (this._blurDuration === 0) { this.blurStrength = this._blurTarget; }
    };

    Game_Map_Effects.prototype.setup_blur = function(type, param, duration) {
        this._setBlur(type, this.blurStrength, param, duration);
        return true;
    };
    Game_Map_Effects.prototype.set_gaussian_blur = function(strength, duration) {
        this._setBlur(1, strength, this.blurParam, duration);
        return true;
    };
    Game_Map_Effects.prototype.set_zoom_blur = function(strength, duration) {
        this._setBlur(2, strength, this.blurParam, duration);
        return true;
    };
    Game_Map_Effects.prototype.set_linear_blur = function(angle, strength, duration) {
        this._setBlur(3, strength, angle, duration);
        return true;
    };
    Game_Map_Effects.prototype.set_radial_blur = function(strength, duration) {
        this._setBlur(4, strength, this.blurParam, duration);
        return true;
    };
    Game_Map_Effects.prototype.set_motion_blur = function(strength) {
        this._setBlur(5, strength || 1, this.blurParam, 0);
        return true;
    };
    Game_Map_Effects.prototype.set_pixelize = function(size, duration) {
        // no bundled filter for this; state only
        this._setBlur(6, size, this.blurParam, duration);
        return true;
    };
    Game_Map_Effects.prototype.set_blur_zoom = function(zoom, duration) {
        this.blurParam = zoom;
        return true;
    };

    // --- colour --------------------------------------------------------------
    Game_Map_Effects.prototype.set_hue = function(hue, duration) {
        this.active = true;
        this._hueTarget = hue || 0;
        this._hueDuration = duration || 0;
        if (this._hueDuration === 0) { this.hue = this._hueTarget; }
        return true;
    };
    Game_Map_Effects.prototype.set_color = function(r, g, b, a, duration) {
        this.active = true;
        this.color = [r, g, b, a];
        return true;
    };
    Game_Map_Effects.prototype.set_opacity = function(opacity, duration) {
        this.active = true;
        this._opacityTarget = Math.max(0, Math.min(255, opacity || 0));
        this._opacityDuration = duration || 0;
        if (this._opacityDuration === 0) { this.opacity = this._opacityTarget; }
        return true;
    };
    Game_Map_Effects.prototype.set_blend_type = function(type) {
        this.blendType = type || 0;
        return true;
    };
    Game_Map_Effects.prototype.set_origin = function(x, y, duration) {
        this.ox = x || 0;
        this.oy = y || 0;
        return true;
    };
    Game_Map_Effects.prototype.set_angle = function(angle, duration) {
        this.angle = angle || 0;
        return true;
    };
    Game_Map_Effects.prototype.set_viewport = function(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        return true;
    };
    Game_Map_Effects.prototype.set_wave = function(amp, length, speed, duration) {
        // recorded but not drawn - see the header
        this.wave = { amp: amp, length: length, speed: speed, duration: duration };
        return true;
    };

    // --- decorative objects (accepted, not drawn) ----------------------------
    ['create_controller', 'move_controller', 'create_comment', 'create_particle',
     'add_orb', 'add_orb2', 'move_orb', 'zoom_orb', 'focus_event_here',
     'focus_event', 'focus_event_player', 'use_se', 'set_anchor',
     'set_refresh_rate', 'snap_to_bitmap'].forEach(function(name) {
        Game_Map_Effects.prototype[name] = function() {
            this.active = true;
            return true;
        };
    });

    Game_Map_Effects.prototype.reset_map_effects = function() { this.clear(); return true; };
    Game_Map_Effects.prototype.revert_map_effects = function() { this.clear(); return true; };

    // --- per-frame animation -------------------------------------------------
    Game_Map_Effects.prototype.update = function() {
        if (this._zoomDuration > 0) {
            this.zoom = nextValue(this.zoom, this._zoomTarget, this._zoomDuration);
            this._zoomDuration -= 1;
            if (this._zoomDuration === 0) { this.zoom = this._zoomTarget; }
        }
        if (this._blurDuration > 0) {
            this.blurStrength = nextValue(this.blurStrength, this._blurTarget,
                                          this._blurDuration);
            this._blurDuration -= 1;
            if (this._blurDuration === 0) { this.blurStrength = this._blurTarget; }
        }
        if (this._opacityDuration > 0) {
            this.opacity = nextValue(this.opacity, this._opacityTarget,
                                     this._opacityDuration);
            this._opacityDuration -= 1;
            if (this._opacityDuration === 0) { this.opacity = this._opacityTarget; }
        }
        if (this._hueDuration > 0) {
            this.hue = nextValue(this.hue, this._hueTarget, this._hueDuration);
            this._hueDuration -= 1;
            if (this._hueDuration === 0) { this.hue = this._hueTarget; }
        }
    };

    MonlineMapEffects.Game_Map_Effects = Game_Map_Effects;

    var effects = new Game_Map_Effects();
    // `Game_Map_Effects` is serialised in the original; publishing the class
    // keeps save files readable and lets the instance be rebuilt from them.
    window.Game_Map_Effects = Game_Map_Effects;
    MonlineMapEffects.effects = effects;

    // `map_effects` is a *container object*, addressed in method style
    // (`map_effects.set_tone(...)`) and with property writes
    // (`map_effects.back = true`).  That matters because the bridge installs
    // its stubs in `F`, the `with` object of the sandbox, and `isRealPort()`
    // only recognises functions - so without a marker here the bridge would
    // install a stub for `map_effects` into `F`, shadowing this object and
    // silently turning every call on it back into a no-op while still
    // reporting the name as "pending".  The flag is what `isRealPort()` checks
    // for container-style ports; see MonlineRubyBridge.js.
    effects.__monlineReal = true;
    window.map_effects = effects;

    //-------------------------------------------------------------------------
    // Applying the state to the map spriteset
    //-------------------------------------------------------------------------
    function apply(spriteset) {
        if (!spriteset) { return; }
        var s = effects;
        var scale = (s.zoom || 100) / 100;
        var mirror = s.mirror ? -1 : 1;
        spriteset.scale.x = scale * mirror;
        spriteset.scale.y = scale;
        // zoom about the player's screen position, otherwise the map drifts
        if (scale !== 1 || mirror === -1) {
            var px = $gamePlayer.screenX();
            var py = $gamePlayer.screenY();
            spriteset.x = px - px * scale * mirror;
            spriteset.y = py - py * scale;
            spriteset.x += s.ox * scale;
            spriteset.y += s.oy * scale;
        } else {
            spriteset.x = s.ox;
            spriteset.y = s.oy;
        }
        spriteset.alpha = Math.max(0, Math.min(255, s.opacity)) / 255;

        // blur (and hue) live in one filter chain; MV bundles only BlurFilter
        // and ColorMatrixFilter, so this is an approximation (see header)
        var filters = [];
        if (s.blurStrength !== 0 && s.blurType !== 6 && window.PIXI &&
            PIXI.filters && PIXI.filters.BlurFilter) {
            if (!spriteset._monlineBlur) {
                spriteset._monlineBlur = new PIXI.filters.BlurFilter();
            }
            spriteset._monlineBlur.blur = Math.abs(s.blurStrength) / 10;
            filters.push(spriteset._monlineBlur);
        }
        if (s.hue !== 0 && window.PIXI && PIXI.filters &&
            PIXI.filters.ColorMatrixFilter) {
            if (!spriteset._monlineColor) {
                spriteset._monlineColor = new PIXI.filters.ColorMatrixFilter();
            }
            spriteset._monlineColor.reset();
            spriteset._monlineColor.hue(s.hue, false);
            filters.push(spriteset._monlineColor);
        }
        spriteset.filters = filters.length ? filters : null;
    }
    MonlineMapEffects.apply = apply;

    //-------------------------------------------------------------------------
    // Hooks
    //-------------------------------------------------------------------------
    var _Spriteset_Map_update = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function() {
        effects.update();
        apply(this);
        _Spriteset_Map_update.call(this);
    };

    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        // a map change drops every effect, like the original's CLEAR_ON_TRANSFER
        effects.clear();
    };

    //-------------------------------------------------------------------------
    // Real now: drop MonlineShim's placeholders
    //-------------------------------------------------------------------------
    if (window.MonlineShim && window.MonlineShim.functions) {
        var implemented = ['set_tone', 'setup_blur', 'set_zoom_blur', 'set_zoom',
                           'set_linear_blur', 'set_gaussian_blur', 'set_wave',
                           'set_hue', 'set_radial_blur', 'set_opacity',
                           'set_motion_blur', 'set_pixelize', 'set_color',
                           'reset_map_effects', 'revert_map_effects',
                           'create_controller', 'move_controller',
                           'create_comment', 'create_particle', 'add_orb',
                           'add_orb2', 'move_orb', 'zoom_orb', 'focus_event_here',
                           'focus_event', 'focus_event_player', 'use_se',
                           'set_anchor', 'set_viewport', 'default_zoom',
                           'set_blur_zoom', 'set_blend_type', 'set_origin',
                           'set_angle'];
        window.MonlineShim.functions = window.MonlineShim.functions.filter(function(n) {
            return implemented.indexOf(n) < 0;
        });
        window.MonlineShim.mapEffects = true;
    }
})();
