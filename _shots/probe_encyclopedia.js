// Exercise the ported PXEpedia (0146.rb): push window.Encyclopedia, walk a
// category, open a topic and screenshot every step.
//   node probe_encyclopedia.js
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  p.on('pageerror', e => console.log('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ' + m.text()); });

  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(7000);
  await p.evaluate(() => { DataManager.setupNewGame(); SceneManager.goto(Scene_Map); });
  await sleep(5000);
  for (let i = 0; i < 40; i++) {
    await p.evaluate(() => { Input._currentState.ok = true; });
    await sleep(120);
    const st = await p.evaluate(() => ({ b: $gameMessage.isBusy(), e: $gameMap.isEventRunning() }));
    if (!st.b && !st.e) break;
  }

  const info = await p.evaluate(() => {
    const out = {};
    out.topics = MonlineEncyclopedia.TOPICS.length;
    out.cats = MonlineEncyclopedia.Categories.map(c => c.name);
    // unlock a sample of every category
    [1441,1442,1443,1444,1445,1446,1447,1448,1402,1403,1404,1405].forEach(function (id) { $gameSwitches.setValue(id, true); });
    // people / states / tips use their own switches; force a few by hand
    return out;
  });
  console.log('INFO ' + JSON.stringify(info));

  await p.evaluate(() => { SceneManager.push(window.Encyclopedia); });
  await sleep(2500);
  await p.screenshot({ path: OUT + 'pedia_1_categories.png' });
  console.log('S1 ' + JSON.stringify(await p.evaluate(() => {
    const sc = SceneManager._scene;
    return { scene: sc.constructor.name,
             stopped: !!SceneManager._stopped,
             err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
                    .replace(/<[^>]+>/g, '').slice(0, 200),
             cats: sc._pediaCategory ? sc._pediaCategory._data.map(d => d.name) : [],
             items: sc._pediaCategory ? sc._pediaCategory.maxItems() : -1 };
  })));

  // OK on the first category -> Story Summary
  await p.evaluate(() => { SceneManager._scene.flipTopics(); });
  await sleep(1200);
  await p.screenshot({ path: OUT + 'pedia_2_topics.png' });
  console.log('S2 ' + JSON.stringify(await p.evaluate(() => {
    const sc = SceneManager._scene;
    return { topics: sc._pediaTopics._data.map(d => d.name),
             mode: sc._globalMode,
             helpText: sc._pediaHelp._text };
  })));

  // walk down to the second topic
  await p.evaluate(() => { SceneManager._scene._pediaTopics.select(2); });
  await sleep(1800);
  await p.screenshot({ path: OUT + 'pedia_3_info.png' });
  console.log('S3 ' + JSON.stringify(await p.evaluate(() => {
    const sc = SceneManager._scene;
    const t = sc._pediaTopics.item();
    return { idx: sc._pediaTopics.index(), name: t ? t.name : null,
             infoLen: sc._pediaInfo._contentsDrawn || 0,
             err: (Graphics._errorPrinter ? Graphics._errorPrinter.innerHTML : '')
                    .replace(/<[^>]+>/g, '').slice(0, 200) };
  })));

  // B back to categories, B again leaves
  await p.evaluate(() => { Input._currentState.escape = true; });
  await sleep(900);
  console.log('S4 ' + JSON.stringify(await p.evaluate(() => ({
    mode: SceneManager._scene._globalMode,
    catVisible: SceneManager._scene._pediaCategory.visible
  }))));
  await p.evaluate(() => { Input._currentState.escape = false; });
  await sleep(500);
  await p.evaluate(() => { Input._currentState.escape = true; });
  await sleep(1200);
  console.log('S5 ' + JSON.stringify(await p.evaluate(() => ({
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null
  }))));

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
