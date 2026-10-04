//=============================================================================
// MonlineCamera.js
//=============================================================================
/*:
 * @plugindesc VX Ace "Galv's Cam Control v1.4" ported to MV.
 * @author Monline port
 *
 * @help
 * Port of the VX Ace script `Galv's Cam Control v1.4` (source script 0216.rb in
 * the original project).  The game drives it from map events:
 *
 *     cam_set(10, 5)        # centre the camera on map coords 10,5 at speed 6
 *     cam_set(10, 5, 2)     # ... at speed 2
 *     cam_follow(4)         # scroll to event 4 and keep following it
 *     cam_follow(4, 0)      # SNAP to event 4 and keep following it
 *     cam_center            # hand the camera back to the player, speed 6
 *     cam_center(0)         # snap back to the player
 *
 * Data-wide census: 305 `cam_set`, 208 `cam_center`, 94 `cam_follow`.
 *
 * ---------------------------------------------------------------------------
 * What the original does
 * ---------------------------------------------------------------------------
 * `$game_map.cam_target` is the whole state machine:
 *
 *     0   the player drives the camera (MV's normal behaviour)
 *    -1   locked: the camera stays exactly where it was put
 *    >0   follow that event instead of the player
 *
 * While it is non-zero `Game_Player#update_scroll` is suppressed, so the player
 * walking around no longer drags the camera; while it is > 0 `Game_Player#update`
 * forces the display onto the followed event every frame.
 *
 * A move is a loop, one tile per iteration:
 *
 *     loop do
 *       scroll_to_target(x, y, speed)   # pick 1 of 8 directions, scroll one
 *                                       # tile, then Fiber.yield while scrolling?
 *       break if arrived or cannot_scroll?
 *     end
 *
 * so `cam_set(40, 30, 6)` is NOT one long scroll - it alternates diagonal and
 * straight steps, and it stops the instant the display lands exactly on the
 * target (or the map edge blocks it).  The caller then snaps the display, which
 * is what makes speed 0 an instant cut rather than a very fast pan.
 *
 * ---------------------------------------------------------------------------
 * How this port reproduces it
 * ---------------------------------------------------------------------------
 * 1. `Fiber.yield while scrolling?` becomes an interpreter *wait mode*.  MV's
 *    interpreter is update()-driven instead of coroutine-driven, so the loop
 *    body runs once per `updateWaitMode()` call - the same cadence the Fiber
 *    had.  Without this the event would run its next commands while the camera
 *    was still gliding, which is exactly the cutscene timing the original was
 *    written to control.
 *
 * 2. MV's `Game_Map#doScroll` only implements the four cardinal directions.
 *    The direction picker below needs the four diagonals, so they are added
 *    back by composing the two cardinal scrolls, exactly like Galv's
 *    `#overwrite def do_scroll`.
 *
 * 3. `Graphics.height / 32` (VX Ace's tile size) is `screenTileY()` in MV.
 *    The ratio is unchanged because both engines show exactly 13 tiles.
 *
 * Known, deliberate gaps:
 *   - A stuck move cannot hang the map.  The original relied on the coroutine
 *     to localise a bad state; here the interpreter chain is shared, so the
 *     plan gives up after ~10 seconds and the caller snaps instead.
 */

var MonlineCamera = MonlineCamera || {};

