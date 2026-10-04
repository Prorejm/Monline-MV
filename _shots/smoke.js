// Headless smoke test for the Monline MV port.
//   node smoke.js
// Requires NODE_PATH pointing at the playwright-core workspace.
//
// Order matters: the multi-map sweep happens while the title screen is up, so
// it cannot disturb a running Scene_Map.  The real multi-map coverage then uses
// $gamePlayer.reserveTransfer(), i.e. exactly the code path a player takes.
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required',
           '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });

  const hard = [];        // page errors / uncaught exceptions
  const soft = [];        // real engine behaviour that is not a defect
  const errScreens = [];  // RPG Maker error screen contents
  const loadErr = [];     // network failures
  const guard = [];       // MonlineAssetGuard reports

  p.on('pageerror', e => hard.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(t)) hard.push('CONSOLE: ' + t);
    if (/MonlineAssetGuard/.test(t)) guard.push(t);
  });
  p.on('requestfailed', r => {
    const u = r.url();
    if (!/\.(png|ogg|m4a|json)$/i.test(u)) return;
    const reason = (r.failure() && r.failure().errorText) || 'unknown';
    // ERR_ABORTED is not a missing asset: the engine routinely replaces an
    // <img> src (Bitmap._onError -> src = '') or a scene swap cancels an
    // in-flight request.  Only genuine HTTP/network failures are interesting.
    if (/ERR_ABORTED/.test(reason)) return;
    loadErr.push(reason + ' ' + u.replace(/^.*\/Monline-MV\//, ''));
  });

  const probe = async (label) => {
    const s = await p.evaluate(() => ({
      scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
      stopped: !!SceneManager._stopped,
      showed: !!Graphics._errorShowed,
      err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '').replace(/<[^>]+>/g, '').slice(0, 160),
      audioErr: (typeof AudioManager !== 'undefined')
        ? ['_bgmBuffer', '_bgsBuffer', '_meBuffer'].some(k => AudioManager[k] && AudioManager[k].isError())
        : null,
      imgReady: (typeof ImageManager !== 'undefined') ? ImageManager.isReady() : null,
      missing: (ResourceHandler.missingAssets) ? ResourceHandler.missingAssets().length : -1,
      missingSample: (ResourceHandler.missingAssets) ? ResourceHandler.missingAssets().slice(0, 8) : []
    })).catch(e => ({ evalErr: e.message }));
    const flag = (s.stopped || s.showed || s.err) ? '  <<< PROBLEM' : '';
    console.log(`PROBE ${label.padEnd(28)} ${JSON.stringify(s)}${flag}`);
    if (s.stopped || s.showed || s.err) errScreens.push(label + ': ' + (s.err || 'scene stopped'));
    return s;
  };

  // ------------------------------------------------------------------ boot
  console.log('--- boot ---');
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  const boot = await probe('boot/title');
  if (boot.scene !== 'Scene_Title') hard.push('boot did not reach Scene_Title: ' + boot.scene);

  // ------------------------------------------------------------- new game
  console.log('--- new game -> map ---');
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); })
    .catch(e => hard.push('NEWGAME ' + e.message));
  await sleep(6000);
  const mapInfo = await p.evaluate(() => ({
    mapId: $gameMap.mapId(), w: $gameMap.width(), h: $gameMap.height(),
    tilemap: SceneManager._scene._spriteset && SceneManager._scene._spriteset._tilemap
      ? SceneManager._scene._spriteset._tilemap.constructor.name : null,
    chars: $gameMap.events().length, tilesetId: $gameMap.tilesetId()
  })).catch(e => ({ evalErr: e.message }));
  console.log('MAPINFO ' + JSON.stringify(mapInfo));
  await probe('map-loaded');

  // --------------------------------------------------- real map transfers
  // The converted game opens with a story cutscene ("Hey, what's going on?").
  // MV correctly refuses to transfer while a message window is busy, so we
  // press OK until the cutscene has moved on.
  console.log('--- dismiss opening cutscene ---');
  for (let i = 0; i < 70; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; }).catch(() => {});
    await sleep(120);
    if (i % 10 === 9) {
      const st = await p.evaluate(() => ({ busy: $gameMessage.isBusy(), ev: $gameMap.isEventRunning() }))
        .catch(() => ({}));
      console.log('  ok-press %d  messageBusy=%s eventRunning=%s', i + 1, st.busy, st.ev);
      if (!st.busy && !st.ev) break;
    }
  }
  await probe('after-cutscene');

  // $gamePlayer.reserveTransfer() + the *real* game loop: this is exactly the
  // code path a player takes, including the fade and the tilemap rebuild.
  console.log('--- real transfers ---');
  const MAPS = [1, 3, 7, 12, 14, 22, 37, 55, 78, 101, 140, 190, 238, 285, 330, 375,
                420, 465, 499, 507];
  for (const id of MAPS) {
    await p.evaluate(mid => { $gamePlayer.reserveTransfer(mid, 5, 5, 2, 0); }, id)
      .catch(e => hard.push('reserve ' + id + ': ' + e.message));

    // Poll instead of sleeping a fixed amount.  A reserved transfer is only
    // consumed once the map stops running an event, and several maps open with
    // a long AUTORUN cutscene (map 14's "Game Set" is 285 commands), so a
    // fixed 2.6s wait races against the story and reports a false failure.
    // On arrival we still dwell ~2s so the destination's own events get to run
    // - otherwise the sweep stops exercising them at all.
    let r = null;
    let arrived = 0;
    for (let attempt = 0; attempt < 15; attempt++) {
      await sleep(700);
      r = await p.evaluate(() => ({
        now: $gameMap.mapId(),
        ev: $gameMap.events().length,
        running: $gameMap.isEventRunning(),
        transferring: $gamePlayer.isTransferring(),
        scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
        stubScene: (function () {
          var n = SceneManager._scene ? SceneManager._scene.constructor.name : null;
          return !!(window.MonlineShim && MonlineShim.scenes.indexOf(n) >= 0);
        })(),
        stopped: !!SceneManager._stopped,
        err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '').replace(/<[^>]+>/g, '').slice(0, 120)
      })).catch(e => ({ err: 'eval: ' + e.message }));
      if (r.err || r.stopped) { break; }
      if (r.stubScene) {
        // The story opened a custom scene that has not been ported.  It is an
        // empty but exitable stand-in, so back out the same way a player would
        // and record it as a missing feature rather than a failure.
        if (soft.indexOf('entered unported ' + r.scene) < 0) {
          soft.push('entered unported ' + r.scene + ' (backed out)');
        }
        await p.evaluate(() => { SceneManager.goto(Scene_Map); }).catch(() => {});
        continue;
      }
      if (r.now === id) {
        if (++arrived >= 3) { break; }
        continue;
      }
      if (!r.running && !r.transferring) { break; }
    }
    if (r.err || r.stopped) {
      console.log('  TRANSFER ' + id + ' -> PROBLEM ' + JSON.stringify(r));
      hard.push('transfer ' + id + ': ' + (r.err || 'stopped'));
    } else if (r.now !== id && r.running) {
      // The destination opened an autorun cutscene which is still holding the
      // request.  That is the original game's scripting, not a port defect.
      console.log('  TRANSFER ' + id + ' -> DEFERRED (cutscene running on ' + r.now + ')');
      soft.push('transfer ' + id + ' deferred by a running event on map ' + r.now);
    } else if (r.now !== id) {
      console.log('  TRANSFER ' + id + ' -> STILL ON ' + r.now);
      hard.push('transfer ' + id + ' did not take effect (still on ' + r.now + ')');
    } else {
      console.log('  TRANSFER ' + id + ' ok  events=' + r.ev);
    }
  }
  // MV fades in after a transfer; a screenshot taken immediately is black
  // (the tilemap and map-name window sit under/over the fade differently),
  // which read as "the map does not render" until a settle wait was added.
  await sleep(1500);
  await p.screenshot({ path: OUT + 'smoke_map.png' });
  await probe('after-transfers');

  // --------------------------------------------------------------- walking
  await p.evaluate(() => {
    for (let i = 0; i < 8; i++) $gamePlayer.moveStraight((i % 4) + 2);
  }).catch(e => hard.push('WALK ' + e.message));
  await sleep(3000);
  await probe('after-walk');

  // ----------------------------------------------------------------- menus
  // Menu scenes are *pushed* on top of Scene_Map in real play, so mirror that:
  // return to Scene_Map, then push.  Reachability is a soft signal (recorded
  // separately); what matters for the verdict is that nothing froze or errored.
  console.log('--- menus ---');
  for (const sc of ['Scene_Menu', 'Scene_Item', 'Scene_Skill', 'Scene_Equip',
                    'Scene_Status', 'Scene_Save', 'Scene_Load']) {
    await p.evaluate(() => { SceneManager.goto(Scene_Map); }).catch(() => {});
    await sleep(900);
    await p.evaluate(n => { SceneManager.push(window[n]); }, sc)
      .catch(e => hard.push(sc + ' ' + e.message));
    await sleep(2200);
    const s = await probe(sc);
    if (s.scene !== sc) soft.push(sc + '->' + s.scene);
  }
  console.log('SOFT_NOTES      ' + (soft.length ? soft.join(' | ') : 'none'));

  // ------------------------------------------- move-route Ruby (headline fix)
  // MV 1.6.3 runs move-route "Script" (code 45) commands through a bare
  // eval() inside Game_Character.processMoveCommand with NO try/catch, so any
  // Ruby here used to unwind to SceneManager.catchException -> stop().
  // This exercises: a real Ruby call that must work (self_switch), a call that
  // cannot exist (must be swallowed), and two motion helpers.
  console.log('--- move-route ruby bridge ---');
  const mvSetup = await p.evaluate(() => {
    try {
      const ev = $gameMap.events().filter(e => e && e.eventId() > 0)[0];
      if (!ev) { return { skip: 'no event' }; }
      window.__mvTest = { mapId: $gameMap.mapId(), evId: ev.eventId(), x0: ev.x, y0: ev.y };
      ev.forceMoveRoute({
        repeat: false, skippable: false, wait: false,
        list: [
          { code: 45, parameters: ['self_switch("D", true)'] },
          { code: 45, parameters: ['totally_undefined_ruby_call(1, 2)'] },
          { code: 45, parameters: ['set_char("Actor1", 0, 2, 4)'] },
          { code: 45, parameters: ['@shop_stock[1] = 2'] },
          { code: 0, parameters: [] }
        ]
      });
      return window.__mvTest;
    } catch (e) { return { err: e.message }; }
  }).catch(e => ({ err: e.message }));
  await sleep(3000);
  const mvCheck = await p.evaluate(() => {
    const t = window.__mvTest || {};
    const ev = t.evId ? $gameMap.event(t.evId) : null;
    return {
      selfSwitchD: t.mapId ? $gameSelfSwitches.value([t.mapId, t.evId, 'D']) === true : null,
      moved: ev ? (ev.x !== t.x0 || ev.y !== t.y0) : null,
      stopped: !!SceneManager._stopped,
      showed: !!Graphics._errorShowed,
      moveRuns: window.MonlineRuby ? MonlineRuby.stats.move : -1,
      moveFails: window.MonlineRuby ? MonlineRuby.stats.failedMove : -1
    };
  }).catch(e => ({ err: e.message }));
  console.log('MOVEROUTE       ' + JSON.stringify({ setup: mvSetup, check: mvCheck }));
  if (!mvCheck.selfSwitchD) hard.push('move-route self_switch("D", true) did not take effect');
  if (mvCheck.stopped || mvCheck.showed) hard.push('move-route Ruby still stops the game');
  if (mvCheck.moveFails > 0) hard.push('move-route Ruby had ' + mvCheck.moveFails + ' failure(s)');

  // ------------------------------------------------- regression assertions
  // Four bugs that were invisible in a "does it boot" test.  Each one is
  // pinned down by an outcome no other code path can produce.
  console.log('--- regressions ---');
  const reg = await p.evaluate(async () => {
    const out = {};
    try {
      // (1) command355 must NOT advance _index - executeCommand() already
      //     does.  An extra increment swallows the command that follows the
      //     script, so the constant-7 variable assignment below never runs.
      //     A trace makes the exact command sequence visible either way.
      //
      //     NOTE: Game_Variables#setValue silently ignores ids >=
      //     $dataSystem.variables.length, so the scratch ids must be inside
      //     the project's variable table.
      const VN = $dataSystem.variables.length;
      const VA = VN - 3, VB = VN - 2, VC = VN - 1;
      $gameVariables.setValue(VA, 0);
      $gameVariables.setValue(VB, 0);
      $gameVariables.setValue(VC, 0);
      const list = [
        { code: 355, indent: 0, parameters: ['$game_variables[' + VA + '] = 1'] },
        { code: 655, indent: 0, parameters: ['$game_variables[' + VA + '] = 2'] },
        { code: 122, indent: 0, parameters: [VB, VB, 0, 0, 7] },
        { code: 355, indent: 0, parameters: ['$game_variables[' + VC + '] = 1'] },
        { code: 0, indent: 0, parameters: [] }
      ];
      const trace = [];
      const _exec = Game_Interpreter.prototype.executeCommand;
      Game_Interpreter.prototype.executeCommand = function () {
        const c = this.currentCommand();
        trace.push(this._index + ':' + (c ? c.code : -1));
        return _exec.apply(this, arguments);
      };
      let indexOut;
      try {
        const it = new Game_Interpreter(0);
        it.setup(list);
        let guard = 0;
        while (it.isRunning() && guard++ < 500) { it.update(); }
        indexOut = {
          ids: [VA, VB, VC],
          v500: $gameVariables.value(VA),   // 2  (655 continuation ran)
          v501: $gameVariables.value(VB),   // 7  (following command NOT skipped)
          v502: $gameVariables.value(VC),   // 1  (second script ran)
          trail: trace.join(' '),
          guard: guard
        };
      } finally {
        Game_Interpreter.prototype.executeCommand = _exec;
      }
      out.index = indexOut;

      // (2) `__self` inside the sandbox must be the *real* object, not a
      //     stub.  `@shop_stock` is an indexed write, so a stub self used to
      //     throw "Cannot set properties of undefined".
      const ce = new Game_Interpreter(0);
      ce.setup([{ code: 355, indent: 0, parameters: ['@shop_stock[3] = 7'] },
                { code: 0, indent: 0, parameters: [] }]);
      let g2 = 0;
      while (ce.isRunning() && g2++ < 100) { ce.update(); }
      out.selfVar = {
        stock3: ce._shopStock ? ce._shopStock[3] : null,
        eventId: (function () { return ce.event_id; })(),
        mapId: ce.map_id
      };

      // (3) SceneManager.scene must exist and be null-safe, otherwise
      //     `SceneManager.scene.log_window.add_text(...)` throws.
      out.scene = {
        hasAccessor: 'scene' in SceneManager,
        savedScene: !!SceneManager._scene,
        type: typeof SceneManager.scene
      };

      // (4) the log-window stand-in must accept the VX Ace call shapes.
      const logOk = (function () {
        try {
          SceneManager.scene.log_window.add_text('probe');
          SceneManager.scene.log_window.wait_and_clear;
          return true;
        } catch (e) { return e.message; }
      })();
      out.logWindow = logOk;

      // (5) comment-declared page conditions ("CP Page Conditions").
      //     The source project uses this VX Ace script, and map 238's opening
      //     event is gated entirely by it: 11 pages, no native conditions, all
      //     declared as `variable 99 = N`.  Without the port every page looks
      //     unconditional and the last one ("God Mode") is chosen.
      $gameVariables.setValue(99, 3);
      $gameSwitches.setValue(5, false);
      const synth = {
        list: [
          { code: 108, indent: 0, parameters: ['extra conditions'] },
          { code: 408, indent: 0, parameters: ['variable 99 = 3'] },
          { code: 408, indent: 0, parameters: ['switch 5 on'] },
          { code: 0, indent: 0, parameters: [] }
        ]
      };
      out.extraSynth = {
        switchOff: MonlineRuby.extraConditionsMet(synth, null),   // false
        switchOn: (function () {
          $gameSwitches.setValue(5, true);
          return MonlineRuby.extraConditionsMet(synth, null);      // true
        })(),
        wrongValue: (function () {
          $gameVariables.setValue(99, 2);
          return MonlineRuby.extraConditionsMet(synth, null);      // false
        })()
      };

      // (6) the same mechanism against the real map data
      try {
        const raw = await (await fetch('data/Map238.json')).json();
        const pages = raw.events[1].pages;
        $gameVariables.setValue(99, 0);
        const states0 = pages.map(pg => MonlineRuby.extraConditionsMet(pg, null));
        $gameVariables.setValue(99, 3);
        const states3 = pages.map(pg => MonlineRuby.extraConditionsMet(pg, null));
        out.pages238 = {
          pageCount: pages.length,
          matched_v99_0: states0.map((s, i) => s ? i : -1).filter(i => i >= 0),
          matched_v99_3: states3.map((s, i) => s ? i : -1).filter(i => i >= 0)
        };
      } catch (e) { out.pages238 = { err: e.message }; }
      // (7) the game rewrites database rows in event scripts and persists them
      //     through Hime's Custom Database (script 0176).  280 call sites, and
      //     a missing module made every one of them throw
      //     "CustomData.update_armor is not a function".
      try {
        const armor = $dataArmors[159];
        const before = armor.name;
        const ok = CustomData.update_armor(armor);
        out.customData = {
          exists: typeof CustomData === 'object' && CustomData !== null,
          kinds: ['actor', 'class', 'skill', 'item', 'weapon', 'armor',
                  'enemy', 'state', 'troop']
                 .filter(k => typeof CustomData['update_' + k] === 'function').length,
          ret: ok,
          registered: !!(window.$custom_armors && window.$custom_armors[159] === armor),
          liveRowTouched: $dataArmors[159] === armor,
          nameBefore: before
        };
      } catch (e) { out.customData = { err: e.message }; }

      // (8) the real payload that used to crash: it also exercises the
      //     attribute renames (icon_index -> iconIndex) and the CustomData
      //     write in one go.
      try {
        const it2 = new Game_Interpreter(0);
        it2.setup([
          { code: 355, indent: 0, parameters: ['w = $data_weapons[93]'] },
          { code: 655, indent: 0, parameters: ['w.name = "Regression Blade"'] },
          { code: 655, indent: 0, parameters: ['w.icon_index = 9025'] },
          { code: 655, indent: 0, parameters: ['CustomData.update_weapon(w)'] },
          { code: 0, indent: 0, parameters: [] }
        ]);
        const errBefore = MonlineRuby.report().errorCount;
        let g3 = 0;
        while (it2.isRunning() && g3++ < 200) { it2.update(); }
        out.dbRewrite = {
          name: $dataWeapons[93].name,
          iconIndex: $dataWeapons[93].iconIndex,
          deadIconProp: 'icon_index' in $dataWeapons[93],
          errors: MonlineRuby.report().errorCount - errBefore
        };
      } catch (e) { out.dbRewrite = { err: e.message }; }

      // (9) move_speed is an attr_accessor in VX Ace: the data *writes*
      //     fractions to it (`$game_map.events[20].move_speed = 4.15`).  A
      //     translation that turned the assignment target into `moveSpeed()`
      //     would throw "Invalid left-hand side in assignment"; a truncating
      //     setter would silently turn 4.15 into 4.
      try {
        $gamePlayer.move_speed = 4.15;
        const got = $gamePlayer.move_speed;
        // alwaysDash makes isDashButtonPressed() deterministic (true unless
        // shift is held), so the no_dash gate can be asserted both ways.
        const savedAlwaysDash = ConfigManager.alwaysDash;
        ConfigManager.alwaysDash = true;
        $gamePlayer.no_dash = false;
        const unlocked = $gamePlayer.isDashButtonPressed();
        $gamePlayer.no_dash = true;
        const locked = $gamePlayer.isDashButtonPressed();
        ConfigManager.alwaysDash = savedAlwaysDash;
        $gamePlayer.no_dash = false;
        out.moveSpeed = { fractional: got, noDash: { unlocked: unlocked, locked: locked } };
      } catch (e) { out.moveSpeed = { err: e.message }; }

      // (10) a malformed Show Text command (the MTool double-wrap) put NaN in
      //      the window's y.  Assert the data is clean, so a message window
      //      can actually be placed.
      try {
        const raw = await (await fetch('data/CommonEvents.json')).json();
        let nested = 0, emptyFace = 0;
        const rec = o => {
          if (Array.isArray(o)) { o.forEach(rec); return; }
          if (!o || typeof o !== 'object') return;
          if (o.code === 101) {
            if (!Array.isArray(o.parameters)) { nested++; }
            else { emptyFace++; }
          }
          Object.keys(o).forEach(k => rec(o[k]));
        };
        rec(raw);
        out.showText = { total: nested + emptyFace, malformed: nested };
      } catch (e) { out.showText = { err: e.message }; }

      // (11) Galv's Cam Control.  This one has to survive contact with the real
      //      engine rather than with a stub: MV's own doScroll implements only
      //      the four cardinal directions, so a camera move across open ground
      //      would stall on the very first diagonal step unless the port added
      //      them back - and a stalled move inside a wait mode is a frozen map.
      try {
        const map = $gameMap;
        const cx = $gamePlayer.centerX(), cy = $gamePlayer.centerY();
        const saveDisp = [map._displayX, map._displayY];
        const saveTarget = map._monlineCamTarget;

        // The diagonal check uses the engine's own cardinals as the oracle:
        // direction 1 must be exactly "down then left", which is what Galv's
        // do_scroll says and what MV's doScroll cannot do on its own (it has no
        // case for 1/3/7/9, so the display would not move at all).
        const maxX = Math.max(0, map.width() - map.screenTileX());
        const maxY = Math.max(0, map.height() - map.screenTileY());
        const x0 = Math.round(maxX / 2), y0 = Math.round(maxY / 2);
        const run = (dir) => {
          map.setDisplayPos(x0, y0);
          map.doScroll(dir, 2);
          return [map.displayX(), map.displayY()];
        };
        const diagXY = run(1);
        const downXY = run(2);
        const leftXY = run(4);
        const movedX = leftXY[0] !== x0;
        const movedY = downXY[1] !== y0;
        const diagEq = diagXY[0] === leftXY[0] && diagXY[1] === downXY[1];
        const bothAxes = movedX && movedY;
        const diagMoved = diagXY[0] !== x0 || diagXY[1] !== y0;

        // speed 0 must be an exact instant cut, clamped the way the engine
        // clamps setDisplayPos
        const endX = map.width() - map.screenTileX();
        const endY = map.height() - map.screenTileY();
        const clampX = (v) => endX < 0 ? endX / 2 : Math.max(0, Math.min(v, endX));
        const clampY = (v) => endY < 0 ? endY / 2 : Math.max(0, Math.min(v, endY));
        window.cam_set(10, 8, 0);
        const setOk = map.displayX() === clampX(10 - cx)
                   && map.displayY() === clampY(8 - cy);
        const locked = MonlineCamera.camTarget();

        // ...and cam_center(0) must hand the camera back to the player.  The
        // expectation is the *clamped* position: MV's setDisplayPos clamps at
        // the map edge, exactly like Galv's set_display_pos did.
        window.cam_center(0);
        const centered = map.displayX() === clampX($gamePlayer.x - cx)
                      && map.displayY() === clampY($gamePlayer.y - cy);
        const unlocked = MonlineCamera.camTarget();

        // a real gliding move, driven through the port's own wait mode on a
        // throwaway interpreter so the live event chain is never touched
        const fromX = map.displayX(), fromY = map.displayY();
        window.cam_set(fromX + 3 + cx, fromY + 2 + cy, 6);
        const armed = MonlineCamera.hasPlan();
        const glideTarget = [fromX, fromY];
        const it = new Game_Interpreter();
        it.setWaitMode(MonlineCamera.WAIT_MODE);
        let frames = 0;
        while (MonlineCamera.hasPlan() && frames < 3000) {
          it.updateWaitMode();
          map.updateScroll();
          frames++;
        }
        out.camera = {
          diagEq, diagMoved, bothAxes, movedX, movedY,
          diagXY, downXY, leftXY, at: x0 + ',' + y0,
          setOk, locked, centered, unlocked, armed, frames,
          settled: !MonlineCamera.hasPlan(),
          waitCleared: it._waitMode === '',
          // `fromX + 3` may be past the right edge, in which case the glide
          // legitimately stops early — the invariant is that it moved and settled.
          glideMoved: map.displayX() !== glideTarget[0] || map.displayY() !== glideTarget[1]
        };

        map._monlineCamTarget = saveTarget;
        map._displayX = saveDisp[0];
        map._displayY = saveDisp[1];
      } catch (e) { out.camera = { err: e.message }; }

      // (12) System assets: the presentation layer has its own metrics, and
      //      getting them wrong makes every icon wrong *without throwing*.
      //      MV hard-codes 32px icon cells and reads the 32 text colours out of
      //      the window skin; the port's sheet is a 24px VX Ace grid.
      try {
        const win = new Window_Base(0, 0, 400, 200);
        const skin = ImageManager.loadSystem('Window');
        const f13 = MonlineIconSet.frameFor(13);
        const f00 = MonlineIconSet.frameFor(0);
        const fSeam = MonlineIconSet.frameFor(4096);
        const fMax = MonlineIconSet.frameFor(13321);

        win.contents.clear();
        win.drawIcon(13321, 0, 0);
        let lit = 0;
        for (let y = 0; y < 24; y++) {
          for (let x = 0; x < 24; x++) { if (win.contents.getAlphaPixel(x, y) > 0) lit++; }
        }
        const sheets = {};
        for (let c = 0; c < 4; c++) {
          const nm = c === 0 ? 'IconSet' : 'IconSet_' + c;
          const b = ImageManager.loadSystem(nm);
          sheets[nm] = b.isReady() && b.width > 0 ? b.height : 0;
        }
        out.systemAssets = {
          iconW: Window_Base._iconWidth,
          stateIconW: Sprite_StateIcon._iconWidth,
          skin: [skin.width, skin.height],
          // with the old 128x128 skin every one of these was '#000000'
          colorNormal: skin.getPixel(102, 150),
          colorSystem: skin.getPixel(114, 150),
          icon13: [f13.chunk, f13.sx],        // used to be 416: off a 384px sheet
          icon0: [f00.chunk, f00.sx, f00.sy],
          seam: fSeam.chunk,                  // 4096 is the first icon of chunk 1
          max: [fMax.chunk, fMax.sy],
          chunkHeights: sheets,
          drawnPx: lit,
          font: win.contents.fontFace
        };
      } catch (e) { out.systemAssets = { err: e.message }; }

      // (13) Fog (Shaz 0246.rb): a Plane has no MV equivalent, so the port uses
      //      TilingSprite.  Verify the real engine path: the plane fills the
      //      screen, scrolls with the map, fades, and takes a tone.
      try {
        MonlineFog.clearAll();
        // The fog sheet goes through ImageManager, i.e. it loads asynchronously.
        // FogLayer#refresh bails out (leaving the sprite at its defaults) until
        // the bitmap is ready, so wait for it here - otherwise the assertions
        // below race the loader and read a freshly created TilingSprite.
        const fogBmp = ImageManager.loadBitmap('img/fogs/', 'Fog1', 0, true);
        for (let i = 0; i < 200 && !(fogBmp.isReady() && fogBmp.width > 0); i++) {
          await new Promise(r => setTimeout(r, 50));
        }
        window.show_fog(3, 'Fog1', 0, 100, 1, 100, 6, 2);
        const f3 = MonlineFog.fog(3);
        // Prefer the live map spriteset.  This probe runs after a walk through
        // the menus, so the current scene is not always Scene_Map - fall back to
        // a throwaway host so the assertions still exercise the real FogLayer.
        const scene = SceneManager._scene;
        let layer = null;
        let fromScene = false;
        if (scene && scene._spriteset && scene._spriteset._monlineFog) {
          layer = scene._spriteset._monlineFog;
          fromScene = true;
        } else {
          layer = new MonlineFog.FogLayer({
            children: [],
            addChild(c) { this.children.push(c); c.parent = this; return c; }
          });
        }
        layer.update();
        const sprite = layer && layer._sprites && layer._sprites['3'];
        out.fog = {
          hasLayer: !!layer,
          fromScene: fromScene,
          hasSprite: !!sprite,
          name: f3.name,
          z: f3.z,
          fills: sprite ? [sprite.x, sprite.y, sprite.width, sprite.height] : null,
          tileScale: sprite ? sprite.tileScale.x : null,
          blendMode: sprite ? sprite.blendMode : null,
          opacity: sprite ? sprite.opacity : null
        };
        // anchored to the map: scroll the display and the origin must follow
        if (sprite) {
          const before = f3.ox;
          $gameMap.setDisplayPos(0, 0);
          f3.updateMove();
          out.fog.scrollFollowsMap = Math.abs(f3.ox - before) > 0 ||
            (f3.ox === f3.sx2 * 1.5);
        }
        // fade + tone over the real update loop
        window.fade_fog(3, 20, 10);
        window.tint_fog(3, 40, -40, -15, 0, 0);
        for (let i = 0; i < 10; i++) { MonlineFog.update(); }
        out.fog.fadedTo = f3.opacity;
        out.fog.tone = f3.tone.slice();
        if (layer) { layer.update(); }
        out.fog.hasToneFilter = !!(sprite && sprite.filters && sprite.filters.length);
        MonlineFog.clearAll();
        out.fog.cleared = MonlineFog.fog(3).name === '';
      } catch (e) { out.fog = { err: e.message }; }

      // (14) Choice options (Tsuki 0117.rb): hide_choice / disable_choice /
      //      text_choice.  The branch an event runs depends on the *original*
      //      choice index, so the mapping is the thing worth asserting.
      try {
        // Snapshot and restore: MV builds a Window_ChoiceList inside
        // Window_Message#createSubWindows, and with choices still set it goes
        // windowWidth -> maxChoiceWidth -> textWidthEx -> contents, which is
        // undefined that early. Leaving choices behind crashes every later
        // message window.
        const savedChoices = $gameMessage.choices();
        const savedCancel = $gameMessage.choiceCancelType();
        MonlineChoice.reset();
        // Build the window FIRST, with no choices: Window_Command#initialize
        // measures the widest choice before Window_Base has created `contents`,
        // so constructing one while choices are set throws. Stock MV only ever
        // builds it from Window_Message#createSubWindows, i.e. always empty.
        $gameMessage.setChoices([], 0, -1);
        const w = new Window_ChoiceList({ terminateMessage: function() {} });
        $gameMessage.setChoices(['Alpha', 'Beta', 'Gamma'], 0, -1);
        window.hide_choice(2, 'true');
        window.disable_choice(3, 'true');
        window.text_choice(1, 'Renamed', 'true');

        w.makeCommandList();
        let reported = null;
        $gameMessage.setChoiceCallback(function(n) { reported = n; });
        if (w._monlineChoiceMap && w._monlineChoiceMap.length) {
          w._index = 1;               // second visible choice -> original 2
          w.callOkHandler();
        }
        out.choice = {
          hidden: MonlineChoice.hidden(2),
          disabled: MonlineChoice.disabled(3),
          text: MonlineChoice.text(1, 'Alpha'),
          map: w._monlineChoiceMap ? w._monlineChoiceMap.slice() : null,
          disabledFlag: w.isEnabled ? w.isEnabled(1) : null,
          reported: reported
        };
        $gameMessage.setChoiceCallback(null);
        MonlineChoice.reset();
        $gameMessage.setChoices(savedChoices, 0, savedCancel);
      } catch (e) { out.choice = { err: e.message }; }
    } catch (e) { out.err = e.message + '\n' + e.stack; }
    return out;
  }).catch(e => ({ err: e.message }));

  console.log('REGRESSIONS     ' + JSON.stringify(reg));
  if (reg.err) { hard.push('regression probe threw: ' + reg.err); }
  else {
    if (!reg.index || reg.index.v501 !== 7) {
      hard.push('command355 swallows the following command (v501=' +
        (reg.index && reg.index.v501) + ', want 7)');
    }
    if (!reg.index || reg.index.v500 !== 2) {
      hard.push('655 script continuation did not run (v500=' +
        (reg.index && reg.index.v500) + ', want 2)');
    }
    if (!reg.index || reg.index.v502 !== 1) {
      hard.push('second 355 block did not run (v502=' +
        (reg.index && reg.index.v502) + ', want 1)');
    }
    if (!reg.selfVar || reg.selfVar.stock3 !== 7) {
      hard.push('@shop_stock write did not reach the interpreter (' +
        JSON.stringify(reg.selfVar) + ', want stock3=7)');
    }
    if (!reg.scene || !reg.scene.hasAccessor) {
      hard.push('SceneManager.scene is missing');
    }
    if (reg.logWindow !== true) {
      hard.push('log_window stand-in failed: ' + JSON.stringify(reg.logWindow));
    }
    if (!reg.extraSynth || reg.extraSynth.switchOff !== false ||
        reg.extraSynth.switchOn !== true || reg.extraSynth.wrongValue !== false) {
      hard.push('comment page conditions mis-parse: ' + JSON.stringify(reg.extraSynth));
    }
    const p238 = reg.pages238 || {};
    if (p238.err) {
      hard.push('map 238 page probe failed: ' + p238.err);
    } else {
      if (String(p238.matched_v99_0) !== '0' || String(p238.matched_v99_3) !== '3') {
        hard.push('map 238 extra page conditions wrong: ' + JSON.stringify(p238));
      }
    }
    const cd = reg.customData || {};
    if (cd.err) {
      hard.push('CustomData probe failed: ' + cd.err);
    } else if (!cd.exists || cd.kinds !== 9 || cd.ret !== true ||
               !cd.registered || !cd.liveRowTouched) {
      hard.push('Custom Database module incomplete: ' + JSON.stringify(cd));
    }
    const dr = reg.dbRewrite || {};
    if (dr.err) {
      hard.push('database-rewrite payload failed: ' + dr.err);
    } else if (dr.name !== 'Regression Blade' || dr.iconIndex !== 9025 ||
               dr.deadIconProp || dr.errors !== 0) {
      hard.push('database rewrite wrong: ' + JSON.stringify(dr));
    }
    const ms = reg.moveSpeed || {};
    if (ms.err) {
      hard.push('move_speed probe failed: ' + ms.err);
    } else if (ms.fractional !== 4.15) {
      hard.push('fractional move_speed was truncated: ' + JSON.stringify(ms));
    } else if (!ms.noDash || ms.noDash.locked !== false ||
               ms.noDash.unlocked !== true) {
      hard.push('no_dash does not gate dashing: ' + JSON.stringify(ms.noDash));
    }
    const st = reg.showText || {};
    if (st.err) {
      hard.push('Show Text probe failed: ' + st.err);
    } else if (st.malformed !== 0) {
      hard.push('malformed Show Text commands remain: ' + JSON.stringify(st));
    } else if (!st.total) {
      hard.push('Show Text probe found no commands at all');
    }

    const cm = reg.camera || {};
    if (cm.err) {
      hard.push('camera probe failed: ' + cm.err);
    } else {
      // MV's own doScroll has no diagonal case, so direction 1 must equal
      // "down then left" or the camera would stall on its first diagonal step.
      if (cm.diagEq !== true) {
        hard.push('doScroll lost the diagonals (dir 1 != down+left): ' +
          JSON.stringify(cm));
      }
      if (cm.setOk !== true || cm.locked !== -1) {
        hard.push('cam_set did not cut exactly to the target, or did not lock: ' +
          JSON.stringify(cm));
      }
      if (cm.centered !== true || cm.unlocked !== 0) {
        hard.push('cam_center did not hand the camera back to the player: ' +
          JSON.stringify(cm));
      }
      if (cm.armed !== true || cm.settled !== true || cm.waitCleared !== true) {
        hard.push('a camera move never released the waiting event: ' +
          JSON.stringify(cm));
      }
      if (cm.glideMoved !== true) {
        hard.push('a gliding camera move did not move at all: ' +
          JSON.stringify(cm));
      }
      if (cm.bothAxes !== true) {
        soft.push('camera diagonal check was not discriminating on this map ' +
          '(room x=' + cm.movedX + ' y=' + cm.movedY + ')');
      } else if (cm.diagMoved !== true) {
        hard.push('the diagonal moved neither axis: ' + JSON.stringify(cm));
      }
    }

    const sa = reg.systemAssets || {};
    if (sa.err) {
      hard.push('system-asset probe failed: ' + sa.err);
    } else {
      if (sa.iconW !== 24 || sa.stateIconW !== 24) {
        hard.push('icon cell size is not the sheet\'s real 24px grid: ' +
          JSON.stringify(sa));
      }
      if (String(sa.skin) !== '192,192') {
        hard.push('window skin is not the MV 192x192 layout: ' + String(sa.skin));
      }
      // the whole 32-colour palette comes from these pixels; out of bounds
      // returns '#000000' and every \C[n] turns black
      if (sa.colorNormal === '#000000' || sa.colorSystem === '#000000') {
        hard.push('window skin text colours read out of bounds: ' +
          JSON.stringify({ n: sa.colorNormal, s: sa.colorSystem }));
      }
      if (String(sa.icon13) !== '0,312') {
        hard.push('icon column 13 is not at the 24px grid position (want 0,312): ' +
          String(sa.icon13));
      }
      if (sa.seam !== 1) {
        hard.push('icon 4096 is not the first of chunk 1: ' + sa.seam);
      }
      if (String(sa.max) !== '3,1536') {
        hard.push('icon 13321 does not route to chunk 3: ' + String(sa.max));
      }
      if (!(sa.drawnPx > 0)) {
        hard.push('drawIcon produced no pixels for a live icon');
      }
      const ch = sa.chunkHeights || {};
      if (!(ch.IconSet > 0 && ch.IconSet_1 > 0 && ch.IconSet_2 > 0 && ch.IconSet_3 > 0)) {
        hard.push('an IconSet chunk did not load: ' + JSON.stringify(ch));
      }
      if (!/Segoe UI/.test(sa.font || '')) {
        hard.push('the modern font stack is not applied: ' + sa.font);
      }
    }

    const fg = reg.fog || {};
    if (fg.err) {
      hard.push('fog probe failed: ' + fg.err);
    } else {
      if (!fg.hasLayer || !fg.hasSprite) {
        hard.push('show_fog produced no TilingSprite: ' + JSON.stringify(fg));
      }
      if (String(fg.fills) !== '0,0,816,624') {
        hard.push('the fog plane does not fill the screen: ' + String(fg.fills));
      }
      if (fg.tileScale !== 1.5) {
        hard.push('fog zoom was not world-scaled (want 1.5): ' + fg.tileScale);
      }
      if (fg.blendMode !== 1) {
        hard.push('fog blend_type 1 did not become PIXI add: ' + fg.blendMode);
      }
      if (fg.fadedTo !== 20) {
        hard.push('fade_fog did not land on its target: ' + fg.fadedTo);
      }
      if (String(fg.tone) !== '40,-40,-15,0') {
        hard.push('tint_fog did not apply: ' + String(fg.tone));
      }
      if (!fg.hasToneFilter) {
        hard.push('a tinted fog has no filter attached');
      }
      if (!fg.cleared) {
        hard.push('clearing the fogs did not erase them');
      }
    }

    const ch = reg.choice || {};
    if (ch.err) {
      hard.push('choice probe failed: ' + ch.err);
    } else {
      if (ch.hidden !== true) {
        hard.push('hide_choice did not record the hidden choice: ' + ch.hidden);
      }
      if (ch.disabled !== true) {
        hard.push('disable_choice did not record: ' + ch.disabled);
      }
      if (ch.text !== 'Renamed') {
        hard.push('text_choice did not swap the label: ' + ch.text);
      }
      // the visible list must drop the hidden one but keep original indices
      if (String(ch.map) !== '0,2') {
        hard.push('the choice map is wrong (want 0,2): ' + String(ch.map));
      }
      if (ch.disabledFlag !== false) {
        hard.push('a disabled choice is still selectable: ' + ch.disabledFlag);
      }
      if (ch.reported !== 2) {
        hard.push('picking a choice reported the wrong branch index: ' + ch.reported);
      }
    }
  }

  // ---------------------------------------------------------------- battle
  console.log('--- battle ---');
  const battle = await p.evaluate(() => {
    try { BattleManager.setup(1, true, false); SceneManager.goto(Scene_Battle); return { ok: true }; }
    catch (e) { return { err: e.message }; }
  }).catch(e => ({ err: e.message }));
  console.log('BATTLE ' + JSON.stringify(battle));
  await sleep(9000);                    // let the real loop run the battle
  await p.screenshot({ path: OUT + 'smoke_battle.png' });
  await probe('battle');
  // force some turns so actors/enemies actually act
  await p.evaluate(() => {
    if (BattleManager.isBattleStart()) {
      $gameParty.members().forEach(a => a.forceAction(1, 0));
      BattleManager.forceAction($gameParty.members()[0]);
    }
  }).catch(() => {});
  await sleep(6000);
  await probe('battle-turns');

  // ------------------------------------------------------------ title back
  await p.evaluate(() => { SceneManager.goto(Scene_Title); }).catch(() => {});
  await sleep(2500);
  await p.screenshot({ path: OUT + 'smoke_title.png' });
  const fin = await probe('final/title');

  // -------------------------------------------------- picture extension check
  // The ported art is mostly .jpg but MV asks for .png; MonlineImageExt must
  // pick the real extension or every CG renders blank.
  console.log('--- picture extension fallback ---');
  await p.evaluate(() => {
    ['Echidna1', 'PrincessMaid1', 'Beret174a'].forEach(n => ImageManager.loadPicture(n));
  }).catch(() => {});
  await sleep(4000);
  const pics = await p.evaluate(() => ['Echidna1', 'PrincessMaid1', 'Beret174a'].map(n => {
    const b = ImageManager.loadPicture(n);
    return { name: n, ready: b.isReady(), w: b.width, h: b.height };
  })).catch(e => [{ err: e.message }]);
  console.log('PICTURES        ' + JSON.stringify(pics));
  const picFail = pics.filter(x => !x.ready || !x.w);
  if (picFail.length) hard.push('picture(s) failed to decode: ' + JSON.stringify(picFail));

  console.log('--------------------------------------------------');
  // ------------------------------------------------------- ruby bridge
  const ruby = await p.evaluate(
    () => (window.MonlineRuby && MonlineRuby.report) ? MonlineRuby.report() : null
  ).catch(() => null);
  console.log('RUBY_STATS      ' + JSON.stringify(ruby ? ruby.stats : null));
  console.log('RUBY_ERRORS     ' + (ruby ? ruby.errorCount : -1)
    + ' in ' + (ruby ? ruby.groupCount : -1) + ' group(s)');
  if (ruby && ruby.groups && ruby.groups.length) {
    for (const g of ruby.groups.slice(0, 18)) {
      console.log('  x' + String(g.count).padStart(5) + ' [' + g.kind + '] ' + g.err);
      console.log('            <-- ' + String(g.sample).replace(/\n/g, '\\n').slice(0, 120));
    }
  }
  console.log('RUBY_PENDING    ' + JSON.stringify(ruby ? ruby.pending : {}));
  console.log('GUARD_REPORTS   ' + guard.length);
  console.log('GUARD_SAMPLE    ' + guard.slice(0, 6).join(' | '));
  console.log('MISSING_ASSETS  ' + fin.missing + ' ' + JSON.stringify(fin.missingSample || []));
  console.log('NET_FAILURES    ' + loadErr.length + '  ' + [...new Set(loadErr)].slice(0, 10).join(' | '));
  console.log('ERR_SCREENS     ' + (errScreens.length ? errScreens.join(' || ') : 'none'));
  console.log('HARD_ERRORS     ' + (hard.length ? hard.join(' || ') : 'none'));
  console.log('VERDICT         ' + ((hard.length || errScreens.length) ? 'FAIL' : 'PASS'));
  await b.close();
  process.exit((hard.length || errScreens.length) ? 1 : 0);
})().catch(e => { console.error('FATAL ' + e.message + '\n' + e.stack); process.exit(2); });
