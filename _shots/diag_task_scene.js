// why does Scene_Task never appear?
const { chromium } = require('playwright-core');
const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  p.on('pageerror', e => console.log('PAGEERROR: ' + e.message + '\n' +
       (e.stack || '').split('\n').slice(0, 8).join('\n')));
  p.on('console', m => {
    if (m.type() === 'error') console.log('CONSOLE-ERR: ' + m.text());
  });
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 60; i++) {
    const n = await p.evaluate(() => SceneManager._scene &&
      SceneManager._scene.constructor.name);
    if (n === 'Scene_Map') break; await sleep(200);
  }
  await sleep(1500);

  console.log('at map: ' + await p.evaluate(() => SceneManager._scene.constructor.name));

  // route 1: straight push from the map
  await p.evaluate(() => { SceneManager.push(Scene_Task); });
  await sleep(2000);
  console.log('direct push -> ' + await p.evaluate(() => JSON.stringify({
    scene: SceneManager._scene.constructor.name,
    next: SceneManager._nextScene ? SceneManager._nextScene.constructor.name : null,
    keys: Object.keys(SceneManager._scene).filter(k => /Window$/.test(k))
  })));
  await p.evaluate(() => { SceneManager.pop(); });
  await sleep(1500);

  // route 2: through the menu, the way the probe does it
  await p.evaluate(() => { SceneManager.push(Scene_Menu); });
  for (let i = 0; i < 40; i++) {
    const n = await p.evaluate(() => SceneManager._scene.constructor.name);
    if (n === 'Scene_Menu') break; await sleep(150);
  }
  await sleep(1000);
  console.log('at menu: ' + await p.evaluate(() => JSON.stringify({
    scene: SceneManager._scene.constructor.name,
    busy: SceneManager._scene.isBusy(),
    hasHandler: !!(SceneManager._scene.commandTasks)
  })));

  const r = await p.evaluate(() => {
    try {
      SceneManager._scene.commandTasks();
      return { thrown: false };
    } catch (e) {
      return { thrown: true, msg: e.message, stack: (e.stack || '').split('\n').slice(0, 6) };
    }
  });
  console.log('commandTasks -> ' + JSON.stringify(r));

  for (let i = 0; i < 20; i++) {
    await sleep(250);
    const st = await p.evaluate(() => JSON.stringify({
      scene: SceneManager._scene.constructor.name,
      next: SceneManager._nextScene ? SceneManager._nextScene.constructor.name : null,
      busy: SceneManager._scene.isBusy()
    }));
    console.log('  t+' + ((i + 1) * 250) + 'ms ' + st);
    if (/Scene_Task/.test(st)) break;
  }

  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
