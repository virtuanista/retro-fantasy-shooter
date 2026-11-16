/* Pruebas de simulación sin render (Node): verifican los requisitos de
 * aceptación del GDD §15 ejecutando la lógica real del juego.
 * Uso: node test/sim-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

function loadGame(seed) {
  const M = Object.create(Math);
  if (seed) { let x = seed >>> 0; M.random = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  const ctx = { console, Math: M, JSON, Date, Set, Map, Object, Array, String, Number, Infinity, isNaN, parseInt, Float32Array, Uint8Array };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['config', 'core', 'audio', 'economy', 'projectiles', 'player', 'enemies', 'bosses', 'stage', 'game']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return ctx.RFS;
}

let failures = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ✔ ' + msg); } else { failures++; console.log('  ✘ ' + msg); } };

// ---------------------------------------------------------------- bot
function makeBot(RFS, g, opts) {
  const U = RFS.util, V = {}; RFS.Input.virtual = V;
  return function step() {
    for (const k in V) V[k] = false;
    const p = g.player, t = g.t, S = RFS.CONFIG.screen;
    const tap = t % 2 === 0;
    const goTo = (tx, ty, standoff) => {
      const dx = U.wdx(p.x, tx, g.W);
      if (Math.abs(dx) > (standoff || 0) + 6) { if (dx > 0) V.right = true; else V.left = true; }
      if (ty > p.y + 2) V.down = true; else if (ty < p.y - 2) V.up = true;
      return dx;
    };
    switch (g.state) {
      case 'title': case 'intro': case 'clear': case 'gameover': case 'victory': V.fire = tap; break;
      case 'shop': if (opts.shop) opts.shop(V); else V.back = tap; break;
      case 'equip': V.fire = tap; break;
      case 'pause': V.pause = tap; break;
      case 'play': case 'bosswarn': {
        if (opts.idle) break;
        const bases = g.bases.filter(b => !b.dead);
        if (g.balloon && opts.visitShop) { goTo(g.balloon.x, g.balloon.y); break; }
        const near = g.coins.filter(c => Math.abs(U.wdx(p.x, c.x, g.W)) < 110 && c.life > 60);
        if (opts.dodge && near.length) { goTo(near[0].x, near[0].y); V.fire = tap; break; }
        if (bases.length) {
          bases.sort((a, b) => Math.abs(U.wdx(p.x, a.x, g.W)) - Math.abs(U.wdx(p.x, b.x, g.W)));
          const b = bases[0], dx0 = U.wdx(p.x, b.x, g.W), side = dx0 >= 0 ? -1 : 1; // lado del jugador respecto a la base
          const want = U.mod(b.x + side * 70, g.W);
          goTo(want, b.y, 0);
          const dx = U.wdx(p.x, b.x, g.W);
          if (Math.abs(U.wdx(p.x, want, g.W)) <= 6 && Math.sign(dx) !== p.facing) { V.left = dx < 0; V.right = dx > 0; }
          V.fire = tap && Math.abs(dx) < 140 && Math.sign(dx) === p.facing;
          V.bomb = t % 10 === 0 && Math.abs(dx) < 30;
        } else if (g.coins.length) { const c = g.coins[0]; goTo(c.x, c.y); V.fire = tap; }
        break;
      }
      case 'boss': {
        if (opts.idle) break;
        const ts = RFS.BossController.targets(g);
        const b = g.boss;
        let tgt = ts[0];
        if (!tgt && b && b.parts.length) tgt = RFS.BossController.world(g, b, b.parts.find(q => !q.dead) || b.parts[0]);
        if (tgt) {
          const sx = U.wdx(g.camX, tgt.x, g.W);
          const want = U.mod(g.camX + Math.max(20, sx - (opts.dodge ? 140 : 90)), g.W);
          goTo(want, tgt.y, 0);
          if (Math.abs(U.wdx(p.x, want, g.W)) < 10 && p.facing < 0) V.right = true;
          V.fire = tap; V.bomb = t % 30 === 0;
        }
        break;
      }
      case 'coinrain': { const c = g.coins[0]; if (c) goTo(c.x, c.y); break; }
    }
    // esquiva simple: si una bala va a pasar cerca en los próximos frames, apartarse en vertical
    if (opts.dodge && ['play', 'boss', 'bosswarn'].includes(g.state)) {
      let threat = null, best = 1e9;
      for (const b of g.ebullets) for (let k = 0; k <= 24; k += 4) {
        const dx = U.wdx(p.x, b.x + b.vx * k, g.W), dy = b.y + b.vy * k - p.y;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16 && k < best) { best = k; threat = dy; }
      }
      for (const e of g.enemies) { const dx = U.wdx(p.x, e.x, g.W), dy = e.y - p.y; if (Math.abs(dx) < 26 && Math.abs(dy) < 18 && 10 < best) { best = 10; threat = dy; } }
      if (threat !== null) { V.up = threat >= 0 && p.y > S.topY + 20 || p.y > S.groundY - 20; V.down = !V.up; }
    }
  };
}

function run(g, step, maxFrames, until) {
  for (let i = 0; i < maxFrames; i++) { step(); g.update(); if (until(g)) return i; }
  return -1;
}

// ===================================================================== 1
console.log('\n[1] Recorrido completo (7 zonas + fase final) con bot invencible');
{
  const RFS = loadGame();
  const g = new RFS.Game({}); g.debug.invincible = true;
  const step = makeBot(RFS, g, {});
  const levelLog = [];
  let lastIdx = -1, bossSeen = new Set(), maxBasesSeen = 0, shopSeen = 0, statesSeen = new Set();
  const frames = run(g, () => {
    step();
    statesSeen.add(g.state);
    if (g.levelIdx !== lastIdx && g.state === 'intro') { lastIdx = g.levelIdx; levelLog.push({ idx: g.levelIdx, start: g.t, bases: g.bases.length, money: g.money, wd: g.stats.wouldDie || 0 }); maxBasesSeen = Math.max(maxBasesSeen, g.bases.length); }
    if (g.boss) bossSeen.add(g.boss.key);
    if (g.balloon) shopSeen++;
  }, 600000, g => g.state === 'victory');
  ok(frames > 0, 'Se alcanza la victoria en ' + frames + ' frames (~' + Math.round(frames / 3600) + ' min de juego)');
  ok(levelLog.length === 8, 'Se cargan 7 niveles + fase final (' + levelLog.length + ')');
  ok(levelLog.slice(0, 7).every(l => l.bases === 6), 'Cada nivel principal tiene 6 bases');
  ok(levelLog[7] && levelLog[7].bases === 0, 'La fase final no tiene bases');
  const allBosses = ['maw', 'cinder', 'frost', 'leviathan', 'storm', 'dune', 'colossus', 'crown'];
  ok(allBosses.every(k => bossSeen.has(k)), 'Aparecen los 8 jefes: ' + [...bossSeen].join(','));
  ok(g.stats.bossesDefeated === 7 + 7 + 1, 'Jefes derrotados = 15 (7 zonas + 7 repetición + definitivo): ' + g.stats.bossesDefeated);
  ok(g.stats.coins > 0 && g.money > 0, 'Dinero recogido durante la partida: $' + g.stats.coins);
  ok(shopSeen > 0, 'El globo de la tienda aparece durante los niveles');
  ok(statesSeen.has('bosswarn') && statesSeen.has('boss') && statesSeen.has('coinrain'), 'Transición bases→aviso→jefe→lluvia de monedas');
  for (let i = 0; i < levelLog.length; i++) {
    const L = levelLog[i], next = levelLog[i + 1];
    console.log('     zona ' + (L.idx + 1) + ': ' + Math.round(((next ? next.start : g.t) - L.start) / 60) + ' s, dinero al entrar $' + L.money + ', impactos que habrían matado: ' + ((next ? next.wd : g.stats.wouldDie || 0) - L.wd));
  }
}

// ===================================================================== 2
console.log('\n[2] Fin de partida al perder todas las vidas');
{
  const RFS = loadGame();
  const g = new RFS.Game({});
  const step = makeBot(RFS, g, { idle: true });
  g.newGame(1); // zona 2: enemigos que disparan
  const f = run(g, step, 60000, g => g.state === 'gameover');
  ok(f > 0, 'Game over tras ' + f + ' frames');
  ok(g.lives === 0 && g.stats.deaths === 3, 'Vidas 0 y 3 muertes registradas');
  ok(g.records.length === 1, 'Se guarda el récord de la partida');
}

// ===================================================================== 3
console.log('\n[3] Economía, tienda, inflación e inventario');
{
  const RFS = loadGame();
  const g = new RFS.Game({});
  RFS.Input.virtual = {};
  g.newGame(0);
  g.money = 1e6;
  const cats = new Set();
  const priceBefore = {};
  for (const it of RFS.CONFIG.shop.items) {
    priceBefore[it.id] = g.econ.price(it.id);
    const err = g.econ.buy(g, it.id);
    if (!err) cats.add(it.cat);
  }
  ok(cats.size === 4, 'Se pueden comprar artículos de las 4 categorías');
  const inflated = RFS.CONFIG.shop.items.filter(it => g.econ.price(it.id) > priceBefore[it.id]).length;
  ok(inflated === 16, 'Los 16 artículos suben de precio tras comprarlos (' + inflated + '/16)');
  ok(g.econ.price('rear') === Math.round(700 * 1.6 / 10) * 10, 'Inflación configurable por artículo (REAR SHOT 700 → ' + g.econ.price('rear') + ')');
  ok(g.inv.speed() === 3.0 && g.inv.speed() > RFS.CONFIG.player.baseSpeed, 'Los motores aumentan la velocidad (' + RFS.CONFIG.player.baseSpeed + ' → ' + g.inv.speed() + ')');
  ok(g.econ.buy(g, 'comet') === 'EQUIPADO', 'No se compra dos veces un motor ya equipado');
  ok(g.lives === 4, 'EXTRA SHIP añade una vida');
  ok(g.inv.auto && g.inv.shield && g.inv.flash === 1, 'AUTO SHOT, SHIELD y FLASH BURST aplicados');
  ok(g.inv.activeWeapon === 'seeker' && g.inv.activeBomb === 'megabomb', 'Solo un arma especial y un tipo de bomba activos');
  // selección de equipamiento
  g.setState('play'); g.openEquip();
  const V = RFS.Input.virtual;
  const press = k => { V[k] = true; g.update(); V[k] = false; g.update(); };
  press('right');
  ok(g.inv.activeWeapon === null || g.inv.activeWeapon !== 'seeker', 'La interfaz de equipamiento cambia el arma activa (' + g.inv.activeWeapon + ')');
  press('down'); press('left');
  ok(g.inv.activeBomb !== 'megabomb', 'La interfaz de equipamiento cambia la bomba activa (' + g.inv.activeBomb + ')');
  press('fire');
  ok(g.state === 'play', 'Se vuelve a la partida tras seleccionar');
  // munición limitada y vuelta al básico
  g.inv.activeWeapon = 'rear'; g.inv.weapons.rear = 2;
  g.player.fireCd = 0; press('fire'); g.player.fireCd = 0; press('fire');
  ok(g.inv.activeWeapon === null && !g.inv.weapons.rear, 'REAR SHOT se agota y vuelve el disparo básico');
  g.inv.weapons.fan = 3; g.inv.activeWeapon = 'fan';
  for (let i = 0; i < 4; i++) g.update();
  ok(g.inv.activeWeapon === null, 'FAN SHOT (por tiempo) caduca y vuelve el disparo básico');
  const uses = g.inv.bombs.twinbomb; g.inv.activeBomb = 'twinbomb'; g.player.bombCd = 0; press('bomb');
  ok(g.inv.bombs.twinbomb === uses - 1, 'Las bombas consumen usos (' + uses + ' → ' + g.inv.bombs.twinbomb + ')');
  // pérdida de equipamiento al morir
  g.inv.shield = null; RFS.PlayerHealth.kill(g);
  ok(g.inv.engines.length === 0 && !g.inv.auto && g.inv.activeWeapon === null, 'Al morir se recupera el equipamiento básico');
  // tope de daño de bombas contra jefes
  g.player.alive = true; g.setState('play'); g.arena = true; RFS.BossController.spawn(g, 'colossus', {}); g.boss.t = 100;
  const hp0 = g.boss.parts[3].hp; g.boss.parts[3].vuln = true;
  RFS.PlayerCombat.areaAttack(g, 9999, 10, 'smart');
  ok(hp0 - g.boss.parts[3].hp === Math.round(0.05 * g.boss.maxHp), 'NOVA BOMB no elimina al jefe de golpe (daño ' + (hp0 - g.boss.parts[3].hp) + ' de ' + g.boss.maxHp + ')');
  // MEGA BOMB con impacto directo: un único golpe con tope del 10 %
  const eye = g.boss.parts[3], hp1 = eye.hp, w = RFS.BossController.world(g, g.boss, eye);
  g.bombs.length = 0; RFS.ProjectileSystem.bomb(g, w.x, w.y, 0, 0, { dmg: 40, kind: 'mega', grav: 0, hw: 6, hh: 6 });
  RFS.ProjectileSystem.update(g);
  ok(hp1 - eye.hp === Math.round(0.10 * g.boss.maxHp), 'MEGA BOMB aplica un solo golpe con tope del 10 % (daño ' + (hp1 - eye.hp) + ')');
}

// ===================================================================== 4
console.log('\n[4] Movimiento en 8 direcciones, disparo en ambos sentidos, bombas, tienda');
{
  const RFS = loadGame();
  const g = new RFS.Game({});
  const V = RFS.Input.virtual = {};
  g.newGame(0); g.setState('play'); g.debug.invincible = true;
  const dirs = [['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
  let moved = 0;
  for (const d of dirs) {
    g.player.y = 110; const x0 = g.player.x, y0 = g.player.y;
    for (const k in V) V[k] = false; d.forEach(k => V[k] = true);
    g.update();
    const dx = RFS.util.wdx(x0, g.player.x, g.W), dy = g.player.y - y0;
    const exp = [d.includes('right') ? 1 : d.includes('left') ? -1 : 0, d.includes('down') ? 1 : d.includes('up') ? -1 : 0];
    if (Math.sign(Math.round(dx * 100)) === exp[0] && Math.sign(Math.round(dy * 100)) === exp[1]) moved++;
  }
  ok(moved === 8, 'Movimiento correcto en las 8 direcciones (' + moved + '/8)');
  for (const k in V) V[k] = false;
  g.shots.length = 0; V.right = true; g.update(); V.right = false; g.player.fireCd = 0; V.fire = true; g.update(); V.fire = false;
  const right = g.shots.length && g.shots.every(s => s.vx > 0);
  g.shots.length = 0; V.left = true; g.update(); V.left = false; g.update(); g.player.fireCd = 0; V.fire = true; g.update(); V.fire = false;
  const left = g.shots.length && g.shots.every(s => s.vx < 0);
  ok(right && left, 'Disparo horizontal hacia la derecha y hacia la izquierda');
  ok(g.shots.length === 2, 'Disparo básico doble');
  g.player.bombCd = 0; V.bomb = true; g.update(); V.bomb = false;
  const bomb = g.bombs[0]; const y0 = bomb && bomb.y; for (let i = 0; i < 10; i++) g.update();
  ok(bomb && bomb.y > y0, 'Las bombas caen hacia abajo');
  // enemigos generan recompensa
  const e = RFS.EnemyController.create(g, 'shooter', g.player.x + 400, 100);
  const nCoins = g.coins.length; RFS.EnemyController.damage(g, e, 999);
  ok(g.coins.length > nCoins, 'Destruir enemigos genera monedas');
  // tienda
  RFS.ShopController.spawnBalloon(g); const bl = g.balloon; bl.y = bl.hoverY; g.player.x = bl.x; g.player.y = bl.y; g.update();
  ok(g.state === 'shop', 'Tocar el globo abre la tienda y pausa la acción');
  const before = g.t; const px = g.player.x; V.back = true; g.update(); V.back = false;
  ok(g.state === 'play' && g.player.x === px, 'Salir de la tienda reanuda la partida');
  void before;
  // destruir bases activa al jefe
  g.debugKillBases();
  ok(g.state === 'bosswarn', 'Destruir las 6 bases activa la transición al jefe');
  for (let i = 0; i < 200 && g.state !== 'boss'; i++) g.update();
  ok(g.state === 'boss' && g.boss && g.boss.key === 'maw', 'Aparece el jefe de la zona');
}

// ===================================================================== 5
console.log('\n[5] Balance: bot mortal (sin invencibilidad, esquiva simple) que compra en la tienda');
{
  const results = [];
  for (const seed of [11, 22, 33, 44, 55]) {
    const RFS = loadGame(seed);
    const g = new RFS.Game({});
    const wish = ['fins', 'auto', 'ionjet', 'shield', 'rear', 'twinbomb', 'turbo', 'fan', 'extra', 'laser', 'seeker', 'megabomb'];
    const step = makeBot(RFS, g, { visitShop: true, dodge: true, shop: V => {
      const id = wish.find(id => !g.econ.blocked(g, id));
      if (id) g.econ.buy(g, id);
      V.back = g.t % 2 === 0;
    } });
    g.newGame(0);
    let maxZone = 0;
    run(g, () => { step(); maxZone = Math.max(maxZone, g.levelIdx + 1); }, 300000, g => g.state === 'gameover' || g.state === 'victory');
    results.push({ maxZone, purchases: g.stats.purchases, bosses: g.stats.bossesDefeated, bases: g.stats.bases });
    console.log('     semilla ' + seed + ': llega a la zona ' + maxZone + ', bases ' + g.stats.bases + ', jefes ' + g.stats.bossesDefeated + ', compras ' + g.stats.purchases);
  }
  ok(results.every(r => r.bases >= 3), 'El bot destruye bases en todas las semillas (la zona 1 es asequible)');
  ok(results.some(r => r.maxZone >= 2), 'Al menos una semilla supera la zona 1 sin trucos (' + results.filter(r => r.maxZone >= 2).length + '/5)');
  ok(results.some(r => r.purchases > 0), 'El bot compra mejoras con el dinero recogido');
}

console.log('\n' + passes + ' comprobaciones correctas, ' + failures + ' fallos');
process.exit(failures ? 1 : 0);
