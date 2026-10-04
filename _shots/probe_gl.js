const { chromium } = require('playwright-core');
const EXE = 'C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
(async () => {
  for (const args of [
    ['--no-sandbox', '--enable-unsafe-swiftshader'],
    ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  ]) {
    const b = await chromium.launch({ executablePath: EXE, headless: true, args });
    const p = await b.newPage();
    const r = await p.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      return gl ? { ok: true, max: gl.getParameter(gl.MAX_TEXTURE_SIZE) } : { ok: false };
    });
    console.log(args.join(' ').slice(0, 70) + '  ->  ' + JSON.stringify(r));
    await b.close();
  }
})();
