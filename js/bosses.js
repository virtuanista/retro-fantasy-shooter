/* BossController: marco común de jefes (partes con hitbox, vulnerabilidad,
 * barra de vida, secuencia de destrucción) y los 8 jefes originales. */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;
  const TAU = Math.PI * 2;

  // ---- utilidades de disparo en coordenadas locales de la arena -----------
  const sh = (g, b, lx, ly, vx, vy, r) => RFS.ProjectileSystem.enemyShot(g, g.camX + lx, ly, vx, vy, r || 3);
  const aim = (g, b, lx, ly, spread, speedMul) => {
    const p = g.player, sp = b.bs * (speedMul || 1);
    const px = U.wdx(g.camX, p.x, g.W);
    const a = Math.atan2(p.y - ly, px - lx) + (spread || 0);
    return sh(g, b, lx, ly, Math.cos(a) * sp, Math.sin(a) * sp);
  };
  const ring = (g, b, lx, ly, n, off, speedMul) => { for (let i = 0; i < n; i++) { const a = off + i / n * TAU; sh(g, b, lx, ly, Math.cos(a) * b.bs * (speedMul || 1), Math.sin(a) * b.bs * (speedMul || 1)); } };
  const playerLX = g => U.wdx(g.camX, g.player.x, g.W);
  const part = (id, ox, oy, hw, hh, o) => Object.assign({ id, ox, oy, hw, hh, hp: 0, maxHp: 0, vuln: false, solid: true, dead: false, flash: 0 }, o || {});
  const fr = (b, n) => Math.max(8, Math.round(n / b.fm)); // cadencia escalada

  // =========================================================================
  const TYPES = {
    // 1. MAW ENGINE — criatura mecánica con boca central que se abre (ventana de vulnerabilidad)
    maw: {
      init(b) {
        b.lx = 340; b.ly = 110;
        b.parts = [part('shell', 0, 0, 22, 22), part('mouth', -16, 2, 9, 8, { hp: b.H, vuln: false, solid: false })];
        b.cycle = 0;
      },
      update(b, g) {
        if (b.t < 60) { b.lx -= 1.5; return; }
        b.cycle++;
        const c = b.cycle % 260, mouth = b.parts[1];
        b.ly = 110 + Math.sin(b.t * 0.022) * 55;
        b.lx = 250 + Math.sin(b.t * 0.011) * 20;
        b.open = c > 130 && c < 250 ? 1 : c > 115 && c <= 130 ? (c - 115) / 15 : 0;
        mouth.vuln = b.open >= 1;
        if (mouth.vuln && c % fr(b, b.def.fireRate) === 0) { aim(g, b, b.lx - 18, b.ly, -0.22); aim(g, b, b.lx - 18, b.ly, 0); aim(g, b, b.lx - 18, b.ly, 0.22); }
        if (!mouth.vuln && c % 90 === 45) aim(g, b, b.lx - 10, b.ly - 18, 0, 0.8);
      }
    },

    // 2. CINDER WHEEL — criatura ígnea, anillos de proyectiles y tres núcleos vulnerables
    cinder: {
      init(b) {
        b.lx = 340; b.ly = 110;
        const core = Math.round(b.H * 0.25);
        b.parts = [part('body', 0, 0, 15, 15, { hp: b.H - core * 3, armor: true })];
        for (let i = 0; i < 3; i++) b.parts.push(part('core' + i, 0, 0, 7, 7, { hp: core, vuln: true, ang: i / 3 * TAU }));
      },
      update(b, g) {
        if (b.t < 60) { b.lx -= 1.6; return; }
        const body = b.parts[0], cores = b.parts.slice(1), alive = cores.filter(c => !c.dead).length;
        body.vuln = alive === 0; body.armor = !body.vuln;
        const speed = alive === 0 ? 0.03 : 0.018;
        b.lx = 210 + Math.sin(b.t * speed) * 70; b.ly = 110 + Math.sin(b.t * speed * 2) * 45;
        for (const c of cores) { c.ang += 0.035; c.ox = Math.cos(c.ang) * 30; c.oy = Math.sin(c.ang) * 30; }
        b.spin = (b.spin || 0) + (alive === 0 ? 0.09 : 0.05);
        if (b.t % fr(b, b.def.fireRate * (alive === 0 ? 0.65 : 1)) === 0) ring(g, b, b.lx, b.ly, b.def.ringShots + (alive === 0 ? 4 : 0), b.spin);
        if (b.t % fr(b, 110) === 0) for (const c of cores) if (!c.dead) aim(g, b, b.lx + c.ox, b.ly + c.oy, 0, 1.1);
      }
    },

    // 3. FROST HYDRA — criatura de hielo con tres cabezas (múltiples puntos de ataque) y embestidas
    frost: {
      init(b) {
        b.lx = 350; b.ly = 112; b.home = 262;
        const h = Math.round(b.H / 3);
        b.parts = [part('body', 0, 0, 16, 22, { armor: true })];
        [[-26, -38], [-34, 0], [-26, 38]].forEach((o, i) => b.parts.push(part('head' + i, o[0], o[1], 8, 7, { hp: i === 1 ? b.H - 2 * h : h, vuln: true, bx: o[0], by: o[1] })));
        b.mode = 'idle'; b.mt = 0;
      },
      update(b, g) {
        if (b.t < 60) { b.lx -= 1.5; return; }
        b.mt++;
        const heads = b.parts.slice(1);
        heads.forEach((h, i) => { h.ox = h.bx + Math.sin(b.t * 0.05 + i * 2) * 5; h.oy = h.by + Math.cos(b.t * 0.04 + i) * 6; });
        if (b.mode === 'idle') {
          b.ly = 112 + Math.sin(b.t * 0.02) * 40; b.lx += (b.home - b.lx) * 0.05;
          const alive = heads.filter(h => !h.dead);
          if (alive.length && b.t % fr(b, b.def.fireRate) === 0) { const h = alive[(b.t / 7 | 0) % alive.length]; aim(g, b, b.lx + h.ox - 4, b.ly + h.oy, 0, 1); aim(g, b, b.lx + h.ox - 4, b.ly + h.oy, 0.15, 0.9); }
          if (b.mt > 280) { b.mode = 'tele'; b.mt = 0; b.dashY = U.clamp(g.player.y, 50, 170); }
        } else if (b.mode === 'tele') {
          b.ly += (b.dashY - b.ly) * 0.08; b.shakeX = (b.mt % 4 < 2 ? 2 : -2);
          if (b.mt > 40) { b.mode = 'dash'; b.mt = 0; b.shakeX = 0; }
        } else if (b.mode === 'dash') {
          b.lx -= b.def.dashSpeed * b.bm;
          if (b.mt % 10 === 0) for (const h of heads) if (!h.dead) sh(g, b, b.lx + h.ox, b.ly + h.oy, 0.4, -1.2 * b.bs / 2), sh(g, b, b.lx + h.ox, b.ly + h.oy, 0.4, 1.2 * b.bs / 2);
          if (b.lx < 50) { b.mode = 'back'; b.mt = 0; }
        } else if (b.mode === 'back') {
          b.lx += 2.2; if (b.lx >= b.home) { b.mode = 'idle'; b.mt = 0; }
        }
      }
    },

    // 4. ABYSS LEVIATHAN — gran criatura marina; punto débil frontal; proyectiles y embestidas
    leviathan: {
      init(b) {
        b.lx = 360; b.ly = 120; b.home = 236; b.dir = -1;
        b.parts = [
          part('head', -30, 0, 11, 10, { hp: b.H, vuln: true }),
          part('jaw', -18, 0, 8, 12, { armor: true }),
          part('seg1', 2, 0, 14, 13, { armor: true }),
          part('seg2', 26, 0, 12, 11, { armor: true }),
          part('tail', 46, 0, 9, 8, { armor: true })
        ];
        b.mode = 'swim'; b.mt = 0;
      },
      update(b, g) {
        if (b.t < 70) { b.lx -= 1.8; return; }
        b.mt++;
        b.parts.forEach((p, i) => { if (i >= 2) p.oy = Math.sin(b.t * 0.08 - i) * 6 * (i - 1); });
        if (b.mode === 'swim') {
          b.ly = 112 + Math.sin(b.t * 0.025) * 60; b.lx += (b.home - b.lx) * 0.05;
          if (b.mt % fr(b, b.def.fireRate) === 0) { for (const s of [-0.3, -0.1, 0.1, 0.3]) aim(g, b, b.lx - 34, b.ly, s, 0.95); }
          if (b.mt % fr(b, 150) === 75) { const s = sh(g, b, b.lx + 20, b.ly - 10, -1.2, -2.4, 4); s.gy = 0.035; }
          if (b.mt > 300) { b.mode = 'tele'; b.mt = 0; b.dashY = U.clamp(g.player.y, 50, 175); }
        } else if (b.mode === 'tele') {
          b.ly += (b.dashY - b.ly) * 0.1; b.lx += 0.6;
          if (b.mt > 36) { b.mode = 'dash'; b.mt = 0; }
        } else if (b.mode === 'dash') {
          b.lx -= b.def.dashSpeed * b.bm;
          if (b.lx < 40) { b.mode = 'back'; b.mt = 0; ring(g, b, b.lx - 30, b.ly, 8, 0, 0.8); }
        } else { b.lx += 2.4; if (b.lx >= b.home) { b.mode = 'swim'; b.mt = 0; } }
      }
    },

    // 5. STORM FLOCK — aparece por oleadas; varias fases; cadencia creciente
    storm: {
      init(b) {
        b.lx = 230; b.ly = 100; b.wave = 0; b.parts = [];
        b.waves = [{ n: 6, share: 0.30 }, { n: 8, share: 0.28 }, { n: 1, share: 0.42 }];
        b.reserve = b.H; b.waveT = 30;
      },
      spawnWave(b) {
        const w = b.waves[b.wave];
        const hp = Math.max(1, Math.round(b.H * w.share / w.n));
        b.reserve -= hp * w.n; if (b.wave === b.waves.length - 1) { b.reserve = 0; }
        b.parts = [];
        if (b.wave < 2) for (let i = 0; i < w.n; i++) b.parts.push(part('bird' + i, 0, 0, 7, 6, { hp, vuln: true, ang: i / w.n * TAU, bird: true }));
        else b.parts.push(part('eye', 0, 0, 16, 16, { hp: Math.round(b.H * w.share), vuln: true }));
        b.waveStart = b.t;
      },
      update(b, g) {
        if (b.parts.length === 0 || b.parts.every(p => p.dead)) {
          if (b.wave >= b.waves.length) return;
          if (b.waveT-- > 0) return;
          this.spawnWave(b); b.wave++; b.waveT = 70;
          g.notice(b.wave < 3 ? 'OLEADA ' + b.wave : '¡EL OJO DE LA TORMENTA!');
        }
        const tt = b.t - b.waveStart;
        if (b.wave <= 2) {
          const sp = b.wave === 1 ? 0.025 : 0.035, R = 50 + Math.sin(tt * 0.02) * 20;
          b.lx = 200 + Math.sin(tt * 0.013) * 60; b.ly = 110 + Math.sin(tt * 0.017) * 30;
          const alive = b.parts.filter(p => !p.dead);
          for (const p of b.parts) { p.ang += sp; p.ox = Math.cos(p.ang) * R; p.oy = Math.sin(p.ang) * R * 0.8; }
          const rate = fr(b, b.def.fireRate * (b.wave === 1 ? 1 : 0.7) * (0.6 + 0.4 * alive.length / b.parts.length));
          if (alive.length && tt % rate === 0) { const p = alive[(tt / rate | 0) % alive.length]; aim(g, b, b.lx + p.ox, b.ly + p.oy, 0, 1.1); }
        } else {
          const eye = b.parts[0], frac = Math.max(0, eye.hp / eye.maxHp);
          b.lx = 220 + Math.sin(tt * 0.02) * 60; b.ly = 110 + Math.sin(tt * 0.031) * 55;
          const rate = fr(b, 70 * (0.35 + 0.65 * frac));      // la cadencia aumenta al perder vida
          if (tt % rate === 0) { ring(g, b, b.lx, b.ly, 10, tt * 0.05, 0.9); }
          if (tt % fr(b, 50) === 25) aim(g, b, b.lx, b.ly, 0, 1.3);
        }
      }
    },

    // 6. DUNE BEHEMOTH — gran criatura acorazada; punto vulnerable en la cabeza
    dune: {
      init(b) {
        b.lx = 360; b.ly = 166;
        b.parts = [part('shell', 6, -6, 32, 18, { armor: true }), part('head', -36, -2, 9, 8, { hp: b.H, vuln: false, solid: true })];
        b.ext = 0; b.mt = 0; b.mode = 'walk';
      },
      update(b, g) {
        if (b.t < 80) { b.lx -= 1.2; return; }
        b.mt++;
        const head = b.parts[1];
        b.lx = 220 + Math.sin(b.t * 0.008) * 50;
        if (b.mode === 'walk') {
          b.ext = Math.max(0, b.ext - 0.05);
          if (b.mt % fr(b, 60) === 0) for (let i = 0; i < 3; i++) { const s = sh(g, b, b.lx + 6 + (i - 1) * 14, b.ly - 24, (playerLX(g) - b.lx) / 90 + (i - 1) * 0.5, -3.2, 3); s.gy = 0.06; }
          if (b.mt > 200) { b.mode = 'head'; b.mt = 0; }
        } else {
          b.ext = Math.min(1, b.ext + 0.05);
          if (b.ext >= 1 && b.mt % fr(b, b.def.fireRate) === 0) { for (const s of [-0.25, 0, 0.25]) aim(g, b, b.lx - 40, b.ly - 2 - 10 * b.ext, s, 1); }
          if (b.mt > 190) { b.mode = 'walk'; b.mt = 0; }
        }
        head.ox = -30 - 12 * b.ext; head.oy = -2 - 12 * b.ext;
        head.vuln = b.ext > 0.6;
      }
    },

    // 7. CORE COLOSSUS — entidad biomecánica: ataques de aproximación, varios patrones y ventanas
    colossus: {
      init(b) {
        b.lx = 360; b.ly = 110; b.home = 252;
        b.parts = [
          part('body', 0, 0, 22, 34, { armor: true }),
          part('armL', -16, -38, 10, 8, { armor: true }), part('armR', -16, 38, 10, 8, { armor: true }),
          part('eye', -20, 0, 8, 9, { hp: b.H, vuln: false, solid: false })
        ];
        b.pattern = 0; b.mt = 0; b.eyeOpen = 0;
      },
      update(b, g) {
        if (b.t < 60) { b.lx -= 1.8; return; }
        b.mt++;
        const eye = b.parts[3], pat = b.pattern % 3;
        if (pat === 0) { // ráfagas dirigidas, ojo abierto
          b.lx += (b.home - b.lx) * 0.05; b.ly = 110 + Math.sin(b.t * 0.03) * 50; b.eyeOpen = 1;
          if (b.mt % fr(b, b.def.fireRate) === 0) for (let i = -2; i <= 2; i++) aim(g, b, b.lx - 22, b.ly, i * 0.13, 1);
          if (b.mt > 220) { b.pattern++; b.mt = 0; }
        } else if (pat === 1) { // espiral, ojo cerrado
          b.eyeOpen = 0; b.ly += (110 - b.ly) * 0.04;
          if (b.mt % fr(b, 6) === 0) { const a = b.mt * 0.21; sh(g, b, b.lx - 10, b.ly, Math.cos(a) * b.bs, Math.sin(a) * b.bs); sh(g, b, b.lx - 10, b.ly, -Math.cos(a) * b.bs, -Math.sin(a) * b.bs); }
          if (b.mt > 200) { b.pattern++; b.mt = 0; b.target = { x: U.clamp(playerLX(g) + 30, 50, 260), y: U.clamp(g.player.y, 50, 170) }; }
        } else { // aproximación: embiste hacia el jugador, después ventana de vulnerabilidad
          if (b.mt < 30) { b.shakeX = b.mt % 4 < 2 ? 2 : -2; b.eyeOpen = 0; }
          else if (b.mt < 90) { b.shakeX = 0; b.lx += (b.target.x - b.lx) * 0.09; b.ly += (b.target.y - b.ly) * 0.09; }
          else if (b.mt < 190) { b.eyeOpen = 1; if (b.mt === 92) ring(g, b, b.lx, b.ly, 12, 0, 0.8); }
          else { b.lx += (b.home - b.lx) * 0.06; if (b.mt > 240) { b.pattern++; b.mt = 0; } }
        }
        eye.vuln = b.eyeOpen > 0;
      }
    },

    // 8. ABYSSAL CROWN — jefe definitivo: tres fases y secuencia final de destrucción
    crown: {
      init(b) {
        b.lx = 360; b.ly = 108; b.home = 236;
        const gem = Math.round(b.H * 0.12);
        b.parts = [part('core', 0, 0, 14, 14, { hp: b.H - gem * 4, vuln: false, armor: true })];
        [[-30, -30], [-34, 10], [-10, 40], [-10, -46]].forEach((o, i) => b.parts.push(part('gem' + i, o[0], o[1], 7, 7, { hp: gem, vuln: true, bx: o[0], by: o[1] })));
        b.parts.push(part('halo', 18, 0, 10, 40, { armor: true }));
        b.phase = 1;
      },
      update(b, g) {
        if (b.t < 90) { b.lx -= 1.4; return; }
        const core = b.parts[0], gems = b.parts.slice(1, 5), aliveGems = gems.filter(p => !p.dead);
        const frac = core.hp / core.maxHp;
        const newPhase = aliveGems.length ? 1 : frac > 0.45 ? 2 : 3;
        if (newPhase !== b.phase) { b.phase = newPhase; g.notice(newPhase === 2 ? 'EL NÚCLEO SE ABRE' : '¡FURIA DEL ABISMO!'); g.flashT = 10; RFS.Audio.sfx('warning'); }
        core.vuln = b.phase > 1; core.armor = !core.vuln;
        gems.forEach((p, i) => { p.ox = p.bx + Math.sin(b.t * 0.04 + i) * 4; p.oy = p.by + Math.cos(b.t * 0.05 + i) * 4; });
        if (b.phase === 1) {
          b.lx += (b.home - b.lx) * 0.04; b.ly = 112 + Math.sin(b.t * 0.02) * 40;
          if (b.t % fr(b, b.def.fireRate) === 0 && aliveGems.length) { const p = aliveGems[(b.t / 5 | 0) % aliveGems.length]; aim(g, b, b.lx + p.ox, b.ly + p.oy, -0.12); aim(g, b, b.lx + p.ox, b.ly + p.oy, 0.12); }
          if (b.t % fr(b, 160) === 0) ring(g, b, b.lx, b.ly, 12, b.t * 0.02, 0.7);
        } else if (b.phase === 2) {
          b.lx = 200 + Math.sin(b.t * 0.017) * 70; b.ly = 112 + Math.sin(b.t * 0.027) * 55;
          if (b.t % fr(b, 7) === 0) { const a = b.t * 0.13; for (let k = 0; k < 3; k++) sh(g, b, b.lx, b.ly, Math.cos(a + k * TAU / 3) * b.bs * 0.9, Math.sin(a + k * TAU / 3) * b.bs * 0.9); }
          if (b.t % fr(b, 90) === 0) aim(g, b, b.lx, b.ly, 0, 1.4);
        } else {
          b.lx = 170 + Math.sin(b.t * 0.025) * 100; b.ly = 112 + Math.sin(b.t * 0.04) * 60;
          if (b.t % fr(b, 5) === 0) { const a = b.t * 0.17; for (let k = 0; k < 4; k++) sh(g, b, b.lx, b.ly, Math.cos(a + k * TAU / 4) * b.bs, Math.sin(a + k * TAU / 4) * b.bs); }
          if (b.t % fr(b, 70) === 0) ring(g, b, b.lx, b.ly, 16, 0, 0.6);
          if (b.t % 240 === 0 && RFS.EnemyController.countActive(g) < 4) RFS.EnemyController.create(g, 'chaser', g.camX + (Math.random() < 0.5 ? -20 : 340), 40 + Math.random() * 140);
        }
      }
    }
  };

  // =========================================================================
  const B = RFS.BossController = {
    TYPES,
    spawn(g, key, mods) {
      const def = RFS.CONFIG.bosses[key], m = mods || {};
      const b = { key, def, name: def.name, t: 0, H: Math.round(def.hp * (m.hpMult || 1)), bm: m.bulletMult || 1, fm: m.fireMult || 1, dying: false, dieT: 0, shakeX: 0, final: key === 'crown' };
      b.bs = def.bulletSpeed * b.bm;
      TYPES[key].init(b);
      for (const p of b.parts) p.maxHp = p.hp;
      b.maxHp = b.H; b.hp = b.H;
      g.boss = b;
      return b;
    },
    world(g, b, p) { return { x: U.mod(g.camX + b.lx + p.ox + (b.shakeX || 0), g.W), y: b.ly + p.oy }; },
    update(g) {
      const b = g.boss; if (!b) return;
      b.t++;
      for (const p of b.parts) if (p.flash > 0) p.flash--;
      if (b.dying) {
        b.dieT++;
        const dur = b.final ? 300 : 130;
        if (b.dieT % (b.final ? 4 : 6) === 0) {
          const p = b.parts[Math.floor(Math.random() * b.parts.length)], w = this.world(g, b, p);
          g.fx.push({ type: 'boom', x: w.x + (Math.random() - 0.5) * 40, y: w.y + (Math.random() - 0.5) * 40, t: 0, life: 22, size: 10 + Math.random() * 12 });
          RFS.Audio.sfx(b.dieT % 24 === 0 ? 'bigexplode' : 'explode');
          g.shake = Math.max(g.shake, 6);
        }
        if (b.final && b.dieT % 60 === 0) g.flashT = 14;
        b.ly += b.final ? 0 : 0.25;
        if (b.dieT >= dur) { g.boss = null; g.onBossDefeated(b); }
        return;
      }
      TYPES[b.key].update(b, g);
      let hp = b.reserve || 0;
      for (const p of b.parts) if (!p.dead) hp += Math.max(0, p.hp);
      b.hp = hp;
      // colisión del cuerpo con el jugador
      const pl = g.player, H = RFS.CONFIG.player.hitbox;
      if (pl.alive) for (const p of b.parts) {
        if (p.dead || !p.solid) continue;
        const w = this.world(g, b, p);
        if (U.hit(pl.x, pl.y, H.hw, H.hh, w.x, w.y, p.hw - 2, p.hh - 2, g.W)) { RFS.PlayerHealth.hurt(g, 1); break; }
      }
      if (b.hp <= 0 && !(b.waves && b.wave < b.waves.length)) this.die(g, b);
    },
    die(g, b) {
      b.dying = true; b.dieT = 0; g.ebullets.length = 0;
      for (const e of g.enemies) e.dead = true;
      RFS.Audio.sfx('bigexplode');
    },
    applyDamage(g, b, p, dmg, kind) {
      const cap = RFS.CONFIG.bossDamageCap[kind];
      if (cap) dmg = Math.min(dmg, Math.max(1, Math.round(cap * b.maxHp)));
      p.hp -= dmg; p.flash = 4; g.stats.bossDamage += dmg;
      if (p.hp <= 0) {
        p.dead = true; p.hp = 0;
        const w = this.world(g, b, p);
        g.fx.push({ type: 'boom', x: w.x, y: w.y, t: 0, life: 24, size: 16 });
        RFS.Audio.sfx('explode');
        if (p.bird) RFS.CurrencySystem.drop(g, w.x, w.y, 'medium');
      } else RFS.Audio.sfx('hit');
    },
    hit(g, x, y, hw, hh, dmg, kind) {
      const b = g.boss; if (!b || b.dying || b.t < 40) return null;
      let blocked = false;
      for (const p of b.parts) {
        if (p.dead) continue;
        const w = this.world(g, b, p);
        if (!U.hit(x, y, hw, hh, w.x, w.y, p.hw, p.hh, g.W)) continue;
        if (p.vuln && p.hp > 0) { this.applyDamage(g, b, p, dmg, kind); return 'hit'; }
        if (p.solid || p.armor) blocked = true;
      }
      return blocked ? 'block' : null;
    },
    areaHit(g, dmg, kind) {
      const b = g.boss; if (!b || b.dying || b.t < 40) return;
      const p = b.parts.find(q => !q.dead && q.vuln && q.hp > 0);
      if (p) this.applyDamage(g, b, p, dmg, kind);
    },
    targets(g) {
      const b = g.boss; if (!b || b.dying) return [];
      return b.parts.filter(p => !p.dead && p.vuln).map(p => this.world(g, b, p));
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
