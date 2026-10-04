// "I can't even look at the player info / save & load isn't ported" - repro +
// regression for 0114.rb, the Ace Save Engine.
//   NODE_PATH=<pw> node _shots/probe_save_engine.js
//
// Drives the *real* save screen in a browser: 60 slots, the Load / Save /
// Delete bar, and the status panel that shows playtime, save count, gold,
// location and the party.  Save -> delete -> load is exercised end to end.
// Any page error is a hard failure.
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

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);

  // ------------------------------------------------------------- boot + map
  console.log('--- boot ---');
  ok('the game boots to the title', await sceneName() === 'Scene_Title',
     await sceneName());

  // clear every save slot first so the run is reproducible
  await p.evaluate(() => {
    for (let i = 1; i <= 60; i++) { StorageManager.remove(i); }
    StorageManager.save(0, JsonEx.stringify([]));
  });

  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Map'; i++) await sleep(200);
  ok('New Game reaches the map', await sceneName() === 'Scene_Map',
     await sceneName());
  // the map scene can only be left once its spriteset exists (Scene_Map#stop
  // closes it), so wait for it before pushing anything on top
  await p.waitForFunction(
    () => !!(SceneManager._scene && SceneManager._scene._spriteset),
    null, { timeout: 20000 });
  await sleep(800);

  await p.evaluate(() => {
    $gameParty.gainGold(4321);
    $gameVariables.setValue(1, 42);
    $gameTemp._probeMarker = 'saved-me';
  });

  // ------------------------------------------------------------ open Save
  console.log('--- the save screen ---');
  await p.evaluate(() => { SceneManager.push(Scene_Save); });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Save'; i++) await sleep(200);
  await sleep(600);
  ok('the save screen opens', await sceneName() === 'Scene_Save',
     await sceneName());

  const layout = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const names = c => c ? c.constructor.name : null;
    return {
      help: names(sc._helpWindow),
      file: names(sc._fileWindow),
      action: names(sc._actionWindow),
      status: names(sc._statusWindow),
      slots: sc._fileWindow.maxItems(),
      cmds: sc._actionWindow._list.map(c => ({ n: c.name, s: c.symbol, e: c.enabled })),
      fileW: sc._fileWindow.width,
      statusX: sc._statusWindow.x,
      statusY: sc._statusWindow.y,
      helpText: sc._helpWindow._text,
      maxSavefiles: DataManager.maxSavefiles()
    };
  });
  console.log('  layout ' + JSON.stringify(layout));
  ok('all four panes are built', layout.help === 'Window_Help' &&
     layout.file === 'Window_FileList' && layout.action === 'Window_FileAction' &&
     layout.status === 'Window_FileStatus', JSON.stringify(layout));
  ok('there are 60 slots, not MV\'s 20 (0114.rb:57)',
     layout.slots === 60 && layout.maxSavefiles === 60, JSON.stringify(layout));
  ok('the action bar is Load / Save / Delete',
     JSON.stringify(layout.cmds.map(c => c.n)) === '["Load","Save","Delete"]',
     JSON.stringify(layout.cmds));
  ok('the status pane sits to the right of the 128px file list',
     layout.fileW === 128 && layout.statusX === 128, JSON.stringify(layout));
  ok('the help line starts on the select prompt',
     layout.helpText === 'Please select a file slot.', JSON.stringify(layout));

  // ------------------------------------------------------------- save to #1
  console.log('--- saving ---');
  const saved = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._fileWindow.select(0);
    sc.onFileOk();                       // cursor jumps onto the action bar
    const landed = sc._actionWindow.index();
    const before = $gameSystem.saveCount();
    sc.onActionSave();
    const info = DataManager.loadSavefileInfo(1);
    return {
      landed: landed,
      stillOnSave: SceneManager._scene.constructor.name,
      before: before, after: $gameSystem.saveCount(),
      info: info && {
        saveCount: info.saveCount, gold: info.gold, location: info.location,
        playtime: info.playtime, members: info.members.length,
        member0: info.members[0].name
      },
      header: !!sc._statusWindow._header,
      actionEnabled: sc._actionWindow._list.map(c => c.enabled)
    };
  });
  console.log('  saved  ' + JSON.stringify(saved));
  ok('on the save screen the cursor lands on Save, not Load', saved.landed === 1,
     JSON.stringify(saved));
  ok('saving stays on the save screen, like 0114.rb:702',
     saved.stillOnSave === 'Scene_Save', JSON.stringify(saved));
  ok('$gameSystem.onBeforeSave ran, so the save count moved',
     saved.after === saved.before + 1, JSON.stringify(saved));
  ok('slot 1 now has a header', !!saved.info, JSON.stringify(saved));
  ok('the header carries the gold', saved.info && saved.info.gold === 4321,
     JSON.stringify(saved));
  ok('...the save count', saved.info && saved.info.saveCount === saved.after,
     JSON.stringify(saved));
  ok('...the map name', saved.info && typeof saved.info.location === 'string',
     JSON.stringify(saved));
  ok('...the playtime string', saved.info && /:/.test(saved.info.playtime || ''),
     JSON.stringify(saved));
  ok('...and the party', saved.info && saved.info.members >= 1,
     JSON.stringify(saved));
  ok('the status pane picked up the new header', saved.header === true,
     JSON.stringify(saved));
  ok('Load and Delete are now enabled on that slot',
     saved.actionEnabled[0] === true && saved.actionEnabled[2] === true,
     JSON.stringify(saved));

  await p.screenshot({ path: OUT + 'save_screen.png' });

  // --------------------------------------------------------------- load it
  console.log('--- loading ---');
  const loaded = await p.evaluate(() => {
    $gameParty.loseGold($gameParty.gold());
    $gameTemp._probeMarker = 'wiped';
    SceneManager.goto(Scene_Title);
    return true;
  });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Title'; i++) await sleep(200);
  await p.evaluate(() => { SceneManager.push(Scene_Load); });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Load'; i++) await sleep(200);
  await sleep(600);
  const ls = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._fileWindow.select(0);
    sc.onFileOk();
    return {
      landed: sc._actionWindow.index(),
      cmds: sc._actionWindow._list.map(c => ({ n: c.name, e: c.enabled })),
      emptyEnabled: sc._fileWindow.isCurrentItemEnabled.call(
        Object.assign(Object.create(Object.getPrototypeOf(sc._fileWindow)),
                      sc._fileWindow, { _index: 5 }))
    };
  });
  console.log('  load   ' + JSON.stringify(ls));
  ok('on the load screen the cursor lands on Load', ls.landed === 0,
     JSON.stringify(ls));
  ok('Save is disabled there', ls.cmds[1].e === false, JSON.stringify(ls));
  ok('an empty slot cannot be picked on the load screen',
     ls.emptyEnabled === false, JSON.stringify(ls));
  await p.screenshot({ path: OUT + 'load_screen.png' });

  await p.evaluate(() => { SceneManager._scene.onActionLoad(); });
  for (let i = 0; i < 80 && await sceneName() !== 'Scene_Map'; i++) await sleep(200);
  const restored = await p.evaluate(() => ({
    scene: SceneManager._scene.constructor.name,
    gold: $gameParty.gold(), v1: $gameVariables.value(1),
    map: $gameMap.mapId(), saveCount: $gameSystem.saveCount()
  }));
  console.log('  restored ' + JSON.stringify(restored));
  ok('loading drops straight back onto the map', restored.scene === 'Scene_Map',
     JSON.stringify(restored));
  ok('...with the gold back', restored.gold === 4321, JSON.stringify(restored));
  ok('...and a variable', restored.v1 === 42, JSON.stringify(restored));
  ok('...and the save count', restored.saveCount >= 1, JSON.stringify(restored));

  // --------------------------------------------------------------- deleting
  console.log('--- deleting ---');
  await p.evaluate(() => { SceneManager.push(Scene_Save); });
  for (let i = 0; i < 60 && await sceneName() !== 'Scene_Save'; i++) await sleep(200);
  await sleep(500);
  const del = await p.evaluate(() => {
    const sc = SceneManager._scene;
    sc._fileWindow.select(0);
    sc.onFileOk();
    sc.onActionDelete();
    return {
      info: DataManager.loadSavefileInfo(1),
      header: sc._statusWindow._header,
      cmds: sc._actionWindow._list.map(c => c.enabled),
      exists: StorageManager.exists(1)
    };
  });
  console.log('  delete ' + JSON.stringify(del));
  ok('deleting empties slot 1', del.info === null, JSON.stringify(del));
  ok('...and the file itself is gone', del.exists === false, JSON.stringify(del));
  ok('...and the status pane goes back to "No Save Data"',
     del.header === null, JSON.stringify(del));
  ok('...and Load / Delete grey out again',
     del.cmds[0] === false && del.cmds[2] === false, JSON.stringify(del));

  // ------------------------------------------------------ menu command / bridge
  const menu = await p.evaluate(() => {
    $gameSystem.disableSave();
    const w = new Window_MenuCommand(0, 0);
    const on = w.isSaveEnabled();
    $gameSystem.enableSave();
    return { on: on, max: MonlineRuby.F.savefile_max() };
  });
  console.log('  menu   ' + JSON.stringify(menu));
  ok('Save stays on the menu even when saving is disabled',
     menu.on === true, JSON.stringify(menu));
  ok('savefile_max is 60 through the Ruby bridge', menu.max === 60,
     JSON.stringify(menu));

  ok('no page errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));

  await b.close();
  console.log('');
  if (failures > 0) { console.log('SAVE ENGINE FAILED: ' + failures + ' assertion(s)'); process.exit(1); }
  console.log('SAVE ENGINE PASSED: all assertions held');
})().catch(e => { console.error(e); process.exit(2); });
