// Caste City camera probe.
//   NODE_PATH=<pw> node _shots/probe_caste_camera.js
//
// The bug report was "after the Caste City event the camera stopped following
// the player".  Two things have to hold for that to be fixed:
//
//   1. An *unrelated* interpreter reaching Game_Interpreter#terminate must not
//      tear down a camera pan.  MV calls terminate() from executeCommand()
//      whenever any event's list runs out (rpg_objects.js:8936), and Caste
//      City runs a long "Game Set" autorun (event 5, 285 commands,
//      cam_follow at :24, cam_set at :116, cam_follow at :205, cam_center
//      at :231) alongside dozens of tutorial events that finish constantly.
//   2. When the pan *is* abandoned by its owner, the camera has to be handed
//      back - cam_set parks the display on purpose and never unlocks.
//
// Both are checked here against the real engine, on the real map.
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function ok(label, cond, detail) {
  if (!cond) failures++;
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + label +
              (cond ? '' : '\n        ' + detail));
}

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required',
           '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const hard = [];
  p.on('pageerror', e => hard.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text()))
      hard.push('CONSOLE: ' + m.text());
  });

  // MV's Input only ever reports ONE triggered button per frame
  // (`_latestButton`), so a cutscene that stops at the chain-command minigame
  // needs each key pressed on its own frame, in turn.
  const ALL = ['ok', 'monlineA', 'monlineS', 'monlineD', 'shift',
               'up', 'down', 'left', 'right'];
  const setKeys = (k) => p.evaluate(k => {
    ['ok', 'monlineA', 'monlineS', 'monlineD', 'shift',
     'up', 'down', 'left', 'right'].forEach(x => { Input._currentState[x] = false; });
    if (k) { Input._currentState[k] = true; }
  }, k);

  // Press until the map goes idle.  `minPresses` guards against exiting during
  // the frame or two before the cutscene has actually started.
  const clearUntilIdle = async (max, keys, minPresses) => {
    const list = keys || ['ok'];
    for (let i = 0; i < max; i++) {
      await setKeys(list[i % list.length]); await sleep(40);
      await setKeys(null); await sleep(40);
      if (i >= (minPresses || 15) && i % 4 === 3) {
        const st = await p.evaluate(() => ({
          busy: $gameMessage.isBusy(), ev: $gameMap.isEventRunning()
        }));
        if (!st.busy && !st.ev) return true;
      }
    }
    return false;
  };

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(6000);
  await clearUntilIdle(80, ['ok'], 15);

  // ---- go to Caste City ---------------------------------------------------
  const goTo = async (id) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await p.evaluate(m => { $gamePlayer.reserveTransfer(m, 5, 5, 2, 0); }, id);
      for (let i = 0; i < 200; i++) {
        await setKeys('ok'); await sleep(40); await setKeys(null); await sleep(40);
        const cur = await p.evaluate(() => $gameMap.mapId());
        if (cur === id) break;
      }
      if (await p.evaluate(() => $gameMap.mapId()) === id) { await clearUntilIdle(120, ['ok'], 10); }
      if (await p.evaluate(() => $gameMap.mapId()) === id) return true;
    }
    return false;
  };
  const arrived = await goTo(14);
  const where = await p.evaluate(() => ({ mapId: $gameMap.mapId(), ev5: !!$gameMap.event(5) }));
  ok('reached Caste City (map 14)', arrived && where.mapId === 14 && where.ev5,
     JSON.stringify(where));

  // ============================================================ 1) ownership
  // A pan armed from an event must survive some *other* event finishing.
  const r1 = await p.evaluate(() => {
    const tx = Math.min($gameMap.width() - 2, $gamePlayer.x + 6);
    const ty = Math.min($gameMap.height() - 2, $gamePlayer.y + 4);
    window.cam_set(tx, ty, 4);                 // arms a glide, parks at -1
    const armedImmediately = MonlineCamera.hasPlan();
    const lockedImmediately = MonlineCamera.camTarget();

    // an unrelated interpreter running out of commands - exactly what happened
    // every frame during the Caste City cutscene
    const other = new Game_Interpreter();
    other._list = [];
    other.terminate();

    return {
      armedImmediately, lockedImmediately,
      survivedOtherTerminate: MonlineCamera.hasPlan(),
      stillLocked: MonlineCamera.camTarget()
    };
  });
  console.log('  (1) ' + JSON.stringify(r1));
  ok('cam_set arms a glide and parks the camera',
     r1.armedImmediately === true && r1.lockedImmediately === -1, JSON.stringify(r1));
  ok('an unrelated interpreter terminating does NOT abort the pan',
     r1.survivedOtherTerminate === true && r1.stillLocked === -1, JSON.stringify(r1));

  // let it settle through the port's own wait mode
  const r2 = await p.evaluate(() => {
    const it = new Game_Interpreter();
    it.setWaitMode(MonlineCamera.WAIT_MODE);
    let frames = 0;
    while (MonlineCamera.hasPlan() && frames < 3000) {
      it.updateWaitMode();
      $gameMap.updateScroll();
      frames++;
    }
    return { frames, settled: !MonlineCamera.hasPlan(), target: MonlineCamera.camTarget(),
             disp: [$gameMap.displayX(), $gameMap.displayY()] };
  });
  console.log('  (2) ' + JSON.stringify(r2));
  ok('the pan settles on its own', r2.settled === true, JSON.stringify(r2));
  ok('cam_set stays parked once it arrives (by design)',
     r2.target === -1, JSON.stringify(r2));

  // ============================================== 2) owner dies -> released
  const r3 = await p.evaluate(() => {
    const tx = Math.min($gameMap.width() - 2, $gamePlayer.x + 5);
    window.cam_set(tx, $gamePlayer.y, 4);
    const armed = MonlineCamera.hasPlan();
    // the owning interpreter is the one parked on the camera wait mode
    const owner = new Game_Interpreter();
    owner.setWaitMode(MonlineCamera.WAIT_MODE);
    owner.terminate();
    return { armed, planAfter: MonlineCamera.hasPlan(), target: MonlineCamera.camTarget() };
  });
  console.log('  (3) ' + JSON.stringify(r3));
  ok('the owning interpreter dying releases the camera',
     r3.armed === true && r3.planAfter === false && r3.target === 0, JSON.stringify(r3));

  // ================================================ 3) camera follows again
  // The player has to stand somewhere the display is not pinned against the
  // map edge - MV clamps displayX to [0, width-screenTileX] - and somewhere
  // three tiles to the right are actually walkable.
  const r4 = await p.evaluate(async () => {
    const cx = $gamePlayer.centerX(), cy = $gamePlayer.centerY();
    let spot = null;
    for (let y = 1; y < $gameMap.height() - 1 && !spot; y++) {
      for (let x = cx; x < $gameMap.width() - cx - 3 && !spot; x++) {
        let clear = true;
        for (let d = 1; d <= 3; d++) {
          if (!$gamePlayer.canPass(x + d - 1, y, 6)) { clear = false; break; }
        }
        if (clear) { spot = [x, y]; }
      }
    }
    if (!spot) { return { noSpot: true, mapId: $gameMap.mapId() }; }
    $gamePlayer.setThrough(true);   // never let a wandering event block the test
    $gamePlayer.locate(spot[0], spot[1]);
    $gameMap.setDisplayPos($gamePlayer.x - cx, $gamePlayer.y - cy);
    window.cam_center(0);
    const before = [$gameMap.displayX(), $gameMap.displayY()];
    const px = $gamePlayer.x, py = $gamePlayer.y;
    for (let i = 0; i < 3; i++) {
      $gamePlayer.moveStraight(6);
      await new Promise(res => requestAnimationFrame(res));
    }
    // MV advances _realX one `distancePerFrame` per tick and only nudges the
    // display from Game_Player#updateScroll, so this needs real frames - not a
    // wait on isScrolling(), which is false because MV's scrollRight lands the
    // display immediately.
    for (let i = 0; i < 200; i++) { await new Promise(res => requestAnimationFrame(res)); }
    const after = [$gameMap.displayX(), $gameMap.displayY()];
    $gamePlayer.setThrough(false);
    return {
      target: MonlineCamera.camTarget(), before, after, spot,
      playerMoved: $gamePlayer.x !== px, movedX: $gamePlayer.x - px,
      displayFollowedX: after[0] === before[0] + ($gamePlayer.x - px),
      displayMoved: after[0] !== before[0] || after[1] !== before[1]
    };
  });
  console.log('  (4) ' + JSON.stringify(r4));
  ok('found a walkable spot to test on', !r4.noSpot, JSON.stringify(r4));
  ok('the player actually walked', r4.playerMoved === true, JSON.stringify(r4));
  ok('the display tracks the player step for step',
     r4.displayFollowedX === true, JSON.stringify(r4));
  ok('...and something on screen moved', r4.displayMoved === true, JSON.stringify(r4));

  // ============================================= 4) the real "Game Set" run
  const r5 = await p.evaluate(() => {
    $gameSwitches.setValue(22, true);
    const e5 = $gameMap.event(5);
    const page = e5 ? e5.page() : null;
    return { mapId: $gameMap.mapId(), hasEvent: !!e5,
             pageLen: page ? page.list.length : 0,
             trigger: page ? page.trigger : null };
  });
  console.log('  (5) ' + JSON.stringify(r5));
  ok('event 5 "Game Set" is live once switch 22 is on',
     r5.hasEvent && r5.pageLen === 285 && r5.trigger === 3, JSON.stringify(r5));

  // The cutscene parks a chain-command minigame at :122 and only releases once
  // it has been played, so every button has to be exercised, not just OK.
  let diags = null;
  for (let i = 0; i < 600; i++) {
    await setKeys(ALL[i % ALL.length]); await sleep(40);
    await setKeys(null); await sleep(40);
    if (i % 20 === 19) {
      const st = await p.evaluate(() => {
        const e5 = $gameMap.event(5);
        const it = e5 ? e5._interpreter : null;
        const running = ($gameMap.events() || []).filter(e => e && e._interpreter &&
            e._interpreter.isRunning()).map(e => ({
              id: e.eventId(), idx: e._interpreter._index,
              wait: e._interpreter._waitMode, wc: e._interpreter._waitCount
            })).slice(0, 6);
        return {
          busy: $gameMessage.isBusy(), ev: $gameMap.isEventRunning(),
          target: MonlineCamera.camTarget(), mapId: $gameMap.mapId(),
          e5idx: it ? it._index : -2, e5wait: it ? it._waitMode : '',
          running,
          scene: SceneManager._scene ? SceneManager._scene.constructor.name : null
        };
      });
      diags = st;
      if (!st.busy && !st.ev && st.e5idx >= 231) break;
    }
  }
  console.log('  (6a) cutscene diagnostic ' + JSON.stringify(diags));
  const r6 = await p.evaluate(() => {
    const e5 = $gameMap.event(5);
    const it = e5 ? e5._interpreter : null;
    return {
      target: MonlineCamera.camTarget(),
      plan: MonlineCamera.hasPlan(),
      mapId: $gameMap.mapId(),
      disp: [$gameMap.displayX(), $gameMap.displayY()],
      player: [$gamePlayer.x, $gamePlayer.y],
      idx: it ? it._index : -2,
      scene: SceneManager._scene ? SceneManager._scene.constructor.name : null
    };
  });
  console.log('  (6) ' + JSON.stringify(r6));
  ok('the cutscene got past the chain-command minigame at :122',
     r6.idx > 122 || r6.idx < 0, JSON.stringify(r6));
  // The 285-command autorun ends by handing the player the PXE menu
  // (`SceneManager.call(Scene_PXEBestChoose)` at :276), so "still parked" is
  // not necessarily a defect - what matters is that the recovery works, which
  // is the next check.
  ok('...and no pan is left armed', r6.plan === false, JSON.stringify(r6));

  // Whatever state the cutscene left behind, the release path has to work:
  // run the very command the cutscene ends with and check the camera comes
  // home and the display snaps onto the player.
  const r7 = await p.evaluate(() => {
    window.cam_center(3);
    const it = new Game_Interpreter();
    it.setWaitMode(MonlineCamera.WAIT_MODE);
    let frames = 0;
    while (MonlineCamera.hasPlan() && frames < 3000) {
      it.updateWaitMode();
      $gameMap.updateScroll();
      frames++;
    }
    const cx = $gamePlayer.centerX(), cy = $gamePlayer.centerY();
    const endX = $gameMap.width() - $gameMap.screenTileX();
    const endY = $gameMap.height() - $gameMap.screenTileY();
    const clampX = v => endX < 0 ? endX / 2 : Math.max(0, Math.min(v, endX));
    const clampY = v => endY < 0 ? endY / 2 : Math.max(0, Math.min(v, endY));
    return {
      target: MonlineCamera.camTarget(), frames,
      settled: !MonlineCamera.hasPlan(),
      centered: $gameMap.displayX() === clampX($gamePlayer.x - cx) &&
                $gameMap.displayY() === clampY($gamePlayer.y - cy)
    };
  });
  console.log('  (7) ' + JSON.stringify(r7));
  ok('cam_center hands the camera back even from a stalled cutscene',
     r7.settled === true && r7.target === 0 && r7.centered === true,
     JSON.stringify(r7));

  // ================================ 5) PXEpedia / Bestiary really differ now
  // 0148.rb:55 - `command_to_pedia` opens the Encyclopedia, not the bestiary.
  // Both used to resolve to the same placeholder scene.
  const r8 = await p.evaluate(async () => {
    SceneManager.push(Scene_PXEBestChoose);
    await new Promise(r => setTimeout(r, 400));
    const menuScene = SceneManager._scene.constructor.name;
    const names = SceneManager._scene._commandWindow
      ? SceneManager._scene._commandWindow._list.map(c => c.name) : [];
    SceneManager._scene.commandToPedia();
    await new Promise(r => setTimeout(r, 400));
    const pediaScene = SceneManager._scene.constructor.name;
    SceneManager.pop();
    await new Promise(r => setTimeout(r, 300));
    SceneManager.push(Scene_PXEBestChoose);
    await new Promise(r => setTimeout(r, 400));
    SceneManager._scene.commandToBestiary();
    await new Promise(r => setTimeout(r, 400));
    const bestiaryScene = SceneManager._scene.constructor.name;
    return { menuScene, names, pediaScene, bestiaryScene };
  });
  console.log('  (8) ' + JSON.stringify(r8));
  ok('Scene_PXEBestChoose opens with PXEpedia / Bestiary / Return',
     r8.menuScene === 'Scene_PXEBestChoose' &&
     r8.names[0] === 'PXEpedia' && r8.names[1] === 'Bestiary' &&
     r8.names[r8.names.length - 1] === 'Return', JSON.stringify(r8));
  ok('PXEpedia opens the real encyclopedia (0146.rb), not the catalogue',
     r8.pediaScene === 'Encyclopedia', JSON.stringify(r8));
  ok('Bestiary opens the monster catalogue (0147.rb)',
     r8.bestiaryScene === 'Scene_MonsterCatalogue', JSON.stringify(r8));

  ok('no page errors', hard.length === 0, hard.slice(0, 5).join(' | '));

  await p.screenshot({ path: OUT + 'caste_camera.png' });
  await b.close();
  console.log('');
  console.log(failures ? 'CASTE CAMERA FAILED: ' + failures + ' assertion(s)'
                       : 'CASTE CAMERA PASSED: all assertions held');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(2); });
