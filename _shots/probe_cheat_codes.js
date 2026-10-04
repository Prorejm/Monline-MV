// "Why is Cheat not ported?" - repro + regression for 0263.rb.
//   NODE_PATH=<pw> node _shots/probe_cheat_codes.js
//
// Drives the real title screen: the "Cheats" command has to exist and open
// Scene_CodeInput, a typed code has to be validated against the real code
// table, and the effect has to land when New Game starts (or immediately, for
// the SKIP* / IDDQD stage codes).  Any page error is a hard failure.
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
    if (t.indexOf('POK ') === 0) { console.log('    ' + t); }
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(t))
      errors.push('CONSOLE: ' + t);
  });

  const snap = () => p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    stopped: !!SceneManager._stopped,
    showed: !!Graphics._errorShowed,
    err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
           .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300),
    stack: SceneManager._stack ? SceneManager._stack.map(s => s.name || String(s)) : []
  }));

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => {
    const _po = Window_Command.prototype.processOk;
    Window_Command.prototype.processOk = function () {
      console.log('POK ' + this.constructor.name + ' idx=' + this.index() +
                  ' sym=' + this.currentSymbol());
      return _po.apply(this, arguments);
    };
  });
  await sleep(7000);

  // ------------------------------------------------------ the title command
  console.log('--- title screen ---');
  let s = await snap();
  console.log('  boot   ' + JSON.stringify(s));
  ok('the game boots to the title', s.scene === 'Scene_Title', JSON.stringify(s));

  const cmds = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return w._list.map(c => ({ name: c.name, symbol: c.symbol }));
  });
  console.log('  cmds   ' + JSON.stringify(cmds));
  const cheatIdx = cmds.findIndex(c => c.symbol === 'passwords');
  ok('a "Cheats" command exists on the title', cheatIdx >= 0, JSON.stringify(cmds));
  ok('it is the third command, as in 0263.rb:1275', cheatIdx === 2, JSON.stringify(cmds));
  ok('it is labelled with RIFF::CHEAT::CODESCENE_BUTTON',
     cheatIdx >= 0 && cmds[cheatIdx].name === 'Cheats', JSON.stringify(cmds));

  // Walk there with real keys: down, down, ok.
  const setKeys = (k) => p.evaluate(k => {
    ['ok', 'cancel', 'escape', 'down', 'up', 'left', 'right', 'shift']
      .forEach(x => { Input._currentState[x] = false; });
    if (k) { Input._currentState[k] = true; }
  }, k);
  const tap = async (k, n) => {
    for (let i = 0; i < (n === undefined ? 1 : n); i++) {
      await setKeys(k); await sleep(60); await setKeys(null); await sleep(60);
    }
  };

  console.log('--- open the Cheats screen with the keyboard ---');
  await openCheats();
  s = await snap();
  console.log('  open   ' + JSON.stringify(s));
  ok('Cheats opens Scene_CodeInput', s.scene === 'Scene_CodeInput', JSON.stringify(s));

  const win = await p.evaluate(() => {
    const sc = SceneManager._scene;
    return {
      edit: !!sc._editWindow, check: !!sc._checkWindow, input: !!sc._inputWindow,
      max: sc._editWindow ? sc._editWindow._maxLength : -1,
      table: sc._inputWindow ? sc._inputWindow.table()[0].slice(87) : [],
      isOk: sc._inputWindow ? sc._inputWindow.isOk() : null,
      isPage: sc._inputWindow ? sc._inputWindow.isPageChange() : null
    };
  });
  console.log('  wins   ' + JSON.stringify(win));
  ok('edit / check / input windows exist',
     win.edit && win.check && win.input, JSON.stringify(win));
  ok('the field is RIFF::CHEAT::CODE_LENGTH long', win.max === 10, JSON.stringify(win));
  ok('the modified table ends Leave, OK',
     JSON.stringify(win.table) === JSON.stringify([' ', 'Leave', 'OK']),
     JSON.stringify(win.table));

  // ------------------------------------------------------------- typing
  // A player picks cells with the cursor; the route into onInputOk is the same
  // either way, so the characters are added and OK is pressed on the window.
  const typeCode = (code) => p.evaluate(code => {
    const sc = SceneManager._scene;
    code.split('').forEach(ch => { sc._editWindow.add(ch); });
    const typed = sc._editWindow.name();
    sc._inputWindow._index = 89;
    sc._inputWindow.processOk();
    return { typed: typed, name: sc._currentCodeName ||
             (MonlineCheatCodes.pending.length
               ? MonlineCheatCodes.pending[MonlineCheatCodes.pending.length - 1].name
               : null),
             pending: MonlineCheatCodes.pending.length,
             after: sc._editWindow.name() };
  }, code);

  // Returning to the title is a scene transition with a fade, so poll for it
  // rather than guessing a sleep - the map can be busy when asked.
  // The title remembers the last command you used (Window_TitleCommand
  // ._lastCommandSymbol, rpg_windows.js:5755), so after the first visit the
  // cursor is already on "Cheats".  Work out the number of presses instead of
  // hard-coding two.
  async function openCheats() {
    const info = await p.evaluate(() => {
      const w = SceneManager._scene._commandWindow;
      return { idx: w.index(), n: w._list.length, sym: w.currentSymbol(),
               list: w._list.map(c => c.symbol),
               cheat: w._list.findIndex(c => c.symbol === 'passwords'),
               last: Window_TitleCommand._lastCommandSymbol };
    });
    const steps = (info.cheat - info.idx + info.n) % info.n;
    await tap('down', steps);
    await tap('ok');
    await sleep(2000);
    const after = await p.evaluate(() => ({
      scene: SceneManager._scene.constructor.name,
      idx: SceneManager._scene._commandWindow ? SceneManager._scene._commandWindow.index() : -1,
      open: SceneManager._scene._commandWindow ? SceneManager._scene._commandWindow.isOpen() : null,
      act: SceneManager._scene._commandWindow ? SceneManager._scene._commandWindow.active : null
    }));
    console.log('  cheats ' + JSON.stringify(info) + ' -> ' + JSON.stringify(after));
    return info;
  }

  const backToTitle = async () => {
    await p.evaluate(() => { SceneManager.goto(Scene_Title); });
    for (let i = 0; i < 60; i++) {
      const now = await p.evaluate(() => (SceneManager._scene && SceneManager._scene._commandWindow)
        ? SceneManager._scene.constructor.name : null);
      if (now === 'Scene_Title') { break; }
      await sleep(200);
    }
    await p.evaluate(() => {
      const sc = SceneManager._scene;
      if (sc && sc._commandWindow) {
        sc._commandWindow.open(); sc._commandWindow.activate();
      }
    });
    await sleep(400);
    const st = await p.evaluate(() => ({
      scene: SceneManager._scene.constructor.name,
      idx: SceneManager._scene._commandWindow
        ? SceneManager._scene._commandWindow.index() : -1,
      active: SceneManager._scene._commandWindow
        ? SceneManager._scene._commandWindow.active : null
    }));
    console.log('  title  ' + JSON.stringify(st));
  };

  // ---------------------------------------------------------- invalid code
  console.log('--- an unknown code ---');
  const bad = await typeCode('BOGUS');
  console.log('  bogus  ' + JSON.stringify(bad));
  ok('an unknown code is refused', bad.pending === 0, JSON.stringify(bad));
  ok('the field is cleared after a refusal', bad.after === '', JSON.stringify(bad));
  ok('no error from a refusal', errors.length === 0, errors.slice(0, 2).join(' | '));

  // ---------------------------------------------------------- baseline gold
  console.log('--- baseline New Game ---');
  await backToTitle();
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  await sleep(4000);
  const base = await p.evaluate(() => ({
    gold: $gameParty.gold(), map: $gameMap.mapId(), v99: $gameVariables.value(99)
  }));
  console.log('  base   ' + JSON.stringify(base));
  ok('New Game without codes does not add gold', base.gold === 0, JSON.stringify(base));

  // --------------------------------------------------------------- Rosebud
  console.log('--- Rosebud (+1000G) ---');
  await backToTitle();
  await openCheats();
  const rose = await typeCode('Rosebud');
  console.log('  typed  ' + JSON.stringify(rose));
  ok('Rosebud is recognised', rose.pending === 1 && rose.name === '1000G Added',
     JSON.stringify(rose));

  await p.evaluate(() => { SceneManager._scene.popScene(); });
  await sleep(1200);
  s = await snap();
  ok('leaving the code screen returns to the title', s.scene === 'Scene_Title',
     JSON.stringify(s));

  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  await sleep(4000);
  const gold = await p.evaluate(() => $gameParty.gold());
  console.log('  gold   ' + JSON.stringify({ base: base.gold, now: gold }));
  ok('Rosebud added 1000G on New Game', gold === base.gold + 1000,
     JSON.stringify({ base: base.gold, now: gold }));
  ok('the pending list was consumed',
     await p.evaluate(() => MonlineCheatCodes.pending.length) === 0);

  // --------------------------------------------------- Kenkou / Arena / gear
  console.log('--- Kenkou, Arena, IDCHOPPERS, Zelda (stacked) ---');
  await backToTitle();
  await openCheats();
  const stacked = await p.evaluate(() => {
    const sc = SceneManager._scene;
    const out = [];
    ['Kenkou', 'Arena', 'IDCHOPPERS', 'Zelda'].forEach(code => {
      code.split('').forEach(ch => { sc._editWindow.add(ch); });
      sc._inputWindow._index = 89;
      sc._inputWindow.processOk();
    });
    return out;
  });
  console.log('  typed  ' + JSON.stringify(stacked));
  const pend = await p.evaluate(() => MonlineCheatCodes.pending.map(c => c.name));
  console.log('  pend   ' + JSON.stringify(pend));
  ok('four codes are queued', pend.length === 4, JSON.stringify(pend));

  await p.evaluate(() => { SceneManager._scene.popScene(); });
  await sleep(1200);
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  await sleep(4000);
  const effect = await p.evaluate(() => {
    const want = [];
    for (let i = 101; i <= 180; i++) { if (i !== 144) { want.push(i); } }
    return {
      missing: want.filter(i => !$gameSwitches.value(i)),
      skip144: $gameSwitches.value(144),
      arena: $gameSwitches.value(46),
      chainsaw: $gameParty.hasItem($dataWeapons[31]),
      tunic: $gameParty.hasItem($dataArmors[57]),
      pending: MonlineCheatCodes.pending.length
    };
  });
  console.log('  effect ' + JSON.stringify(effect));
  ok('Kenkou turned exactly its 79 switches',
     effect.missing.length === 0 && effect.skip144 === false, JSON.stringify(effect));
  ok('Arena unlocked switch 46', effect.arena === true, JSON.stringify(effect));
  ok('IDCHOPPERS added weapon 31', effect.chainsaw === true, JSON.stringify(effect));
  ok('Zelda added armor 57', effect.tunic === true, JSON.stringify(effect));
  ok('the queue is emptied once applied', effect.pending === 0, JSON.stringify(effect));

  // ------------------------------------------------------- SKIP1 (stage code)
  console.log('--- SKIP1 (stage code, immediate restart) ---');
  await backToTitle();
  await openCheats();
  const skip1 = await typeCode('SKIP1');
  console.log('  typed  ' + JSON.stringify(skip1));
  await sleep(6000);
  const stage = await p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null,
    map: $gameMap.mapId(),
    x: $gamePlayer.x, y: $gamePlayer.y,
    v99: $gameVariables.value(99),
    stack: SceneManager._stack.length,
    pending: MonlineCheatCodes.pending.length
  }));
  console.log('  stage  ' + JSON.stringify(stage));
  s = await snap();
  ok('a stage code jumps straight into the map',
     stage.scene === 'Scene_Map', JSON.stringify(stage));
  ok('SKIP1 lands on map 238 at (8,6)',
     stage.map === 238 && stage.x === 8 && stage.y === 6, JSON.stringify(stage));
  ok('SKIP1 set variable 99 to 1', stage.v99 === 1, JSON.stringify(stage));
  ok('the return stack was cleared (0263.rb:913)', stage.stack === 0, JSON.stringify(stage));
  ok('the interpreter ran inside the jump', stage.pending === 0, JSON.stringify(stage));
  ok('no crash from the stage jump', !s.stopped && !s.showed && !s.err, JSON.stringify(s));

  // -------------------------------------------------------------- IDDQD
  console.log('--- IDDQD (God Mode) ---');
  await backToTitle();
  await openCheats();
  await typeCode('IDDQD');
  await sleep(6000);
  const god = await p.evaluate(() => ({
    map: $gameMap.mapId(), v99: $gameVariables.value(99),
    scene: SceneManager._scene.constructor.name
  }));
  console.log('  god    ' + JSON.stringify(god));
  ok('IDDQD sets variable 99 to 99', god.v99 === 99, JSON.stringify(god));
  ok('IDDQD also lands on map 238', god.map === 238, JSON.stringify(god));

  // --------------------------------------------- codes survive a save/load
  console.log('--- codes apply on Continue too (0263.rb:1320) ---');
  const reload = await p.evaluate(() => {
    // Scene_Load#on_load_success runs the interpreter after the save is in.
    const okSave = DataManager.saveGame(1);
    const before = $gameVariables.value(99);
    $gameVariables.setValue(99, 0);
    MonlineCheatCodes.pending.push(
      new MonlineCheatCodes.Cheat_Code('God Mode', ['set_variable(99, 99)']));
    // a real instance, not a bare object: onLoadSuccess -> fadeOutAll
    const sl = new Scene_Load();
    sl.create();
    Scene_Load.prototype.onLoadSuccess.call(sl);
    return { okSave: okSave, before: before, after: $gameVariables.value(99),
             pending: MonlineCheatCodes.pending.length };
  });
  console.log('  load   ' + JSON.stringify(reload));
  ok('a save can be written', reload.okSave === true, JSON.stringify(reload));
  ok('Scene_Load#onLoadSuccess runs the interpreter',
     reload.after === 99 && reload.pending === 0, JSON.stringify(reload));

  await p.screenshot({ path: OUT + 'cheat_codes.png' });
  await b.close();
  console.log('');
  console.log(failures ? 'CHEAT CODES FAILED: ' + failures + ' assertion(s)'
                       : 'CHEAT CODES PASSED: all assertions held');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(2); });
