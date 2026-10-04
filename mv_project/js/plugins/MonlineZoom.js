//=============================================================================
// MonlineZoom.js
//=============================================================================
//
// Faithful port of 0236.rb "Character Sprite Zooming" (Hime), 129 references.
//
//   zoom_event_sprite(id, zoom)                        # zoom 1 = 100%
//   zoom_event_sprite(id, zoom, duration)              # animate over N frames
//   zoom_event_sprite(id, zoom, duration, wait)
//   zoom_event_sprite(id, zoom, duration, wait, zoom_y, duration_y)
//   zoom_player_sprite(zoom [, duration [, wait [, zoom_y [, duration_y]]]])
//   zoom_vehicle_sprite(:ship|:boat|:airship, ...)
//
// Ruby behaviour that has to survive the port:
//   * `Game_Character#zoom_x` / `zoom_y` default to 1.0 and are eased towards
//     the target over `duration` frames with the engine's usual
//     `(current * (d - 1) + target) / d` step (0236.rb:159).  A duration of 0
//     snaps immediately.
//   * `Sprite_Character#update_other` pushes `@character.zoom_x` / `zoom_y`
//     onto the sprite every frame - without that the state is invisible.
//   * `zoom_character_sprite` suspends the event while either duration is still
//     running (`Fiber.yield while ... if wait`).  MV has no Fiber, so this uses
//     the same wait-mode mechanism MonlineCamera established.
//   * `zoom_player_sprite` also zooms the followers.
//
// Measured call shapes in this project: zoom_event_sprite(N,N) x44,
// zoom_event_sprite(N,N,N) x13, zoom_event_sprite(N,N,N,false,N,N) x3,
// zoom_player_sprite(N) x40, zoom_player_sprite(N,N) x4.  Only the three-arg
// event form can actually produce a wait (duration > 0, wait defaults to true).
//=============================================================================

/*:
 * @plugindesc Port of Hime Character Sprite Zooming (0236.rb): zoom_event_sprite / zoom_player_sprite / zoom_vehicle_sprite.
 * @author Monline port
 */

