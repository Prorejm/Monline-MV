//=============================================================================
// MonlineCharEffects.js
//=============================================================================
/*:
 * @plugindesc Port of Galv's Character Effects (0261.rb): reflections, mirrors, cast shadows and overhead icons for map characters.
 * @author Monline port
 *
 * @help
 * 0261.rb gives map characters four optional attachments:
 *
 *     char_effects(2, true)                          # 0 reflect, 1 shadow,
 *                                                    # 2 mirror, 3 icon
 *     reflect(8, 9, true)                            # events 8 and 9 reflect
 *     reflect_sprite(1, "Original Player Sprite", 0) # actor 1's reflection art
 *
 * Per-map defaults come from event comments (`<reflect>`, `<shadow>`,
 * `<icon:id,x,y>`) and from actor notes (`<no_reflect>`,
 * `<reflect_sprite: file,pos>`), and are re-read on every map load.
 *
 * Measured usage: reflect_sprite 1, char_effects 1, reflect 1 - all on one map
 * (492).  Before this port all three were shim no-ops.
 *
 * ---------------------------------------------------------------------------
 * Engine differences handled here
 * ---------------------------------------------------------------------------
 *   * RGSS `Sprite#mirror` + `Sprite#angle` have no MV equivalent.  `mirror`
 *     alone is a horizontal flip -> `scale.x = -1`; `mirror + angle 180`
 *     composes into a *vertical* flip about the sprite's bottom-centre origin,
 *     which is `scale.y = -1` with MV's default anchor (0.5, 1).
 *   * `Sprite#angle` is counter-clockwise and MV's `rotation` is clockwise, so
 *     the shadow's `Math.atan2` result is negated (the same correction as
 *     MonlineCompass).
 *   * `Sprite#color = Color.new(0,0,0,255)` - a black silhouette - is MV's
 *     tone, not its blend colour: `setColorTone([-255,-255,-255,0])`.
 *   * `Sprite#wave_amp` (the water ripple on reflections) has no MV
 *     counterpart and is not reproduced.
 */
//=============================================================================

var MonlineCharEffects = MonlineCharEffects || {};

