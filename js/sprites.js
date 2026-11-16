/* Arte procedural original: sprites rasterizados píxel a píxel con contorno,
 * fondos de varias capas con paralaje y fuente bitmap 5x7. Solo navegador. */
(function (root) {
  const RFS = root.RFS = root.RFS || {};
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------- utilidades
  const rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const h = hex.replace('#', '');
    return (rgbCache[hex] = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]);
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /** Rasteriza fn(x,y)->color|null en un canvas w×h y añade contorno. */
  function raster(w, h, fn, outline) {
    const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    const filled = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = fn(x + 0.5, y + 0.5);
      if (!col) continue;
      const [r, g, b] = rgb(col), i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; filled[y * w + x] = 1;
    }
    if (outline) {
      const [r, g, b] = rgb(outline);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (filled[y * w + x]) continue;
        const n = (x > 0 && filled[y * w + x - 1]) || (x < w - 1 && filled[y * w + x + 1]) || (y > 0 && filled[(y - 1) * w + x]) || (y < h - 1 && filled[(y + 1) * w + x]);
        if (n) { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function flip(src) { const c = canvas(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
  function tint(src, color) { const c = canvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; }
  const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const circ = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const tri = (x, y, ax, ay, bx, by, cx, cy) => {
    const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    const d1 = s(x, y, ax, ay, bx, by), d2 = s(x, y, bx, by, cx, cy), d3 = s(x, y, cx, cy, ax, ay);
    return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)));
  };
  const rect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const OUT = '#120a28';

  // ------------------------------------------------------------- paletas
  const THEMES = {
    forest: { sky: ['#4cb8ff', '#7fd4ff', '#b8ecff', '#e4fbff'], far: '#58b070', farHi: '#8ad890', mid: '#2e8a4e', midHi: '#4cb860', ground: '#d8702c', groundHi: '#ffb040', groundLo: '#9a4418', e: ['#ff5aa8', '#ffe060', '#8a2a9a'], base: ['#e0f070', '#7a3a9a', '#ff60a0'] },
    fire:   { sky: ['#1a0612', '#3e0c18', '#6e1a1a', '#b4381e'], far: '#4a1418', farHi: '#8a2a20', mid: '#24080c', midHi: '#5a1a14', ground: '#2e1616', groundHi: '#ff7a10', groundLo: '#140808', e: ['#ff9a1a', '#ffe68a', '#a01a0e'], base: ['#9aa0b0', '#4a4a5a', '#ff6010'] },
    ice:    { sky: ['#0e2a66', '#24509e', '#4a86d0', '#a8dcff'], far: '#bfe4ff', farHi: '#ffffff', mid: '#76b4e6', midHi: '#bfe8ff', ground: '#e6f6ff', groundHi: '#ffffff', groundLo: '#86bce6', e: ['#58dcff', '#ffffff', '#1e4c9c'], base: ['#d8f4ff', '#5a8ac8', '#40f0ff'] },
    water:  { sky: ['#001a36', '#00304e', '#004c66', '#0a7084'], far: '#003048', farHi: '#0a5a6e', mid: '#0a4e5e', midHi: '#18a0a0', ground: '#bc9c5a', groundHi: '#e8cc84', groundLo: '#7a5a2c', e: ['#2cf0c0', '#f0ff7a', '#0e5664'], base: ['#f0a0c0', '#7a3a6a', '#7affe8'] },
    cloud:  { sky: ['#ff8ac8', '#ffaab8', '#ffcaa0', '#fff0b4'], far: '#ffffff', farHi: '#fff8ff', mid: '#f0dcff', midHi: '#ffffff', ground: '#8ad46a', groundHi: '#c4f08a', groundLo: '#4a9440', e: ['#9a6aff', '#ffffff', '#ff5a9a'], base: ['#fff4d0', '#c08ae0', '#ffd040'] },
    desert: { sky: ['#ff7a3a', '#ffa45a', '#ffc87a', '#ffe8a8'], far: '#cc8448', farHi: '#e8a868', mid: '#a8642c', midHi: '#c8844a', ground: '#f0c06c', groundHi: '#ffe0a0', groundLo: '#b88440', e: ['#c8641c', '#ffe0a0', '#5a240c'], base: ['#e8c890', '#8a5a2a', '#40e0a0'] },
    final:  { sky: ['#0a0418', '#180a34', '#2a1450', '#44206a'], far: '#22163e', farHi: '#3e2a6a', mid: '#3a2a58', midHi: '#6a4a9a', ground: '#44446a', groundHi: '#9a9ac8', groundLo: '#22223a', e: ['#ff3a9a', '#9affff', '#4a186a'], base: ['#b0b8d0', '#5a2a7a', '#ff3a6a'] },
    void:   { sky: ['#000006', '#08000e', '#14041e', '#22082e'], far: '#160a26', farHi: '#2a1040', mid: '#22082e', midHi: '#4a1a5a', ground: '#16162a', groundHi: '#6a2a8a', groundLo: '#08080e', e: ['#ff3a9a', '#9affff', '#4a186a'], base: ['#888', '#444', '#f0f'] }
  };

  // ------------------------------------------------------------- jugador
  function playerSprite(frame) {
    return raster(20, 13, (x, y) => {
      if (x < 4 && Math.abs(y - 7) < (frame ? 1.6 : 1.1) && x > (frame ? 0 : 1.5)) return x < 2.5 ? '#ffe060' : '#ff8020';
      if (ell(x, y, 12, 4.6, 2.8, 2.0)) return (x < 11.5 && y < 4.4) ? '#e8ffff' : '#30b8f0';
      if (tri(x, y, 5, 8, 11, 8, 4, 12.4)) return y > 10.5 ? '#c05010' : '#ff8a20';
      if (tri(x, y, 4, 1.5, 7.5, 6.5, 4, 6.5)) return '#ff8a20';
      if (ell(x, y, 10.5, 6.6, 7, 3.2)) { if (x > 16.2) return '#ff4060'; return y > 7.8 ? '#a8b8e0' : '#ffffff'; }
      return null;
    }, OUT);
  }

  // ------------------------------------------------------------- enemigos
  const ENEMY_SIZE = { patrol: [15, 14], chaser: [16, 16], vertical: [14, 16], shooter: [15, 15], spreader: [16, 16], tank: [22, 18], formation: [13, 11], guardian: [13, 13] };
  function enemySprite(fam, pal, f) {
    const [a, b, c] = pal, [w, h] = ENEMY_SIZE[fam];
    const fns = {
      patrol: (x, y) => {
        if (f ? ell(x, y, 8.5, 4, 3.2, 1.6) : ell(x, y, 9.5, 5.5, 3, 1.2)) return '#ffffff';
        if (circ(x, y, 5.6, 7.4, 1.6)) return '#ffffff';
        if (circ(x, y, 5.1, 7.4, 0.9)) return OUT;
        if (circ(x, y, 7.5, 8.5, 4.6)) return y > 10 ? c : a;
        if (rect(x, y, 6, 12.6, 7, 14) || rect(x, y, 9, 12.6, 10, 14)) return b;
        return null;
      },
      chaser: (x, y) => {
        const dx = x - 8, dy = y - 8, r = Math.hypot(dx, dy), an = Math.atan2(dy, dx) + (f ? 0.39 : 0);
        if (r < 4.8) { if ((Math.abs(dx + 1.8) < 1 || Math.abs(dx - 1.8) < 1) && Math.abs(dy + 0.6) < 1.2) return dy < -0.6 + 0.4 * Math.sign(dx) ? '#ffffff' : OUT; return dy > 2 ? c : a; }
        const k = (an / TAU * 8 % 1 + 1) % 1;
        if (r < 7.4 && Math.abs(k - 0.5) < 0.5 * (7.4 - r) / 3) return b;
        return null;
      },
      vertical: (x, y) => {
        if (y < 8.5 && ell(x, y, 7, 7, 6, 5.6)) { if (circ(x, y, 5, 5, 1.2) || circ(x, y, 9, 5, 1.2)) return OUT; return y > 7 ? c : a; }
        for (let i = 0; i < 4; i++) { const tx = 2.8 + i * 2.8 + Math.sin(y * 0.8 + i + f * 2) * 0.8; if (y >= 8.5 && y < 15 - (i % 2) && Math.abs(x - tx) < 0.75) return b; }
        return null;
      },
      shooter: (x, y) => {
        if (!circ(x, y, 7.5, 7.5, 6.6)) return (Math.abs(y - 7.5) < 1 && (x < 1.5 || x > 13.5)) ? c : null;
        if (circ(x, y, 6.4, 7.5, 2.9)) { if (circ(x, y, 5.6, 7.5, 1.5)) return OUT; return '#ffffff'; }
        if (f && y < 5) return c;
        return y > 10 ? c : a;
      },
      spreader: (x, y) => {
        if (circ(x, y, 8, 8, 2.8)) return circ(x, y, 8, 8, 1.2) ? c : a;
        for (let i = 0; i < 6; i++) { const an = i / 6 * TAU + (f ? 0.5 : 0); if (circ(x, y, 8 + Math.cos(an) * 4.6, 8 + Math.sin(an) * 4.6, 2.3)) return i % 2 ? b : a; }
        return null;
      },
      tank: (x, y) => {
        if (ell(x, y, 12.5, 8, 8.6, 6.6)) { if (Math.abs(x - 12.5) < 0.9 || Math.abs(y - 6) < 0.6 && x > 6) return c; return y > 11 ? c : (y < 5 ? b : a); }
        if (circ(x, y, 3.6, 10, 3)) return circ(x, y, 2.6, 9.4, 0.9) ? OUT : b;
        if (y > 14 && y < 17.5 && [7, 11, 15, 19].some(l => Math.abs(x - l - (f ? 1 : 0)) < 0.8)) return c;
        return null;
      },
      formation: (x, y) => {
        if (Math.abs(x - 6.5) / 6.2 + Math.abs(y - 5.5) / (f ? 4.6 : 3.6) < 1) { if (Math.abs(y - 5.5) < 0.7) return b; return x < 4 ? '#ffffff' : a; }
        return null;
      },
      guardian: (x, y) => {
        const dx = Math.abs(x - 6.5), dy = Math.abs(y - 6.5);
        if (dx * 0.6 + dy * 0.6 < 4.6 && dx < 5.6 && dy < 5.6) { if (circ(x, y, 6.5, 6.5, 1.8)) return f ? '#ffffff' : c; return x < 6.5 ? b : a; }
        return null;
      }
    };
    return raster(w, h, fns[fam], OUT);
  }

  // ------------------------------------------------------------- bases
  function baseSprite(theme, ground) {
    const P = THEMES[theme].base, [m, d, glow] = P;
    return raster(28, 28, (x, y) => {
      if (ground) {
        if (theme === 'desert') { if (tri(x, y, 14, 2, 1, 24, 27, 24)) { if (y > 22) return d; if (circ(x, y, 14, 15, 3.6)) return OUT; return (Math.floor(y / 4) % 2) ? m : '#d0a868'; } return null; }
        if (rect(x, y, 3, 21, 25, 26)) return y > 24 ? OUT : d;
        if (theme === 'fire' && (rect(x, y, 5, 3, 8, 14) || rect(x, y, 20, 6, 23, 14))) return y < 5 || (y > 6 && y < 7.5) ? '#ff8030' : d;
        if (theme === 'ice' && (tri(x, y, 7, 1, 4, 12, 10, 12) || tri(x, y, 21, 3, 18, 12, 24, 12))) return x < 7 || (x > 18 && x < 21) ? '#ffffff' : m;
        if (theme === 'forest' && (ell(x, y, 6, 6, 4, 2) || ell(x, y, 22, 5, 4, 2))) return '#4cc060';
        if (theme === 'final' && rect(x, y, 13, 0, 15, 8)) return y < 2 ? glow : d;
        if (ell(x, y, 14, 18, 11.5, 11)) { if (circ(x, y, 14, 15, 4.2)) return OUT; if (Math.abs(x - 14) > 9.5 || y > 19 && y < 20.2) return d; return (x < 11 && y < 13) ? '#ffffff' : m; }
        return null;
      }
      // base flotante
      if (ell(x, y, 14, 14, 13.5, 3.2) && !circ(x, y, 14, 14, 9.6)) return y < 14 ? glow : d;
      if (circ(x, y, 14, 14, 9.6)) {
        if (circ(x, y, 14, 14, 4.2)) return OUT;
        if (theme === 'water' && Math.abs((Math.atan2(y - 14, x - 14) * 5 / Math.PI) % 1) < 0.15) return d;
        if (theme === 'cloud' && y > 17) return '#ffffff';
        return (x < 11 && y < 11) ? '#ffffff' : (y > 17 ? d : m);
      }
      if (rect(x, y, 12, 23, 16, 27)) return d;
      if (rect(x, y, 13, 1, 15, 5)) return glow;
      return null;
    }, OUT);
  }

  // ------------------------------------------------------------- objetos
  function balloonSprite(f) {
    return raster(22, 30, (x, y) => {
      if (ell(x, y, 11, 10, 9.5, 9.5)) {
        if (rect(x, y, 4, 7, 18, 13)) { const lx = x - 4; return (rect(lx, y, 1, 8, 3, 12) || rect(lx, y, 5, 8, 7, 12) || rect(lx, y, 9, 8, 11, 12) || rect(lx, y, 1, 8, 13, 9)) ? '#ffffff' : '#c01848'; }
        return (x < 8 && y < 7) ? '#ffd0e0' : (Math.floor((x - 11) / 4 + (f ? 0.5 : 0)) % 2 ? '#ff4a7a' : '#ffd040');
      }
      if (y > 19 && y < 24 && (Math.abs(x - 7 - (y - 19) * 0.6) < 0.6 || Math.abs(x - 15 + (y - 19) * 0.6) < 0.6)) return '#5a3a1a';
      if (rect(x, y, 7, 24, 15, 29)) return y < 25 ? '#5a3a1a' : '#c08040';
      return null;
    }, OUT);
  }
  function tokenSprite(f) {
    return raster(15, 15, (x, y) => {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      if (dx + dy < 7) { if (dx + dy < 3.4) return f ? '#ffffff' : '#ffe060'; return (x < 7.5) === (y < 7.5) ? '#40e0ff' : '#2070d0'; }
      return null;
    }, OUT);
  }
  function coinSprite(kind, f) {
    const col = { small: ['#ffe060', '#c08a10'], medium: ['#a0ffb0', '#20a050'], large: ['#ffffff', '#40b0ff'], base: ['#ffd040', '#e04020'], boss: ['#ffb0ff', '#a030c0'] }[kind];
    const r = { small: 3, medium: 4, large: 5, base: 7, boss: 6 }[kind];
    const s = r * 2 + 3, c = s / 2, sq = [1, 0.55, 0.15, 0.55][f];
    return raster(s, s, (x, y) => {
      if (!ell(x, y, c, c, r * sq + 0.4, r)) return null;
      if (kind === 'base' && Math.abs(y - c) < 1.4 && Math.abs(x - c) < r * sq) return '#ffffff';
      return (x < c && y < c) ? '#ffffff' : (Math.abs(x - c) < r * sq * 0.5 ? col[0] : col[1]);
    }, OUT);
  }

  // ------------------------------------------------------------- jefes
  function bossSprites() {
    const S = {};
    S.maw_shell = raster(52, 52, (x, y) => {
      if (rect(x, y, 23, 0, 25, 6) || rect(x, y, 32, 2, 34, 7)) return y < 2.5 ? '#ff4060' : '#5a5a7a';
      if (!circ(x, y, 26, 27, 23)) return null;
      if (circ(x, y, 10, 29, 11)) return null; // hueco de la boca
      if (circ(x, y, 26, 15, 4) ) return circ(x, y, 25, 14.5, 1.6) ? OUT : '#ffe060';
      if ([[40, 18], [42, 34], [30, 44], [18, 44], [16, 12]].some(([cx, cy]) => circ(x, y, cx, cy, 1.4))) return '#3a3a5a';
      if (Math.abs(Math.hypot(x - 26, y - 27) - 17) < 0.7) return '#6a6a9a';
      return (x < 22 && y < 18) ? '#e8e8ff' : (y > 38 ? '#5a5a8a' : '#9a9ad0');
    }, OUT);
    S.maw_mouth = [0, 1, 2, 3].map(k => raster(24, 24, (x, y) => {
      const o = k / 3, ry = 1.5 + o * 8.5;
      if (!ell(x, y, 12, 12, 10.5, Math.max(ry + 1.6, 3.2))) return null;
      if (ell(x, y, 12, 12, 9, ry)) { if ((y < 12 - ry + 2.5 || y > 12 + ry - 2.5) && Math.floor(x / 3) % 2 === 0) return '#ffffff'; return circ(x, y, 12, 12, o * 4) ? '#ffd040' : '#5a0820'; }
      return '#ff4060';
    }, OUT));
    S.cinder_body = [0, 1].map(f => raster(40, 40, (x, y) => {
      const r = Math.hypot(x - 20, y - 20), a = Math.atan2(y - 20, x - 20);
      if (r < 13) { if (circ(x, y, 20, 20, 5)) return circ(x, y, 20, 20, 2.4) ? '#ffffff' : '#ffe080'; return (Math.floor((a + f * 0.4) * 6 / Math.PI) % 2) ? '#ff6010' : '#c02008'; }
      if (r < 18 + 2.5 * Math.sin(a * 8 + f * 1.5)) return r < 15.5 ? '#ffa020' : '#ffe060';
      return null;
    }, '#5a0808'));
    S.cinder_core = [0, 1].map(f => raster(18, 18, (x, y) => {
      if (circ(x, y, 9, 9, 3.5)) return f ? '#ffffff' : '#fff0a0';
      if (circ(x, y, 9, 9, 7)) return (Math.floor(Math.atan2(y - 9, x - 9) * 3 / Math.PI + f) % 2) ? '#ff8020' : '#ffd040';
      return null;
    }, '#5a0808'));
    S.frost_body = raster(40, 50, (x, y) => {
      if (!ell(x, y, 22, 25, 16, 23)) return (tri(x, y, 30, 0, 26, 12, 36, 10) || tri(x, y, 38, 12, 32, 20, 40, 24)) ? '#ffffff' : null;
      const fct = Math.floor((x + y * 0.6) / 7) % 3;
      return x < 16 ? '#e8f8ff' : ['#a8dcff', '#80c0f0', '#c8ecff'][fct];
    }, '#102a5a');
    S.frost_head = [0, 1].map(f => raster(24, 18, (x, y) => {
      if (tri(x, y, 2, 9 + (f ? 3 : 1), 14, 8, 14, 14 + f * 2)) return '#5ab0e8';
      if (ell(x, y, 13, 7.5, 10, 6)) { if (circ(x, y, 9, 6, 1.8)) return '#ff3060'; return y < 5 ? '#ffffff' : '#9ad6ff'; }
      if (tri(x, y, 16, 2, 22, 0, 20, 5)) return '#ffffff';
      return null;
    }, '#102a5a'));
    S.lev_head = [0, 1].map(f => raster(34, 30, (x, y) => {
      const open = f ? 4 : 1.2;
      if (ell(x, y, 19, 15, 14, 11)) {
        if (x < 15 && Math.abs(y - 18) < open) return (Math.floor(x / 3) % 2 && Math.abs(Math.abs(y - 18) - open) < 1) ? '#ffffff' : '#2a0a2a';
        if (circ(x, y, 14, 9, 2.6)) return circ(x, y, 13.4, 9, 1.3) ? OUT : '#f0ff80';
        return y < 12 ? '#40d0c0' : (y > 20 ? '#e8f0a0' : '#20a0a0');
      }
      if (tri(x, y, 24, 5, 32, 0, 30, 9)) return '#30f0c0';
      return null;
    }, '#062a30'));
    S.lev_seg = [28, 24, 18].map((s, i) => raster(s + 4, s + 2, (x, y) => {
      const c = (s + 4) / 2, cy = (s + 2) / 2;
      if (i === 2) { if (tri(x, y, 2, cy, s + 2, 1, s + 2, s + 1)) return (Math.floor(x / 3) % 2) ? '#30f0c0' : '#20a0a0'; return null; }
      if (!ell(x, y, c, cy, s / 2, s / 2 - 1)) return (tri(x, y, c - 3, 1, c + 3, 1, c, -4 + 6)) ? '#30f0c0' : null;
      if (Math.abs(x - c) < 1 && y > cy) return '#e8f0a0';
      return y < cy - 2 ? '#40d0c0' : (y > cy + 4 ? '#e8f0a0' : '#20a0a0');
    }, '#062a30'));
    S.storm_bird = [0, 1].map(f => raster(18, 16, (x, y) => {
      if (f ? tri(x, y, 5, 8, 13, 8, 9, 1) : tri(x, y, 5, 8, 13, 8, 9, 15)) return '#d0c0ff';
      if (ell(x, y, 9, 8.5, 6.5, 3.2)) { if (circ(x, y, 5, 7.5, 1.1)) return '#ff3060'; return y > 9.5 ? '#6a4ac0' : '#9a6aff'; }
      if (tri(x, y, 1, 9, 4, 7.5, 4, 10)) return '#ffd040';
      return null;
    }, '#1a0a3a'));
    S.storm_eye = [0, 1].map(f => raster(40, 40, (x, y) => {
      const r = Math.hypot(x - 20, y - 20), a = Math.atan2(y - 20, x - 20);
      if (r < 6) return r < 3 ? OUT : '#ff3060';
      if (r < 9.5) return '#ffffff';
      if (r < 18 && Math.sin(a * 3 + r * 0.5 + f) > -0.4) return r < 13 ? '#c0a0ff' : '#ffffff';
      return null;
    }, '#1a0a3a'));
    S.dune_shell = raster(72, 44, (x, y) => {
      if (rect(x, y, 10, 34, 18, 44) || rect(x, y, 50, 34, 58, 44)) return '#7a4a1a';
      if (!ell(x, y, 36, 34, 34, 30) || y > 38) return null;
      const hex = (Math.floor(x / 9) + Math.floor(y / 8)) % 2;
      if (y > 33) return '#5a2a0c';
      return hex ? '#d8a050' : '#b07a30';
    }, '#2a1404');
    S.dune_head = raster(24, 18, (x, y) => {
      if (ell(x, y, 9, 8, 8, 6.4)) { if (circ(x, y, 6, 6, 1.8)) return circ(x, y, 5.6, 6, 0.9) ? OUT : '#ffe040'; if (x < 5 && y > 9) return '#5a2a0c'; return y < 6 ? '#f0c070' : '#c08a40'; }
      if (rect(x, y, 14, 6, 24, 12)) return '#a87030';
      return null;
    }, '#2a1404');
    S.col_body = raster(50, 76, (x, y) => {
      if (!ell(x, y, 25, 38, 22, 36)) return null;
      if (rect(x, y, 2, 30, 13, 46)) return null; // hueco del ojo
      if (Math.abs(y - 38) % 9 < 1.2 && x > 14) return '#ff3a9a';
      if (Math.abs(x - 32) < 1) return '#2a1a4a';
      return x < 18 ? '#c8c8e8' : (x > 38 ? '#4a3a7a' : '#8a7ab8');
    }, '#0a0418');
    S.col_arm = raster(24, 18, (x, y) => {
      if (ell(x, y, 13, 9, 10, 7)) { if (circ(x, y, 5, 9, 2.6)) return '#ff3a9a'; return y < 7 ? '#c8c8e8' : '#6a5a9a'; }
      return null;
    }, '#0a0418');
    S.col_eye = [0, 1].map(f => raster(20, 22, (x, y) => {
      if (!ell(x, y, 10, 11, 8.5, 9.5)) return null;
      if (!f) return Math.abs(y - 11) < 1 ? '#ff3a9a' : '#5a4a8a';
      if (circ(x, y, 9, 11, 3.6)) return circ(x, y, 8.4, 11, 1.8) ? OUT : '#ff3060';
      return '#fff0ff';
    }, '#0a0418'));
    S.crown_core = [0, 1].map(f => raster(34, 34, (x, y) => {
      const r = Math.hypot(x - 17, y - 17);
      if (r > 15) return null;
      if (f) { if (r < 6) return r < 3 ? '#ffffff' : '#ff3060'; if (r < 9) return '#ffd040'; }
      else if (Math.abs(x - 17) < 1.2 || Math.abs(y - 17) < 1.2) return '#ffd040';
      return (x < 14 && y < 14) ? '#e0d0ff' : (r > 12 ? '#3a1a6a' : '#7a4ac0');
    }, '#0a0418'));
    S.crown_gem = [0, 1].map(f => raster(15, 15, (x, y) => {
      const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5);
      if (dx + dy > 6.5) return null;
      if (dx + dy < 2.6) return f ? '#ffffff' : '#9affff';
      return x < 7.5 ? '#30d0ff' : '#1a70c0';
    }, '#0a0418'));
    S.crown_halo = raster(24, 86, (x, y) => {
      const r = Math.hypot((x - 0) * 1.8, y - 43);
      if (r > 40 && r < 46 && x > 2) return (Math.floor(y / 6) % 2) ? '#ffd040' : '#c08a10';
      if (y % 18 < 6 && r > 45 && r < 52) return '#ffd040';
      return null;
    }, '#0a0418');
    return S;
  }

  // ------------------------------------------------------------- fondos
  function background(theme) {
    const T = THEMES[theme], C = RFS.CONFIG.screen, H = C.groundY - C.hudH;
    const rng = RFS.util.rng(theme.length * 977 + theme.charCodeAt(0));
    // cielo con bandas y tramado
    const sky = canvas(C.w, H), s = sky.getContext('2d');
    const bands = T.sky.length;
    for (let y = 0; y < H; y++) {
      const v = y / H * (bands - 1), i = Math.floor(v), fr = v - i;
      for (let x = 0; x < C.w; x++) {
        const dither = ((x + y) % 2 === 0 ? 0.25 : 0.75);
        s.fillStyle = T.sky[Math.min(bands - 1, fr > dither ? i + 1 : i)];
        s.fillRect(x, y, 1, 1);
      }
    }
    if (theme === 'final' || theme === 'void' || theme === 'water') for (let i = 0; i < 70; i++) { s.fillStyle = theme === 'water' ? '#4ae0e0' : (i % 5 ? '#8a7ab8' : '#ffffff'); s.fillRect(rng() * C.w | 0, rng() * H * 0.7 | 0, 1, 1); }
    if (theme === 'forest' || theme === 'desert' || theme === 'cloud') { s.fillStyle = theme === 'desert' ? '#fff4c0' : '#ffffff'; s.beginPath(); s.arc(250, 40, 14, 0, TAU); s.fill(); }
    if (theme === 'ice') for (let k = 0; k < 3; k++) { s.fillStyle = ['#40ffb0', '#60c0ff', '#a080ff'][k]; for (let x = 0; x < C.w; x++) { const y = 26 + k * 6 + Math.sin(x * 0.03 + k) * 8; s.fillRect(x, y | 0, 1, 2); } }
    if (theme === 'fire') { s.fillStyle = '#ff6020'; for (let i = 0; i < 40; i++) s.fillRect(rng() * C.w | 0, rng() * H | 0, 1, 1); }

    // capa lejana periódica (sin costuras)
    const FW = 640, far = canvas(FW, H), f = far.getContext('2d');
    const k1 = 2 + (rng() * 3 | 0), k2 = 5 + (rng() * 4 | 0), k3 = 11 + (rng() * 5 | 0), p1 = rng() * TAU, p2 = rng() * TAU;
    for (let x = 0; x < FW; x++) {
      const u = x / FW * TAU;
      let h = 40 + 18 * Math.sin(u * k1 + p1) + 9 * Math.sin(u * k2 + p2) + 4 * Math.sin(u * k3);
      if (theme === 'fire') h += 26 * Math.max(0, Math.cos(u * 3)) ** 8;      // volcanes
      if (theme === 'ice') h = 34 + Math.abs(((x * 0.09) % 4) - 2) * 14 + 8 * Math.sin(u * k1 + p1); // picos
      if (theme === 'desert') h = 20 + 26 * Math.max(0, 1 - Math.abs(((x / 120) % 1) - 0.5) * 3.2) + 6 * Math.sin(u * k2); // pirámides/dunas
      if (theme === 'final') h = 30 + (Math.floor(x / 22) % 3) * 16 + (x % 22 < 3 ? 6 : 0);
      if (theme === 'cloud') h = 30 + 10 * Math.sin(u * k2 + p2) + 6 * Math.abs(Math.sin(u * 23));
      const top = H - h;
      f.fillStyle = T.far; f.fillRect(x, top, 1, h);
      f.fillStyle = T.farHi; f.fillRect(x, top, 1, 2);
    }
    if (theme === 'water') for (let i = 0; i < 18; i++) { const x = rng() * FW | 0, h = 30 + rng() * 60; f.fillStyle = T.farHi; f.fillRect(x, H - h, 3, h); f.fillRect(x - 3, H - h + 10, 3, 3); f.fillRect(x + 3, H - h + 20, 3, 3); }

    // capa media con decorados temáticos
    const MW = 512, mid = canvas(MW, H), m = mid.getContext('2d');
    const drawAt = (fnc, x) => { fnc(x); fnc(x - MW); fnc(x + MW); };
    const n = 10;
    for (let i = 0; i < n; i++) {
      const x0 = i * MW / n + rng() * 30, sz = 0.7 + rng() * 0.6;
      drawAt(x => {
        if (theme === 'forest') {
          m.fillStyle = '#7a3a1a'; m.fillRect(x - 2, H - 60 * sz, 4, 60 * sz);
          for (let k = 0; k < 3; k++) { m.fillStyle = k % 2 ? T.midHi : T.mid; m.beginPath(); m.ellipse(x + (k - 1) * 9 * sz, H - 60 * sz - k * 4, 14 * sz, 10 * sz, 0, 0, TAU); m.fill(); }
          m.fillStyle = '#ff60a0'; m.fillRect(x - 6, H - 64 * sz, 3, 3);
        } else if (theme === 'fire') {
          m.fillStyle = T.mid; m.beginPath(); m.moveTo(x - 30 * sz, H); m.lineTo(x - 6, H - 50 * sz); m.lineTo(x + 6, H - 50 * sz); m.lineTo(x + 30 * sz, H); m.fill();
          m.fillStyle = '#ff5010'; m.fillRect(x - 4, H - 50 * sz, 8, 3); m.fillRect(x - 1, H - 50 * sz + 3, 2, 14);
        } else if (theme === 'ice') {
          m.fillStyle = T.mid; m.beginPath(); m.moveTo(x - 8 * sz, H); m.lineTo(x, H - 70 * sz); m.lineTo(x + 8 * sz, H); m.fill();
          m.fillStyle = T.midHi; m.beginPath(); m.moveTo(x - 2, H - 50 * sz); m.lineTo(x, H - 70 * sz); m.lineTo(x + 1, H - 50 * sz); m.fill();
        } else if (theme === 'water') {
          m.fillStyle = T.mid; for (let k = 0; k < 6; k++) m.fillRect(x + Math.sin(k) * 4 - 2, H - k * 10 * sz - 10, 4, 10);
          m.fillStyle = '#ff70c0'; m.fillRect(x + 6, H - 14, 4, 4); m.fillStyle = T.midHi; m.fillRect(x - 10, H - 30 * sz, 3, 3);
        } else if (theme === 'cloud') {
          const y = 40 + (i % 3) * 30;
          m.fillStyle = T.mid; m.beginPath(); m.ellipse(x, H - y, 26 * sz, 9 * sz, 0, 0, TAU); m.fill();
          m.fillStyle = '#ffffff'; m.beginPath(); m.ellipse(x - 6, H - y - 4, 14 * sz, 7 * sz, 0, 0, TAU); m.fill();
          m.fillStyle = '#8a6a4a'; m.beginPath(); m.moveTo(x - 16 * sz, H - y + 6); m.lineTo(x + 16 * sz, H - y + 6); m.lineTo(x, H - y + 22 * sz); m.fill();
        } else if (theme === 'desert') {
          m.fillStyle = T.mid; m.fillRect(x - 3, H - 36 * sz, 6, 36 * sz); m.fillRect(x - 12, H - 36 * sz, 24, 4);
          if (i % 2) { m.fillStyle = '#4a8a3a'; m.fillRect(x + 18, H - 22, 4, 22); m.fillRect(x + 14, H - 16, 4, 3); m.fillRect(x + 22, H - 12, 4, 3); }
        } else if (theme === 'final' || theme === 'void') {
          m.fillStyle = T.mid; m.fillRect(x - 6, H - 80 * sz, 12, 80 * sz);
          m.fillStyle = T.midHi; for (let k = 0; k < 6; k++) m.fillRect(x - 6, H - 80 * sz + k * 12, 12, 2);
          m.fillStyle = '#ff3a9a'; m.fillRect(x - 1, H - 80 * sz - 4, 2, 4);
        }
      }, x0);
    }
    // suelo (losa de 64 px)
    const GH = C.h - C.radarH - C.groundY, ground = canvas(64, GH), gx = ground.getContext('2d');
    gx.fillStyle = T.ground; gx.fillRect(0, 0, 64, GH);
    gx.fillStyle = T.groundHi; gx.fillRect(0, 0, 64, 2);
    gx.fillStyle = T.groundLo;
    for (let i = 0; i < 12; i++) gx.fillRect((i * 37) % 64, 4 + (i * 5) % (GH - 4), 4 + i % 3, 2);
    if (theme === 'forest') { gx.fillStyle = '#4cc060'; for (let x = 0; x < 64; x += 4) gx.fillRect(x, 0, 2, 2 + (x % 8 ? 0 : 2)); }
    if (theme === 'fire') { gx.fillStyle = '#ff7a10'; gx.fillRect(10, 6, 14, 2); gx.fillRect(40, 10, 12, 2); }
    if (theme === 'cloud') { gx.fillStyle = '#ffffff'; gx.fillRect(0, GH - 4, 64, 4); }
    return { sky, far, mid, ground, T };
  }

  // ------------------------------------------------------------- fuente
  const GLYPHS = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
    0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
    4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
    8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
    '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
    ':': [0, 12, 12, 0, 12, 12, 0], '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [0, 1, 2, 4, 8, 16, 0],
    "'": [12, 4, 8, 0, 0, 0, 0], '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '$': [4, 15, 20, 14, 5, 30, 4],
    '%': [24, 25, 2, 4, 8, 19, 3], '¡': [4, 0, 4, 4, 4, 4, 4], '¿': [4, 0, 4, 8, 16, 17, 14], '*': [0, 4, 21, 14, 21, 4, 0],
    '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '=': [0, 0, 31, 0, 31, 0, 0], '#': [10, 10, 31, 10, 31, 10, 10],
    '▶': [8, 12, 14, 15, 14, 12, 8], '◀': [2, 6, 14, 30, 14, 6, 2], '■': [0, 31, 31, 31, 31, 31, 0], '□': [0, 31, 17, 17, 17, 31, 0],
    '♥': [0, 10, 31, 31, 14, 4, 0], 'x': [0, 0, 17, 10, 4, 10, 17], ' ': [0, 0, 0, 0, 0, 0, 0]
  };
  const ACCENT = { 'Á': ['A', 'a'], 'É': ['E', 'a'], 'Í': ['I', 'a'], 'Ó': ['O', 'a'], 'Ú': ['U', 'a'], 'Ñ': ['N', 't'], 'Ü': ['U', 'd'] };
  const fontCache = {};
  function fontAtlas(color) {
    if (fontCache[color]) return fontCache[color];
    const map = {}, chars = Object.keys(GLYPHS).concat(Object.keys(ACCENT));
    const c = canvas(chars.length * 6, 10), x = c.getContext('2d');
    x.fillStyle = color;
    chars.forEach((ch, i) => {
      const acc = ACCENT[ch], rows = GLYPHS[acc ? acc[0] : ch], ox = i * 6;
      for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if (rows[r] & (16 >> b)) x.fillRect(ox + b, r + 2, 1, 1);
      if (acc) {
        if (acc[1] === 'a') { x.fillRect(ox + 3, 0, 1, 1); x.fillRect(ox + 2, 1, 1, 1); }
        if (acc[1] === 't') { x.fillRect(ox + 1, 0, 2, 1); x.fillRect(ox + 4, 0, 1, 1); x.fillRect(ox, 1, 1, 1); x.fillRect(ox + 3, 1, 1, 1); }
        if (acc[1] === 'd') { x.fillRect(ox + 1, 0, 1, 1); x.fillRect(ox + 3, 0, 1, 1); }
      }
      map[ch] = ox;
    });
    return (fontCache[color] = { c, map });
  }
  /** Texto bitmap. align: 'l' | 'c' | 'r'. y = parte superior del glifo (sin acento). */
  function text(ctx, str, x, y, color, align, shadow) {
    str = String(str).toUpperCase().replace(/×/g, 'x');
    const w = str.length * 6 - 1;
    let sx = Math.round(align === 'c' ? x - w / 2 : align === 'r' ? x - w : x);
    if (shadow !== false) drawStr(ctx, str, sx + 1, y + 1, shadow || '#000000');
    drawStr(ctx, str, sx, y, color || '#ffffff');
    return w;
  }
  function drawStr(ctx, str, x, y, color) {
    const A = fontAtlas(color);
    for (let i = 0; i < str.length; i++) {
      let ch = str[i]; if (A.map[ch] == null) ch = ch === 'X' ? 'X' : ' ';
      ctx.drawImage(A.c, A.map[ch], 0, 5, 10, x + i * 6, y - 2, 5, 10);
    }
  }

  // ------------------------------------------------------------- caché
  const Sprites = RFS.Sprites = {
    THEMES, text, raster, flip, tint,
    init() {
      this.player = [playerSprite(0), playerSprite(1)];
      this.playerL = this.player.map(flip);
      this.playerW = this.player.map(s => tint(s, '#ffffff'));
      this.balloon = [balloonSprite(0), balloonSprite(1)];
      this.token = [tokenSprite(0), tokenSprite(1)];
      this.coins = {};
      for (const k of ['small', 'medium', 'large', 'base', 'boss']) this.coins[k] = [0, 1, 2, 3].map(f => coinSprite(k, f));
      this.boss = bossSprites();
      this.bossW = {};
      this.enemies = {}; this.bases = {}; this.bgs = {};
    },
    enemy(fam, theme, f, left) {
      const key = fam + theme;
      if (!this.enemies[key]) {
        const pal = THEMES[theme].e;
        const fr = [0, 1].map(k => enemySprite(fam, pal, k));
        this.enemies[key] = { L: fr, R: fr.map(flip), W: fr.map(s => tint(s, '#ffffff')) };
      }
      const e = this.enemies[key];
      return left === 'W' ? e.W[f] : (left ? e.L[f] : e.R[f]);
    },
    base(theme, ground, white) {
      const key = theme + (ground ? 'g' : 'f');
      if (!this.bases[key]) { const s = baseSprite(theme, ground); this.bases[key] = { s, w: tint(s, '#ffffff') }; }
      return white ? this.bases[key].w : this.bases[key].s;
    },
    bg(theme) { return this.bgs[theme] || (this.bgs[theme] = background(theme)); },
    white(img) { if (!img._white) img._white = tint(img, '#ffffff'); return img._white; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
