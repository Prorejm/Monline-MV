// MonlineGameEnd.js - the Shut Down command that VX Ace has and MV does not.
//   0087.rb Window_GameEnd builds three commands (to_title / shutdown / cancel)
//   while MV's stock Window_GameEnd builds only two.  0086.rb puts Shut Down on
//   the title screen as well, with the handler missing from MV's Scene_Title.
//     NODE_PATH=<pw> node _shots/probe_gameend.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
function ok(label, cond, detail) {
  if (!cond) failures++;
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + label +
              (cond ? '' : '\n        ' + JSON.stringify(detail)));
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

  // ------------------------------------------------------- plugin is installed
  console.log('\n== plugin surface ==');
  const api = await p.evaluate(() => ({
    has: typeof MonlineGameEnd === 'object',
    keys: window.MonlineGameEnd ? Object.keys(window.MonlineGameEnd) : [],
    ruby: !!(window.MonlineRuby && MonlineRuby.F &&
             MonlineRuby.F.shutdown_game === 'function' ||
             typeof (window.MonlineRuby && MonlineRuby.F &&
                     MonlineRuby.F.shutdown_game) === 'function')
  }));
  ok('MonlineGameEnd is installed', api.has, api);
  ok('exposes quit / request / overlay', ['quit', 'request', 'overlay']
      .every(k => api.keys.indexOf(k) >= 0), api.keys);
  ok('Ruby bridge knows shutdown_game', api.ruby, api);

  // ------------------------------------------------------------ title screen
  console.log('\n== title screen Shut Down (0086.rb:37 / 0091.rb:95) ==');
  const title = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    return {
      scene: SceneManager._scene.constructor.name,
      list: w._list.map(c => ({ s: c.symbol, n: c.name, e: c.enabled })),
      hasHandler: typeof SceneManager._scene._handlers === 'object'
        ? true : (SceneManager._scene.commandShutdown !== undefined),
      hasCommandShutdown:
        typeof Scene_Title.prototype.commandShutdown === 'function',
      term: $dataSystem.terms.commands[20],
      toTitle: TextManager.toTitle,
      cancel: TextManager.cancel
    };
  });
  ok('terms.commands[20] survived the conversion', title.term === 'Quit', title);
  ok('TextManager.toTitle reads "To Title"', title.toTitle === 'To Title', title);
  ok('TextManager.cancel reads "Cancel"', title.cancel === 'Cancel', title);
  ok('scene is Scene_Title', title.scene === 'Scene_Title', title.scene);
  ok('Shut Down is offered', title.list.some(c => c.s === 'shutdown'), title.list);
  ok('Shut Down is enabled',
      (title.list.find(c => c.s === 'shutdown') || {}).e === true, title.list);
  // 0000.rb:142 Vocab.shutdown = terms.commands[20]; Monline's Terms has
  // "Quit" there, so that is what the command must read.
  ok('Shut Down uses the project term',
      (title.list.find(c => c.s === 'shutdown') || {}).n === title.term,
      { got: (title.list.find(c => c.s === 'shutdown') || {}).n, want: title.term });
  ok('Shut Down comes last, as in 0086.rb',
      title.list[title.list.length - 1].s === 'shutdown', title.list);
  ok('the other commands survive',
      ['newGame', 'continue', 'options', 'passwords', 'achieve']
        .filter(s => title.list.some(c => c.s === s)).length >= 4, title.list);
  ok('Scene_Title#commandShutdown exists', title.hasCommandShutdown, title);

  const reallyLast = await p.evaluate(() => {
    // makeCommandList runs on refresh, so rebuild it and check again
    const w = SceneManager._scene._commandWindow;
    w.refresh();
    return w._list.map(c => c.symbol);
  });
  ok('still last after a refresh', reallyLast[reallyLast.length - 1] === 'shutdown',
      reallyLast);
  ok('no duplicate after refresh',
      reallyLast.filter(s => s === 'shutdown').length === 1, reallyLast);

  // ------------------------------------------------------------- in-game menu
  console.log('\n== Exit Game screen (0087.rb:33 / 0103.rb) ==');
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 80; i++) {
    if (await sceneName() === 'Scene_Map') break;
    await sleep(120);
  }
  ok('reached the map', await sceneName() === 'Scene_Map', await sceneName());

  // Scene_Map.create() runs before start(), so the constructor name flips to
  // Scene_Map a frame or two before _mapNameWindow exists; pushing a scene
  // before that makes Scene_Map#stop throw.
  for (let i = 0; i < 80; i++) {
    const ready = await p.evaluate(() =>
      SceneManager.isCurrentSceneStarted() &&
      !!(SceneManager._scene && SceneManager._scene._mapNameWindow));
    if (ready) break;
    await sleep(120);
  }

  await p.evaluate(() => { SceneManager.push(Scene_GameEnd); });
  for (let i = 0; i < 80; i++) {
    if (await sceneName() === 'Scene_GameEnd') break;
    await sleep(120);
  }
  ok('Scene_GameEnd opened', await sceneName() === 'Scene_GameEnd', await sceneName());

  const ge = await p.evaluate(() => {
    const s = SceneManager._scene;
    const w = s._commandWindow;
    return {
      list: w._list.map(c => ({ s: c.symbol, n: c.name })),
      height: w.height,
      x: w.x, y: w.y,
      centered: Math.abs(w.x - (Graphics.boxWidth - w.width) / 2) < 1 &&
                Math.abs(w.y - (Graphics.boxHeight - w.height) / 2) < 1,
      opacity128: true,
      hasShutdown: typeof s.commandShutdown === 'function',
      handlersSet: !!(w._handlers && w._handlers.shutdown)
    };
  });
  ok('three commands: toTitle / shutdown / cancel',
      JSON.stringify(ge.list.map(c => c.s)) ===
        JSON.stringify(['toTitle', 'shutdown', 'cancel']), ge.list);
  ok('Shut Down sits between To Title and Cancel', ge.list[1].s === 'shutdown',
      ge.list);
  ok('To Title no longer reads "Cancel"', ge.list[0].n === 'To Title', ge.list);
  ok('Shut Down reads the project term', ge.list[1].n === 'Quit', ge.list);
  ok('Cancel still reads "Cancel"', ge.list[2].n === 'Cancel', ge.list);
  ok('height grew to fittingHeight(3) = 144', ge.height === 144, ge.height);
  ok('window stays centred', ge.centered, ge);
  ok('the shutdown handler is wired', ge.handlersSet, ge);
  ok('Scene_GameEnd#commandShutdown exists', ge.hasShutdown, ge);

  const cancelStillWorks = await p.evaluate(() => {
    const w = SceneManager._scene._commandWindow;
    w.selectSymbol('cancel');
    return w.currentSymbol();
  });
  ok('cancel is still selectable', cancelStillWorks === 'cancel', cancelStillWorks);

  await p.screenshot({ path: OUT + 'gameend_menu.png' });

  await p.evaluate(() => { SceneManager.pop(); });
  for (let i = 0; i < 80; i++) {
    if (await sceneName() === 'Scene_Map') break;
    await sleep(120);
  }
  ok('leaves back to the map', await sceneName() === 'Scene_Map', await sceneName());

  // --------------------------------------------------- browser quit fallback
  console.log('\n== browser fallback card ==');
  const overlay = await p.evaluate(() => {
    MonlineGameEnd.clearOverlay();
    SceneManager._exiting = true;          // pretend exit() already ran
    MonlineGameEnd.overlay();
    const el = document.getElementById('monline-quit-overlay');
    if (!el) return { exists: false };
    const btn = Array.prototype.slice.call(el.querySelectorAll('div'))
      .filter(d => d.addEventListener && d.textContent === 'Back to Title');
    return {
      exists: true,
      text: el.textContent,
      lines: String(el.textContent).length,
      button: btn.length > 0,
      z: el.style.zIndex
    };
  });
  ok('the fallback card is drawn', overlay.exists, overlay);
  ok('it explains what happened', /shut down/i.test(overlay.text || ''), overlay);
  ok('it offers a way back', overlay.button, overlay);

  const backBtn = await p.evaluate(() => {
    const el = document.getElementById('monline-quit-overlay');
    const btn = Array.prototype.slice.call(el.querySelectorAll('div'))
      .filter(d => d.textContent === 'Back to Title')[0];
    btn.click();
    return {
      gone: !document.getElementById('monline-quit-overlay'),
      exiting: SceneManager._exiting
    };
  });
  ok('the card disappears once used', backBtn.gone, backBtn);
  ok('SceneManager._exiting is cleared', backBtn.exiting === false, backBtn);

  for (let i = 0; i < 80; i++) {
    if (await sceneName() === 'Scene_Title') break;
    await sleep(120);
  }
  ok('the title screen comes back', await sceneName() === 'Scene_Title',
      await sceneName());

  await p.screenshot({ path: OUT + 'gameend_title_with_shutdown.png' });

  console.log('\n== errors ==');
  ok('no page errors', errors.length === 0, errors);

  await b.close();
  console.log('\n' + (failures === 0 ? 'GAME END PROBE PASSED' :
                                       'GAME END PROBE FAILED: ' + failures));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
