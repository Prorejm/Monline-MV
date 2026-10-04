// quick diagnostic for the task data problem
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
  p.on('pageerror', e => console.log('PAGEERROR: ' + e.message));
  p.on('console', m => {
    const t = m.text();
    if (/Tasks|task|Failed to load/i.test(t)) console.log('CONSOLE[' + m.type() + ']: ' + t);
  });
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await sleep(4000);
  const info = await p.evaluate(() => ({
    files: DataManager._databaseFiles.map(f => f.src),
    hasData: typeof window.$dataTasks,
    pluginGlobal: typeof window.MonlineTasks,
    plugins: ($plugins || []).map(x => x.name),
    scene: SceneManager._scene ? SceneManager._scene.constructor.name : null
  }));
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
