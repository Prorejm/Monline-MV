const { chromium } = require('playwright-core');
const EXE='C:/Users/彭/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--mute-audio']});
const p=await b.newPage({viewport:{width:816,height:624}});
p.on('pageerror',e=>console.log('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE: '+m.text()); });
await p.goto('http://127.0.0.1:8765/index.html',{waitUntil:'load',timeout:60000});
await sleep(6000);
console.log(await p.evaluate(()=>{
  return JSON.stringify({
    createSrc: String(Scene_Gameover.prototype.create).slice(0,160),
    hasCWC: typeof Scene_Gameover.prototype.createCommandWindow,
    cwc: String(Scene_Gameover.prototype.createCommandWindow||'').slice(0,80)
  },null,1);
}));
await p.evaluate(()=>{SceneManager._scene.commandNewGame();});
for(let i=0;i<80;i++){ if(await p.evaluate(()=>SceneManager._scene&&SceneManager._scene.constructor.name)==='Scene_Map') break; await sleep(250);}
console.log('scene', await p.evaluate(()=>SceneManager._scene.constructor.name));
console.log('direct make window:');
console.log(await p.evaluate(()=>{
  try { var w=new Window_GameOverCommand(); return 'OK w='+w.width+'x'+w.height+' list='+JSON.stringify(w._list.map(c=>c.symbol)); }
  catch(e){ return 'THREW: '+e.message+'\n'+e.stack.split('\n').slice(0,5).join('\n'); }
}));
await p.evaluate(()=>{SceneManager.goto(Scene_Gameover);});
await sleep(1500);
console.log('after goto:', await p.evaluate(()=>JSON.stringify({
  scene: SceneManager._scene.constructor.name,
  cw: !!SceneManager._scene._commandWindow,
  windows: SceneManager._scene._windowLayer ? SceneManager._scene._windowLayer.children.length : -1
})));
await b.close();
})();
