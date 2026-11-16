/* StageManager (carga y progresión de niveles), ShopController (globo de tienda
 * y objeto de selección de equipamiento) y HazardSystem (peligros del escenario). */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;

  // ---------------------------------------------------------------------
  RFS.StageManager = {
    count() { return RFS.CONFIG.levels.length + 1; }, // 7 niveles + fase final
    isGauntlet(idx) { return idx >= RFS.CONFIG.levels.length; },
    levelDef(idx) {
      const C = RFS.CONFIG;
      if (!this.isGauntlet(idx)) return C.levels[idx];
      const G = C.gauntlet, last = C.levels[C.levels.length - 1];
      return {
        id: C.levels.length + 1, name: G.name, theme: G.theme, worldW: G.worldW, gauntlet: true,
        baseHp: 0, baseSpawn: { fam: 'chaser', every: 99999 }, hpMult: last.hpMult, speedMult: last.speedMult,
        fireMult: last.fireMult, bulletSpeed: last.bulletSpeed, spawnInterval: 99999, maxEnemies: 4,
        rewardMult: G.rewardMult * last.rewardMult, table: { chaser: 1 }, shop: null, equipToken: null, music: G.music
      };
    },
    load(g, idx) {
      const S = RFS.CONFIG.screen;
      g.levelIdx = idx; g.level = this.levelDef(idx); g.W = g.level.worldW;
      g.enemies = []; g.shots = []; g.bombs = []; g.ebullets = []; g.coins = []; g.fx = []; g.hazards = [];
      g.boss = null; g.arena = false; g.spawnsStopped = false; g.balloon = null; g.token = null;
      if (g.level.gauntlet) { g.bases = []; g.basesLeft = 0; g.gIdx = 0; }
      else RFS.EnemyBase.create(g);
      // el jugador aparece a medio camino entre dos bases, nunca encima de una
      const startX = g.bases.length ? U.mod((g.bases[0].x + U.wdx(g.bases[0].x, g.bases[1].x, g.W) / 2), g.W) : g.W / 2;
      g.player = RFS.PlayerController.create(startX, (S.topY + S.groundY) / 2);
      g.player.invuln = 120;
      g.camX = g.player.x - (S.w / 2 - RFS.CONFIG.player.cameraLead);
      RFS.EnemySpawner.reset(g);
      RFS.ShopController.reset(g);
      RFS.HazardSystem.reset(g);
      g.bulletMult = 1;
      g.setState('intro'); g.introT = 0;
      g.playMusic('level' + g.level.id, g.level.music);
    },
    /** Inicia el combate contra un jefe en la arena actual. */
    startBoss(g, key) {
      const G = RFS.CONFIG.gauntlet;
      g.arena = true;
      g.camX = Math.round(g.camX);
      const mods = g.level.gauntlet ? { hpMult: G.hpMult, bulletMult: G.bulletSpeedMult, fireMult: G.fireMult } : {};
      if (key === G.finalBoss) Object.assign(mods, { hpMult: 1, bulletMult: 1, fireMult: 1 });
      RFS.BossController.spawn(g, key, mods);
      g.setState('boss');
      g.playMusic(key === G.finalBoss ? 'final' : 'boss', key === G.finalBoss ? RFS.CONFIG.music.final : RFS.CONFIG.music.boss);
    },
    nextBossKey(g) {
      const G = RFS.CONFIG.gauntlet;
      if (!g.level.gauntlet) return g.level.boss;
      return g.gIdx < G.sequence.length ? G.sequence[g.gIdx] : G.finalBoss;
    }
  };

  // ---------------------------------------------------------------------
  RFS.ShopController = {
    reset(g) {
      const L = g.level;
      g.shopT = L.shop ? L.shop.first : Infinity;
      g.tokenT = L.equipToken ? L.equipToken.first : Infinity;
      g.balloon = null; g.token = null;
    },
    spawnBalloon(g, inArena) {
      const S = RFS.CONFIG.screen, p = g.player;
      const sx = inArena ? (U.wdx(g.camX, p.x, g.W) < S.w / 2 ? 250 : 70) : (p.facing > 0 ? S.w - 40 : 40) + (Math.random() - 0.5) * 60;
      g.balloon = { x: U.mod(g.camX + sx, g.W), y: S.groundY + 12, vy: -RFS.CONFIG.shop.balloonSpeed * 2, life: RFS.CONFIG.shop.balloonLife, t: 0, hoverY: 70 + Math.random() * 60 };
    },
    spawnToken(g) {
      const S = RFS.CONFIG.screen;
      g.token = { x: U.mod(g.camX + (Math.random() < 0.5 ? -20 : S.w + 20), g.W), y: 60 + Math.random() * 100, vx: 0, t: 0, life: RFS.CONFIG.shop.equipTokenLife };
      g.token.vx = U.wdx(g.token.x, g.player.x, g.W) > 0 ? 0.5 : -0.5;
    },
    update(g) {
      const L = g.level, p = g.player, H = RFS.CONFIG.player.hitbox;
      if (g.state === 'play') {
        if (!g.balloon && --g.shopT <= 0) { this.spawnBalloon(g); g.shopT = L.shop.interval; }
        if (!g.token && --g.tokenT <= 0) { this.spawnToken(g); g.tokenT = L.equipToken.interval; }
      }
      const bl = g.balloon;
      if (bl) {
        bl.t++; bl.life--;
        if (bl.life > 0) { if (bl.y > bl.hoverY) bl.y += bl.vy; else bl.y = bl.hoverY + Math.sin(bl.t * 0.03) * 6; bl.x = U.mod(bl.x + Math.sin(bl.t * 0.02) * 0.3, g.W); }
        else { bl.y -= 0.8; if (bl.y < -20) g.balloon = null; }
        if (g.balloon && p.alive && U.hit(p.x, p.y, H.hw + 2, H.hh + 2, bl.x, bl.y, 10, 12, g.W)) { g.balloon = null; g.openShop(); }
      }
      const tk = g.token;
      if (tk) {
        tk.t++; tk.life--; tk.x = U.mod(tk.x + tk.vx, g.W); tk.y += Math.sin(tk.t * 0.05) * 0.5;
        if (tk.life <= 0) g.token = null;
        else if (p.alive && U.hit(p.x, p.y, H.hw + 2, H.hh + 2, tk.x, tk.y, 7, 7, g.W)) { g.token = null; g.openEquip(); }
      }
    }
  };

  // ---------------------------------------------------------------------
  RFS.HazardSystem = {
    reset(g) { g.hazards = []; const h = RFS.CONFIG.hazards[g.level.theme]; g.hazardT = h ? h.every : Infinity; },
    update(g) {
      const h = RFS.CONFIG.hazards[g.level.theme], S = RFS.CONFIG.screen, p = g.player, HB = RFS.CONFIG.player.hitbox;
      if (h && g.state === 'play' && --g.hazardT <= 0) {
        g.hazardT = Math.round(h.every * (0.7 + Math.random() * 0.6) / Math.max(1, g.level.speedMult * 0.9));
        const sx = 30 + Math.random() * (S.w - 60);
        const z = { type: h.type, x: U.mod(g.camX + sx, g.W), t: 0, h };
        if (h.type === 'faller') { z.y = S.topY + 2; z.vy = 0; }
        if (h.type === 'riser') { z.y = S.groundY; z.x0 = z.x; }
        g.hazards.push(z);
      }
      for (let i = g.hazards.length - 1; i >= 0; i--) {
        const z = g.hazards[i]; z.t++;
        let box = null, done = false;
        if (z.type === 'geyser') {
          const a = z.t - z.h.warn;
          if (a > 0) { const k = Math.min(1, a / 10) * (a > z.h.active - 10 ? Math.max(0, (z.h.active - a) / 10) : 1); z.len = z.h.height * k; box = { x: z.x, y: S.groundY - z.len / 2, hw: 6, hh: z.len / 2 }; }
          done = a > z.h.active;
        } else if (z.type === 'bolt') {
          const a = z.t - z.h.warn;
          if (a > 0) box = { x: z.x, y: (S.topY + S.groundY) / 2, hw: 5, hh: (S.groundY - S.topY) / 2 };
          done = a > z.h.active;
        } else if (z.type === 'faller') {
          if (z.t > z.h.warn) { z.vy += z.h.speed; z.y += z.vy; }
          box = { x: z.x, y: z.y + 4, hw: 3, hh: 6 };
          if (z.y > S.groundY - 6) { done = true; g.fx.push({ type: 'shards', x: z.x, y: S.groundY - 4, t: 0, life: 20 }); }
        } else if (z.type === 'riser') {
          z.y -= z.h.speed; z.x = U.mod(z.x0 + Math.sin(z.t * 0.05) * 10, g.W);
          box = { x: z.x, y: z.y, hw: 4, hh: 4 };
          done = z.y < S.topY;
        }
        if (box && box.hh > 1 && p.alive && U.hit(p.x, p.y, HB.hw, HB.hh, box.x, box.y, box.hw, box.hh, g.W)) RFS.PlayerHealth.hurt(g, 1);
        if (done || g.state !== 'play' && z.type !== 'faller' && z.type !== 'riser' && z.t > 400) g.hazards.splice(i, 1);
      }
      if (g.state !== 'play' && g.state !== 'pause') g.hazards = g.hazards.filter(z => z.type === 'faller' || z.type === 'riser' ? z.y < RFS.CONFIG.screen.groundY : false);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
