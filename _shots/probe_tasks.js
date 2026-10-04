// Task / quest system (modelled on 未定型大陆调查记's XdRs_TaskSystem).
//   NODE_PATH=<pw> node _shots/probe_tasks.js
//
// Drives the real task screen: the menu entry, the type tabs, the list, the
// info pane, taking / completing / failing, the on-map tracking HUD, the
// tracking hotkey, event signs and the Ruby bridge aliases.
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
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' +
       (e.stack || '').split('\n').slice(0, 6).join('\n')));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(t))
      errors.push('CONSOLE: ' + t);
  });
  const sceneName = () => p.evaluate(() =>
    SceneManager._scene ? SceneManager._scene.constructor.name : null);
  async function tap(key, n) {
    const K = { Down: 'ArrowDown', Up: 'ArrowUp', Left: 'ArrowLeft',
                Right: 'ArrowRight' };
    for (let i = 0; i < (n === undefined ? 1 : n); i++) {
      await p.keyboard.down(K[key] || key); await sleep(80);
      await p.keyboard.up(K[key] || key); await sleep(90);
    }
  }

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Map'; i++) await sleep(200);
  await p.waitForFunction(
    () => !!(SceneManager._scene && SceneManager._scene._spriteset),
    null, { timeout: 20000 });
  await sleep(1200);

  // -------------------------------------------------------------- the data
  console.log('--- the task database ---');
  const db = await p.evaluate(() => ({
    count: $dataTasks.length,
    names: $dataTasks.filter(Boolean).map(t => t.name),
    types: $gameTemp.taskTypes(),
    maxTrack: MonlineTasks.CFG.TRACK_COUNT
  }));
  console.log('  db     ' + JSON.stringify(db));
  ok('data/Tasks.json loads into $dataTasks', db.count === 6,
     JSON.stringify(db));
  ok('the type names come from the config', db.types.length >= 2,
     JSON.stringify(db));
  ok('the tracking limit is capped at 5 or less', db.maxTrack <= 5,
     JSON.stringify(db));

  // ------------------------------------------------------------- the API
  console.log('--- the script API ---');
  const api = await p.evaluate(() => {
    const before = $gameParty.hasTask(2);
    $gameParty.takeTask(2);
    return {
      before: before,
      after: $gameParty.hasTask(2),
      completed: $gameParty.isTaskCompleted(2),
      canComplete: $gameParty.canTaskComplete(2),
      bridge: ['take_task', 'complete_task', 'fail_task', 'has_task',
               'is_task_completed', 'can_task_complete', 'take_random_task',
               'clear_killed_data', 'set_event_sign']
              .every(n => typeof MonlineRuby.F[n] === 'function')
    };
  });
  console.log('  api    ' + JSON.stringify(api));
  ok('takeTask registers the task', !api.before && api.after,
     JSON.stringify(api));
  ok('...and it is not complete yet', !api.completed, JSON.stringify(api));
  ok('the Ruby bridge exposes the whole vocabulary', api.bridge,
     JSON.stringify(api));

  // --------------------------------------------------------- the menu entry
  console.log('--- the menu entry ---');
  const menu = await p.evaluate(() => {
    const w = new Window_MenuCommand(0, 0);
    return w._list.map(c => c.symbol);
  });
  console.log('  menu   ' + JSON.stringify(menu));
  ok('a Tasks command is on the menu', menu.indexOf('monlineTasks') >= 0,
     JSON.stringify(menu));

  const opened = await p.evaluate(() => {
    SceneManager.push(Scene_Menu);
    return true;
  });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Menu'; i++) await sleep(150);
  await sleep(700);
  const wired = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      handler: !!(sc._commandWindow._handlers &&
                  sc._commandWindow._handlers.monlineTasks),
      enabled: sc._commandWindow._list.some(c => c.symbol === 'monlineTasks' &&
                                                 c.enabled)
    };
  });
  console.log('  wired  ' + JSON.stringify(wired));
  ok('the menu wires the Tasks command to a handler', wired.handler && wired.enabled,
     JSON.stringify(wired));
  await p.evaluate(() => { SceneManager._scene.commandTasks(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Task'; i++) await sleep(150);
  // SceneManager assigns _scene before calling create(), so wait for the panes
  await p.waitForFunction(
    () => !!(SceneManager._scene && SceneManager._scene._listWindow),
    null, { timeout: 10000 });
  await sleep(400);
  ok('it opens Scene_Task', await sceneName() === 'Scene_Task', await sceneName());

  const layout = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const n = c => c ? c.constructor.name : null;
    return {
      title: n(sc._titleWindow), label: n(sc._labelWindow),
      list: n(sc._listWindow), info: n(sc._infoWindow),
      tabs: sc._labelWindow._list.map(c => c.name),
      rows: sc._listWindow.maxItems(),
      names: Array.from({ length: sc._listWindow.maxItems() },
                        (_, i) => sc._listWindow.task(i).name()),
      labelActive: sc._labelWindow.active
    };
  });
  console.log('  layout ' + JSON.stringify(layout));
  ok('the four panes are built', layout.title === 'Window_Base' &&
     layout.label === 'Window_TaskLabel' && layout.list === 'Window_TaskList' &&
     layout.info === 'Window_TaskInfo', JSON.stringify(layout));
  ok('the tabs are the four statuses plus every type',
     JSON.stringify(layout.tabs) ===
       JSON.stringify(['Run', 'Ready', 'Done', 'Fail', 'Main', 'Side']),
     JSON.stringify(layout.tabs));
  ok('the list shows the task that was taken',
     layout.names.length === 1 && /Potion Supply/.test(layout.names[0]),
     JSON.stringify(layout));

  // ------------------------------------------------------- condition progress
  console.log('--- the condition follows the inventory ---');
  const prog = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const t = $gameParty.allTasks()[2];
    const before = t.conditions()[0].nowNum();
    $gameParty.gainItem($dataItems[1], 3);
    const after = t.conditions()[0].nowNum();
    return { before: before, after: after, need: t.conditions()[0].needNum(),
             can: t.canCompleted(), status: t.status(),
             numText: t.conditions()[0].numText() };
  });
  console.log('  prog   ' + JSON.stringify(prog));
  ok('gaining the item advances the condition',
     prog.before === 0 && prog.after === 3, JSON.stringify(prog));
  ok('the task became ready to hand in', prog.can === true &&
     prog.status === 1, JSON.stringify(prog));
  ok('the progress text is "have/need"', prog.numText === '3/3',
     JSON.stringify(prog));

  // ----------------------------------------------------------- completing it
  console.log('--- completing ---');
  const done = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._listWindow.refresh();
    sc._infoWindow.refresh();
    const goldBefore = $gameParty.gold();
    sc._listWindow.select(0);
    sc.onListOk();                       // the check mark is lit, so it completes
    const t = $gameParty.allTasks()[2];
    return {
      status: t.status(), statusText: t.statusText(),
      goldBefore: goldBefore, goldAfter: $gameParty.gold(),
      tracked: $gameSystem.trackedTasks().length,
      rows: sc._listWindow.maxItems()
    };
  });
  console.log('  done   ' + JSON.stringify(done));
  ok('the task completes', done.status === 2, JSON.stringify(done));
  ok('...and pays the 150G reward',
     done.goldAfter === done.goldBefore + 150, JSON.stringify(done));

  // The tabs are multi-select in the reference too, so a second tab ADDS to
  // the filter instead of replacing it. Select one status at a time.
  const filtered = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const pick = function (ext) {
      sc._labelWindow._labels = [ext];
      sc._labelWindow.refresh();
      sc._listWindow.refresh();
      return sc._listWindow.maxItems();
    };
    return { doneRows: pick(2), runRows: pick(0), allRows: pick(-1) };
  });
  console.log('  tabs   ' + JSON.stringify(filtered));
  ok('the Done tab lists the finished task', filtered.doneRows === 1,
     JSON.stringify(filtered));
  ok('the Run tab no longer lists it', filtered.runRows === 0,
     JSON.stringify(filtered));
  ok('an unknown label filters everything out', filtered.allRows === 0,
     JSON.stringify(filtered));

  // --------------------------------------------------------------- tracking
  console.log('--- tracking ---');
  const track = await p.evaluate(() => {
    // clear the filters again
    const sc = SceneManager._scene;
    sc._labelWindow._labels = [];
    sc._labelWindow.refresh();
    sc._listWindow.refresh();
    // take two more tasks, then fill the tracker to the brim and overflow it
    $gameParty.takeTask(3);
    $gameParty.takeTask(4);
    const results = [];
    const ids = [3, 4, 5, 1];
    ids.forEach(function (id) { results.push($gameSystem.trackTask(id)); });
    return { results: results, limit: MonlineTasks.CFG.TRACK_COUNT,
             list: $gameSystem.trackedTasks().slice(),
             tracked3: $gameSystem.isTaskTracked(3) };
  });
  console.log('  track  ' + JSON.stringify(track));
  ok('tasks can be tracked up to the configured limit',
     track.results.map((v, i) => i < track.limit).join() ===
       track.results.map(v => v).join() &&
       track.results.filter(Boolean).length === track.limit,
     JSON.stringify(track));
  ok('the tracker refuses anything past the limit',
     track.list.length === track.limit &&
       track.results[track.results.length - 1] === false,
     JSON.stringify(track));
  ok('isTaskTracked agrees', track.tracked3 === true, JSON.stringify(track));

  // Scene_Base#popScene is SceneManager.pop(), and the reference binds cancel
  // to exactly that - so the task screen steps back the way it came:
  // Task -> Menu -> Map.
  await p.evaluate(() => { SceneManager._scene.popScene(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Menu'; i++) await sleep(150);
  await sleep(500);
  ok('leaving the task screen returns to the menu it came from',
     await sceneName() === 'Scene_Menu', await sceneName());
  await p.evaluate(() => { SceneManager._scene.popScene(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Map'; i++) await sleep(150);
  await sleep(900);
  ok('...and from there back to the map',
     await sceneName() === 'Scene_Map', await sceneName());

  const hud = await p.evaluate(() => {
    const w = SceneManager._scene._taskTracker;
    return {
      exists: !!w,
      visible: w ? w.visible : null,
      z: w ? w.z : null,
      x: w ? w.x : null, y: w ? w.y : null,
      height: w ? w.height : null
    };
  });
  console.log('  hud    ' + JSON.stringify(hud));
  ok('the map carries a tracking window', hud.exists && hud.visible,
     JSON.stringify(hud));

  const toggle = await p.evaluate(() => {
    const before = $gameSystem.isTaskTrackerVisible();
    const v = $gameSystem.toggleTaskTracker();
    return { before: before, after: v };
  });
  console.log('  toggle ' + JSON.stringify(toggle));
  ok('the tracking window can be hidden', toggle.before !== toggle.after,
     JSON.stringify(toggle));
  await p.evaluate(() => { $gameSystem.setTaskTrackerVisible(true); });

  // ---------------------------------------------------------------- failing
  console.log('--- failing / restarting ---');
  const fail = await p.evaluate(() => {
    $gameParty.failTask(4);
    const t = $gameParty.allTasks()[4];
    const st = t.status();
    $gameParty.restartTask(4);
    return { afterFail: st, afterRestart: $gameParty.allTasks()[4].status(),
             trackedStill4: $gameSystem.isTaskTracked(4) };
  });
  console.log('  fail   ' + JSON.stringify(fail));
  ok('failTask marks the task failed', fail.afterFail === 3,
     JSON.stringify(fail));
  ok('restartTask puts it back in progress', fail.afterRestart === 0,
     JSON.stringify(fail));

  // ------------------------------------------------------------------ kills
  console.log('--- kill counting ---');
  const kills = await p.evaluate(() => {
    $gameParty.clearKilledData();
    $gameParty.takeTask(3);
    const t = $gameParty.allTasks()[3];
    t.conditions()[0].recordCurrentNum();       // baseline
    $gameParty.recordEnemyKilled(7, 2);
    const two = t.conditions()[0].nowNum();
    $gameParty.recordEnemyKilled(9, 5);         // a different enemy
    const stillTwo = t.conditions()[0].nowNum();
    $gameParty.recordEnemyKilled(7, 1);
    return { two: two, stillTwo: stillTwo, three: t.conditions()[0].nowNum(),
             can: t.canCompleted() };
  });
  console.log('  kills  ' + JSON.stringify(kills));
  ok('kills are counted from when the task was taken',
     kills.two === 2 && kills.stillTwo === 2, JSON.stringify(kills));
  ok('...and only the tracked enemy counts',
     kills.three === 3 && kills.can === true, JSON.stringify(kills));

  await p.screenshot({ path: OUT + 'task_tracker.png' });

  // ------------------------------------------------------------------ signs
  console.log('--- event signs ---');
  const sign = await p.evaluate(() => {
    const ev = $gameMap.events()[0];
    if (!ev) { return { none: true }; }
    $gameSystem.setEventSignImg($gameMap.mapId(), ev.eventId(), '');
    const read0 = $gameSystem.eventSignImg($gameMap.mapId(), ev.eventId());
    $gameSystem.setEventSignImg($gameMap.mapId(), ev.eventId(), 'Fog1');
    const read1 = $gameSystem.eventSignImg($gameMap.mapId(), ev.eventId());
    const sprites = (SceneManager._scene._taskSigns || []).length;
    $gameSystem.clearEventSign($gameMap.mapId(), ev.eventId());
    return { read0: read0, read1: read1, sprites: sprites,
             cleared: $gameSystem.eventSignImg($gameMap.mapId(), ev.eventId()) };
  });
  console.log('  sign   ' + JSON.stringify(sign));
  ok('a sign image can be set and cleared',
     sign.read1 === 'Fog1' && sign.cleared === '', JSON.stringify(sign));
  ok('the map built a sign sprite per event', sign.sprites >= 1,
     JSON.stringify(sign));

  ok('no page errors anywhere', errors.length === 0,
     errors.slice(0, 3).join(' | '));

  await b.close();
  console.log('');
  if (failures > 0) { console.log('TASKS FAILED: ' + failures + ' assertion(s)'); process.exit(1); }
  console.log('TASKS PASSED: all assertions held');
})().catch(e => { console.error(e); process.exit(2); });
