/* Enemigos: EnemyController (familias de comportamiento), EnemySpawner
 * (tabla de aparición por nivel) y EnemyBase (bases enemigas). */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;

  const onScreen = (g, x, pad) => { const sx = U.wdx(g.camX, x, g.W); return sx > -(pad || 0) && sx < RFS.CONFIG.screen.w + (pad || 0); };
  RFS.onScreen = onScreen;

  const E = RFS.EnemyController = {
    create(g, fam, x, y, opts) {
      const base = RFS.CONFIG.enemies[fam], L = g.level;
      const e = Object.assign({
        fam, x: U.mod(x, g.W), y, vx: 0, vy: 0, t: 0, dead: false, flash: 0,
        hp: Math.max(1, Math.round(base.hp * L.hpMult)),
        speed: base.speed * L.speedMult,
        fireRate: base.fireRate ? Math.round(base.fireRate / L.fireMult) : 0,
        damage: base.damage, reward: base.reward, score: base.score, hw: base.hw, hh: base.hh,
        dir: Math.random() < 0.5 ? -1 : 1, baseY: y, phase: Math.random() * 6.28
      }, opts || {});
      e.maxHp = e.hp;
      e.fireT = e.fireRate ? Math.floor(e.fireRate * (0.4 + Math.random() * 0.6)) : 0;
      g.enemies.push(e);
      return e;
    },
    update(g) {
      const p = g.player, S = RFS.CONFIG.screen, W = g.W, H = RFS.CONFIG.player.hitbox;
      const bs = g.level.bulletSpeed * (g.bulletMult || 1);
      for (const e of g.enemies) {
        if (e.dead) continue;
        e.t++; if (e.flash > 0) e.flash--;
        const dx = U.wdx(e.x, p.x, W), dy = p.y - e.y;
        switch (e.fam) {
          case 'patrol':
            e.vx = e.dir * e.speed; e.y = e.baseY + Math.sin(e.t * 0.05 + e.phase) * 14; e.vy = 0;
            if (!onScreen(g, e.x, 40) && e.t % 240 === 0) e.dir = Math.sign(dx) || 1;
            break;
          case 'chaser': {
            const a = RFS.CONFIG.enemies.chaser.accel * (e.t < 40 ? 0.3 : 1);
            e.vx = U.clamp(e.vx + Math.sign(dx) * a, -e.speed * 1.4, e.speed * 1.4);
            e.vy = U.clamp(e.vy + Math.sign(dy) * a * 0.6, -e.speed, e.speed);
            break;
          }
          case 'vertical':
            if (!e.vy) e.vy = e.speed * (Math.random() < 0.5 ? -1 : 1);
            if (e.y < S.topY + 10) e.vy = Math.abs(e.vy); if (e.y > S.groundY - 12) e.vy = -Math.abs(e.vy);
            e.vx = e.dir * e.speed * 0.35;
            break;
          case 'shooter': {
            const want = U.wdx(e.x, U.mod(p.x - Math.sign(dx || 1) * 90, W), W);
            e.vx = U.clamp(want * 0.02, -e.speed, e.speed);
            e.vy = U.clamp((p.y - 30 * Math.sin(e.phase) - e.y) * 0.02, -e.speed, e.speed);
            break;
          }
          case 'spreader':
            e.vx = e.dir * e.speed * 0.6; e.vy = Math.cos(e.t * 0.03 + e.phase) * 0.5;
            if (Math.abs(dx) > 200 && e.t % 120 === 0) e.dir = Math.sign(dx) || 1;
            break;
          case 'tank':
            e.vx = Math.sign(dx) * e.speed; e.vy = Math.sign(dy) * e.speed * 0.4;
            break;
          case 'formation':
            e.vx = e.dir * e.speed; e.y = e.baseY + Math.sin(e.t * 0.06 - e.idx * 0.7) * 30; e.vy = 0;
            break;
          case 'guardian':
            if (e.home && !e.home.dead) {
              e.ang = (e.ang || 0) + e.speed;
              const R = RFS.CONFIG.enemies.guardian.orbitR;
              e.x = U.mod(e.home.x + Math.cos(e.ang) * R, W); e.y = e.home.y + Math.sin(e.ang) * R * 0.8; e.vx = e.vy = 0;
            } else {
              e.vx = U.clamp(e.vx + Math.sign(dx) * 0.04, -1.6, 1.6); e.vy = U.clamp(e.vy + Math.sign(dy) * 0.03, -1, 1);
            }
            break;
        }
        e.x = U.mod(e.x + e.vx, W);
        e.y = U.clamp(e.y + (e.fam === 'patrol' || e.fam === 'formation' ? 0 : e.vy), S.topY + 4, S.groundY - 6);
        // disparo
        if (e.fireRate && onScreen(g, e.x, -8) && p.alive && --e.fireT <= 0) {
          e.fireT = e.fireRate;
          const P = RFS.ProjectileSystem;
          if (e.fam === 'spreader') P.ring(g, e.x, e.y, RFS.CONFIG.enemies.spreader.shots + (g.level.id > 4 ? 2 : 0), bs * 0.85, e.t * 0.1);
          else if (e.fam === 'tank') { P.aimed(g, e.x, e.y, bs, -0.2); P.aimed(g, e.x, e.y, bs, 0); P.aimed(g, e.x, e.y, bs, 0.2); }
          else P.aimed(g, e.x, e.y, bs);
          RFS.Audio.sfx('enemyshot');
        }
        // contacto con el jugador
        if (p.alive && U.hit(p.x, p.y, H.hw, H.hh, e.x, e.y, e.hw - 1, e.hh - 1, W)) RFS.PlayerHealth.hurt(g, e.damage);
        // reciclado de enemigos lejanos
        if (e.t > 900 && !onScreen(g, e.x, 220) && e.fam !== 'guardian') e.dead = true, e.silent = true;
      }
      for (let i = g.enemies.length - 1; i >= 0; i--) if (g.enemies[i].dead) g.enemies.splice(i, 1);
    },
    damage(g, e, dmg) {
      if (e.dead) return;
      e.hp -= dmg; e.flash = 4;
      if (e.hp > 0) { RFS.Audio.sfx('hit'); return; }
      e.dead = true;
      g.score += e.score; g.stats.kills++;
      g.fx.push({ type: 'boom', x: e.x, y: e.y, t: 0, life: 18, size: e.hw + 4 });
      RFS.CurrencySystem.drop(g, e.x, e.y, e.reward);
      if (e.group) {
        e.group.killed++;
        if (e.group.killed === e.group.size) { RFS.CurrencySystem.drop(g, e.x, e.y - 8, RFS.CONFIG.enemies.formation.groupBonus); g.popText(e.x, e.y - 14, 'BONUS!', 'large'); }
      }
      RFS.Audio.sfx('explode');
    },
    countActive(g) { let n = 0; for (const e of g.enemies) if (!e.dead) n++; return n; }
  };

  // ---------------------------------------------------------------------
  RFS.EnemySpawner = {
    reset(g) { g.spawnT = 120; },
    update(g) {
      if (g.state !== 'play' || g.spawnsStopped) return;
      const L = g.level;
      if (--g.spawnT > 0) return;
      g.spawnT = Math.round(L.spawnInterval * (0.7 + Math.random() * 0.6));
      if (E.countActive(g) >= L.maxEnemies) return;
      const fam = U.weighted(Math.random, L.table);
      this.spawn(g, fam);
    },
    spawn(g, fam) {
      const S = RFS.CONFIG.screen, p = g.player;
      const side = Math.random() < 0.65 ? p.facing : -p.facing;
      const x = side > 0 ? g.camX + S.w + 24 : g.camX - 24;
      const y = S.topY + 16 + Math.random() * (S.groundY - S.topY - 40);
      if (fam === 'formation') {
        const n = RFS.CONFIG.enemies.formation.groupSize, group = { size: n, killed: 0 };
        for (let i = 0; i < n; i++) E.create(g, 'formation', x + side * i * 16, y, { dir: -side, idx: i, group, baseY: U.clamp(y, S.topY + 40, S.groundY - 40) });
      } else if (fam === 'guardian') {
        E.create(g, 'chaser', x, y, { dir: -side });
      } else {
        E.create(g, fam, x, y, { dir: -side });
      }
    }
  };

  // ---------------------------------------------------------------------
  RFS.EnemyBase = {
    create(g) {
      const S = RFS.CONFIG.screen, L = g.level, r = U.rng(L.id * 1013 + 7);
      g.bases = [];
      const n = 6, step = g.W / n;
      for (let i = 0; i < n; i++) {
        const ground = i % 2 === 0;
        g.bases.push({
          i, x: U.mod(step * i + step * 0.5 + (r() - 0.5) * step * 0.5 + 200, g.W),
          y: ground ? S.groundY - 16 : 60 + r() * 80, ground,
          hp: L.baseHp, maxHp: L.baseHp, hw: 12, hh: 12, dead: false, flash: 0, t: r.int(0, 200),
          spawnT: L.baseSpawn.every * (0.5 + r()), guards: 0
        });
      }
      g.basesLeft = n;
    },
    update(g) {
      const p = g.player, H = RFS.CONFIG.player.hitbox, L = g.level;
      for (const b of g.bases) {
        if (b.dead) continue;
        b.t++; if (b.flash > 0) b.flash--;
        // generación de enemigos mientras la base permanece activa
        if (g.state === 'play' && !g.spawnsStopped && onScreen(g, b.x, 120) && --b.spawnT <= 0) {
          b.spawnT = L.baseSpawn.every;
          const fam = L.baseSpawn.fam;
          if (fam === 'guardian') {
            const alive = g.enemies.filter(e => e.home === b && !e.dead).length;
            if (alive < 3) E.create(g, 'guardian', b.x, b.y, { home: b, ang: Math.random() * 6.28 });
          } else if (E.countActive(g) < L.maxEnemies + 2) {
            if (fam === 'formation') RFS.EnemySpawner.spawn(g, 'formation');
            else E.create(g, fam, b.x, b.y - 14, { dir: Math.random() < 0.5 ? -1 : 1, baseY: b.y - 20 });
          }
        }
        if (p.alive && U.hit(p.x, p.y, H.hw, H.hh, b.x, b.y, b.hw - 2, b.hh - 2, g.W)) RFS.PlayerHealth.hurt(g, 1);
      }
    },
    damage(g, b, dmg) {
      if (b.dead) return;
      b.hp -= dmg; b.flash = 5;
      if (b.hp > 0) { RFS.Audio.sfx('hit'); return; }
      b.dead = true; g.basesLeft--; g.stats.bases++;
      g.score += RFS.CONFIG.score.base * g.level.id;
      for (let i = 0; i < 6; i++) g.fx.push({ type: 'boom', x: b.x + (Math.random() - 0.5) * 24, y: b.y + (Math.random() - 0.5) * 24, t: -i * 5, life: 24, size: 14 });
      g.fx.push({ type: 'debris', x: b.x, y: b.y, t: 0, life: 40, seed: Math.random() * 1000 });
      RFS.CurrencySystem.drop(g, b.x, b.y, 'base');
      RFS.CurrencySystem.drop(g, b.x - 10, b.y, 'large');
      RFS.CurrencySystem.drop(g, b.x + 10, b.y, 'large');
      g.shake = 10; RFS.Audio.sfx('bigexplode');
      g.notice(g.basesLeft > 0 ? 'BASE DESTRUIDA  ' + g.basesLeft + ' RESTANTES' : '¡TODAS LAS BASES DESTRUIDAS!');
      if (g.basesLeft <= 0) g.onAllBasesDestroyed();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
