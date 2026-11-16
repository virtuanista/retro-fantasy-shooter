/* ProjectileSystem: disparos del jugador, bombas/misiles y proyectiles enemigos. */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util;

  const P = RFS.ProjectileSystem = {
    shot(g, x, y, vx, vy, opts) {
      g.shots.push(Object.assign({ x: U.mod(x, g.W), y, vx, vy, dmg: 1, life: RFS.CONFIG.basicShot.life, kind: 'basic', hw: 4, hh: 2 }, opts || {}));
    },
    bomb(g, x, y, vx, vy, opts) {
      g.bombs.push(Object.assign({ x: U.mod(x, g.W), y, vx, vy, dmg: 4, kind: 'basic', life: RFS.CONFIG.basicBomb.life, hw: 3, hh: 3, grav: RFS.CONFIG.basicBomb.gravity }, opts || {}));
    },
    enemyShot(g, x, y, vx, vy, r) {
      if (g.ebullets.length > 160) return {};
      const b = { x: U.mod(x, g.W), y, vx, vy, r: r || 2, life: 360 };
      g.ebullets.push(b);
      return b;
    },
    aimed(g, x, y, speed, spread) {
      const p = g.player; const dx = U.wdx(x, p.x, g.W), dy = p.y - y;
      const a = Math.atan2(dy, dx) + (spread || 0);
      this.enemyShot(g, x, y, Math.cos(a) * speed, Math.sin(a) * speed);
    },
    ring(g, x, y, n, speed, off) {
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (off || 0); this.enemyShot(g, x, y, Math.cos(a) * speed, Math.sin(a) * speed); }
    },

    /** Aplica daño a lo que toque la caja; devuelve 'hit' | 'block' | null. */
    strike(g, x, y, hw, hh, dmg, kind, skip) {
      for (const e of g.enemies) {
        if (e.dead || (skip && skip.has(e))) continue;
        if (U.hit(x, y, hw, hh, e.x, e.y, e.hw, e.hh, g.W)) { RFS.EnemyController.damage(g, e, dmg); if (skip) skip.add(e); return 'enemy'; }
      }
      for (const b of g.bases) {
        if (b.dead) continue;
        if (U.hit(x, y, hw, hh, b.x, b.y, b.hw, b.hh, g.W)) { RFS.EnemyBase.damage(g, b, dmg); return 'hit'; }
      }
      if (g.boss) { const r = RFS.BossController.hit(g, x, y, hw, hh, dmg, kind); if (r) return r; }
      return null;
    },
    /** Daño en área (bomba pesada). */
    blast(g, x, y, radius, dmg) {
      g.fx.push({ type: 'ring', x, y, r: 4, max: radius, t: 0, life: 22, color: '#fff7a0' });
      for (const e of g.enemies) if (!e.dead && U.dist(x, y, e.x, e.y, g.W) < radius + e.hw) RFS.EnemyController.damage(g, e, dmg);
      for (const b of g.bases) if (!b.dead && U.dist(x, y, b.x, b.y, g.W) < radius + b.hw) RFS.EnemyBase.damage(g, b, dmg);
      if (g.boss) RFS.BossController.hit(g, x, y, radius, radius, dmg, 'heavy');
      g.shake = Math.max(g.shake, 8);
    },
    nearestTarget(g, x, y, range) {
      let best = null, bd = range;
      const consider = (tx, ty, ref) => { const d = U.dist(x, y, tx, ty, g.W); if (d < bd) { bd = d; best = { x: tx, y: ty, ref }; } };
      for (const e of g.enemies) if (!e.dead) consider(e.x, e.y, e);
      for (const b of g.bases) if (!b.dead) consider(b.x, b.y, b);
      if (g.boss) for (const t of RFS.BossController.targets(g)) consider(t.x, t.y, t);
      return best;
    },

    update(g) {
      const S = RFS.CONFIG.screen, W = g.W;
      // --- disparos del jugador
      for (let i = g.shots.length - 1; i >= 0; i--) {
        const s = g.shots[i];
        if (s.kind === 'seeker') {
          const t = this.nearestTarget(g, s.x, s.y, 220);
          const sp = Math.hypot(s.vx, s.vy);
          if (t) {
            const want = Math.atan2(t.y - s.y, U.wdx(s.x, t.x, W));
            let cur = Math.atan2(s.vy, s.vx), d = want - cur;
            while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
            cur += U.clamp(d, -s.turn, s.turn);
            s.vx = Math.cos(cur) * sp; s.vy = Math.sin(cur) * sp;
          }
        }
        s.x = U.mod(s.x + s.vx, W); s.y += s.vy; s.life--;
        let gone = s.life <= 0 || s.y < S.topY - 8 || s.y > S.groundY + 4;
        if (!gone) {
          const r = this.strike(g, s.x, s.y, s.hw, s.hh, s.dmg, s.kind, s.pierce ? (s.hitSet || (s.hitSet = new Set())) : null);
          if (r && !(s.pierce && r === 'enemy')) gone = true;
          if (r === 'block') RFS.Audio.sfx('tink');
        }
        if (gone) g.shots.splice(i, 1);
      }
      // --- bombas y misiles
      for (let i = g.bombs.length - 1; i >= 0; i--) {
        const b = g.bombs[i];
        if (b.kind === 'rocket') { b.vx = U.clamp(b.vx + b.accel * Math.sign(b.vx), -b.maxSpeed, b.maxSpeed); if (g.t % 3 === 0) g.fx.push({ type: 'puff', x: b.x, y: b.y, t: 0, life: 14 }); }
        else b.vy += b.grav;
        b.x = U.mod(b.x + b.vx, W); b.y += b.vy; b.life--;
        let gone = b.life <= 0;
        if (b.y >= S.groundY - 2) { gone = true; this.explodeBomb(g, b); }
        else if (!gone) {
          const r = this.strike(g, b.x, b.y, b.hw, b.hh, b.kind === 'mega' ? 0 : b.dmg, b.kind === 'mega' ? 'heavy' : b.kind === 'rocket' ? 'missile' : 'bomb');
          if (r) { gone = true; this.explodeBomb(g, b); }
        }
        if (gone) g.bombs.splice(i, 1);
      }
      // --- proyectiles enemigos
      const p = g.player, H = RFS.CONFIG.player.hitbox;
      for (let i = g.ebullets.length - 1; i >= 0; i--) {
        const e = g.ebullets[i];
        if (!e) continue; // la lista puede vaciarse al morir el jugador
        if (e.gy) e.vy += e.gy;
        e.x = U.mod(e.x + e.vx, W); e.y += e.vy; e.life--;
        let gone = e.life <= 0 || e.y < S.topY - 10 || e.y > S.groundY + 6;
        if (!gone && Math.abs(U.wdx(g.camX + 160, e.x, W)) > 260) gone = true;
        if (!gone && p.alive && U.hit(p.x, p.y, H.hw, H.hh, e.x, e.y, e.r * 0.7, e.r * 0.7, W)) {
          RFS.PlayerHealth.hurt(g, 1); gone = true;
        }
        if (gone) g.ebullets.splice(i, 1);
      }
    },
    explodeBomb(g, b) {
      if (b.kind === 'mega') { this.blast(g, b.x, b.y, RFS.CONFIG.bombs.megabomb.radius, b.dmg); RFS.Audio.sfx('bigexplode'); }
      else { g.fx.push({ type: 'boom', x: b.x, y: b.y, t: 0, life: 16, size: 8 }); RFS.Audio.sfx('explode'); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
