// Monline's Bad End roster + collection gallery.
//   NODE_PATH=<pw> node _shots/probe_badends.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function ok(label, cond, detail) {
  if (!cond) failures++;
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + label +
              (cond ? '' : '\n        ' + detail));
}

const sceneName = p => p.evaluate(() =>
  SceneManager._scene ? SceneManager._scene.constructor.name : null);

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required',
           '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(t))
      errors.push('CONSOLE: ' + t);
  });

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);

  // ------------------------------------------------------------ the roster
  console.log('--- the roster ---');
  const r = await p.evaluate(() => {
    if (!window.MonlineBadEnds) return null;
    const e = MonlineBadEnds.entries;
    const zones = {};
    e.forEach(x => { zones[x.zone] = (zones[x.zone] || 0) + 1; });
    const sws = new Set(e.map(x => x.sw));
    let named = 0, trig = 0;
    e.forEach(x => { if (x.name) named++; if (x.trig) trig++; });
    return {
      total: MonlineBadEnds.total(), zones, uniqueSwitches: sws.size,
      named, trig,
      a1: MonlineBadEnds.entry('A1'),
      c31: MonlineBadEnds.entry('C31'),
      f92: MonlineBadEnds.entry('F92'),
      f24: MonlineBadEnds.entry('F24'),
      b10: MonlineBadEnds.entry('B10'),
      a6: MonlineBadEnds.entry('A6'),
      bogus: MonlineBadEnds.entry('Z9')
    };
  });
  ok('the plugin is loaded', !!r, 'window.MonlineBadEnds missing');
  console.log('  ' + JSON.stringify(r && r.zones));
  ok('306 endings', r.total === 306, 'got ' + r.total);
  ok('zone counts A17 B23 C38 D84 E52 F92',
     JSON.stringify(r.zones) ===
       JSON.stringify({ A: 17, B: 23, C: 38, D: 84, E: 52, F: 92 }),
     JSON.stringify(r.zones));
  ok('every ending has its own switch', r.uniqueSwitches === 306,
     'unique switches ' + r.uniqueSwitches);
  ok('every ending is named', r.named === 306, 'named ' + r.named);
  ok('most endings carry a trigger hint', r.trig > 295, 'with trigger ' + r.trig);
  ok('A1 is Liar Liar on switch 901',
     r.a1 && r.a1.name === 'Liar Liar' && r.a1.sw === 901, JSON.stringify(r.a1));
  ok('C31 is Once Bitten and no longer shares A6\'s switch',
     r.c31 && r.c31.name === 'Once Bitten' && r.c31.sw === 941 &&
       r.c31.sw !== r.a6.sw,
     'C31 ' + JSON.stringify(r.c31) + ' A6 ' + JSON.stringify(r.a6));
  ok('F24 no longer shares A6\'s switch',
     r.f24 && r.f24.sw === 1138, JSON.stringify(r.f24));
  ok('F92 no longer shares A6\'s switch',
     r.f92 && r.f92.sw === 1206, JSON.stringify(r.f92));
  ok('B10 is on its own switch 914',
     r.b10 && r.b10.sw === 914, JSON.stringify(r.b10));
  ok('an unknown code resolves to null', r.bogus === null, JSON.stringify(r.bogus));

  // the switches really are the game's achievement switches
  const named = await p.evaluate(() => {
    const out = [];
    MonlineBadEnds.entries.forEach(e => {
      const n = $dataSystem.switches[e.sw] || '';
      if (!/^ACH: End/.test(n)) out.push(e.code + ' -> ' + n);
    });
    return out;
  });
  ok('every ending switch is an ACH: End switch', named.length === 0,
     named.slice(0, 5).join(' | '));

  // ------------------------------------------------------- recording a seen
  console.log('--- recording ---');
  const rec = await p.evaluate(() => {
    MonlineBadEnds.reset();
    const before = MonlineBadEnds.seenCount();
    MonlineBadEnds.mark('A1');
    MonlineBadEnds.mark('A2');
    const e = MonlineBadEnds.entry('A1');
    const afterSwitch = $gameSwitches.value(e.sw);
    const after = MonlineBadEnds.seenCount();
    return { before, after, afterSwitch,
             seenA1: MonlineBadEnds.isSeen('A1'),
             seenA3: MonlineBadEnds.isSeen('A3') };
  });
  console.log('  ' + JSON.stringify(rec));
  ok('a fresh reset starts at 0', rec.before === 0, 'was ' + rec.before);
  ok('marking an ending also turns on its switch', rec.afterSwitch === true,
     'switch was ' + rec.afterSwitch);
  ok('marking two endings counts two', rec.after === 2, 'count ' + rec.after);
  ok('marked endings report seen, others do not',
     rec.seenA1 === true && rec.seenA3 === false,
     'A1 ' + rec.seenA1 + ' A3 ' + rec.seenA3);

  // setting a switch directly is picked up too - that is what the events do
  const viaSwitch = await p.evaluate(() => {
    MonlineBadEnds.reset();
    $gameSwitches.setValue(967, true);          // D23
    return { seen: MonlineBadEnds.isSeen('D23'),
             code: (MonlineBadEnds.entries.filter(e => e.sw === 967)[0] || {}).code,
             count: MonlineBadEnds.seenCount() };
  });
  ok('an ending is seen as soon as its switch is turned on',
     viaSwitch.code === 'D23' && viaSwitch.seen === true && viaSwitch.count === 1,
     JSON.stringify(viaSwitch));

  // the record survives a brand new game
  const persist = await p.evaluate(() => {
    MonlineBadEnds.reset();
    MonlineBadEnds.mark('B7');
    const before = MonlineBadEnds.seenCount();
    DataManager.setupNewGame();
    const after = MonlineBadEnds.seenCount();
    return { before, after, stillSeen: MonlineBadEnds.isSeen('B7') };
  });
  ok('the collection survives a new game (gallery behaviour)',
     persist.before === 1 && persist.after === 1 && persist.stillSeen === true,
     JSON.stringify(persist));

  // ------------------------------------------------------------- the gallery
  console.log('--- the gallery scene ---');
  await p.evaluate(() => {
    DataManager.setupNewGame();
    MonlineBadEnds.reset();
    MonlineBadEnds.mark('A1');
    MonlineBadEnds.mark('A2');
    MonlineBadEnds.mark('F91');
    SceneManager.push(Scene_BadEndGallery);
  });
  await sleep(1200);
  ok('the gallery opens', await sceneName(p) === 'Scene_BadEndGallery',
     await sceneName(p));

  const win = await p.evaluate(() => {
    const s = SceneManager._scene;
    const g = w => w ? { x: w.x, y: w.y, w: w.width, h: w.height } : null;
    return {
      header: g(s._headerWindow), zone: g(s._zoneWindow),
      list: g(s._listWindow), detailGeo: g(s._detailWindow),
      zoneItems: s._zoneWindow._list.map(i => i.name),
      listRows: s._listWindow.maxItems(),
      active: s._listWindow.active,
      detail: s._detailWindow._entry,
      headerText: s._headerWindow.contents.__proto__ ? true : true
    };
  });
  console.log('  ' + JSON.stringify(win));
  ok('four panes are laid out',
     !!(win.header && win.zone && win.list && win.detailGeo),
     JSON.stringify(win));
  ok('panes do not overlap',
     win.list.y === win.header.h &&
       win.detailGeo.y + win.detailGeo.h <= 625 &&
       win.list.y + win.list.h <= win.detailGeo.y + 1,
     JSON.stringify(win));
  ok('the zone list is All Zones + the six zones',
     JSON.stringify(win.zoneItems) === JSON.stringify(
       ['All Zones', 'Forest Zone', 'Coastal Zone', 'Demon Zone',
        'Desolate Zone', 'Desert Zone', 'Mythic Zone']),
     JSON.stringify(win.zoneItems));
  ok('the list shows every ending in "All Zones"', win.listRows === 306,
     'rows ' + win.listRows);
  ok('the list starts active', win.active === true, 'active ' + win.active);
  ok('the detail pane is showing the first ending',
     win.detail && win.detail.code === 'A1', JSON.stringify(win.detail));

  // filtering to a zone
  const zoneFilter = await p.evaluate(() => {
    const s = SceneManager._scene;
    s._zoneWindow.select(1);              // Forest Zone
    s.onZoneOk();
    return { rows: s._listWindow.maxItems(), first: s._listWindow.item(),
             zone: s._listWindow.zone() };
  });
  ok('picking Forest Zone narrows the list to A1..A17',
     zoneFilter.rows === 17 && zoneFilter.first.code === 'A1' &&
       zoneFilter.zone === 'A',
     JSON.stringify(zoneFilter));

  // locked entries are masked
  const masked = await p.evaluate(() => {
    const s = SceneManager._scene;
    const seen0 = s._listWindow._data[0];    // A1 - marked
    const seen2 = s._listWindow._data[2];    // A3 - not marked
    return { a1: MonlineBadEnds.isSeen(seen0.code),
             a3: MonlineBadEnds.isSeen(seen2.code) };
  });
  ok('A1 is found and A3 is still hidden',
     masked.a1 === true && masked.a3 === false, JSON.stringify(masked));

  // toggling with the OK key
  await p.evaluate(() => { SceneManager._scene._listWindow.select(2); });
  await sleep(200);
  const okToggle = await p.evaluate(() => {
    const s = SceneManager._scene;
    s.onListOk();
    const now = MonlineBadEnds.isSeen('A3');
    s.onListOk();
    const back = MonlineBadEnds.isSeen('A3');
    return { now, back };
  });
  ok('OK marks an ending, OK again clears it',
     okToggle.now === true && okToggle.back === false, JSON.stringify(okToggle));

  // leaving - a tap is too fast for the 60fps poll, hold the key across a frame
  await p.keyboard.down('Escape');
  await sleep(300);
  await p.keyboard.up('Escape');
  await sleep(600);
  const after = await p.evaluate(() => SceneManager._scene.constructor.name);
  ok('cancel leaves the gallery', after !== 'Scene_BadEndGallery', after);

  // ------------------------------------------------------ title screen entry
  console.log('--- the title command ---');
  await p.evaluate(() => { SceneManager.goto(Scene_Title); });
  await sleep(1500);
  const cmds = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return w ? w._list.map(i => ({ n: i.name, s: i.symbol })) : null;
  });
  console.log('  ' + JSON.stringify(cmds));
  ok('the title screen has the Achieve entry',
     !!cmds && cmds.some(c => c.s === 'achieve'), JSON.stringify(cmds));

  const opened = await p.evaluate(() => {
    SceneManager._scene.commandAchieve();
    return true;
  });
  await sleep(900);
  ok('the Achieve entry opens the gallery',
     await sceneName(p) === 'Scene_BadEndGallery', await sceneName(p));

  // 0091.rb's own call path
  const legacy = await p.evaluate(() => ({
    check: typeof window.picturecheck,
    scene: typeof window.Scene_Picture_Gallery,
    ran: (function () { try { return picturecheck() === true; } catch (e) { return String(e); } })()
  }));
  ok('picturecheck and Scene_Picture_Gallery now exist, as 0091.rb expects',
     legacy.check === 'function' && legacy.scene === 'function' && legacy.ran === true,
     JSON.stringify(legacy));

  // ------------------------------------------------------------ plugin cmds
  console.log('--- plugin commands ---');
  const pc = await p.evaluate(() => {
    const gi = new Game_Interpreter();
    MonlineBadEnds.reset();
    gi.pluginCommand('BadEnds', ['mark', 'e5']);
    const marked = MonlineBadEnds.isSeen('E5');
    gi.pluginCommand('BadEnds', ['unmark', 'E5']);
    const cleared = MonlineBadEnds.isSeen('E5');
    $gameVariables.setValue(11, -1);
    gi.pluginCommand('BadEnds', ['mark', 'D1']);
    gi.pluginCommand('BadEnds', ['count', '11']);
    return { marked, cleared, countVar: $gameVariables.value(11) };
  });
  ok('BadEnds mark / unmark / count work',
     pc.marked === true && pc.cleared === false && pc.countVar === 1,
     JSON.stringify(pc));

  // ------------------------------------------------------------------ toast
  console.log('--- the unlock toast ---');
  // SceneManager.pop() only schedules the change, so a while-loop on it would
  // spin forever - goto() and then wait for the scene to actually turn over.
  await p.evaluate(() => { SceneManager.goto(Scene_Title); });
  for (let i = 0; i < 80; i++) {
    if (await sceneName(p) === 'Scene_Title') break;
    await sleep(250);
  }
  await p.evaluate(() => {
    if (SceneManager._scene && SceneManager._scene.commandNewGame) {
      SceneManager._scene.commandNewGame();
    }
  });
  for (let i = 0; i < 80; i++) {
    if (await sceneName(p) === 'Scene_Map') break;
    await sleep(250);
  }
  ok('back on the map for the toast test', await sceneName(p) === 'Scene_Map',
     await sceneName(p));
  const toast = await p.evaluate(() => {
    MonlineBadEnds.mark('C7');
    return true;
  });
  await sleep(700);
  const toastWin = await p.evaluate(() => {
    const s = SceneManager._scene;
    return !!(s && s._badEndToast && s._badEndToast.parent);
  });
  ok('a new ending pops a toast on the map', toastWin === true, 'no toast window');

  // ------------------------------------------------------------------ errors
  console.log('--- errors ---');
  ok('no page errors', errors.length === 0, errors.slice(0, 6).join('\n        '));

  await p.screenshot({ path: '_shots/bad_end_gallery.png' });
  await b.close();
  console.log(failures ? '\nBAD END PROBE FAILED (' + failures + ')'
                       : '\nBAD END PROBE PASSED');
  process.exit(failures ? 1 : 0);
})();
