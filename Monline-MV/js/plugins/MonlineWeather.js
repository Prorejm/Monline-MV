//=============================================================================
// MonlineWeather.js
//=============================================================================
//
// Faithful port of 0225.rb "MOG - Weather EX (v2.3)", 145 references
// (64 `weather(type, power, image)` + 71 `weather_stop`, plus the store and
// restore helpers).
//
// Until now both were counting stubs: every call succeeded and did nothing, so
// the game's rain, snow, drifting sand and falling petals were simply missing.
//
// What the script does:
//   $game_system.weather = [type, power, image]
//       0 rain   1 wind   2 fog   3 light   4 snow   5 spark   6 random
//   power is scaled by WEATHER_POWER_EFIC (5) into a particle count,
//   clamped to [5, 999].  Each particle is one sprite from
//   Graphics/Weather/<image>.png with its own per-type motion.
//
// Measured in this project: 65 weather() calls, types {0, 1, 3, 4},
// powers 1..10, images Flower_01/02, Rain_04, Sand_01A/01B, Snow_01 - all six
// are present in img/weather/.
//
// Two deliberate deviations, both documented rather than hidden:
//
//   * Particles live in SCREEN space.  The Ruby drives a viewport whose
//     ox/oy follow the map display, so particles sit in world space and are
//     teleported by `check_loop_map` whenever the scroll jumps.  Its scroll
//     compensation (`@wp.x += nx`, then `-= @old_nx if nx == 0`) does not
//     reproduce as written, and atmospheric weather reads identically either
//     way; keeping it screen-space avoids a whole class of jitter bugs.
//
//   * RGSS3 `Sprite#angle` is counterclockwise and MV's `rotation` is
//     clockwise, so angles are negated - the same correction MonlineCompass
//     needs for the compass needle.
//=============================================================================

/*:
 * @plugindesc Port of MOG Weather EX (0225.rb): weather / weather_stop / weather_restore and the particle system.
 * @author Monline port
 */

