// Capture the UI shell before/after the modernisation pass, so the change can
// actually be looked at rather than described.
//   NODE_PATH=<pw> node _shots/shot_ui.js after
const { chromium } = require('playwright-core');

const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const OUT = 'G:/新建文件夹 (22)/Monline_MV/_shots/';
const URL = 'http://127.0.0.1:8765/index.html';
const TAG = process.argv[2] || 'before';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
           '--use-gl=swiftshader', '--mute-audio']
  });
  const p = await b.newPage({ viewport: { width: 816, height: 624 } });
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text()))
      errors.push('CONSOLE: ' + m.text());
  });
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(6000);
  await p.screenshot({ path: OUT + 'ui_' + TAG + '_1_title.png' });

  await p.evaluate(() => { SceneManager._scene.commandNewGame(); });
  for (let i = 0; i < 60; i++) {
    const n = await p.evaluate(() => SceneManager._scene &&
      SceneManager._scene.constructor.name);
    if (n === 'Scene_Map') break; await sleep(200);
  }
  await sleep(2500);
  await p.screenshot({ path: OUT + 'ui_' + TAG + '_2_map.png' });

  await p.evaluate(() => { SceneManager.push(Scene_Menu); });
  for (let i = 0; i < 40; i++) {
    const n = await p.evaluate(() => SceneManager._scene.constructor.name);
    if (n === 'Scene_Menu') break; await sleep(150);
  }
  await sleep(1200);
  await p.screenshot({ path: OUT + 'ui_' + TAG + '_3_menu.png' });

  // the item screen, so the NEW tag (if any) and the item list are visible
  await p.evaluate(() => { $gameParty.gainItem($dataItems[2], 1);
                           SceneManager.push(Scene_Item); });
  await sleep(1500);
  await p.screenshot({ path: OUT + 'ui_' + TAG + '_4_item.png' });

  await p.evaluate(() => { SceneManager.pop(); });
  await sleep(900);
  await p.evaluate(() => { SceneManager.push(Scene_Save); });
  await sleep(1500);
  await p.screenshot({ path: OUT + 'ui_' + TAG + '_5_save.png' });

  console.log('shots written for "' + TAG + '"');
  if (errors.length) console.log(errors.slice(0, 6).join('\n'));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
