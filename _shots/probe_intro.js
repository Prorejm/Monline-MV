// Verify the opening cutscene (Map014 event 5, autorun) actually runs.
//   node probe_intro.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  console.log('boot scene:', await p.evaluate(() => SceneManager._scene.constructor.name).catch(e => e.message));

  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(1500);

  const snap = () => p.evaluate(() => {
    const interp = $gameMap._interpreter;
    const ev5 = $gameMap.event(5);
    return {
      scene: SceneManager._scene.constructor.name,
      stopped: !!SceneManager._stopped,
      evRunning: $gameMap.isEventRunning(),
      msgBusy: $gameMessage.isBusy(),
      ev5Page: ev5 ? ev5._pageIndex : null,
      ev5trigger: ev5 ? (ev5.event().pages[ev5._pageIndex] || {}).trigger : null,
      selfSwitchA: $gameSelfSwitches.value([$gameMap.mapId(), 5, 'A']) === true,
      interpRunning: interp ? interp.isRunning() : null,
      interpIdx: interp ? interp._index : null,
      interpLen: interp ? (interp._list || []).length : null,
      rubyLoaded: !!window.MonlineRuby,
      rubyStats: window.MonlineRuby ? MonlineRuby.stats : null,
      rubyPendingKeys: window.MonlineRuby ? Object.keys(MonlineRuby.pending).length : -1,
      rubyTopPending: window.MonlineRuby
        ? Object.entries(MonlineRuby.pending).sort((a, c) => c[1] - a[1]).slice(0, 6) : null,
      rubyErrGroups: window.MonlineRuby ? MonlineRuby.report().groups.slice(0, 5) : null
    };
  }).catch(e => ({ err: e.message }));

  for (const label of ['t+1.5s', 't+4s', 't+8s']) {
    console.log(label + '  ' + JSON.stringify(await snap()));
    await sleep(label === 't+1.5s' ? 2500 : 4000);
  }

  // Now press OK a few times and see whether the interpreter advances.
  console.log('--- pressing OK x12 ---');
  for (let i = 0; i < 12; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; });
    await sleep(200);
  }
  console.log('after-ok  ' + JSON.stringify(await snap()));

  await p.screenshot({ path: OUT + 'probe_intro.png' });
  console.log('ERRORS ' + (errs.length ? errs.slice(0, 8).join(' || ') : 'none'));
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message + '\n' + e.stack); process.exit(2); });