(function () {
    'use strict';

    // 0261.rb:184 Galv_CEffects
    var CFG = {
        MIRROR_REGION: 60,
        ICON_OFFSET: -60,
        REFLECT_Z: -10,
        SHADOW_Z: 0
    };

    //-------------------------------------------------------------------------
    // Game_Map state (0261.rb:909)
    //-------------------------------------------------------------------------
    var _Game_Map_initialize = Game_Map.prototype.initialize;
    Game_Map.prototype.initialize = function () {
        _Game_Map_initialize.call(this);
        this._lightSource = [];
        this._shadowOptions = [80, 10, false];
        this._reflectOptions = [0];
        this._charEffects = [false, false, false, false];  // reflect,shadow,mirror,icon
    };

    // 0261.rb:926
    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function (mapId) {
        _Game_Map_setup.call(this, mapId);
        this.resetCharEffects();
        this.doAllCharEffects();
        var scene = SceneManager._scene;
        if (scene && scene._spriteset && scene._spriteset.refreshEffects) {
            scene._spriteset.refreshEffects();
        }
    };

    // 0261.rb:936
    Game_Map.prototype.resetCharEffects = function () {
        this._lightSource = [];
        var events = this.events();
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (!e) { continue; }
            e.reflect = false;
            e.icon = 0;
        }
    };

    // 0261.rb:247 - the per-map event comment tags
    Game_Map.prototype.doAllCharEffects = function (refresh) {
        var events = this.events();
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (!e) { continue; }
            // MV's Game_Event#list is `this.page().list`, and `page()` is
            // undefined whenever the event has no active page (_pageIndex -1,
            // i.e. its conditions are not met on this map).  Ruby's
            // `@event.pages[0].list` never had that failure mode, so the port
            // must guard it - otherwise *every* map setup throws.
            if (!e.event() || !(e._pageIndex >= 0)) { continue; }
            var list = e.list();
            if (!list || !list[0]) { continue; }
            var cmd = list[0];
            if (cmd.code !== 108 && cmd.code !== 408) { continue; }
            var text = String(cmd.parameters ? cmd.parameters[0] : '');
            var m = text.match(/<icon:([^,>]*),([^,>]*),([^>]*)>/i);
            if (m) {
                e.icon = parseInt(m[1], 10) || 0;
                e.iconOffset = [parseInt(m[2], 10) || 0, parseInt(m[3], 10) || 0];
            }
            e.shadow = /<shadow>/i.test(text);
            e.reflect = /<reflect>/i.test(text);
        }
        if (refresh !== false) {
            var scene = SceneManager._scene;
            if (scene && scene._spriteset && scene._spriteset.refreshEffects) {
                scene._spriteset.refreshEffects();
            }
        }
    };

    ['charEffects', 'lightSource', 'shadowOptions', 'reflectOptions']
        .forEach(function (name) {
            var field = '_' + name;
            Object.defineProperty(Game_Map.prototype, name, {
                configurable: true,
                get: function () {
                    if (!this[field]) { this[field] = []; }
                    return this[field];
                },
                set: function (v) { this[field] = v; }
            });
        });

    //-------------------------------------------------------------------------
    // Character flags (0261.rb:827) - plain properties, like Ruby's accessors
    //-------------------------------------------------------------------------
    var _Game_Event_initialize = Game_Event.prototype.initialize;
    Game_Event.prototype.initialize = function (mapId, eventId) {
        this.reflect = false;
        this.shadow = false;
        this.iconOffset = [0, 0];
        _Game_Event_initialize.call(this, mapId, eventId);
    };

    var _Game_Vehicle_initialize = Game_Vehicle.prototype.initialize;
    Game_Vehicle.prototype.initialize = function (type) {
        this.reflect = true;
        this.shadow = true;
        this.iconOffset = [0, 0];
        _Game_Vehicle_initialize.call(this, type);
    };

    var _Game_Follower_initialize = Game_Follower.prototype.initialize;
    Game_Follower.prototype.initialize = function (memberIndex, precedingCharacter) {
        _Game_Follower_initialize.call(this, memberIndex, precedingCharacter);
        this.reflect = true;
        this.shadow = true;
        this.copyEffectsFromActor();
    };

    var _Game_Follower_refresh = Game_Follower.prototype.refresh;
    Game_Follower.prototype.refresh = function () {
        _Game_Follower_refresh.call(this);
        this.copyEffectsFromActor();
    };

    var _Game_Player_initialize = Game_Player.prototype.initialize;
    Game_Player.prototype.initialize = function () {
        _Game_Player_initialize.call(this);
        this.reflect = true;
        this.shadow = true;
        this.copyEffectsFromActor();
    };

    var _Game_Player_refresh = Game_Player.prototype.refresh;
    Game_Player.prototype.refresh = function () {
        _Game_Player_refresh.call(this);
        this.copyEffectsFromActor();
    };

    // 0261.rb:869 / :891 - the actor carries the persistent flags
    function copyEffectsFromActor() {
        var actor = this.actor ? this.actor() : null;
        if (!actor) { return; }
        this.reflect = actor.reflect;
        this.reflect_sprite = actor.reflect_sprite;
        this.icon = actor.icon;
    }
    Game_Player.prototype.copyEffectsFromActor = copyEffectsFromActor;
    Game_Follower.prototype.copyEffectsFromActor = copyEffectsFromActor;

    //-------------------------------------------------------------------------
    // Game_Actor (0261.rb:945) - flags come from the actor's note field
    //-------------------------------------------------------------------------
    var _Game_Actor_initialize = Game_Actor.prototype.initialize;
    Game_Actor.prototype.initialize = function (actorId) {
        _Game_Actor_initialize.call(this, actorId);
        var data = $dataActors ? $dataActors[actorId] : null;
        var note = data ? String(data.note || '') : '';
        var m = note.match(/<reflect_sprite:[ ]*([^,>]*),([^>]*)>/i);
        this.reflect_sprite = m ? [String(m[1]).trim(), parseInt(m[2], 10) || 0] : null;
        this.reflect = !/<no_reflect>/i.test(note);
        this.icon = 0;
        this.iconOffset = [0, 0];
    };

    //-------------------------------------------------------------------------
    // Shared helpers for the four effect sprites
    //-------------------------------------------------------------------------
    function blockX(index) { return index % 4 * 3; }
    function blockY(index) { return Math.floor(index / 4) * 4; }
    function patternOf(character) {
        var p = character.pattern();
        return p < 3 ? p : 1;
    }
    function reflectIndexOf(character) {
        var rs = character.reflect_sprite;
        if (rs) { return rs[1] || 0; }
        return character.characterIndex();
    }
    function reflectNameOf(character) {
        var rs = character.reflect_sprite;
        if (rs && rs[0]) { return rs[0]; }
        return character.characterName();
    }

    //-------------------------------------------------------------------------
    // Sprite_Reflect (0261.rb:554)
    //-------------------------------------------------------------------------
    function Sprite_Reflect(character) { this.initialize.apply(this, arguments); }
    Sprite_Reflect.prototype = Object.create(Sprite_Character.prototype);
    Sprite_Reflect.prototype.constructor = Sprite_Reflect;

    Sprite_Reflect.prototype.setCharacterBitmap = function () {
        this.bitmap = ImageManager.loadCharacter(reflectNameOf(this._character));
        this._isBigCharacter = ImageManager.isBigCharacter(
            reflectNameOf(this._character));
        // `self.mirror = true` + `self.angle = 180` composes into a vertical
        // flip about the bottom-centre origin (anchor 0.5 / 1).
        this.scale.y = -1;
        this.opacity = 220;
        this.z = CFG.REFLECT_Z;
    };
    Sprite_Reflect.prototype.updateCharacterFrame = function () {
        var pw = this.patternWidth();
        var ph = this.patternHeight();
        var index = reflectIndexOf(this._character);
        var sx = (blockX(index) + patternOf(this._character)) * pw;
        var sy = (blockY(index) + (this._character.direction() - 2) / 2) * ph;
        this.setFrame(sx, sy, pw, ph);
    };
    Sprite_Reflect.prototype.updatePosition = function () {
        this.x = this._character.screenX();
        var jump = this._character.isJumping() ? this._character.jumpHeight() * 2 : 0;
        this.y = this._character.screenY() - 3 + jump;
        this.z = CFG.REFLECT_Z;
    };
    Sprite_Reflect.prototype.updateOther = function () {
        this.setBlendMode(this._character.blendMode());
        this.visible = !this._character.isTransparent();
    };
    Sprite_Reflect.prototype.updateBalloon = function () {};
    Sprite_Reflect.prototype.updateAnimation = function () {};

    //-------------------------------------------------------------------------
    // Sprite_Mirror (0261.rb:620)
    //-------------------------------------------------------------------------
    function Sprite_Mirror(character) { this.initialize.apply(this, arguments); }
    Sprite_Mirror.prototype = Object.create(Sprite_Character.prototype);
    Sprite_Mirror.prototype.constructor = Sprite_Mirror;

    Sprite_Mirror.prototype.initialize = function (character) {
        this._distance = 0;
        Sprite_Character.prototype.initialize.call(this, character);
    };

    Sprite_Mirror.prototype.setCharacterBitmap = function () {
        this.bitmap = ImageManager.loadCharacter(reflectNameOf(this._character));
        this._isBigCharacter = ImageManager.isBigCharacter(
            reflectNameOf(this._character));
        this.scale.x = -1;                  // `self.mirror = true`
        this.opacity = 255;
        this.z = CFG.REFLECT_Z;
    };
    // 0261.rb:655 - the mirror image faces the opposite way
    Sprite_Mirror.prototype.updateCharacterFrame = function () {
        var pw = this.patternWidth();
        var ph = this.patternHeight();
        var index = reflectIndexOf(this._character);
        var sx = (blockX(index) + patternOf(this._character)) * pw;
        var sy = (blockY(index) + (10 - this._character.direction() - 2) / 2) * ph;
        this.setFrame(sx, sy, pw, ph);
    };
    // 0261.rb:667
    Sprite_Mirror.prototype.getMirrorY = function () {
        var ch = this.patternHeight();
        var cy = this._character.y;
        for (var i = 0; i < 20; i++) {
            if ($gameMap.regionId(cy, cy - i) === CFG.MIRROR_REGION) {
                this._distance = (i - 1) * 0.05;
                this.opacity = 255;
                return (cy - i + 1 - $gameMap.displayY()) *
                       $gameMap.tileWidth() - i * 4;
            }
        }
        this.opacity = 0;
        return ch;
    };
    Sprite_Mirror.prototype.updatePosition = function () {
        this.x = this._character.screenX();
        this.y = this.getMirrorY() - 6;
        var s = 1 - this._distance;
        this.scale.y = s;
        this.scale.x = -s;
        this.z = CFG.REFLECT_Z;
    };
    Sprite_Mirror.prototype.updateOther = function () {
        this.setBlendMode(this._character.blendMode());
        this.visible = !this._character.isTransparent();
    };
    Sprite_Mirror.prototype.updateBalloon = function () {};
    Sprite_Mirror.prototype.updateAnimation = function () {};

    //-------------------------------------------------------------------------
    // Sprite_Shadow (0261.rb:698)
    //-------------------------------------------------------------------------
    function Sprite_Shadow(character, source) { this.initialize.apply(this, arguments); }
    Sprite_Shadow.prototype = Object.create(Sprite_Character.prototype);
    Sprite_Shadow.prototype.constructor = Sprite_Shadow;

    Sprite_Shadow.prototype.initialize = function (character, source) {
        this._flicker = 0;
        this._famount = 0;
        this._aamount = 0;
        this._source = source;
        Sprite_Character.prototype.initialize.call(this, character);
    };

    Sprite_Shadow.prototype.setCharacterBitmap = function () {
        this.bitmap = ImageManager.loadCharacter(this._character.characterName());
        this._isBigCharacter = ImageManager.isBigCharacter(
            this._character.characterName());
        this.z = CFG.SHADOW_Z;
    };
    Sprite_Shadow.prototype.updatePosition = function () {
        this.x = this._character.screenX();
        this.y = this._character.screenY() - 10;
        this.z = CFG.SHADOW_Z;
        this.getAngle();
    };
    // 0261.rb:745
    Sprite_Shadow.prototype.getAngle = function () {
        var src = $gameMap.lightSource[this._source];
        if (!src) { this.opacity = 0; return; }
        var x = src[0] - this._character._realX;
        var y = src[1] - this._character._realY;
        var opts = $gameMap.shadowOptions;
        this.opacity = opts[0] - Math.sqrt(x * x + y * y) * opts[1];
        if ((x === 0 && y === 0) || this.opacity <= 0) {
            this.opacity = 0;
        } else {
            // RGSS `angle` is counter-clockwise, MV `rotation` is clockwise.
            this.rotation = -(Math.atan2(x, y) * 180 / Math.PI + this._aamount) *
                            Math.PI / 180;
        }
    };
    // 0261.rb:758
    Sprite_Shadow.prototype.updateFacing = function () {
        var src = $gameMap.lightSource[this._source];
        if (!src) { return; }
        this.scale.x = (this._character.y < src[1]) ? 1 : -1;
    };
    Sprite_Shadow.prototype.updateOther = function () {
        this.setBlendMode(this._character.blendMode());
        this.visible = !this._character.isTransparent();
        // `self.color = Color.new(0,0,0,255)` - a black silhouette.
        this.setColorTone([-255, -255, -255, 0]);
    };
    Sprite_Shadow.prototype.update = function () {
        Sprite_Character.prototype.update.call(this);
        this.updateFacing();
    };
    Sprite_Shadow.prototype.updateBalloon = function () {};
    Sprite_Shadow.prototype.updateAnimation = function () {};

    //-------------------------------------------------------------------------
    // Sprite_Icon (0261.rb:777)
    //-------------------------------------------------------------------------
    function Sprite_Icon(character) { this.initialize.apply(this, arguments); }
    Sprite_Icon.prototype = Object.create(Sprite_Character.prototype);
    Sprite_Icon.prototype.constructor = Sprite_Icon;

    Sprite_Icon.prototype.initialize = function (character) {
        Sprite_Character.prototype.initialize.call(this, character);
        this._iconSprite = new Sprite();
        this._iconSprite.bitmap = ImageManager.loadSystem('IconSet');
        this._iconIndex = null;
        // Only the icon sprite is drawn: the Ruby overrides `update_position`
        // so the inherited character sprite never moves off (0,0).
        this.visible = false;
    };
    Sprite_Icon.prototype.updateVisibility = function () {
        this.visible = false;
    };
    Sprite_Icon.prototype.update = function () {
        Sprite_Character.prototype.update.call(this);
        this.updateIcon();
    };
    Sprite_Icon.prototype.updateIcon = function () {
        if (!this._character.icon) { return; }
        this.drawIcon(this._character.icon);
    };
    Sprite_Icon.prototype.drawIcon = function (iconIndex) {
        if (this._iconIndex !== null) { return; }
        var size = 24;                    // the port ships the VX Ace IconSet
        var w = Math.max(Math.floor(this._iconSprite.bitmap.width / size), 1);
        this._iconSprite.setFrame(iconIndex % w * size,
                                  Math.floor(iconIndex / w) * size, size, size);
        this._iconIndex = iconIndex;
    };
    Sprite_Icon.prototype.updatePosition = function () {
        var off = this._character.iconOffset || [0, 0];
        this._iconSprite.x = this._character.screenX() - 12 + (off[0] || 0);
        this._iconSprite.y = this._character.screenY() + CFG.ICON_OFFSET + (off[1] || 0);
        this._iconSprite.z = 100;
    };
    Sprite_Icon.prototype.updateOther = function () {
        this._iconSprite.visible = !this._character.isTransparent();
    };
    Sprite_Icon.prototype.setParent = function (parent) {
        // the icon rides above the tilemap, like Ruby's viewport-less Sprite
        parent.addChild(this._iconSprite);
    };
    Sprite_Icon.prototype.dispose = function () {
        if (this._iconSprite) {
            if (this._iconSprite.parent) {
                this._iconSprite.parent.removeChild(this._iconSprite);
            }
            this._iconSprite = null;
        }
        Sprite_Character.prototype.dispose.call(this);
    };

    MonlineCharEffects.Sprite_Reflect = Sprite_Reflect;
    MonlineCharEffects.Sprite_Mirror = Sprite_Mirror;
    MonlineCharEffects.Sprite_Shadow = Sprite_Shadow;
    MonlineCharEffects.Sprite_Icon = Sprite_Icon;

    //-------------------------------------------------------------------------
    // Spriteset_Map (0261.rb:433)
    //-------------------------------------------------------------------------
    function charactersWith(spriteset, out) {
        var list = [];
        var events = $gameMap.events();
        for (var i = 0; i < events.length; i++) { if (events[i]) { list.push(events[i]); } }
        var followers = $gamePlayer.followers()._followers || [];
        for (var f = 0; f < followers.length; f++) { list.push(followers[f]); }
        list.push($gamePlayer);
        var vehicles = $gameMap.vehicles();
        for (var v = 0; v < vehicles.length; v++) { if (vehicles[v]) { list.push(vehicles[v]); } }
        return list;
    }

    Spriteset_Map.prototype.createEffects = function () {
        if (!this._tilemap) { return; }
        var eff = $gameMap.charEffects;
        var sprites = [];
        var list = charactersWith(this);
        var i, c;

        // 0261.rb:459 reflections
        if (eff[0]) {
            for (i = 0; i < list.length; i++) {
                c = list[i];
                if (!c || !c.reflect) { continue; }
                var r = new Sprite_Reflect(c);
                this._tilemap.addChild(r);
                sprites.push(r);
            }
        }
        // 0261.rb:475 mirrors
        if (eff[2]) {
            for (i = 0; i < list.length; i++) {
                c = list[i];
                if (!c || !c.reflect) { continue; }
                var m = new Sprite_Mirror(c);
                this._tilemap.addChild(m);
                sprites.push(m);
            }
        }
        // 0261.rb:491 shadows - one set per light source
        if (eff[1]) {
            var src = $gameMap.lightSource || [];
            for (var s = 0; s < src.length; s++) {
                for (i = 0; i < list.length; i++) {
                    c = list[i];
                    if (!c || !c.shadow) { continue; }
                    var sh = new Sprite_Shadow(c, s);
                    this._tilemap.addChild(sh);
                    sprites.push(sh);
                }
            }
        }
        // 0261.rb:510 icons
        if (eff[3]) {
            for (i = 0; i < list.length; i++) {
                c = list[i];
                if (!c || !c.icon) { continue; }
                var ic = new Sprite_Icon(c);
                ic.setParent(this._tilemap);
                sprites.push(ic);
            }
        }
        this._monlineEffects = sprites;
    };

    Spriteset_Map.prototype.disposeEffects = function () {
        var sprites = this._monlineEffects || [];
        for (var i = 0; i < sprites.length; i++) {
            var s = sprites[i];
            if (s.parent) { s.parent.removeChild(s); }
            if (s.dispose) { s.dispose(); }
        }
        this._monlineEffects = [];
    };

    Spriteset_Map.prototype.refreshEffects = function () {
        this.disposeEffects();
        this.createEffects();
    };

    var _createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function () {
        _createCharacters.call(this);
        this.createEffects();
    };

    var _refreshCharacters = Spriteset_Map.prototype.refreshCharacters;
    Spriteset_Map.prototype.refreshCharacters = function () {
        _refreshCharacters.call(this);
        this.refreshEffects();
    };

    var _spritesetUpdate = Spriteset_Map.prototype.update;
    Spriteset_Map.prototype.update = function () {
        _spritesetUpdate.call(this);
        var sprites = this._monlineEffects;
        if (!sprites) { return; }
        var eff = $gameMap.charEffects;
        if (!(eff[0] || eff[1] || eff[2] || eff[3])) { return; }
        for (var i = 0; i < sprites.length; i++) { sprites[i].update(); }
    };

    var _spritesetDispose = Spriteset_Map.prototype.dispose;
    Spriteset_Map.prototype.dispose = function () {
        this.disposeEffects();
        _spritesetDispose.call(this);
    };

    //-------------------------------------------------------------------------
    // Interpreter script calls (0261.rb:258)
    //-------------------------------------------------------------------------
    function refreshEffects() {
        var scene = SceneManager._scene;
        if (scene && scene._spriteset && scene._spriteset.refreshEffects) {
            scene._spriteset.refreshEffects();
        }
    }
    function eachCharId(args, fn) {
        for (var i = 0; i < args.length; i++) { fn(args[i]); }
    }
    function isAll(args) { return args.length === 1 && args[0] === 'all'; }

    // 0261.rb:269
    function reflect(a, b, c, d) {
        var args = Array.prototype.slice.call(arguments);
        var status = args.pop();
        if (isAll(args)) {
            var events = $gameMap.events();
            for (var i = 0; i < events.length; i++) {
                if (events[i]) { events[i].reflect = !!status; }
            }
        } else {
            eachCharId(args, function (id) {
                var e = $gameMap.event(id);
                if (e) { e.reflect = !!status; }
            });
        }
        refreshEffects();
        return true;
    }
    // 0261.rb:280
    function actor_reflect(actorId, status) {
        var a = $gameActors.actor(actorId);
        if (a) { a.reflect = !!status; }
        $gamePlayer.refresh();
        return true;
    }
    // 0261.rb:302
    function reflect_sprite(actorId, filename, pos) {
        var a = $gameActors.actor(actorId);
        if (a) { a.reflect_sprite = [String(filename), parseInt(pos, 10) || 0]; }
        $gamePlayer.refresh();
        return true;
    }
    // 0261.rb:308
    function reflect_esprite(eventId, filename, pos) {
        var e = $gameMap.event(eventId);
        if (e) {
            e.reflect_sprite = [String(filename), parseInt(pos, 10) || 0];
            e.reflect = true;
        }
        if (SceneManager._scene && SceneManager._scene._spriteset) {
            SceneManager._scene._spriteset.refreshCharacters();
        }
        return true;
    }
    // 0261.rb:325
    function shadow(a, b, c, d) {
        var args = Array.prototype.slice.call(arguments);
        var status = args.pop();
        if (isAll(args)) {
            var events = $gameMap.events();
            for (var i = 0; i < events.length; i++) {
                if (events[i]) { events[i].shadow = !!status; }
            }
        } else {
            eachCharId(args, function (id) {
                var e = $gameMap.event(id);
                if (e) { e.shadow = !!status; }
            });
        }
        refreshEffects();
        return true;
    }
    // 0261.rb:336
    function actor_shadows(status) {
        $gamePlayer.shadow = !!status;
        var followers = $gamePlayer.followers()._followers || [];
        for (var i = 0; i < followers.length; i++) { followers[i].shadow = !!status; }
        refreshEffects();
        return true;
    }
    // 0261.rb:353
    function shadow_options(a, b, c) {
        $gameMap._shadowOptions = Array.prototype.slice.call(arguments);
        refreshEffects();
        return true;
    }
    // 0261.rb:296
    function reflect_options(a) {
        $gameMap._reflectOptions = Array.prototype.slice.call(arguments);
        refreshEffects();
        return true;
    }
    // 0261.rb:358
    function shadow_source(a, b, shadId) {
        var args = Array.prototype.slice.call(arguments);
        var id = args.pop();
        if (args.length === 1) {
            var e = $gameMap.event(args[0]);
            if (e) { $gameMap.lightSource[id] = [e._realX, e._realY]; }
        } else if (args.length > 1) {
            $gameMap.lightSource[id] = args;
        } else {
            $gameMap._lightSource = [];
        }
        refreshEffects();
        return true;
    }
    // 0261.rb:377
    function icon(a, b, iconId) {
        var args = Array.prototype.slice.call(arguments);
        var id = args.pop();
        if (isAll(args)) {
            var events = $gameMap.events();
            for (var i = 0; i < events.length; i++) {
                var e = events[i];
                if (!e) { continue; }
                if (e.icon <= 0) { e.icon = 0; } else { e.icon = id; }
            }
        } else {
            eachCharId(args, function (cid) {
                var ev = $gameMap.event(cid);
                if (ev) { ev.icon = id; }
            });
        }
        refreshEffects();
        return true;
    }
    // 0261.rb:394
    function actor_icon(actorId, iconId) {
        var a = $gameActors.actor(actorId);
        if (a) { a.icon = iconId; }
        $gamePlayer.refresh();
        return true;
    }
    // 0261.rb:260
    function remove_icon() {
        var ie = window.MonlineRuby && window.MonlineRuby.current;
        var id = ie ? ie.eventId() : 0;
        var e = $gameMap.event(id);
        if (e) { e.icon = 0; }
        refreshEffects();
        return true;
    }
    // 0261.rb:420 - 0 reflect, 1 shadow, 2 mirror, 3 icon
    function char_effects(a, status) {
        var args = Array.prototype.slice.call(arguments);
        var st = args.pop();
        for (var i = 0; i < args.length; i++) {
            $gameMap.charEffects[args[i]] = !!st;
        }
        refreshEffects();
        return true;
    }

    var API = {
        reflect: reflect, actor_reflect: actor_reflect,
        reflect_sprite: reflect_sprite, reflect_esprite: reflect_esprite,
        shadow: shadow, actor_shadows: actor_shadows,
        shadow_options: shadow_options, shadow_source: shadow_source,
        reflect_options: reflect_options,
        icon: icon, actor_icon: actor_icon, remove_icon: remove_icon,
        char_effects: char_effects
    };
    Object.keys(API).forEach(function (k) { window[k] = API[k]; });
    MonlineCharEffects.api = API;
    MonlineCharEffects.CFG = CFG;

    if (window.MonlineShim && window.MonlineShim.functions) {
        Object.keys(API).forEach(function (k) {
            var i = window.MonlineShim.functions.indexOf(k);
            if (i >= 0) { window.MonlineShim.functions.splice(i, 1); }
        });
    }
    if (window.MonlineRuby && window.MonlineRuby.F) {
        var F = window.MonlineRuby.F;
        Object.keys(API).forEach(function (k) { F[k] = API[k]; });
        var C = window.MonlineRuby.COSMETIC;
        if (C) {
            ['char_effects', 'reflect_sprite'].forEach(function (n) {
                var j = C.indexOf(n);
                if (j >= 0) { C.splice(j, 1); }
            });
        }
    }

    console.log('[MonlineCharEffects] loaded');
})();
