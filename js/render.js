/* Render y HUDController: dibuja el mundo, la interfaz y los menús a partir
 * del estado de la partida (solo lectura). */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const U = RFS.util, TAU = Math.PI * 2;
  let S; // RFS.Sprites
  const txt = (...a) => S.text(...a);

  const big = {};
  function textBig(ctx, str, x, y, color, scale, shadow) {
    const key = str + color + scale;
    if (!big[key]) {
      const w = str.length * 6 + 2, c = document.createElement('canvas'); c.width = w; c.height = 12;
      S.text(c.getContext('2d'), str, 1, 2, color, 'l', shadow || '#1a0a3a');
      big[key] = c;
    }
    const c = big[key];
    ctx.drawImage(c, Math.round(x - c.width * scale / 2), y, c.width * scale, c.height * scale);
  }

  function panel(ctx, x, y, w, h, fill, border) {
    ctx.fillStyle = fill || 'rgba(10,6,30,0.92)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = border || '#ffd040'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  }

  const R = RFS.Renderer = {
    init() { S = RFS.Sprites; S.init(); },
    draw(ctx, g) {
      const C = RFS.CONFIG.screen;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, C.w, C.h);
      const st = g.state;
      if (st === 'title' || st === 'options' || st === 'controls' || st === 'records') { this.drawTitle(ctx, g); return; }
      ctx.save();
      if (g.shake > 0.5) ctx.translate(Math.round((Math.random() - 0.5) * g.shake), Math.round((Math.random() - 0.5) * g.shake * 0.6));
      this.drawWorld(ctx, g);
      ctx.restore();
      if (g.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, g.flashT / 16)})`; ctx.fillRect(0, C.hudH, C.w, C.groundY - C.hudH); }
      this.drawHUD(ctx, g);
      this.drawOverlay(ctx, g);
    },

    // ---------------------------------------------------------------- mundo
    drawWorld(ctx, g) {
      const C = RFS.CONFIG.screen, theme = g.level.theme, bg = S.bg(theme), W = g.W, cam = g.camX, t = g.t;
      const top = C.hudH;
      ctx.drawImage(bg.sky, 0, top);
      const layer = (img, f, y) => { const w = img.width; let ox = -U.mod(cam * f, w); for (let x = ox; x < C.w; x += w) ctx.drawImage(img, Math.round(x), y); };
      layer(bg.far, 0.2, top); layer(bg.mid, 0.5, top); layer(bg.ground, 1, C.groundY);
      if (theme === 'fire' && t % 2 === 0) { ctx.fillStyle = '#ff9a20'; for (let i = 0; i < 4; i++) ctx.fillRect(U.mod(i * 97 - cam * 1 + Math.sin(t * 0.05 + i) * 4, C.w), C.groundY + 4 + i * 2, 6, 1); }
      if (theme === 'ice' || theme === 'void') { ctx.fillStyle = theme === 'ice' ? '#ffffff' : '#8a4aaa'; for (let i = 0; i < 26; i++) { const x = U.mod(i * 53 - cam * 0.8 + Math.sin(t * 0.02 + i) * 10, C.w), y = top + U.mod(i * 37 + t * (0.4 + (i % 3) * 0.2), C.groundY - top); ctx.fillRect(x | 0, y | 0, 1 + (i % 2), 1 + (i % 2)); } }
      if (theme === 'water') { ctx.fillStyle = '#5af0e0'; for (let i = 0; i < 14; i++) { const x = U.mod(i * 71 - cam * 0.7 + Math.sin(t * 0.03 + i) * 6, C.w), y = C.groundY - U.mod(i * 41 + t * 0.5, C.groundY - top); ctx.fillRect(x | 0, y | 0, 2, 2); } }
      const sx = x => U.screenX(x, cam, W, 64);
      const vis = x => x > -48 && x < C.w + 48;

      // peligros (debajo)
      for (const z of g.hazards) this.drawHazard(ctx, g, z, sx(z.x));
      // bases
      for (const b of g.bases) {
        if (b.dead) continue;
        const x = sx(b.x); if (!vis(x)) continue;
        const bob = b.ground ? 0 : Math.round(Math.sin(b.t * 0.05) * 2);
        ctx.drawImage(S.base(theme, b.ground, b.flash > 0), Math.round(x - 14), Math.round(b.y - 14 + bob));
        const pulse = (Math.sin(b.t * 0.15) + 1) / 2;
        ctx.fillStyle = pulse > 0.5 ? S.THEMES[theme].base[2] : '#ffffff';
        const cy = b.ground && theme !== 'desert' ? b.y + 1 : b.y; ctx.fillRect(Math.round(x - 2), Math.round(cy - 2 + bob), 4, 4);
        if (b.hp < b.maxHp) { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - 10), Math.round(b.y - 19), 20, 3); ctx.fillStyle = '#ff4060'; ctx.fillRect(Math.round(x - 9), Math.round(b.y - 18), Math.round(18 * b.hp / b.maxHp), 1); }
      }
      // monedas
      for (const c of g.coins) {
        const x = sx(c.x); if (!vis(x)) continue;
        if (c.life < RFS.CONFIG.coins.blinkAt && t % 6 < 3) continue;
        const img = S.coins[c.type][(c.t >> 3) % 4];
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(c.y - img.height / 2));
      }
      // globo de tienda y objeto de selección
      if (g.balloon) { const x = sx(g.balloon.x); if (vis(x)) { const img = S.balloon[(t >> 4) % 2]; ctx.drawImage(img, Math.round(x - 11), Math.round(g.balloon.y - 12)); if (g.balloon.life < 180 && t % 8 < 4) txt(ctx, '!', x, g.balloon.y - 22, '#ff4060'); } }
      if (g.token) { const x = sx(g.token.x); if (vis(x)) { const img = S.token[(t >> 3) % 2]; ctx.drawImage(img, Math.round(x - 7), Math.round(g.token.y - 7)); txt(ctx, 'EQ', x, g.token.y + 9, '#40e0ff', 'c'); } }
      // enemigos
      for (const e of g.enemies) {
        const x = sx(e.x); if (!vis(x)) continue;
        const f = (e.t >> 3) % 2;
        const left = e.vx < 0 || (e.vx === 0 && U.wdx(e.x, g.player.x, W) < 0);
        const img = S.enemy(e.fam, theme, f, e.flash > 0 ? 'W' : left);
        ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(e.y - img.height / 2));
      }
      // jefe
      if (g.boss) this.drawBoss(ctx, g, g.boss);
      // jugador
      const p = g.player;
      if (p.alive && !(p.invuln > 0 && t % 4 < 2)) {
        const x = sx(p.x), f = (t >> 2) % 2;
        const img = p.facing > 0 ? S.player[f] : S.playerL[f];
        ctx.drawImage(img, Math.round(x - 10), Math.round(p.y - 7));
        if (g.inv.shield) { ctx.strokeStyle = t % 6 < 3 ? '#80f0ff' : '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(p.y), 12, 0, TAU); ctx.stroke(); }
        if (g.inv.auto && t % 30 < 15) { ctx.fillStyle = '#ffe060'; ctx.fillRect(Math.round(x - 1), Math.round(p.y - 10), 2, 2); }
      }
      // disparos
      for (const s of g.shots) {
        const x = Math.round(sx(s.x)), y = Math.round(s.y);
        if (s.kind === 'laser') { ctx.fillStyle = '#ff40c0'; ctx.fillRect(x - s.hw, y - 2, s.hw * 2, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s.hw, y - 1, s.hw * 2, 2); }
        else if (s.kind === 'seeker') { ctx.fillStyle = '#40ff80'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
        else if (s.kind === 'fan') { ctx.fillStyle = '#40e0ff'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
        else { ctx.fillStyle = '#ffe060'; ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 1, 4, 1); }
      }
      for (const b of g.bombs) {
        const x = Math.round(sx(b.x)), y = Math.round(b.y);
        if (b.kind === 'rocket') { const d = Math.sign(b.vx); ctx.fillStyle = '#d0d0e0'; ctx.fillRect(x - 4, y - 1, 8, 3); ctx.fillStyle = '#ff4060'; ctx.fillRect(x + d * 4 - (d < 0 ? 2 : 0), y - 1, 2, 3); ctx.fillStyle = t % 4 < 2 ? '#ffe060' : '#ff8020'; ctx.fillRect(x - d * 6 - 1, y, 3, 1); }
        else { const r = b.kind === 'mega' ? 5 : 3; ctx.fillStyle = '#1a1030'; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.fillStyle = b.kind === 'mega' ? '#ff4060' : '#8080a0'; ctx.fillRect(x - r + 1, y - r + 1, r * 2 - 2, r * 2 - 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r + 1, y - r + 1, 2, 1); }
      }
      // proyectiles enemigos
      for (const e of g.ebullets) {
        const x = Math.round(sx(e.x)), y = Math.round(e.y), r = Math.round(e.r);
        ctx.fillStyle = t % 8 < 4 ? '#ff3a7a' : '#ffb000'; ctx.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); ctx.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      // efectos
      for (const f of g.fx) this.drawFx(ctx, g, f, sx(f.x));
    },

    drawHazard(ctx, g, z, x) {
      const C = RFS.CONFIG.screen, t = g.t, h = z.h; x = Math.round(x);
      if (z.type === 'geyser') {
        const lava = g.level.theme === 'fire';
        if (z.t < h.warn) { if (t % 6 < 3) { ctx.fillStyle = lava ? '#ff6010' : '#e0c080'; ctx.fillRect(x - 5, C.groundY - 3, 10, 3); ctx.fillRect(x - 2 + (t % 5) - 2, C.groundY - 6 - (z.t % 8), 2, 2); } }
        else if (z.len > 1) { const y0 = C.groundY - z.len; ctx.fillStyle = lava ? '#ff4010' : '#c08a40'; ctx.fillRect(x - 6, y0, 12, z.len); ctx.fillStyle = lava ? '#ffd040' : '#f0d090'; ctx.fillRect(x - 3, y0, 6, z.len); ctx.fillRect(x - 7, y0 - 2, 14, 4); }
      } else if (z.type === 'bolt') {
        if (z.t < h.warn) { if (t % 4 < 2) { ctx.fillStyle = '#ffffa0'; for (let y = C.topY; y < C.groundY; y += 6) ctx.fillRect(x, y, 1, 3); } }
        else { ctx.fillStyle = '#ffffff'; let xx = x; for (let y = C.topY - 6; y < C.groundY; y += 4) { xx = x + ((y * 7 + t) % 5) - 2; ctx.fillRect(xx - 2, y, 4, 4); } ctx.fillStyle = 'rgba(255,255,160,0.5)'; ctx.fillRect(x - 6, C.topY - 6, 12, C.groundY - C.topY + 6); }
      } else if (z.type === 'faller') {
        const shakeX = z.t < h.warn ? ((t >> 1) % 2 ? 1 : -1) : 0;
        const ice = g.level.theme === 'ice';
        ctx.fillStyle = ice ? '#e8f8ff' : '#8a6a4a'; ctx.beginPath(); ctx.moveTo(x - 4 + shakeX, z.y); ctx.lineTo(x + 4 + shakeX, z.y); ctx.lineTo(x + shakeX, z.y + 12); ctx.fill();
        ctx.fillStyle = ice ? '#80c0f0' : '#5a3a1a'; ctx.fillRect(x + shakeX, z.y, 2, 8);
      } else if (z.type === 'riser') {
        ctx.fillStyle = '#20202a'; ctx.beginPath(); ctx.arc(x, z.y, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = t % 20 < 10 ? '#ff3040' : '#ffd040'; ctx.fillRect(x - 1, Math.round(z.y) - 1, 2, 2);
        ctx.fillStyle = '#6a6a7a'; for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + z.t * 0.05; ctx.fillRect(Math.round(x + Math.cos(a) * 6) - 1, Math.round(z.y + Math.sin(a) * 6) - 1, 2, 2); }
      }
    },

    drawFx(ctx, g, f, x) {
      if (f.t < 0) return;
      const k = f.t / f.life;
      x = Math.round(x);
      if (f.type === 'boom') {
        const r = f.size * (0.4 + k * 0.8);
        const cols = ['#ffffff', '#ffe060', '#ff8020', '#c02020', '#401020'];
        const ci = Math.min(4, Math.floor(k * 5));
        ctx.fillStyle = cols[ci]; ctx.beginPath(); ctx.arc(x, f.y, r, 0, TAU); ctx.fill();
        if (ci < 3) { ctx.fillStyle = cols[ci + 1 > 4 ? 4 : 0]; ctx.beginPath(); ctx.arc(x, f.y, r * 0.5, 0, TAU); ctx.fill(); }
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + f.size; ctx.fillStyle = '#ffe060'; ctx.fillRect(Math.round(x + Math.cos(a) * r * 1.4), Math.round(f.y + Math.sin(a) * r * 1.4), 2, 2); }
      } else if (f.type === 'ring') {
        ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, f.y, f.r + (f.max - f.r) * k, 0, TAU); ctx.stroke(); ctx.lineWidth = 1;
      } else if (f.type === 'puff') {
        ctx.fillStyle = k < 0.5 ? '#d0d0d0' : '#808080'; ctx.fillRect(x - 1, Math.round(f.y) - 1, 3, 3);
      } else if (f.type === 'debris' || f.type === 'shards') {
        const r = U.rng(Math.floor(f.seed || 7));
        ctx.fillStyle = f.type === 'shards' ? '#ffffff' : '#ffd040';
        for (let i = 0; i < 12; i++) { const a = r() * TAU, sp = 1 + r() * 2.5; ctx.fillRect(Math.round(x + Math.cos(a) * sp * f.t), Math.round(f.y + Math.sin(a) * sp * f.t + 0.05 * f.t * f.t), 2, 2); }
      } else if (f.type === 'text') {
        const col = { small: '#ffe060', medium: '#a0ffb0', large: '#ffffff', base: '#ffd040', boss: '#ffb0ff' }[f.kind] || '#ffffff';
        txt(ctx, f.text, x, Math.round(f.y), col, 'c');
      }
    },

    drawBoss(ctx, g, b) {
      const B = S.boss, t = g.t;
      const pos = p => { const w = RFS.BossController.world(g, b, p); return { x: Math.round(U.screenX(w.x, g.camX, g.W, 64)), y: Math.round(w.y) }; };
      const img = (im, p, cx, cy, white) => { const q = pos(p); ctx.drawImage(white ? S.white(im) : im, q.x - cx, q.y - cy); };
      const P = id => b.parts.find(p => p.id === id);
      const fl = p => p.flash > 0;
      if (b.dying && t % 4 < 2) ctx.globalAlpha = 0.6;
      switch (b.key) {
        case 'maw': { const m = P('mouth'), s = P('shell'); img(B.maw_mouth[Math.round((b.open || 0) * 3)], m, 12, 12, fl(m)); img(B.maw_shell, s, 26, 27, fl(m)); break; }
        case 'cinder': {
          img(B.cinder_body[(t >> 3) % 2], P('body'), 20, 20, fl(P('body')));
          for (const p of b.parts.slice(1)) if (!p.dead) img(B.cinder_core[(t >> 2) % 2], p, 9, 9, fl(p));
          break;
        }
        case 'frost': {
          const body = pos(P('body'));
          for (const h of b.parts.slice(1)) { if (h.dead) continue; const q = pos(h); ctx.fillStyle = '#80c0f0'; for (let i = 0; i <= 10; i++) { const k = i / 10; ctx.fillRect(Math.round(body.x - 6 + (q.x + 6 - body.x) * k) - 2, Math.round(body.y + (q.y - body.y) * k) - 2, 5, 5); } }
          img(B.frost_body, P('body'), 22, 25, false);
          for (const h of b.parts.slice(1)) if (!h.dead) img(B.frost_head[(t >> 4) % 2], h, 12, 8, fl(h));
          break;
        }
        case 'leviathan': {
          const segs = ['tail', 'seg2', 'seg1'];
          img(B.lev_seg[2], P('tail'), 6, 10, false); img(B.lev_seg[1], P('seg2'), 14, 13, false); img(B.lev_seg[0], P('seg1'), 16, 15, false);
          const h = P('head'); img(B.lev_head[b.mode === 'dash' || (t >> 4) % 3 === 0 ? 1 : 0], h, 10, 15, fl(h));
          void segs; break;
        }
        case 'storm': {
          for (const p of b.parts) { if (p.dead) continue; if (p.bird) img(B.storm_bird[(t >> 3) % 2], p, 9, 8, fl(p)); else img(B.storm_eye[(t >> 4) % 2], p, 20, 20, fl(p)); }
          break;
        }
        case 'dune': {
          const h = P('head'), q = pos(h), sh = pos(P('shell'));
          ctx.fillStyle = '#a87030'; for (let i = 0; i <= 8; i++) { const k = i / 8; ctx.fillRect(Math.round(q.x + 8 + (sh.x - 26 - q.x - 8) * k) - 3, Math.round(q.y + (sh.y + 6 - q.y) * k) - 3, 7, 7); }
          img(B.dune_head, h, 9, 8, fl(h)); img(B.dune_shell, P('shell'), 36, 22, false);
          break;
        }
        case 'colossus': {
          const e = P('eye'); img(B.col_eye[b.eyeOpen ? 1 : 0], e, 10, 11, fl(e));
          img(B.col_body, P('body'), 25, 38, false); img(B.col_arm, P('armL'), 12, 9, false); img(B.col_arm, P('armR'), 12, 9, false);
          break;
        }
        case 'crown': {
          img(B.crown_halo, P('halo'), 6, 43, false);
          const c = P('core'); img(B.crown_core[b.phase > 1 ? 1 : 0], c, 17, 17, fl(c));
          for (const p of b.parts.slice(1, 5)) if (!p.dead) img(B.crown_gem[(t >> 3) % 2], p, 7, 7, fl(p));
          if (b.phase === 3 && t % 10 < 5) { const q = pos(c); ctx.strokeStyle = '#ff3060'; ctx.beginPath(); ctx.arc(q.x, q.y, 22, 0, TAU); ctx.stroke(); }
          break;
        }
      }
      ctx.globalAlpha = 1;
      if (g.debug.enabled && g.debug.hitboxes) for (const p of b.parts) { if (p.dead) continue; const q = pos(p); ctx.strokeStyle = p.vuln ? '#0f0' : '#f00'; ctx.strokeRect(q.x - p.hw, q.y - p.hh, p.hw * 2, p.hh * 2); }
    },

    // ---------------------------------------------------------------- HUD
    drawHUD(ctx, g) {
      const C = RFS.CONFIG.screen, t = g.t;
      ctx.fillStyle = '#0c0820'; ctx.fillRect(0, 0, C.w, C.hudH);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(0, C.hudH - 1, C.w, 1);
      txt(ctx, 'SC' + String(g.score).padStart(8, '0'), 3, 1, '#ffffff');
      txt(ctx, '$' + g.money, 72, 1, '#ffd040');
      txt(ctx, 'HI' + String(g.hiScore()).padStart(8, '0'), 138, 1, '#a0a0c0');
      // vidas
      for (let i = 0; i < Math.min(g.lives, 6); i++) ctx.drawImage(S.player[0], 0, 0, 20, 13, C.w - 14 - i * 11, 1, 10, 7);
      if (g.lives > 6) txt(ctx, '+', C.w - 80, 1, '#ffffff');
      // armas
      const inv = g.inv;
      const wname = inv.activeWeapon ? RFS.ShopInventory.get(inv.activeWeapon).name.split(' ')[0] + ' ' + inv.weaponRemaining() : 'TWIN ∞'.replace('∞', '');
      txt(ctx, 'W:' + wname.trim(), 3, 10, inv.activeWeapon ? '#40e0ff' : '#c0c0d8');
      const bname = inv.activeBomb ? RFS.ShopInventory.get(inv.activeBomb).name.split(' ')[0] + 'x' + inv.bombs[inv.activeBomb] : 'BOMB';
      txt(ctx, 'B:' + bname, 96, 10, inv.activeBomb ? '#ff80c0' : '#c0c0d8');
      let ex = 172;
      if (inv.flash) { txt(ctx, 'Fx' + inv.flash, ex, 10, '#ffff80'); ex += 26; }
      if (inv.shield) { txt(ctx, 'S' + inv.shield.hits, ex, 10, '#80f0ff'); ex += 16; }
      if (inv.engines.length) { txt(ctx, '>' + inv.engines.length, ex, 10, '#a0ffa0'); }
      // bases
      if (!g.level.gauntlet) {
        for (let i = 0; i < 6; i++) { const alive = g.bases[i] && !g.bases[i].dead; ctx.fillStyle = alive ? (t % 30 < 20 ? '#ff4060' : '#ff9090') : '#404060'; ctx.fillRect(C.w - 62 + i * 9, 11, 7, 5); }
      } else txt(ctx, 'JEFE ' + Math.min(g.gIdx + 1, 8) + '/8', C.w - 60, 10, '#ff80c0');
      // radar
      const ry = C.h - C.radarH;
      ctx.fillStyle = '#0c0820'; ctx.fillRect(0, ry, C.w, C.radarH);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(0, ry, C.w, 1);
      ctx.fillStyle = '#1e1a40'; ctx.fillRect(8, ry + 4, C.w - 16, 7);
      const p = g.player, span = C.w - 20;
      const rx = x => Math.round(C.w / 2 + U.wdx(p.x, x, g.W) / g.W * span);
      const vx0 = rx(g.camX), vw = Math.max(4, Math.round(C.w / g.W * span));
      ctx.fillStyle = '#3a3470'; ctx.fillRect(Math.round(C.w / 2 + U.wdx(p.x, g.camX, g.W) / g.W * span), ry + 4, vw, 7); void vx0;
      for (const b of g.bases) if (!b.dead) { ctx.fillStyle = t % 20 < 12 ? '#ff4060' : '#ffffff'; ctx.fillRect(rx(b.x) - 2, ry + 5, 4, 5); }
      if (g.balloon) { ctx.fillStyle = '#ffd040'; ctx.fillRect(rx(g.balloon.x) - 1, ry + 4, 3, 3); }
      if (g.token) { ctx.fillStyle = '#40e0ff'; ctx.fillRect(rx(g.token.x) - 1, ry + 8, 3, 3); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(C.w / 2 - 1, ry + 3, 3, 9);
      // barra de jefe
      const b = g.boss;
      if (b && !b.dying) {
        txt(ctx, b.name, C.w / 2, C.hudH + 3, '#ffffff', 'c');
        ctx.fillStyle = '#000'; ctx.fillRect(60, C.hudH + 12, 200, 5);
        ctx.fillStyle = '#ff3060'; ctx.fillRect(61, C.hudH + 13, Math.round(198 * b.hp / b.maxHp), 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(61, C.hudH + 13, Math.round(198 * b.hp / b.maxHp), 1);
      }
      // avisos
      g.notices.forEach((n, i) => { if (n.t % 20 < 16 || n.t > 40) txt(ctx, n.text, C.w / 2, C.hudH + (b ? 24 : 6) + i * 10, '#ffff80', 'c'); });
      if (g.debug.enabled) txt(ctx, 'DEBUG' + (g.debug.invincible ? ' INV' : ''), 3, C.hudH + 2, '#00ff80');
    },

    // ------------------------------------------------------------ superposiciones
    drawOverlay(ctx, g) {
      const C = RFS.CONFIG.screen, t = g.t, cx = C.w / 2;
      switch (g.state) {
        case 'intro': {
          panel(ctx, 40, 70, 240, 70);
          const L = g.level;
          txt(ctx, L.gauntlet ? 'FASE FINAL' : 'ZONA ' + L.id, cx, 80, '#ffd040', 'c');
          textBig(ctx, L.name, cx, 92, '#ffffff', 2);
          txt(ctx, L.gauntlet ? 'DERROTA A TODOS LOS JEFES' : 'DESTRUYE LAS 6 BASES ENEMIGAS', cx, 124, '#80f0ff', 'c');
          break;
        }
        case 'bosswarn':
          if (g.warnT > 10 && g.warnT < 170) {
            const a = (t >> 3) % 2;
            ctx.fillStyle = a ? 'rgba(200,0,40,0.55)' : 'rgba(120,0,20,0.55)'; ctx.fillRect(0, 88, C.w, 34);
            textBig(ctx, '¡ATENCIÓN!', cx, 91, '#ffffff', 2);
            txt(ctx, 'SE ACERCA ' + RFS.CONFIG.bosses[RFS.StageManager.nextBossKey(g)].name, cx, 112, '#ffe060', 'c');
          }
          break;
        case 'coinrain': txt(ctx, '¡RECOGE LAS MONEDAS! ' + Math.ceil(g.rainT / 60), cx, C.hudH + 8, '#ffd040', 'c'); break;
        case 'clear': {
          panel(ctx, 50, 60, 220, 96);
          textBig(ctx, g.level.gauntlet ? '¡VICTORIA!' : 'ZONA SUPERADA', cx, 68, '#ffd040', 2);
          txt(ctx, 'BONUS DE ZONA   ' + g.clearBonus, cx, 96, '#ffffff', 'c');
          txt(ctx, 'DINERO          $' + g.money, cx, 108, '#ffd040', 'c');
          txt(ctx, 'PUNTUACIÓN      ' + g.score, cx, 120, '#ffffff', 'c');
          if (g.clearT > 60 && t % 40 < 26) txt(ctx, 'PULSA DISPARO', cx, 140, '#80f0ff', 'c');
          break;
        }
        case 'shop': this.drawShop(ctx, g); break;
        case 'equip': this.drawEquip(ctx, g); break;
        case 'pause': {
          panel(ctx, 90, 74, 140, 70);
          textBig(ctx, 'PAUSA', cx, 80, '#ffffff', 2);
          ['CONTINUAR', 'SALIR AL TÍTULO'].forEach((s, i) => txt(ctx, (g.menu.i === i ? '▶ ' : '  ') + s, 110, 108 + i * 12, g.menu.i === i ? '#ffd040' : '#c0c0d8'));
          break;
        }
        case 'gameover': {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, C.hudH, C.w, C.groundY - C.hudH);
          textBig(ctx, 'GAME OVER', cx, 80, '#ff4060', 3);
          txt(ctx, 'PUNTUACIÓN ' + g.score, cx, 116, '#ffffff', 'c');
          if (g.newRecordRank >= 0) txt(ctx, g.newRecordRank === 0 ? '¡NUEVO RÉCORD!' : 'PUESTO ' + (g.newRecordRank + 1) + ' EN RÉCORDS', cx, 130, '#ffd040', 'c');
          if (g.stateT > 90 && t % 40 < 26) txt(ctx, 'PULSA DISPARO', cx, 150, '#80f0ff', 'c');
          break;
        }
        case 'victory': {
          ctx.fillStyle = 'rgba(0,0,20,0.75)'; ctx.fillRect(0, C.hudH, C.w, C.groundY - C.hudH);
          textBig(ctx, '¡MISIÓN CUMPLIDA!', cx, 34, '#ffd040', 2);
          const lines = ['LA CORONA ABISAL HA CAÍDO.', 'LAS SIETE ZONAS VUELVEN A BRILLAR', 'Y LOS MERCADERES DEL CIELO', 'REABREN SUS GLOBOS.', '',
            'PUNTUACIÓN   ' + g.score, 'DINERO GANADO  $' + g.stats.coins, 'BASES  ' + g.stats.bases + '   JEFES  ' + g.stats.bossesDefeated, 'COMPRAS  ' + g.stats.purchases + '   VIDAS PERDIDAS  ' + g.stats.deaths];
          lines.forEach((s, i) => txt(ctx, s, cx, 62 + i * 11, i < 4 ? '#ffffff' : '#80f0ff', 'c'));
          if (g.newRecordRank === 0) txt(ctx, '¡NUEVO RÉCORD!', cx, 176, '#ffd040', 'c');
          if (g.stateT > 240 && t % 40 < 26) txt(ctx, 'PULSA DISPARO', cx, 188, '#ffffff', 'c');
          break;
        }
      }
    },

    drawShop(ctx, g) {
      const C = RFS.CONFIG.screen, cats = RFS.CONFIG.shop.categories, cur = g.shopCur, t = g.t;
      ctx.fillStyle = 'rgba(20,4,30,0.94)'; ctx.fillRect(0, C.hudH, C.w, C.h - C.hudH - C.radarH);
      ctx.drawImage(S.balloon[(t >> 4) % 2], 6, C.hudH + 2);
      textBig(ctx, 'TIENDA DEL GLOBO', C.w / 2, C.hudH + 4, '#ffd040', 2);
      txt(ctx, 'SALDO $' + g.money, C.w - 6, C.hudH + 30, '#ffd040', 'r');
      const top = C.hudH + 42;
      cats.forEach((cat, c) => {
        const x = c * 80 + 2;
        ctx.fillStyle = '#3a1a5a'; ctx.fillRect(x, top - 2, 76, 10);
        txt(ctx, cat.name, x + 38, top, '#ffffff', 'c');
        RFS.ShopInventory.byCategory(cat.id).forEach((it, r) => {
          const y = top + 13 + r * 26, sel = cur.c === c && cur.r === r;
          const why = g.econ.blocked(g, it.id);
          if (sel) { ctx.fillStyle = t % 20 < 10 ? '#ffd040' : '#ff8020'; ctx.fillRect(x, y - 2, 76, 23); ctx.fillStyle = '#20082a'; ctx.fillRect(x + 1, y - 1, 74, 21); }
          txt(ctx, it.name, x + 3, y, why === 'EQUIPADO' ? '#80ff80' : '#ffffff');
          txt(ctx, why === 'EQUIPADO' ? 'EQUIPADO' : '$' + g.econ.price(it.id), x + 3, y + 10, why === 'SIN FONDOS' ? '#a05060' : why ? '#80ff80' : '#ffd040');
          const n = g.econ.count(it.id); if (n) txt(ctx, 'x' + n, x + 73, y + 10, '#a0a0c0', 'r');
        });
      });
      const ey = top + 13 + 4 * 26;
      const exitSel = cur.r === 4;
      txt(ctx, (exitSel ? '▶ ' : '  ') + 'SALIR', C.w / 2, ey, exitSel ? '#ffd040' : '#c0c0d8', 'c');
      // descripción
      let desc = '';
      if (!exitSel) { const it = RFS.ShopInventory.byCategory(cats[cur.c].id)[cur.r]; desc = it.desc; }
      txt(ctx, g.shopMsgT > 0 ? g.shopMsg : desc, C.w / 2, ey + 14, g.shopMsgT > 0 ? '#80ff80' : '#80f0ff', 'c');
      txt(ctx, 'DISPARO: COMPRAR   BOMBA/ESC: SALIR', C.w / 2, ey + 26, '#8080a0', 'c');
    },

    drawEquip(ctx, g) {
      const C = RFS.CONFIG.screen, lists = g.equipLists(), inv = g.inv;
      panel(ctx, 30, 50, 260, 112, 'rgba(6,14,36,0.95)', '#40e0ff');
      textBig(ctx, 'EQUIPAMIENTO', C.w / 2, 56, '#40e0ff', 2);
      const rows = [['ARMA', lists[0], inv.activeWeapon, id => id ? RFS.ShopInventory.get(id).name + ' ' + (RFS.ShopInventory.get(id).mode === 'time' ? Math.ceil(inv.weapons[id] / 60) + 's' : inv.weapons[id]) : 'TWIN SHOT (BÁSICO)'],
        ['BOMBA', lists[1], inv.activeBomb, id => id ? RFS.ShopInventory.get(id).name + ' x' + inv.bombs[id] : 'BOMBA BÁSICA']];
      rows.forEach(([label, list, active, name], i) => {
        const y = 88 + i * 30, sel = g.equipCur === i;
        txt(ctx, label, 40, y, sel ? '#ffd040' : '#8080a0');
        txt(ctx, '◀ ' + name(active) + ' ▶', 190, y, sel ? '#ffffff' : '#a0a0c0', 'c');
        txt(ctx, (list.indexOf(active) + 1) + '/' + list.length, 190, y + 11, '#606080', 'c');
      });
      txt(ctx, 'ARRIBA/ABAJO: FILA  IZQ/DER: CAMBIAR', C.w / 2, 142, '#8080a0', 'c');
      txt(ctx, 'DISPARO: CONFIRMAR', C.w / 2, 152, '#8080a0', 'c');
    },

    // ---------------------------------------------------------------- título
    drawTitle(ctx, g) {
      const C = RFS.CONFIG.screen, t = g.t, cx = C.w / 2;
      const bg = S.bg('forest');
      ctx.drawImage(bg.sky, 0, 0); ctx.drawImage(bg.sky, 0, C.groundY - C.hudH - 2);
      const layer = (img, f, y) => { const w = img.width; let ox = -U.mod(t * f, w); for (let x = ox; x < C.w; x += w) ctx.drawImage(img, Math.round(x), y); };
      layer(bg.far, 0.2, 30); layer(bg.mid, 0.5, 30); layer(bg.ground, 1, C.groundY + 12);
      ctx.fillStyle = 'rgba(10,4,30,0.35)'; ctx.fillRect(0, 0, C.w, C.h);
      const p = S.player[(t >> 2) % 2];
      ctx.drawImage(p, Math.round(150 + Math.sin(t * 0.02) * 30), Math.round(88 + Math.sin(t * 0.05) * 6));
      ctx.drawImage(S.balloon[(t >> 4) % 2], 262, Math.round(110 + Math.sin(t * 0.03) * 5));
      textBig(ctx, 'RETRO FANTASY', cx, 22, '#ffd040', 3, '#7a1a4a');
      textBig(ctx, 'SHOOTER', cx, 54, '#ff60a0', 3, '#2a0a3a');
      if (g.state === 'title') {
        ['EMPEZAR PARTIDA', 'OPCIONES', 'RÉCORDS'].forEach((s, i) => txt(ctx, (g.menu.i === i ? '▶ ' : '  ') + s, 110, 122 + i * 13, g.menu.i === i ? '#ffd040' : '#ffffff'));
        txt(ctx, 'RÉCORD ' + String(g.records.length ? g.records[0].score : 0).padStart(8, '0'), cx, 166, '#80f0ff', 'c');
        txt(ctx, 'WASD MOVER  ESPACIO DISPARO  CLIC IZQ BOMBA', cx, 186, '#c0c0d8', 'c');
        txt(ctx, 'CLIC DER FLASH', cx, 175, '#c0c0d8', 'c');
        txt(ctx, 'E EQUIPO  ENTER PAUSA  MANDO COMPATIBLE', cx, 197, '#c0c0d8', 'c');
        if (!RFS.Audio.ctx && t % 60 < 40) txt(ctx, 'PULSA ESPACIO O CLIC PARA ACTIVAR EL SONIDO', cx, 210, '#ffff80', 'c');
      } else if (g.state === 'options') {
        panel(ctx, 50, 96, 220, 112);
        const s = g.settings, bar = v => '■'.repeat(Math.round(v * 10)) + '□'.repeat(10 - Math.round(v * 10));
        const labels = { music: 'MÚSICA   ' + bar(s.music), sfx: 'EFECTOS  ' + bar(s.sfx), scale: 'ESCALA   ' + (s.scale ? s.scale + 'x' : 'AUTO'), fullscreen: 'PANTALLA COMPLETA', controls: 'CONTROLES', resetkeys: 'RESTABLECER CONTROLES', back: 'VOLVER' };
        g.optionItems().forEach((k, i) => txt(ctx, (g.menu.i === i ? '▶ ' : '  ') + labels[k], 60, 104 + i * 14, g.menu.i === i ? '#ffd040' : '#ffffff'));
      } else if (g.state === 'controls') {
        panel(ctx, 40, 90, 240, 130);
        const A = RFS.Input.ACTIONS, names = { up: 'ARRIBA', down: 'ABAJO', left: 'IZQUIERDA', right: 'DERECHA', fire: 'DISPARO', bomb: 'BOMBA', flash: 'FLASH', equip: 'EQUIPO', pause: 'PAUSA', back: 'ATRÁS' };
        A.forEach((a, i) => {
          const sel = g.ctl.i === i, keys = RFS.Input.bindings[a].map(k => RFS.Input.keyName(k)).join('/');
          txt(ctx, (sel ? '▶ ' : '  ') + names[a], 48, 96 + i * 11, sel ? '#ffd040' : '#ffffff');
          txt(ctx, sel && g.ctl.wait ? (t % 30 < 20 ? 'PULSA TECLA' : '') : keys, 272, 96 + i * 11, '#80f0ff', 'r');
        });
        txt(ctx, (g.ctl.i === A.length ? '▶ ' : '  ') + 'VOLVER', 48, 96 + A.length * 11, g.ctl.i === A.length ? '#ffd040' : '#ffffff');
      } else if (g.state === 'records') {
        panel(ctx, 40, 92, 240, 124);
        txt(ctx, 'MEJORES PUNTUACIONES', cx, 98, '#ffd040', 'c');
        if (!g.records.length) txt(ctx, 'TODAVÍA NO HAY RÉCORDS', cx, 140, '#ffffff', 'c');
        g.records.forEach((r, i) => txt(ctx, (i + 1) + '. ' + String(r.score).padStart(8, ' ') + '  ZONA ' + r.stage.padEnd(3, ' ') + ' ' + r.date, cx, 112 + i * 12, i === 0 ? '#ffd040' : '#ffffff', 'c'));
      }
      if (g.notices.length) txt(ctx, g.notices[g.notices.length - 1].text, cx, 4, '#80ff80', 'c');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