(function () {
    'use strict';

    var WAIT_MODE = 'monlineZoom';
    var waitTarget = null;

    function num(v, fallback) {
        var n = Number(v);
        return (v === undefined || v === null || isNaN(n)) ? fallback : n;
    }

    //-------------------------------------------------------------------------
    // Game_CharacterBase: zoom state (0236.rb:128-184)
    //-------------------------------------------------------------------------
    var _initMembers = Game_CharacterBase.prototype.initMembers;
    Game_CharacterBase.prototype.initMembers = function () {
        _initMembers.call(this);
        this._zoomX = 1.0;
        this._zoomY = 1.0;
        this._targetZoom = 1.0;
        this._targetZoomY = 1.0;
        this._zoomDuration = 0;
        this._zoomDurationY = 0;
        this._isZooming = false;
    };

    function ensureZoom(chara) {
        if (chara._zoomX === undefined) { chara._zoomX = 1.0; }
        if (chara._zoomY === undefined) { chara._zoomY = 1.0; }
        if (chara._targetZoom === undefined) { chara._targetZoom = 1.0; }
        if (chara._targetZoomY === undefined) { chara._targetZoomY = 1.0; }
        if (chara._zoomDuration === undefined) { chara._zoomDuration = 0; }
        if (chara._zoomDurationY === undefined) { chara._zoomDurationY = 0; }
    }

    Game_CharacterBase.prototype.zoomX = function () { ensureZoom(this); return this._zoomX; };
    Game_CharacterBase.prototype.zoomY = function () { ensureZoom(this); return this._zoomY; };
    Game_CharacterBase.prototype.zoomDuration = function () { ensureZoom(this); return this._zoomDuration; };
    Game_CharacterBase.prototype.zoomDurationY = function () { ensureZoom(this); return this._zoomDurationY; };

    // 0236.rb:144 `setup_zoom(zoom, zoom_duration, zoom_y = nil, zoom_duration_y = nil)`
    Game_CharacterBase.prototype.setupZoom = function (zoom, duration, zoomY, durationY) {
        ensureZoom(this);
        this._targetZoom = num(zoom, 1.0);
        this._targetZoomY = num(zoomY, this._targetZoom);
        this._zoomDuration = Math.max(0, parseInt(duration, 10) || 0);
        this._zoomDurationY = (durationY === undefined || durationY === null)
            ? this._zoomDuration
            : Math.max(0, parseInt(durationY, 10) || 0);
        this._isZooming = true;
        // A duration of 0 has to land on the target right away, before the
        // caller can ask whether there is anything to wait for.
        this.updateZoom();
    };

    // 0236.rb:159 `update_zoom`
    Game_CharacterBase.prototype.updateZoom = function () {
        ensureZoom(this);
        if (!this._isZooming) { return; }

        var dx = this._zoomDuration;
        if (this._zoomX === this._targetZoom) {
            this._zoomDuration = 0;
        } else if (dx === 0) {
            this._zoomX = this._targetZoom;
        } else if (dx > 0) {
            this._zoomX = (this._zoomX * (dx - 1) + this._targetZoom) / dx;
            this._zoomDuration -= 1;
        }

        var dy = this._zoomDurationY;
        if (this._zoomY === this._targetZoomY) {
            this._zoomDurationY = 0;
        } else if (dy === 0) {
            this._zoomY = this._targetZoomY;
        } else if (dy > 0) {
            this._zoomY = (this._zoomY * (dy - 1) + this._targetZoomY) / dy;
            this._zoomDurationY -= 1;
        }

        if (dx === 0 && dy === 0) { this._isZooming = false; }
    };

    var _Game_CharacterBase_update = Game_CharacterBase.prototype.update;
    Game_CharacterBase.prototype.update = function () {
        _Game_CharacterBase_update.call(this);
        this.updateZoom();
    };

    //-------------------------------------------------------------------------
    // Sprite_Character: make it visible (0236.rb:119-126)
    //-------------------------------------------------------------------------
    var _Sprite_Character_updateOther = Sprite_Character.prototype.updateOther;
    Sprite_Character.prototype.updateOther = function () {
        _Sprite_Character_updateOther.call(this);
        var c = this._character;
        if (c && typeof c.zoomX === 'function') {
            this.scale.x = c.zoomX();
            this.scale.y = c.zoomY();
        }
    };

    //-------------------------------------------------------------------------
    // The wait mode (0236.rb:190 `Fiber.yield while ... if wait`)
    //-------------------------------------------------------------------------
    var _updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === WAIT_MODE) {
            var c = waitTarget;
            if (c && (c.zoomDuration() > 0 || c.zoomDurationY() > 0)) { return true; }
            waitTarget = null;
            this._waitMode = '';
            return false;
        }
        return _updateWaitMode.apply(this, arguments);
    };

    function isWaiting(c) {
        return c.zoomDuration() > 0 || c.zoomDurationY() > 0;
    }

    // 0236.rb:188
    function zoomCharacterSprite(chara, zoomX, duration, wait, zoomY, durationY) {
        if (!chara || typeof chara.setupZoom !== 'function') { return false; }
        chara.setupZoom(zoomX, duration, zoomY, durationY);
        if (wait && isWaiting(chara)) {
            waitTarget = chara;
            var MR = window.MonlineRuby;
            if (MR && typeof MR.waitFor === 'function') { MR.waitFor(WAIT_MODE); }
        }
        return true;
    }

    // 0236.rb:193 `get_character(event_id)` - MV spells that `character(n)`.
    function zoom_event_sprite(eventId, zoomX, duration, wait, zoomY, durationY) {
        var it = (window.MonlineRuby && window.MonlineRuby.current) || null;
        var chara = null;
        if (it && typeof it.character === 'function') {
            chara = it.character(parseInt(eventId, 10));
        }
        if (!chara && $gameMap) {
            var id = parseInt(eventId, 10);
            chara = (id === -1 || id === 0) ? $gamePlayer : $gameMap.event(id);
        }
        return zoomCharacterSprite(chara,
            num(zoomX, 1.0), num(duration, 0),
            wait === undefined ? true : !!wait,
            zoomY, durationY);
    }

    // 0236.rb:198 - player *and* followers
    function zoom_player_sprite(zoomX, duration, wait, zoomY, durationY) {
        var w = wait === undefined ? true : !!wait;
        var d = num(duration, 0);
        var ok = zoomCharacterSprite($gamePlayer, num(zoomX, 1.0), d, w, zoomY, durationY);
        if ($gamePlayer && typeof $gamePlayer.followers === 'function') {
            var fs = $gamePlayer.followers();
            if (fs && typeof fs.forEach === 'function') {
                // Only the player parks the event; the followers just animate.
                fs.forEach(function(f) {
                    if (f) { f.setupZoom(num(zoomX, 1.0), d, zoomY, durationY); }
                });
            }
        }
        return ok;
    }

    // 0236.rb:205 - no call sites in this project, ported for completeness.
    function zoom_vehicle_sprite(type, zoomX, duration, wait, zoomY, durationY) {
        var vehicle = null;
        if ($gameMap) {
            var t = String(type).replace(/^:/, '');
            if (t === 'ship') { vehicle = $gameMap.ship(); }
            else if (t === 'boat') { vehicle = $gameMap.boat(); }
            else if (t === 'airship') { vehicle = $gameMap.airship(); }
        }
        return zoomCharacterSprite(vehicle, num(zoomX, 1.0), num(duration, 60),
            wait === undefined ? true : !!wait, zoomY, durationY);
    }

    window.zoom_event_sprite = zoom_event_sprite;
    window.zoom_player_sprite = zoom_player_sprite;
    window.zoom_vehicle_sprite = zoom_vehicle_sprite;
    window.zoom_character_sprite = zoomCharacterSprite;

    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        F.zoom_event_sprite = zoom_event_sprite;
        F.zoom_player_sprite = zoom_player_sprite;
        F.zoom_vehicle_sprite = zoom_vehicle_sprite;
        F.zoom_character_sprite = zoomCharacterSprite;
        ['zoom_event_sprite', 'zoom_player_sprite'].forEach(function (n) {
            var i = window.MonlineRuby.COSMETIC.indexOf(n);
            if (i >= 0) { window.MonlineRuby.COSMETIC.splice(i, 1); }
        });
    }

    console.log('[MonlineZoom] loaded');
})();
