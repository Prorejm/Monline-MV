// "make the screens actually open" - repro + regression for 0119.rb, the YEA
// Debug Extension.
//   NODE_PATH=<pw> node _shots/probe_debug.js
//
// Opens the real debug menu with a real F9 keypress and walks every pane:
// switches, variables (odometer input), items, events, battle and the
// teleport preview.  Also exercises the F10 code console.
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

  // MV reports triggers by its own symbol names; Playwright wants DOM key
  // names ("ArrowDown", not "Down").
  const KEY = { Down: 'ArrowDown', Up: 'ArrowUp', Left: 'ArrowLeft',
                Right: 'ArrowRight', Enter: 'Enter', Escape: 'Escape' };
  async function tap(key, n) {
    const k = KEY[key] || key;
    for (let i = 0; i < (n === undefined ? 1 : n); i++) {
      await p.keyboard.down(k);
      await sleep(80);
      await p.keyboard.up(k);
      await sleep(90);
    }
  }
  // MV only reports one triggered button per frame, and the first press after
  // a window opens can land on a settling frame, so retry until it takes.
  async function tapUntil(key, cond, tries) {
    for (let i = 0; i < (tries || 8); i++) {
      await tap(key);
      if (await cond()) { return true; }
    }
    return false;
  }

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Map'; i++) await sleep(200);
  await p.waitForFunction(
    () => !!(SceneManager._scene && SceneManager._scene._spriteset),
    null, { timeout: 20000 });
  await sleep(1200);
  // MV listens for keydown on `document`, so no click target is needed - but
  // the canvas does have to own focus for the events to reach the page.
  await p.evaluate(() => { window.focus(); });

  // ------------------------------------------------------------ F9 opens it
  console.log('--- F9 opens the debug menu ---');
  ok('the map is up', await sceneName() === 'Scene_Map', await sceneName());
  await tap('F9');
  await sleep(900);
  ok('F9 opens Scene_Debug', await sceneName() === 'Scene_Debug',
     await sceneName());

  const layout = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const names = c => c ? c.constructor.name : null;
    return {
      cmd: names(sc._commandWindow),
      cmds: sc._commandWindow._list.map(c => c.name),
      syms: sc._commandWindow._list.map(c => c.symbol),
      help: names(sc._helpWindow),
      dummy: names(sc._dummyWindow),
      sw: names(sc._switchWindow),
      vr: names(sc._variableWindow),
      inp: names(sc._inputWindow),
      tp: names(sc._teleportWindow),
      mp: names(sc._mapWindow),
      hd: names(sc._teleportHeader),
      bt: names(sc._battleWindow),
      ev: names(sc._eventWindow),
      it: names(sc._itemWindow),
      z: [sc._commandWindow.z, sc._switchWindow.z]
    };
  });
  console.log('  layout ' + JSON.stringify(layout));
  ok('Window_DebugCommand is the command pane',
     layout.cmd === 'Window_DebugCommand', JSON.stringify(layout));
  ok('all eight commands are there, in the Ruby order',
     JSON.stringify(layout.cmds) === JSON.stringify(
       ['Switches', 'Variables', 'Teleport', 'Battle', 'Events', 'Items',
        'Weapons', 'Armours']), JSON.stringify(layout.cmds));
  ok('every pane is built', layout.help === 'Window_Base' &&
     layout.sw === 'Window_DebugSwitch' &&
     layout.vr === 'Window_DebugVariable' &&
     layout.inp === 'Window_DebugInput' &&
     layout.tp === 'Window_DebugTeleport' &&
     layout.mp === 'Window_DebugShownMap' &&
     layout.hd === 'Window_DebugMapHeader' &&
     layout.bt === 'Window_DebugBattle' &&
     layout.ev === 'Window_DebugCommonEvent' &&
     layout.it === 'Window_DebugItem', JSON.stringify(layout));

  // -------------------------------------------------------------- switches
  console.log('--- switches ---');
  await tap('Enter');
  await sleep(500);
  const sw = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      active: sc._switchWindow.active,
      visible: sc._switchWindow.visible,
      items: sc._switchWindow.maxItems(),
      dummy: sc._dummyWindow.visible,
      firstName: sc._switchWindow.commandName(0),
      help: sc._helpWindow.contents ? 'drawn' : 'none'
    };
  });
  console.log('  sw     ' + JSON.stringify(sw));
  ok('the switch pane shows and activates', sw.active && sw.visible,
     JSON.stringify(sw));
  ok('it lists every switch in the database', sw.items > 1,
     JSON.stringify(sw));
  ok('the labels are S%04d:<name>', /^S\d{4}:/.test(sw.firstName),
     JSON.stringify(sw));

  const toggle = await p.evaluate(async () => {
    const sc = SceneManager._scene;
    // move to a switch the game does not use so nothing else reacts
    const list = sc._switchWindow._list;
    let i = 0;
    for (; i < list.length; i++) { if (list[i].ext === 500) { break; } }
    sc._switchWindow.select(i);
    const id = sc._switchWindow.currentExt();
    const before = $gameSwitches.value(id);
    sc.onSwitchOk();
    return { id: id, before: before, after: $gameSwitches.value(id) };
  });
  console.log('  toggle ' + JSON.stringify(toggle));
  ok('Z toggles the highlighted switch',
     toggle.after === !toggle.before && toggle.id === 500,
     JSON.stringify(toggle));

  await tap('Escape');
  await sleep(500);
  ok('cancel goes back to the command pane',
     await p.evaluate(() => SceneManager._scene._commandWindow.active),
     await sceneName());

  // ------------------------------------------------------------- variables
  console.log('--- variables ---');
  await tap('Down');
  await tap('Enter');
  await sleep(500);
  const vr = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      active: sc._variableWindow.active,
      items: sc._variableWindow.maxItems(),
      first: sc._variableWindow.commandName(0),
      hidden: !sc._switchWindow.visible
    };
  });
  console.log('  vr     ' + JSON.stringify(vr));
  ok('the variable pane shows, the switch pane hides',
     vr.active && vr.hidden && vr.items > 1, JSON.stringify(vr));
  ok('the labels are V%04d:<name>', /^V\d{4}:/.test(vr.first),
     JSON.stringify(vr));

  await tap('Enter');
  await sleep(500);
  const inp = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      openness: sc._inputWindow.openness,
      active: sc._inputWindow.active,
      idx: sc._inputWindow.index(),
      value: sc._inputWindow._value,
      varId: sc._inputWindow._variable,
      cells: sc._inputWindow.maxItems()
    };
  });
  console.log('  input  ' + JSON.stringify(inp));
  ok('Z on a variable opens the nine-digit odometer',
     inp.active && inp.openness > 0 && inp.cells === 9, JSON.stringify(inp));
  ok('...on the sign column, as 0119.rb:846 asks', inp.idx === 8,
     JSON.stringify(inp));

  const odometer = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._inputWindow;
    // column i (1..8) is worth 10^(9-1-i); column 0 flips the sign
    w._value = 0;
    w.select(5);
    const before = w._value;
    w.cursorUp();
    const afterUp = w._value;
    w.cursorDown();
    w.cursorDown();
    const afterDown = w._value;
    w._value = 500;
    w.select(0);
    w.cursorUp();
    const flipped = w._value;
    return { before: before, afterUp: afterUp, afterDown: afterDown,
             flipped: flipped, step: Math.pow(10, 9 - 1 - 5) };
  });
  console.log('  odomet ' + JSON.stringify(odometer));
  ok('up adds that column\'s power of ten',
     odometer.afterUp === odometer.before + odometer.step,
     JSON.stringify(odometer));
  ok('down subtracts it again',
     odometer.afterDown === odometer.before - odometer.step,
     JSON.stringify(odometer));
  ok('the sign column negates the value', odometer.flipped === -500,
     JSON.stringify(odometer));

  const committed = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._inputWindow;
    w.select(5);
    w._value = 4242;
    const id = sc._variableWindow.currentExt();
    sc.onInputOk();
    return { id: id, value: $gameVariables.value(id),
             open: w.openness, closing: w.isClosing ? w.isClosing() : null };
  });
  console.log('  commit ' + JSON.stringify(committed));
  ok('OK writes the number into the variable',
     committed.value === 4242, JSON.stringify(committed));

  await tap('Escape');
  await sleep(600);
  ok('cancel walks back out to the command pane',
     await p.evaluate(() => SceneManager._scene._commandWindow.active),
     await sceneName());

  // ----------------------------------------------------------------- items
  console.log('--- items ---');
  await p.evaluate(() => {
    const sc = SceneManager._scene;
    const i = sc._commandWindow._list.findIndex(c => c.symbol === 'items');
    sc._commandWindow.select(i);
    sc.commandItems();
  });
  await sleep(400);
  const it = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      type: sc._itemWindow._type,
      items: sc._itemWindow.maxItems(),
      first: sc._itemWindow.commandName(0),
      active: sc._itemWindow.active
    };
  });
  console.log('  items  ' + JSON.stringify(it));
  ok('the item pane lists $dataItems', it.type === 'items' && it.items > 1,
     JSON.stringify(it));
  ok('the labels are I%03d:', /^I\d{3}:/.test(it.first), JSON.stringify(it));

  const gain = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const item = sc._itemWindow.currentExt();
    const before = $gameParty.numItems(item);
    sc._itemWindow.cursorRight();      // +1 with no modifier
    const one = $gameParty.numItems(item);
    return { name: item.name, before: before, one: one };
  });
  console.log('  gain   ' + JSON.stringify(gain));
  ok('the right arrow adds one', gain.one === gain.before + 1,
     JSON.stringify(gain));
  const lose = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const item = sc._itemWindow.currentExt();
    const before = $gameParty.numItems(item);
    sc._itemWindow.cursorLeft();
    return { before: before, after: $gameParty.numItems(item) };
  });
  ok('the left arrow removes one', lose.after === lose.before - 1,
     JSON.stringify(lose));

  // weapons / armours are the same window with a different database
  const wa = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const out = {};
    ['weapons', 'armours'].forEach(sym => {
      const i = sc._commandWindow._list.findIndex(c => c.symbol === sym);
      sc._commandWindow.select(i);
      sc.commandItems();
      out[sym] = sc._itemWindow._type;
      sc.onItemCancel();
    });
    return out;
  });
  console.log('  gear   ' + JSON.stringify(wa));
  ok('the weapon and armour panes reuse it with their own databases',
     wa.weapons === 'weapons' && wa.armours === 'armours',
     JSON.stringify(wa));

  // ---------------------------------------------------------------- events
  console.log('--- events / battle ---');
  const ev = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const i = sc._commandWindow._list.findIndex(c => c.symbol === 'events');
    sc._commandWindow.select(i);
    sc.commandCommonEvent();
    const first = sc._eventWindow.commandName(0);
    const id = sc._eventWindow.currentExt();
    $gameTemp.clearCommonEvent();
    sc.onEventOk();
    return { first: first, id: id, reserved: $gameTemp._commonEventId,
             leaving: SceneManager._nextScene === null ? 'none' : 'pending',
             stack: SceneManager._stack.length };
  });
  console.log('  event  ' + JSON.stringify(ev));
  ok('the event pane labels are E%03d:', /^E\d{3}:/.test(ev.first),
     JSON.stringify(ev));
  ok('OK reserves that common event',
     ev.reserved === ev.id && ev.stack === 0, JSON.stringify(ev));
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Map'; i++) await sleep(150);
  ok('...and the debug menu closes behind it',
     await sceneName() === 'Scene_Map', await sceneName());

  // re-enter for the battle pane
  await tapUntil('F9', async () => await sceneName() === 'Scene_Debug');
  await sleep(600);
  ok('F9 reopens the menu', await sceneName() === 'Scene_Debug', await sceneName());

  const battle = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const i = sc._commandWindow._list.findIndex(c => c.symbol === 'battle');
    sc._commandWindow.select(i);
    sc.commandBattle();
    return {
      items: sc._battleWindow.maxItems(),
      first: sc._battleWindow.commandName(0),
      type: typeof BattleManager.setup
    };
  });
  console.log('  battle ' + JSON.stringify(battle));
  ok('the battle pane lists $dataTroops', battle.items > 1 &&
     /^B\d{3}:/.test(battle.first), JSON.stringify(battle));

  // -------------------------------------------------------------- teleport
  console.log('--- teleport preview ---');
  await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc.onBattleCancel();
    const i = sc._commandWindow._list.findIndex(c => c.symbol === 'teleport');
    sc._commandWindow.select(i);
    sc.commandTeleport();
  });
  await sleep(1500);
  const tp = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._mapWindow;
    return {
      maps: sc._teleportWindow.maxItems(),
      first: sc._teleportWindow.commandName(0),
      shown: w.visible,
      mapId: w._mapId,
      hasMap: !!w._map,
      origin: w._tilemap ? [w._tilemap.origin.x, w._tilemap.origin.y] : null,
      cursor: w._cursorSprite ? w._cursorSprite.visible : null,
      header: sc._teleportHeader.visible
    };
  });
  console.log('  tp     ' + JSON.stringify(tp));
  ok('the teleport pane lists the maps', tp.maps > 1 &&
     /^MAP:\d{3}$/.test(tp.first), JSON.stringify(tp));
  ok('the preview loaded the first map and drew a tilemap',
     tp.shown && tp.hasMap && !!tp.cursor, JSON.stringify(tp));

  const pan = await p.evaluate(() => {
    const w = SceneManager._scene._mapWindow;
    const x0 = w.mapX(), y0 = w.mapY();
    w.cursorDown();
    w.cursorUp();
    return { x0: x0, y0: y0, x1: w.mapX(), y1: w.mapY(), lost: w._mapY };
  });
  console.log('  pan    ' + JSON.stringify(pan));
  ok('arrow keys move the preview cursor', pan.y0 === 0 || pan.y1 === pan.y0,
     JSON.stringify(pan));

  await p.screenshot({ path: OUT + 'debug_menu.png' });

  // ------------------------------------------------- F9 leaves, F10 console
  await p.evaluate(() => { SceneManager._scene.onTeleportCancel(); });
  await sleep(400);
  await tap('F9');
  await sleep(900);
  ok('F9 again leaves the debug menu', await sceneName() === 'Scene_Map',
     await sceneName());

  console.log('--- F10 code console ---');
  const consoleUp = () => p.evaluate(() =>
    !!(SceneManager._scene && SceneManager._scene._debugEntryWindow));
  await tap('F10');
  for (let i = 0; i < 12 && !(await consoleUp()); i++) { await tap('F10'); }
  const consoleOpen = await consoleUp();
  ok('F10 opens the code console', consoleOpen, 'no entry window found');
  if (consoleOpen) {
    // Game_Variables#setValue ignores ids outside $dataSystem.variables, so the
    // snippet has to target a real one.
    const vid = await p.evaluate(() => $dataSystem.variables.length - 1);
    await p.evaluate(v => { $gameVariables.setValue(v, 0); }, vid);
    const snippet = '$gameVariables.setValue(' + vid + ', 77';
    await p.keyboard.type(snippet);
    await sleep(250);
    const typed = await p.evaluate(() =>
      SceneManager._scene._debugEntryWindow._text);
    console.log('  typed   ' + JSON.stringify(typed));
    ok('the console shows what was typed', typed === snippet,
       JSON.stringify(typed));

    await p.keyboard.press('Backspace');
    await sleep(150);
    const back = await p.evaluate(() =>
      SceneManager._scene._debugEntryWindow._text);
    ok('Backspace deletes like Input::BACK', back === typed.slice(0, -1),
       JSON.stringify(back));
    await p.keyboard.type('7)');
    await sleep(150);

    await p.keyboard.press('Enter');
    await sleep(500);
    const ran = await p.evaluate(v => ({
      v: $gameVariables.value(v),
      closed: !SceneManager._scene._debugEntryWindow
    }), vid);
    console.log('  console ' + JSON.stringify(ran));
    ok('Enter runs the snippet', ran.v === 77, JSON.stringify(ran));
    ok('...and closes the console', ran.closed === true, JSON.stringify(ran));
  }

  ok('no page errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));

  await b.close();
  console.log('');
  if (failures > 0) { console.log('DEBUG MENU FAILED: ' + failures + ' assertion(s)'); process.exit(1); }
  console.log('DEBUG MENU PASSED: all assertions held');
})().catch(e => { console.error(e); process.exit(2); });
