// Monline's own defeat screen (VX Ace 0254.rb "DT's GameOver +") plus the
// modern extras borrowed from TSF Dungeon's Kath_GameOver.
//   NODE_PATH=<pw> node _shots/probe_gameover.js
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

  // ------------------------------------------------------------- boot to map
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 80; i++) {
    const s = await sceneName();
    if (s === 'Scene_Map') break;
    await sleep(250);
  }
  ok('we reached the map', await sceneName() === 'Scene_Map', await sceneName());

  // ------------------------------------------------- the plugin is installed
  console.log('--- the plugin ---');
  const cfg = await p.evaluate(() => ({
    cfg: window.MonlineGameOver ? MonlineGameOver.CFG : null,
    hasWindowClass: typeof window.Window_GameOverCommand === 'function',
    revive: typeof $gameParty.reviveLeader
  }));
  console.log('  cfg    ' + JSON.stringify(cfg.cfg));
  ok('MonlineGameOver reports its settings', !!cfg.cfg, JSON.stringify(cfg));
  ok('the command window class exists', cfg.hasWindowClass);
  ok('Game_Party#reviveLeader exists', cfg.revive === 'function');
  ok('the window sits at the VX Ace spot (180,300) and is 160 wide',
     cfg.cfg.WIN_X === 180 && cfg.cfg.WIN_Y === 300 && cfg.cfg.WIN_W === 160,
     JSON.stringify(cfg.cfg));

  // -------------------------------------------- dying really reaches the GO
  console.log('--- dying ---');
  await p.evaluate(() => {
    $gameParty.members().forEach(function (m) { m.setHp(0); });
    SceneManager._scene.checkGameover();
    SceneManager.updateScene ? SceneManager.updateScene()
                             : SceneManager.update();
  });
  await sleep(1200);
  ok('an actual wipe-out opens the Game Over screen',
     await sceneName() === 'Scene_Gameover', await sceneName());

  const go = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const w = sc._commandWindow;
    const spr = sc._backSprite;
    return {
      symbols: w ? w._list.map(c => c.symbol) : null,
      names: w ? w._list.map(c => c.name) : null,
      enabled: w ? w._list.map(c => !!c.enabled) : null,
      x: w ? w.x : null, y: w ? w.y : null,
      width: w ? w.width : null, height: w ? w.height : null,
      rows: w ? w.numVisibleRows() : null,
      active: w ? w.active : null,
      selected: w ? w.index() : null,
      backBitmap: !!(spr && spr.bitmap),
      backName: spr && spr.bitmap ? spr.bitmap._url || '' : '',
      added: !!(spr && spr.parent)
    };
  });
  console.log('  screen ' + JSON.stringify(go));
  ok('the screen has a command window', Array.isArray(go.symbols),
     JSON.stringify(go));
  ok('it offers Load / To Title / Quit',
     JSON.stringify(go.symbols) === JSON.stringify(['load', 'title', 'quit']),
     JSON.stringify(go.symbols));
  ok('it is placed at 180,300 and is 160 wide',
     go.x === 180 && go.y === 300 && go.width === 160,
     JSON.stringify(go));
  ok('one visible row per command (VX Ace visible_line_number = item_max)',
     go.rows === 3 && go.height === 144,
     'rows=' + go.rows + ' height=' + go.height);
  ok('the window is active with the first command selected',
     go.active === true && go.selected === 0,
     JSON.stringify(go));
  ok('the GameOver picture is on screen',
     go.backBitmap && go.added && /GameOver/i.test(go.backName),
     JSON.stringify(go));
  ok('with no save yet, Load is greyed out',
     go.enabled[0] === false && go.enabled[1] === true && go.enabled[2] === true,
     JSON.stringify(go.enabled));

  await p.screenshot({ path: OUT + 'go_screen.png' });

  // ------------------------------- the stock "press a key" trap is defused
  // Stock MV reads the trigger before the windows update, so pressing OK
  // would run both the handler and gotoTitle.  Press OK and check that only
  // the handler's scene change survives.
  console.log('--- the input trap ---');
  const before = await sceneName();
  await p.evaluate(() => {
    // Load is disabled, so move to "To Title" first, then press OK.
    SceneManager._scene._commandWindow.select(1);
  });
  // Input only reports a button as triggered if a frame polls while it is
  // held, so the key has to stay down across at least one update.
  await p.keyboard.down('Enter');
  await sleep(300);
  await p.keyboard.up('Enter');
  await sleep(1500);
  const afterOk = await sceneName();
  console.log('  ' + before + ' --[Enter on To Title]--> ' + afterOk);
  ok('pressing OK runs the chosen command instead of always going to title',
     afterOk === 'Scene_Title', afterOk);

  // ------------------------------------------------------------ Load / Quit
  console.log('--- Load and Quit ---');
  await p.evaluate(() => { SceneManager.goto(Scene_Title); });
  await sleep(1500);
  await p.evaluate(() => {
    const sc = SceneManager._scene;
    if (sc && typeof sc.commandNewGame === 'function') { sc.commandNewGame(); }
  });
  for (let i = 0; i < 80; i++) {
    if (await sceneName() === 'Scene_Map') break;
    await sleep(250);
  }
  ok('a fresh run is back on the map', await sceneName() === 'Scene_Map',
     await sceneName());
  // Make a real save so Load lights up.
  await p.evaluate(() => {
    $gameSystem.onBeforeSave();
    DataManager.saveGame(1);
  });
  await sleep(800);
  const saved = await p.evaluate(() => ({
    any: DataManager.isAnySavefileExists(),
    last: DataManager.lastAccessedSavefileId()
  }));
  ok('a save file now exists', saved.any === true && saved.last === 1,
     JSON.stringify(saved));

  await p.evaluate(() => { SceneManager.goto(Scene_Gameover); });
  await sleep(1200);
  const go2 = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return { enabled: w._list.map(c => !!c.enabled) };
  });
  ok('Load lights up once there is a save', go2.enabled[0] === true,
     JSON.stringify(go2));

  await p.evaluate(() => { SceneManager._scene.commandLoad(); });
  await sleep(1200);
  const afterLoad = await sceneName();
  console.log('  GameOver --[Load]--> ' + afterLoad);
  ok('Load opens the load screen', /Scene_Load|Save/.test(afterLoad || ''),
     afterLoad);

  // Back out of the load screen - we must land on the Game Over screen again.
  await p.evaluate(() => {
    const sc = SceneManager._scene;
    if (typeof sc.popScene === 'function') { sc.popScene(); }
    else { SceneManager.pop(); }
  });
  await sleep(1200);
  ok('cancelling the load screen returns to the Game Over screen',
     await sceneName() === 'Scene_Gameover', await sceneName());

  // ------------------------------------------- modern: reload the last save
  console.log('--- reload last save (TSF Kath_GameOver) ---');
  await p.evaluate(() => {
    MonlineGameOver.CFG.RELOAD = true;
    SceneManager._scene.gotoTitle();
  });
  await sleep(2000);
  const afterReload = await p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    mapId: $gameMap.mapId(),
    alive: $gameParty.members().some(m => m.hp > 0)
  }));
  console.log('  reload ' + JSON.stringify(afterReload));
  ok('Game Over reloads the last save instead of the title',
     afterReload.scene === 'Scene_Map', JSON.stringify(afterReload));
  ok('the reloaded party is alive', afterReload.alive === true,
     JSON.stringify(afterReload));
  await p.evaluate(() => { MonlineGameOver.CFG.RELOAD = false; });

  // ------------------------------------- modern: after-game-over common event
  console.log('--- after game over common event ---');
  await p.evaluate(() => {
    MonlineGameOver.CFG.AFTER_EVENT = 1;
    SceneManager.goto(Scene_Gameover);
  });
  await sleep(1200);
  await p.evaluate(() => { SceneManager._scene.gotoTitle(); });
  await sleep(1500);
  const afterEv = await p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    reserved: $gameTemp.isCommonEventReserved(),
    eventId: $gameTemp._commonEventId,
    fadeOut: $gameScreen._fadeOut > 0 || $gameScreen._fadeOutDuration > 0
  }));
  console.log('  after  ' + JSON.stringify(afterEv));
  ok('the after-game-over common event is reserved on a map scene',
     afterEv.scene === 'Scene_Map' && afterEv.reserved === true &&
       afterEv.eventId === 1, JSON.stringify(afterEv));
  await p.evaluate(() => { MonlineGameOver.CFG.AFTER_EVENT = 0; });

  // ---------------------------------------- modern: party death common event
  console.log('--- party death common event ---');
  await p.evaluate(() => {
    MonlineGameOver.CFG.DEATH_EVENT = 2;
    $gameParty.members().forEach(function (m) { m.setHp(0); });
    SceneManager._scene.checkGameover();
  });
  await sleep(800);
  const death = await p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    reserved: $gameTemp.isCommonEventReserved(),
    eventId: $gameTemp._commonEventId,
    leaderHp: $gameParty.leader() ? $gameParty.leader().hp : -1
  }));
  console.log('  death  ' + JSON.stringify(death));
  ok('death runs the common event instead of the Game Over screen',
     death.scene === 'Scene_Map' && death.reserved === true &&
       death.eventId === 2, JSON.stringify(death));
  ok('the leader is revived to 1 HP so the event can run',
     death.leaderHp === 1, JSON.stringify(death));
  await p.evaluate(() => { MonlineGameOver.CFG.DEATH_EVENT = 0; });

  // ---------------------------------------------------------- plugin command
  console.log('--- plugin command ---');
  const pc = await p.evaluate(() => {
    const gi = new Game_Interpreter();
    gi.pluginCommand('GameOver', ['Reload', 'on']);
    const on = MonlineGameOver.CFG.RELOAD;
    gi.pluginCommand('GameOver', ['Reload', 'toggle']);
    const off = MonlineGameOver.CFG.RELOAD;
    gi.pluginCommand('GameOver', ['ShowScene', 'off']);
    const scene = MonlineGameOver.CFG.SHOW_SCENE;
    gi.pluginCommand('GameOver', ['ShowScene', 'on']);
    return { on, off, scene, back: MonlineGameOver.CFG.SHOW_SCENE };
  });
  console.log('  cmd    ' + JSON.stringify(pc));
  ok('GameOver Reload on / toggle works',
     pc.on === true && pc.off === false, JSON.stringify(pc));
  ok('GameOver ShowScene off / on works',
     pc.scene === false && pc.back === true, JSON.stringify(pc));

  // ------------------------------------------------------------------ errors
  console.log('--- errors ---');
  ok('no javascript errors along the way', errors.length === 0,
     errors.join('\n        '));

  await b.close();
  console.log(failures === 0
    ? '\nGAME OVER PASSED: all assertions held'
    : '\nGAME OVER FAILED: ' + failures + ' assertion(s)');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('THREW: ' + e.stack); process.exit(2); });
