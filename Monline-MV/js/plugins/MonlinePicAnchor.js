//=============================================================================
// MonlinePicAnchor.js
//=============================================================================
/*:
 * @plugindesc Port of HimeWorks "Picture Anchors" (0239.rb) for Monline.
 * @author Monline port
 *
 * @help
 * Port of the VX Ace script "Picture Anchors" by HimeWorks (source script
 * 0239.rb in the original project).
 *
 * A picture anchor fixes a picture to something other than the screen:
 *
 *     anchor_picture_to_screen(id)            656 calls in the game data
 *     anchor_picture_to_event(id, event_id)     1 call
 *     anchor_picture_to_player(id)
 *     anchor_picture_to_map(id, x, y)         tile coordinates
 *     anchor_picture_to_follower(id, follower_id)
 *     anchor_picture_to_vehicle(id, type)     "ship" / "boat" / "airship"
 *
 * `anchor_picture_to_screen` is the MV default as well, so a no-op would look
 * correct - but the anchor state has to be *stored* for the other four to be
 * meaningful, and a picture that was anchored to an event and later
 * re-anchored to the screen has to actually come back.
 *
 * VX Ace stores the anchor on Game_Picture and only resets it in
 * `initialize`, so it survives a later `Show Picture` of the same id.  That is
 * reproduced here.  Note also that MV's own `updatePosition` only ever runs
 * while the sprite is visible, which matches `Sprite_Picture#update`.
 *
 * Coordinate mapping: an anchored picture's position is
 *     screen_position_of_anchor + picture.x / picture.y
 * for character anchors, and
 *     (map_tile - display_tile) * tile_size
 * for map anchors.  Map anchors need no rescaling because MV's tiles are
 * already 48px against VX Ace's 32px, i.e. the same 1.5x the rest of the port
 * uses.
 */

(function() {
    'use strict';

    function pictureFor(number) {
        var n = Math.round(Number(number) || 0);
        if (!(n > 0)) { return null; }
        if (typeof $gameScreen === 'undefined' || !$gameScreen) { return null; }
        return $gameScreen.picture(n);
    }

    /** `zls`-style character lookup, same numbering as VX Ace's get_character. */
    function characterFor(id) {
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

    //-------------------------------------------------------------------------
    // Game_Picture#anchor
    //-------------------------------------------------------------------------
    Game_Picture.prototype.anchorType = function() {
        return this._anchorType || 'screen';
    };
    Game_Picture.prototype.anchorObject = function() {
        return this._anchorObject || null;
    };
    Game_Picture.prototype.setAnchor = function(type, object) {
        this._anchorType = type;
        this._anchorObject = object || null;
    };

    // VX Ace sets @anchor in Game_Picture#initialize only, so a `Show Picture`
    // on an already-anchored id keeps the anchor.
    var _Game_Picture_initialize = Game_Picture.prototype.initialize;
    Game_Picture.prototype.initialize = function() {
        _Game_Picture_initialize.apply(this, arguments);
        this.setAnchor('screen', null);
    };

    //-------------------------------------------------------------------------
    // The six interpreter entry points
    //-------------------------------------------------------------------------
    window.anchor_picture_to_screen = function(number) {
        var p = pictureFor(number);
        if (p) { p.setAnchor('screen', null); }
        return true;
    };

    window.anchor_picture_to_map = function(number, x, y) {
        var p = pictureFor(number);
        if (p) { p.setAnchor('map_position', [Number(x) || 0, Number(y) || 0]); }
        return true;
    };

    window.anchor_picture_to_character = function(number, id) {
        var p = pictureFor(number);
        if (p) { p.setAnchor('character', characterFor(id)); }
        return true;
    };

    window.anchor_picture_to_event = function(number, eventId) {
        return window.anchor_picture_to_character(number, eventId);
    };

    window.anchor_picture_to_player = function(number) {
        return window.anchor_picture_to_character(number, -1);
    };

    // The VX Ace source indexes `$game_player.followers[-(follower_id + 1)]`,
    // which lands on the *last* follower for id 0 - clearly not what its own
    // header documents ("the first follower is the actor right behind the
    // leader").  The documented behaviour is implemented; the game never calls
    // this.
    window.anchor_picture_to_follower = function(number, followerId) {
        var p = pictureFor(number);
        if (!p) { return true; }
        var n = Math.max(0, Math.round(Number(followerId) || 0));
        p.setAnchor('character', $gamePlayer.followers().follower(n) || null);
        return true;
    };

    window.anchor_picture_to_vehicle = function(number, type) {
        var p = pictureFor(number);
        if (!p) { return true; }
        var vehicle = $gameMap.vehicle(type);
        // VX Ace only anchors when the vehicle is on the current map
        // (`vehicle.map_id == $game_map.map_id`; MV keeps it in `_mapId`).
        if (vehicle && vehicle._mapId === $gameMap.mapId()) {
            p.setAnchor('character', vehicle);
        }
        return true;
    };

    //-------------------------------------------------------------------------
    // Sprite_Picture#update_position
    //-------------------------------------------------------------------------
    var _Sprite_Picture_updatePosition = Sprite_Picture.prototype.updatePosition;
    Sprite_Picture.prototype.updatePosition = function() {
        var picture = this.picture();
        var type = picture ? picture.anchorType() : 'screen';
        if (type === 'character') {
            var chara = picture.anchorObject();
            if (chara && typeof chara.screenX === 'function') {
                this.x = Math.floor(chara.screenX() + picture.x());
                this.y = Math.floor(chara.screenY() + picture.y());
                return;
            }
        } else if (type === 'map_position') {
            var pos = picture.anchorObject();
            if (pos) {
                this.x = Math.floor((pos[0] - $gameMap.displayX()) * $gameMap.tileWidth());
                this.y = Math.floor((pos[1] - $gameMap.displayY()) * $gameMap.tileHeight());
                return;
            }
        }
        _Sprite_Picture_updatePosition.call(this);
    };

    // MonlineShim installed placeholder no-ops for these globals; they are real
    // now, so drop them from the shim's report instead of leaving the
    // diagnostics claiming otherwise.
    if (window.MonlineShim && window.MonlineShim.functions) {
        var implemented = [
            'anchor_picture_to_screen', 'anchor_picture_to_map',
            'anchor_picture_to_event', 'anchor_picture_to_player',
            'anchor_picture_to_character', 'anchor_picture_to_follower',
            'anchor_picture_to_vehicle'
        ];
        window.MonlineShim.functions = window.MonlineShim.functions.filter(function(n) {
            return implemented.indexOf(n) < 0;
        });
        window.MonlineShim.pictureAnchors = true;
    }
})();