(function() {
    'use strict';

    // The wait mode a camera move parks the event in.  MV's own 'scroll' mode
    // would do for a single startScroll, but a Galv move is a state machine, so
    // it needs its own entry point.
    var WAIT_MODE = 'monlineCam';

    // Safety net: ~10 seconds at 60fps.  See the header.
    var MAX_FRAMES = 600;

    var _Game_Map_doScroll = Game_Map.prototype.doScroll;
    var _Game_Map_setup = Game_Map.prototype.setup;
    var _Game_Player_update = Game_Player.prototype.update;
    var _Game_Player_updateScroll = Game_Player.prototype.updateScroll;
    var _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    var _Game_Interpreter_terminate = Game_Interpreter.prototype.terminate;

    function camTarget() {
        var t = $gameMap._monlineCamTarget;
        return (typeof t === 'number') ? t : 0;
    }
    MonlineCamera.camTarget = camTarget;

    function setCamTarget(v) { $gameMap._monlineCamTarget = v; }
    MonlineCamera.setCamTarget = setCamTarget;

    //-------------------------------------------------------------------------
    // Galv's `Game_Map#can_move?` -- can the display advance one more tile?
    // `@display_x % @map.width` is kept because that is how the original
    // tolerates loop maps, where display_x is stored modulo the map size.
    //-------------------------------------------------------------------------
    function canMove(dir) {
        var map = $gameMap;
        var w = map.width(), h = map.height();
        switch (dir) {
        case 2: return (map.displayY() % h) < h - map.screenTileY();
        case 4: return (map.displayX() % w) > 0;
        case 6: return (map.displayX() % w) < w - map.screenTileX();
        case 8: return (map.displayY() % h) > 0;
        }
        return false;
    }
    MonlineCamera.canMove = canMove;

    /**
     * Galv's `Game_Map#scroll_to_target` direction picker.
     *
     * The order is load-bearing: the first four cases demand that *both* axes
     * are free, so a diagonal is taken only when the whole step is clear, and
     * the last four straighten out once one axis has lined up.  Reordering them
     * would produce a camera that bumps along the walls instead of cutting
     * across open ground.
     */
    function chooseDirection(x, y) {
        var dx = Math.floor($gameMap.displayX());
        var dy = Math.floor($gameMap.displayY());
        var tx = Math.floor(x), ty = Math.floor(y);
        if (dy < ty && dx > tx && canMove(2) && canMove(4)) { return 1; }
        if (dy > ty && dx > tx && canMove(8) && canMove(4)) { return 7; }
        if (dy > ty && dx < tx && canMove(8) && canMove(6)) { return 9; }
        if (dy < ty && dx < tx && canMove(2) && canMove(6)) { return 3; }
        if (dy < ty && canMove(2)) { return 2; }
        if (dy > ty && canMove(8)) { return 8; }
        if (dx < tx && canMove(6)) { return 6; }
        if (dx > tx && canMove(4)) { return 4; }
        return 0;
    }
    MonlineCamera.chooseDirection = chooseDirection;

    //-------------------------------------------------------------------------
    // MV only scrolls on the four cardinal directions; the direction picker
    // needs all eight.  This is Galv's `#overwrite def do_scroll`, and the
    // cardinal cases still delegate to the engine so parallax bookkeeping stays
    // where it belongs.
    //-------------------------------------------------------------------------
    Game_Map.prototype.doScroll = function(direction, distance) {
        switch (direction) {
        case 1: this.scrollDown(distance); this.scrollLeft(distance); break;
        case 3: this.scrollDown(distance); this.scrollRight(distance); break;
        case 7: this.scrollUp(distance); this.scrollLeft(distance); break;
        case 9: this.scrollUp(distance); this.scrollRight(distance); break;
        default: _Game_Map_doScroll.call(this, direction, distance);
        }
    };

    //-------------------------------------------------------------------------
    // The move plan: the Ruby `loop do ... end`, one frame per iteration.
    //-------------------------------------------------------------------------
    var plan = null;

    function finish() {
        var p = plan;
        plan = null;
        if (p && p.onDone) { p.onDone(); }
        return false;
    }

    // Abandoning a plan must go through `finish`, never straight to
    // `plan = null`: `cam_center` hands the camera back to the player *only*
    // from its onDone (it locks to -1 while panning), so silently dropping the
    // plan strands the display at -1 and it never follows the player again.
    // Reported as "after the Caste City event the camera stopped following".
    //
    // `cam_set` deliberately never unlocks (see its comment below), so an
    // abandoned pan would leave the camera parked with nobody left to release
    // it.  The Ruby never aborts its loop, so this state does not exist there;
    // the only sane recovery is to give the camera back to the player.
    function abandon() {
        if (!plan) { return; }
        try {
            finish();
        } catch (e) {
            // during teardown $gameMap / $gamePlayer may already be gone
            plan = null;
        }
        if ($gameMap && $gameMap._monlineCamTarget === -1) {
            $gameMap._monlineCamTarget = 0;
        }
    }

    MonlineCamera.abort = function() { abandon(); };
    MonlineCamera.hasPlan = function() { return !!plan; };

    /**
     * @param target {function} -> {x, y} display coordinates to reach.  It is a
     *        function, not a pair of numbers, because `scroll_to_event` re-reads
     *        the character's position on *every* iteration - a followed event
     *        that walks while the camera is travelling is tracked, not chased to
     *        where it used to be.
     * @param speed 0 disables the move entirely (the caller snaps instead).
     * @param onDone runs once the plan settles, mirroring the statements that
     *        follow the loop in `cam_center` / `cam_follow`.
     * @returns true if a move was started and the caller should wait.
     */
    function beginMove(target, speed, onDone) {
        if (!(speed > 0)) { return false; }
        plan = {
            target: target,
            speed: speed,
            stepped: false,   // a one-tile step has just completed
            blocked: false,   // `cannot_scroll?`
            frames: 0,
            onDone: onDone || null
        };
        return true;
    }

    /**
     * One frame of the loop body.  Returns true while the caller must keep
     * waiting.  This is the only place the plan advances, and it is called from
     * `updateWaitMode`, i.e. once per frame per interpreter.
     */
    MonlineCamera.step = function() {
        var p = plan;
        if (!p) { return false; }
        if (p.frames++ > MAX_FRAMES) { return finish(); }

        // `Fiber.yield while scrolling?`
        if ($gameMap.isScrolling()) { return true; }

        var t = p.target();

        if (p.stepped) {
            p.stepped = false;
            // The original tests for `cannot_scroll?` *and* exact arrival after
            // each completed step; `display_x == scroll_x` is exact because
            // startScroll's step is a power of two, so the display lands on the
            // integer without float dust.
            if (p.blocked) { return finish(); }
            if ($gameMap.displayX() === t.x && $gameMap.displayY() === t.y) {
                return finish();
            }
        }

        var dir = chooseDirection(t.x, t.y);
        if (dir === 0) {
            // scroll_to_target sets the flag and returns; the break test only
            // sees it on the following pass.
            p.blocked = true;
            p.stepped = true;
            return true;
        }
        $gameMap.startScroll(dir, 1, p.speed);
        p.stepped = true;
        return true;
    };

    /** Ask the bridge to park the running event until the plan settles. */
    function requestWait() {
        var MR = window.MonlineRuby;
        if (MR && typeof MR.waitFor === 'function') { MR.waitFor(WAIT_MODE); }
    }

    //-------------------------------------------------------------------------
    // Map lifecycle.
    //
    // `setup` resets cam_target to 0 (the original's aliased setup) and drops
    // any plan in flight - a transfer replaces the interpreter, so a surviving
    // plan would belong to a dead event.
    //-------------------------------------------------------------------------
    Game_Map.prototype.setup = function(mapId) {
        this._monlineCamTarget = 0;
        plan = null;
        return _Game_Map_setup.apply(this, arguments);
    };

    //-------------------------------------------------------------------------
    // Player hooks.
    //-------------------------------------------------------------------------
    Game_Player.prototype.update = function(sceneActive) {
        var t = camTarget();
        if (t > 0) {
            var ev = $gameMap.event(t);
            if (ev) {
                $gameMap.setDisplayPos(ev._realX - this.centerX(),
                                       ev._realY - this.centerY());
            } else {
                // Galv 1.4's own fix: transferring to a map that does not have
                // the followed event used to crash.  Hand the camera back.
                setCamTarget(0);
            }
        }
        _Game_Player_update.call(this, sceneActive);
    };

    Game_Player.prototype.updateScroll = function(lastScrolledX, lastScrolledY) {
        if (camTarget() !== 0) { return; }
        _Game_Player_updateScroll.call(this, lastScrolledX, lastScrolledY);
    };

    //-------------------------------------------------------------------------
    // Interpreter script calls.
    //
    // `displayFor` is the interpreter-level `scroll_to_target` / `scroll_to_event`:
    //     scroll_x = (x - $game_player.center_x).to_i
    // Both center_x and the argument are integers in practice, so the truncation
    // only ever guards against a fractional caller (cam_set(10.0, 5.5)).
    //-------------------------------------------------------------------------
    function displayFor(x, y) {
        return {
            x: Math.trunc(x - $gamePlayer.centerX()),
            y: Math.trunc(y - $gamePlayer.centerY())
        };
    }

    function speedOf(speed) {
        if (speed === undefined || speed === null) { return 6; }
        var n = Number(speed);
        return isNaN(n) ? 6 : n;
    }

    function snapPlayer() {
        // `x` / `y` are read-only accessor properties on
        // Game_CharacterBase.prototype in MV (`Object.defineProperties`, get
        // only) - *not* methods.  `x()` would be "x is not a function", and
        // `x = n` would silently fail in sloppy mode.  The Ruby original read
        // them as attributes, so no parentheses here.
        $gameMap.setDisplayPos($gamePlayer.x - $gamePlayer.centerX(),
                               $gamePlayer.y - $gamePlayer.centerY());
    }

    window.cam_center = function(speed) {
        speed = speedOf(speed);
        setCamTarget(-1);
        var done = function() {
            snapPlayer();
            setCamTarget(0);
        };
        var target = function() { return displayFor($gamePlayer.x, $gamePlayer.y); };
        if (beginMove(target, speed, done)) { requestWait(); return true; }
        done();
        return true;
    };

    window.cam_set = function(x, y, speed) {
        speed = speedOf(speed);
        setCamTarget(-1);
        // Deliberately does NOT unlock afterwards: the camera stays parked
        // until another cam_* call.  (Note the asymmetry with cam_center.)
        var done = function() {
            $gameMap.setDisplayPos(x - $gamePlayer.centerX(), y - $gamePlayer.centerY());
        };
        var target = function() { return displayFor(x, y); };
        if (beginMove(target, speed, done)) { requestWait(); return true; }
        done();
        return true;
    };

    window.cam_follow = function(eventId, speed) {
        speed = speedOf(speed);
        setCamTarget(-1);
        var id = Number(eventId) || 0;
        var done = function() { setCamTarget(id); };
        var target = function() {
            var chara = (id > 0 && $gameMap.event(id)) ? $gameMap.event(id) : $gamePlayer;
            return displayFor(chara.x, chara.y);
        };
        if (beginMove(target, speed, done)) { requestWait(); return true; }
        done();
        return true;
    };

    //-------------------------------------------------------------------------
    // The wait mode itself.
    //-------------------------------------------------------------------------
    Game_Interpreter.prototype.updateWaitMode = function() {
        if (this._waitMode === WAIT_MODE) {
            if (MonlineCamera.step()) { return true; }
            this._waitMode = '';
            return false;
        }
        return _Game_Interpreter_updateWaitMode.apply(this, arguments);
    };

    Game_Interpreter.prototype.terminate = function() {
        // An interpreter that dies mid-move must not leave the plan armed for
        // whichever interpreter runs next -- nor leave the camera locked at -1
        // because cam_center's release never ran.  `abandon` does both.
        //
        // BUT only the interpreter that is actually parked on the camera may
        // release it.  MV reaches terminate() from *every* interpreter whose
        // command list runs out (rpg_objects.js:8936, from executeCommand), so
        // hundreds of unrelated map events call it during a single cutscene.
        // Letting them abort was the Caste City bug: event 5's "Game Set"
        // cutscene starts a cam_set glide, a finished tutorial event calls
        // terminate() on the very same frame, and the pan is torn down half
        // way through - with no cam_center left to hand the camera back.
        if (this._waitMode === WAIT_MODE) { abandon(); }
        return _Game_Interpreter_terminate.apply(this, arguments);
    };

    MonlineCamera.WAIT_MODE = WAIT_MODE;

    //-------------------------------------------------------------------------
    // These are real now, so MonlineShim's placeholders must go - otherwise the
    // bridge would keep stubbing them over the top and they would never run
    // (see the `isRealPort` rule in MonlineRubyBridge).
    //-------------------------------------------------------------------------
    if (window.MonlineShim && window.MonlineShim.functions) {
        var implemented = ['cam_center', 'cam_set', 'cam_follow'];
        window.MonlineShim.functions = window.MonlineShim.functions.filter(function(n) {
            return implemented.indexOf(n) < 0;
        });
        window.MonlineShim.camera = true;
    }
})();
