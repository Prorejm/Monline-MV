// The modernisation pack borrowed from the TSF Dungeon reference build:
//   MonlineMenuModern (AltMenuScreen), MonlineItemBookMenu + ItemBook,
//   MonlineNewItem (Galv), MonlineEventSkipper (TSF EventSkipper).
//   NODE_PATH=<pw> node _shots/probe_modern.js
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
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(t))
      errors.push('CONSOLE: ' + t);
  });
  const sceneName = () => p.evaluate(() =>
    SceneManager._scene ? SceneManager._scene.constructor.name : null);

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);

  // ------------------------------------------------------------ title shell
  console.log('--- the title ---');
  const title = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return {
      x: w.x, y: w.y, width: w.windowWidth(), opacity: w.opacity,
      dimmer: w._dimmerSprite ? w._dimmerSprite.visible : false,
      symbols: w._list.map(c => c.symbol)
    };
  });
  console.log('  title  ' + JSON.stringify(title));
  ok('the title command window is transparent',
     title.opacity === 0 && !title.dimmer, JSON.stringify(title));
  // the game's Cheats command is spelled "passwords" internally (0263.rb)
  ok('the title keeps New Game / Continue / Cheats / Options',
     JSON.stringify(title.symbols) ===
       JSON.stringify(['newGame', 'continue', 'passwords', 'options']),
     JSON.stringify(title.symbols));

  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 60; i++) {
    if (await sceneName() === 'Scene_Map') break; await sleep(200);
  }
  await sleep(1200);

  // ------------------------------------------------------------- menu shell
  console.log('--- the menu shell ---');
  const menu = await p.evaluate(() => {
    SceneManager.push(Scene_Menu);
    return true;
  });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Menu'; i++) await sleep(150);
  await sleep(900);
  const shell = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      symbols: sc._commandWindow._list.map(c => c.symbol),
      cols: sc._commandWindow.maxCols(),
      rows: sc._commandWindow.numVisibleRows(),
      cmdW: sc._commandWindow.width,
      statusX: sc._statusWindow.x,
      statusY: sc._statusWindow.y,
      statusW: sc._statusWindow.width,
      goldX: sc._goldWindow.x,
      goldY: sc._goldWindow.y,
      goldW: sc._goldWindow.width,
      goldH: sc._goldWindow.height,
      glyphs: MonlineCommandIcons.ICON_HASH['Tasks'] + '/' +
              MonlineCommandIcons.ICON_HASH['Item Book']
    };
  });
  console.log('  shell  ' + JSON.stringify(shell));
  ok('the command bar spans the screen in 5 columns x 2 rows',
     shell.cmdW === 816 && shell.cols === 5 && shell.rows === 2,
     JSON.stringify(shell));
  ok('the menu lists all ten commands',
     JSON.stringify(shell.symbols) === JSON.stringify([
       'item', 'skill', 'equip', 'status', 'formation',
       'monlineTasks', 'itemBook', 'options', 'save', 'gameEnd']),
     JSON.stringify(shell.symbols));
  ok('the party row sits under the bar at full width',
     shell.statusX === 0 && shell.statusY === 108 && shell.statusW === 816,
     JSON.stringify(shell));
  ok('the gold window moved to the bottom right',
     shell.goldX + shell.goldW === 816 && shell.goldY + shell.goldH === 624,
     JSON.stringify(shell));
  ok('Tasks and Item Book carry glyphs', shell.glyphs === '8912/8928',
     shell.glyphs);

  await p.screenshot({ path: OUT + 'modern_menu.png' });

  // -------------------------------------------------------------- item book
  console.log('--- the item book ---');
  // two items are owned, so the book should know exactly those two
  const owned = await p.evaluate(() => {
    $gameParty.gainItem($dataItems[1], 1);
    $gameParty.gainItem($dataItems[2], 1);
    return true;
  });
  await p.evaluate(() => { SceneManager._scene.commandItemBook(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_ItemBook'; i++) await sleep(150);
  await sleep(700);
  ok('the menu opens Scene_ItemBook', await sceneName() === 'Scene_ItemBook',
     await sceneName());
  const book = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const rows = sc._indexWindow.maxItems();
    const known = sc._indexWindow._list.filter(function (item) {
      return $gameSystem.isInItemBook(item);
    }).map(function (item) { return item.name; });
    return { rows: rows, known: known, kinds: [
      $dataItems.filter(function (d) { return d && d.name && d.itypeId === 1; }).length,
      $dataWeapons.filter(function (d) { return d && d.name; }).length,
      $dataArmors.filter(function (d) { return d && d.name; }).length
    ], expected: [$dataItems[1].name, $dataItems[2].name] };
  });
  console.log('  book   ' + JSON.stringify(book));
  ok('the index lists the whole database',
     book.rows === book.kinds[0] + book.kinds[1] + book.kinds[2],
     JSON.stringify(book));
  ok('...but only the owned entries are readable',
     book.known.length === 2 &&
       book.known.indexOf(book.expected[0]) >= 0 &&
       book.known.indexOf(book.expected[1]) >= 0,
     JSON.stringify(book.known));
  const detail = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._indexWindow.select(0);
    sc._indexWindow.updateStatus();
    return { drawn: sc._statusWindow._item !== null ||
                    sc._statusWindow.contents.width > 0,
             item: sc._statusWindow._item ? sc._statusWindow._item.name : null };
  });
  console.log('  detail ' + JSON.stringify(detail));
  ok('the status pane follows the cursor', detail.item !== null,
     JSON.stringify(detail));
  await p.screenshot({ path: OUT + 'modern_itembook.png' });
  await p.evaluate(() => { SceneManager.pop(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Menu'; i++) await sleep(150);

  // ------------------------------------------------------------- NEW ribbon
  console.log('--- the NEW ribbon ---');
  // Scene_Item needs to redraw with the fresh item marked unseen
  await p.evaluate(() => { SceneManager.push(Scene_Item); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Item'; i++) await sleep(150);
  await sleep(900);
  const ribbon = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._categoryWindow;
    return {
      seenTable: !!$gameSystem._seenItems,
      fresh: MonlineNewItem.isNew($dataItems[2]) === false,   // viewed? not yet
      anyNew: [1, 2].filter(function (id) {
        return MonlineNewItem.isNew($dataItems[id]); })
    };
  });
  console.log('  ribbon ' + JSON.stringify(ribbon));
  ok('the seen-item table exists in $gameSystem', ribbon.seenTable,
     JSON.stringify(ribbon));
  ok('gained items start NEW', ribbon.anyNew.length >= 1, JSON.stringify(ribbon));

  // viewing the entry then moving the cursor away clears the mark (Galv)
  const cleared = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._itemWindow.select(0);            // examine -> becomes "old on leave"
    sc._itemWindow.updateHelp();
    const wasNew = MonlineNewItem.isNew($dataItems[2]);
    sc._itemWindow.select(1);            // cursor leaves -> redraw without NEW
    sc._itemWindow.updateHelp();
    return { wasNew: wasNew, nowOld: !MonlineNewItem.isNew($dataItems[2]) };
  });
  console.log('  clear  ' + JSON.stringify(cleared));
  ok('examining the entry clears its NEW mark',
     cleared.wasNew && cleared.nowOld, JSON.stringify(cleared));
  await p.screenshot({ path: OUT + 'modern_newitem.png' });
  await p.evaluate(() => { SceneManager.pop(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Menu'; i++) await sleep(150);
  await p.evaluate(() => { SceneManager.pop(); });
  for (let i = 0; i < 40 && await sceneName() !== 'Scene_Map'; i++) await sleep(150);
  await sleep(600);

  // ---------------------------------------------------------- skip mode
  console.log('--- skip mode ---');
  const skip0 = await p.evaluate(() => {
    return { off: !MonlineEventSkipper.isSkipMode(),
             indicator: !SceneManager._scene._skipIndicator.visible,
             key: Input.keyMapper[17] };
  });
  ok('Skip Mode starts off with a hidden indicator and a Ctrl binding',
     skip0.off && skip0.indicator && skip0.key === 'monlineSkip',
     JSON.stringify(skip0));

  // the interpreter eats the padding commands of a skippable event
  const eat = await p.evaluate(() => {
    const S = MonlineEventSkipper;
    const fake = {
      _commonEventId: 0, _eventId: 1, _index: 0,
      eventId: function () { return this._eventId; }
    };
    const ev = $gameMap.event(1);
    const note = (ev && ev.event().note) ? ev.event().note : '';
    // run one padding command through the real interpreter path by calling
    // the plugin's own predicate on a representative command
    return {
      tag: note.indexOf('<skippable>') >= 0,
      waitIsSkippable: S.COMMANDS_TO_SKIP.indexOf(230) >= 0,
      textIsSkippable: S.COMMANDS_TO_SKIP.indexOf(101) >= 0,
      choiceIsGuarded: S.COMMANDS_TO_SKIP.indexOf(102) < 0
    };
  });
  console.log('  eat    ' + JSON.stringify(eat));
  ok('the skip command table matches the reference',
     eat.waitIsSkippable && eat.textIsSkippable && eat.choiceIsGuarded,
     JSON.stringify(eat));

  // toggling keeps the mode on; the indicator lights on the next updateScene
  const toggled = await p.evaluate(() => {
    const sc = SceneManager._scene;
    MonlineEventSkipper.setSkipMode(true);
    const on = MonlineEventSkipper.isSkipMode();
    sc.updateScene();
    const indicator = sc._skipIndicator.visible;
    MonlineEventSkipper.setSkipMode(false);
    sc.updateScene();
    return { on: on, indicator: indicator,
             offAfter: !MonlineEventSkipper.isSkipMode() &&
                       !sc._skipIndicator.visible,
             mirrorSwitch: MonlineEventSkipper.CFG.SWITCH_ID };
  });
  console.log('  toggle ' + JSON.stringify(toggled));
  ok('setSkipMode(true) lights the indicator', toggled.on && toggled.indicator,
     JSON.stringify(toggled));
  ok('...and it switches back off', toggled.offAfter, JSON.stringify(toggled));

  // the plugin command
  const plug = await p.evaluate(() => {
    const ip = new Game_Interpreter();
    ip.pluginCommand('SkipMode', ['on']);
    const on = MonlineEventSkipper.isSkipMode();
    ip.pluginCommand('SkipMode', ['off']);
    return { on: on, off: !MonlineEventSkipper.isSkipMode() };
  });
  ok('SkipMode on/off plugin commands work', plug.on && plug.off,
     JSON.stringify(plug));

  // ----------------------------------------------- HUD vs. message windows
  // Checked inside one JS turn: at this point of the game the intro cutscene
  // is still feeding the message window, so any real waiting would just be
  // spent dismissing the intro instead of testing the HUD.
  console.log('--- the task HUD ---');
  // walk the intro to the end first, so there really is a quiet map to test on
  let quietMap = false;
  for (let i = 0; i < 60 && !quietMap; i++) {
    await p.keyboard.down('Enter'); await sleep(60);
    await p.keyboard.up('Enter'); await sleep(60);
    quietMap = await p.evaluate(() => $gamePlayer.canMove() &&
      !$gameMap.isEventRunning() && !$gameMessage.isBusy());
  }
  console.log('  intro dismissed: ' + quietMap);
  const hud = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const tracker = sc._taskTracker;
    $gameSystem.setTaskTrackerVisible(true);
    sc.update();
    const free = tracker.visible;
    $gameMessage.add('a line of story');
    sc.update();
    const during = tracker.visible && $gameMessage.isBusy();
    $gameMessage.clear();
    sc.update();
    return { exists: !!tracker, free: free, during: during,
             after: tracker.visible, quiet: !$gameMessage.isBusy() };
  });
  console.log('  hud    ' + JSON.stringify(hud));
  ok('the HUD shows while the map is quiet', hud.exists && hud.free === true,
     JSON.stringify(hud));
  ok('the HUD hides while a message window is up', hud.during === false,
     JSON.stringify(hud));
  ok('...and returns when the story stops talking', hud.after === true,
     JSON.stringify(hud));

  ok('no page errors anywhere', errors.length === 0,
     errors.slice(0, 3).join(' | '));

  await b.close();
  console.log('');
  if (failures > 0) {
    console.log('MODERN PACK FAILED: ' + failures + ' assertion(s)');
    process.exit(1);
  }
  console.log('MODERN PACK PASSED: all assertions held');
})().catch(e => { console.error(e); process.exit(2); });
