// Pasada completa en Chrome headless (CDP): teclas reales, audio, menús, todas las armas y partida completa con render.
// Uso: node test/browser-test.js <carpeta_salida> file:///ruta/a/index.html test/sim-test.js
const { spawn } = require('child_process'); const fs = require('fs');
const OUT = process.argv[2], GAME = process.argv[3];
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9334', '--user-data-dir=' + OUT + '/prof2', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:9334/json')).json(); if (tabs.find(t => t.type === 'page')) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const errs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
    if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) errs.push(d.params.type + ' ' + d.params.args.map(a => a.value || a.description).join(' ')); };
  const send = (method, params) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result.result.value; };
  const key = async (code, k, ms) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 13 }); await sleep(ms || 80); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k }); await sleep(60); };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
  const log = (...a) => console.log(...a);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 672, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: GAME }); await sleep(1200);
  await ev("localStorage.clear(); 1");

  // 1) teclado real: título -> partida
  await key('KeyZ', 'z'); await sleep(300);
  log('tras Z en título:', await ev('__game.state'), '| audio:', await ev('RFS.Audio.ctx && RFS.Audio.ctx.state'));
  const step0 = await ev('RFS.Audio.step'); await sleep(1200); const step1 = await ev('RFS.Audio.step');
  log('secuenciador de música avanza:', step0, '->', step1, '| canción:', await ev('RFS.Audio.songKey'));
  await key('KeyZ', 'z'); await sleep(400);
  log('intro -> ', await ev('__game.state'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 }); await sleep(600);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowRight', key: 'ArrowRight', windowsVirtualKeyCode: 39 });
  const x0 = await ev('__game.player.x'); await key('KeyZ', 'z'); log('disparos tras Z:', await ev('__game.shots.length'), 'x', x0);
  await key('KeyX', 'x'); log('bombas tras X:', await ev('__game.bombs.length'));
  await key('Enter', 'Enter'); log('Enter -> ', await ev('__game.state')); await shot('k_pause'); await key('Enter', 'Enter'); log('Enter -> ', await ev('__game.state'));
  await key('KeyE', 'e'); log('E -> ', await ev('__game.state')); await shot('k_equip'); await key('KeyZ', 'z'); log('Z -> ', await ev('__game.state'));

  // 2) comprar y disparar cada arma y bomba, escudo, flash
  log('armas/bombas:', await ev(`(async()=>{const g=__game,res=[];g.money=1e6;g.debug.invincible=true;
    const tick=n=>{for(let i=0;i<n;i++)g.update(); RFS.Renderer.draw(document.getElementById('screen').getContext('2d'),g);};
    for(const id of ['shield','auto','fins','flash']) g.econ.buy(g,id);
    for(const id of ['rear','fan','laser','seeker']){g.econ.buy(g,id);g.inv.activeWeapon=id;g.player.fireCd=0;RFS.Input.virtual={fire:true};tick(1);RFS.Input.virtual={};tick(3);res.push(id+':'+g.shots.filter(s=>s.kind!=='basic'||id==='rear').length);}
    for(const id of ['twinbomb','nova','rockets','megabomb']){g.econ.buy(g,id);g.inv.activeBomb=id;g.player.bombCd=0;RFS.Input.virtual={bomb:true};tick(1);RFS.Input.virtual={};tick(12);res.push(id+':'+g.bombs.length);}
    RFS.Input.virtual={flash:true};tick(1);RFS.Input.virtual={};tick(2);res.push('flashT:'+g.flashT);
    RFS.Input.virtual=null; return res.join(' ');})()`));
  await sleep(100); await shot('k_weapons');

  // 3) pantallas de menú
  log('menús:', await ev(`(()=>{const g=__game,c=document.getElementById('screen').getContext('2d'),out=[];
    for(const s of ['options','records']){g.setState(s);RFS.Renderer.draw(c,g);out.push(s);} g.setState('controls');g.ctl={i:0,wait:false};RFS.Renderer.draw(c,g);out.push('controls');
    g.setState('play');RFS.StageManager.load(g,0);g.setState('play');g.onAllBasesDestroyed();for(let i=0;i<400;i++)g.update();RFS.Renderer.draw(c,g);out.push(g.state);
    return out.join(',');})()`));

  // 4) peligros de cada zona dibujados
  log('peligros:', await ev(`(()=>{const g=__game,c=document.getElementById('screen').getContext('2d'),out=[];
    for(let i=1;i<7;i++){RFS.StageManager.load(g,i);g.setState('play');for(let k=0;k<700;k++){g.update(); if(k%50==0)RFS.Renderer.draw(c,g);} out.push(g.level.theme+':'+g.hazards.length+'/'+g.stats.deaths);}
    return out.join(' ');})()`));
  await shot('k_hazard');

  // 5) partida completa con bot en la página, dibujando cada 10 frames
  const bot = fs.readFileSync(process.argv[4], 'utf8');
  const mb = bot.slice(bot.indexOf('function makeBot'), bot.indexOf('function run('));
  log('partida completa:', await ev(`(async()=>{${mb}; const g=__game; g.debug.invincible=true; g.newGame(0);
    const step=makeBot(RFS,g,{}); const c=document.getElementById('screen').getContext('2d'); const seen=new Set();
    for(let i=0;i<200000 && g.state!=='victory';i++){ step(); g.update(); seen.add(g.state); if(i%10===0) RFS.Renderer.draw(c,g); if(i%5000===0) await new Promise(r=>setTimeout(r,0)); }
    RFS.Renderer.draw(c,g); RFS.Input.virtual=null;
    return g.state+' frames '+g.t+' jefes '+g.stats.bossesDefeated+' estados '+[...seen].join('/');})()`));
  await sleep(300); await shot('k_victory');
  log('récords guardados:', await ev("localStorage.getItem('rfs.records.v1')"));
  await send('Page.reload'); await sleep(1200);
  log('récords tras recargar:', await ev('__game.records.length'));
  log('ERRORES:\n' + (errs.join('\n') || '(ninguno)'));
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