(function () {
    'use strict';

    var CFG = {
        WEATHER_SCREEN_Z: 50,      // 0225.rb:83
        WEATHER_POWER_EFIC: 5,     // 0225.rb:87
        WEATHER_BATTLE: true       // 0225.rb:89
    };
    var IMAGE_FOLDER = 'img/weather/';   // 0225.rb:101  "Graphics/Weather/"

    function num(v, fallback) {
        var n = Number(v);
        return (v === undefined || v === null || isNaN(n)) ? fallback : n;
    }
    function rnd(n) { return Math.floor(Math.random() * n); }
    // Ruby `[[rand(n), 1].max, m].min`
    function randClamped(n, m) {
        return Math.min(Math.max(rnd(n), 1), m);
    }
    function off() { return [-1, 0, '']; }

    //-------------------------------------------------------------------------
    // Game_System / Game_Temp state (0225.rb:109-152)
    //-------------------------------------------------------------------------
    var _Game_System_initialize = Game_System.prototype.initialize;
    Game_System.prototype.initialize = function () {
        _Game_System_initialize.call(this);
        this._weather = off();
        this._weatherRestore = off();
        this._weatherRecordSet = off();
        this._weatherTemp = off();
    };

    var _Game_Temp_initialize = Game_Temp.prototype.initialize;
    Game_Temp.prototype.initialize = function () {
        _Game_Temp_initialize.call(this);
        this._weatherFade = false;
        this._weatherRfTime = 0;
        this._weatherFstop = false;
        this._weatherExSet = [];
    };

    //-------------------------------------------------------------------------
    // One particle (0225.rb:355 Weather_EX)
    //-------------------------------------------------------------------------
    function Particle(type, imageName) {
        this._type = type;
        this._imageName = String(imageName || '');
        this._sprite = new Sprite(ImageManager.loadBitmap(
            IMAGE_FOLDER, this._imageName, 0, true));
        this._sprite.anchor.x = 0.5;
        this._sprite.anchor.y = 0.5;
        this._sprite.opacity = 0;
        this._started = false;
        this.setup();
    }

    Particle.prototype.dispose = function () {
        if (this._sprite && this._sprite.parent) {
            this._sprite.parent.removeChild(this._sprite);
        }
        this._sprite = null;
    };

    // 0225.rb:450 type_setup + 504 check_weather_type
    Particle.prototype.setup = function () {
        var s = this._sprite;
        var bmp = s.bitmap;
        var cw = bmp ? bmp.width : 1;
        var ch = bmp ? bmp.height : 1;
        var cwm = cw / 2 + cw;
        var chm = ch / 2 + ch;
        this._cw2 = [Graphics.width + cwm, -cwm];
        this._ch2 = [Graphics.height + chm, -chm];

        this._xSpeed = 0;
        this._ySpeed = 0;
        this._angleSpeed = 0;
        this._zoomSpeed = 0;
        this._opacitySpeed = 0;
        this._zoom = 1;
        this._angle = 0;
        s.blendMode = 0;
        // RGSS3 and MV both clamp Sprite#opacity to 0..255; tracking it here
        // keeps the fade-in rate and the `opacity == 0` recycle test exact
        // instead of relying on whichever setter is in play.
        this._opacity = 1;
        s.opacity = 1;

        // Every type places itself at a random spot; `rain` then overrides y so
        // that respawned drops enter from above instead of mid-screen.
        s.x = rnd(this._cw2[0]);
        s.y = rnd(this._ch2[0]);

        switch (this._type) {
        case 0: this.setupRain(); break;
        case 1: this.setupWind(); break;
        case 2: this.setupFog(); break;
        case 3: this.setupLight(); break;
        case 4: this.setupSnow(); break;
        case 5: this.setupSpark(); break;
        default: this.setupRandom(); break;
        }

        this.applyTransform();
        // 0225.rb:455 `@opacity_speed = -1 if $game_temp.weather_fade`
        if ($gameTemp && $gameTemp._weatherFade) { this._opacitySpeed = -1; }
    };

    Particle.prototype.setZoom = function (z) {
        this._zoom = z;
        this._sprite.scale.x = z;
        this._sprite.scale.y = z;
    };
    Particle.prototype.setZoomXY = function (zx, zy) {
        this._zoom = zx;
        this._sprite.scale.x = zx;
        this._sprite.scale.y = zy;
    };
    Particle.prototype.applyTransform = function () {
        // RGSS3 angle is counterclockwise, MV rotation is clockwise.
        this._sprite.rotation = -this._angle * Math.PI / 180;
    };

    // 0225.rb:549
    Particle.prototype.setupRain = function () {
        // 0225.rb:551 - the very first drop is seeded anywhere on screen so the
        // rain is already falling when it starts; every respawn enters at the top.
        if (this._started) { this._sprite.y = this._ch2[1]; }
        else { this._started = true; }
        this.setZoomXY((rnd(25) + 100) / 100.0, (rnd(50) + 100) / 100.0);
        this._ySpeed = Math.min(Math.max(rnd(10) + 10, 10), 20);
        this._opacitySpeed = 10;
    };
    // 0225.rb:598
    Particle.prototype.setupWind = function () {
        this._angle = rnd(360);
        this.setZoom((rnd(100) + 50) / 100.0);
        this._xSpeed = randClamped(10, 10);
        this._ySpeed = randClamped(10, 10);
        this._opacitySpeed = 10;
    };
    // 0225.rb:567
    Particle.prototype.setupFog = function () {
        this._angle = rnd(2) === 1 ? 180 : 0;
        this.setZoom((rnd(100) + 50) / 100.0);
        this._xSpeed = randClamped(10, 10);
        this._opacitySpeed = 10;
    };
    // 0225.rb:582
    Particle.prototype.setupLight = function () {
        this._angle = rnd(360);
        this.setZoom((rnd(100) + 50) / 100.0);
        this._sprite.blendMode = 1;
        this._angleSpeed = randClamped(3, 3);
        this._ySpeed = -randClamped(10, 10);
        this._opacitySpeed = 2;
    };
    // 0225.rb:519
    Particle.prototype.setupSnow = function () {
        this._angle = rnd(360);
        this.setZoom((rnd(100) + 50) / 100.0);
        this._ySpeed = Math.min(Math.max(rnd(5), 1), 5);
        this._opacitySpeed = 5;
        this._angleSpeed = rnd(3);
    };
    // 0225.rb:534
    Particle.prototype.setupSpark = function () {
        this._angle = rnd(360);
        this.setZoom((rnd(100) + 100) / 100.0);
        this._sprite.blendMode = 1;
        this._opacitySpeed = 10;
        this._zoomSpeed = -0.01;
    };
    // 0225.rb:613
    Particle.prototype.setupRandom = function () {
        this._angle = rnd(360);
        this.setZoom((rnd(100) + 50) / 100.0);
        var xs = randClamped(10, 10), ys = randClamped(10, 10);
        this._xSpeed = rnd(2) === 1 ? xs : -xs;
        this._ySpeed = rnd(2) === 1 ? ys : -ys;
        this._opacitySpeed = 10;
    };

    // 0225.rb:461 update_weather / 493 can_reset_setup?
    Particle.prototype.update = function () {
        var s = this._sprite;
        s.x += this._xSpeed;
        s.y += this._ySpeed;
        this._opacity += this._opacitySpeed;
        if (this._opacity > 255) { this._opacity = 255; }
        if (this._opacity < 0) { this._opacity = 0; }
        s.opacity = this._opacity;
        this._angle += this._angleSpeed;
        if (this._zoomSpeed) {
            this.setZoom(this._zoom + this._zoomSpeed);
        }
        this.applyTransform();

        if (s.x > this._cw2[0] || s.x < this._cw2[1] ||
            s.y > this._ch2[0] || s.y < this._ch2[1] ||
            s.opacity === 0 || s.scale.x > 2.0 || s.scale.x < 0.5) {
            this.setup();
        }
    };

    //-------------------------------------------------------------------------
    // The layer itself (0225.rb:634 Module_Weather_EX)
    //-------------------------------------------------------------------------
    function WeatherLayer(spriteset) {
        this._spriteset = spriteset;
        this._container = new Sprite();
        this._container.z = CFG.WEATHER_SCREEN_Z;
        spriteset.addChild(this._container);
        this._particles = [];
        this._oldWeather = null;
        // 0225.rb:732 - the particles are created with the spriteset, not on
        // the first update, so the weather is already on screen at once.
        this.rebuild();
    }

    WeatherLayer.prototype.dispose = function () {
        this.clear();
        if (this._container && this._container.parent) {
            this._container.parent.removeChild(this._container);
        }
        this._container = null;
        this._spriteset = null;
    };

    WeatherLayer.prototype.clear = function () {
        for (var i = 0; i < this._particles.length; i++) {
            this._particles[i].dispose();
        }
        this._particles = [];
    };

    // 0225.rb:654 create_weather_sprite
    WeatherLayer.prototype.rebuild = function () {
        this.clear();
        var w = $gameSystem._weather;
        this._oldWeather = w ? w.slice() : null;
        if (!w || w[0] === -1 || !w[2]) { return; }
        var efic = Math.max(CFG.WEATHER_POWER_EFIC, 1);
        var power = Math.min(Math.max(num(w[1], 0) * efic, efic), 999);
        for (var i = 0; i < power; i++) {
            var p = new Particle(num(w[0], 0), w[2]);
            this._container.addChild(p._sprite);
            this._particles.push(p);
        }
    };

    // 0225.rb:700 update_weather_ex / 710 refresh_weather_ex
    WeatherLayer.prototype.update = function () {
        if (!$gameSystem || !$gameTemp) { return; }
        if ($gameTemp._weatherRfTime > 0) { $gameTemp._weatherRfTime -= 1; }
        if ($gameTemp._weatherRfTime === 0) {
            var w = $gameSystem._weather;
            if (this._oldWeather === null ||
                this._oldWeather[0] !== w[0] ||
                this._oldWeather[1] !== w[1] ||
                this._oldWeather[2] !== w[2]) {
                this._oldWeather = w.slice();
                this.rebuild();
            }
        }
        for (var i = 0; i < this._particles.length; i++) {
            this._particles[i].update();
        }
    };


    //-------------------------------------------------------------------------
    // Attach to both spritesets (0225.rb:722 and :759)
    //-------------------------------------------------------------------------
    function attach(proto) {
        var _createUpper = proto.createUpperLayer;
        proto.createUpperLayer = function () {
            _createUpper.call(this);
            this._monlineWeather = new WeatherLayer(this);
        };
        var _update = proto.update;
        proto.update = function () {
            _update.call(this);
            if (this._monlineWeather) { this._monlineWeather.update(); }
        };
        var _dispose = proto.dispose;
        proto.dispose = function () {
            if (this._monlineWeather) {
                this._monlineWeather.dispose();
                this._monlineWeather = null;
            }
            _dispose.call(this);
        };
    }
    attach(Spriteset_Map.prototype);
    if (CFG.WEATHER_BATTLE) { attach(Spriteset_Battle.prototype); }

    //-------------------------------------------------------------------------
    // Script commands (0225.rb:157-226)
    //-------------------------------------------------------------------------
    function weather(type, power, image) {
        $gameTemp._weatherFade = false;
        $gameTemp._weatherRfTime = 0;
        $gameSystem._weather = [num(type, -1), num(power, 0), String(image || '')];
        return true;
    }
    // 0225.rb:172
    function weather_stop() {
        $gameTemp._weatherFade = false;
        $gameSystem._weather = off();
        $gameSystem._weatherRestore = off();
        $gameSystem._weatherTemp = off();
        return true;
    }
    // 0225.rb:183
    function weather_restore() {
        $gameTemp._weatherFade = false;
        if ($gameSystem._weather[0] !== -1) {
            var w = $gameSystem._weather;
            $gameSystem._weatherRestore = w.slice();
            $gameSystem._weather = off();
            return true;
        }
        var r = $gameSystem._weatherRestore;
        return weather(r[0], r[1], r[2]);
    }
    function weather_fade(value) { $gameTemp._weatherFade = !!value; return true; }
    function weather_store() {
        $gameSystem._weatherRecordSet = $gameSystem._weather.slice();
        return true;
    }
    function weather_restore_store() {
        var w = $gameSystem._weatherRecordSet;
        return weather(w[0], w[1], w[2]);
    }
    function weather_stop_b() { $gameTemp._weatherFstop = true; return true; }

    var API = {
        weather: weather,
        weather_stop: weather_stop,
        weather_restore: weather_restore,
        weather_fade: weather_fade,
        weather_store: weather_store,
        weather_restore_store: weather_restore_store,
        weather_stop_b: weather_stop_b
    };
    Object.keys(API).forEach(function (k) { window[k] = API[k]; });

    // 0225.rb:881 - stop the weather once a battle ends, when asked to
    var _Spriteset_Battle_dispose = Spriteset_Battle.prototype.dispose;
    Spriteset_Battle.prototype.dispose = function () {
        if ($gameTemp && $gameTemp._weatherFstop && $gameSystem) {
            $gameTemp._weatherFstop = false;
            $gameTemp._weatherFade = false;
            $gameSystem._weather = off();
            $gameSystem._weatherRestore = off();
            $gameSystem._weatherTemp = off();
        }
        _Spriteset_Battle_dispose.call(this);
    };

    //-------------------------------------------------------------------------
    // Scene changes: stash on push, restore on Map/Battle (0225.rb:926)
    //-------------------------------------------------------------------------
    function weatherDispose() {
        if (!$gameSystem) { return; }
        var w = $gameSystem._weather;
        if (!w || w[0] === -1) { return; }
        $gameSystem._weatherTemp = w.slice();
        $gameSystem._weather = off();
    }
    function weatherRecoverScene() {
        if (!$gameSystem) { return; }
        var t = $gameSystem._weatherTemp;
        if (!t || t[0] === -1) { return; }
        $gameSystem._weather = t.slice();
        $gameSystem._weatherTemp = off();
    }

    var _SceneManager_push = SceneManager.push;
    SceneManager.push = function (sceneClass) {
        weatherDispose();
        _SceneManager_push.call(this, sceneClass);
    };
    var _SceneManager_pop = SceneManager.pop;
    SceneManager.pop = function () {
        _SceneManager_pop.call(this);
        weatherRecoverScene();
    };
    ['Scene_Map', 'Scene_Battle'].forEach(function (name) {
        var cls = window[name];
        if (!cls) { return; }
        var _start = cls.prototype.start;
        cls.prototype.start = function () {
            _start.call(this);
            weatherRecoverScene();
        };
    });

    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        Object.keys(API).forEach(function (k) { F[k] = API[k]; });
        ['weather', 'weather_stop'].forEach(function (n) {
            var i = window.MonlineRuby.COSMETIC.indexOf(n);
            if (i >= 0) { window.MonlineRuby.COSMETIC.splice(i, 1); }
        });
    }

    window.MonlineWeather = { CFG: CFG, Particle: Particle, WeatherLayer: WeatherLayer };

    console.log('[MonlineWeather] loaded');
})();
