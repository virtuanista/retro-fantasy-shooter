/* Núcleo: utilidades matemáticas (incluida la aritmética de mundo circular)
 * y sistema de entrada (teclado + mando + entrada virtual para pruebas). */
(function (root) {
  const RFS = root.RFS = root.RFS || {};

  const U = RFS.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    mod: (a, n) => ((a % n) + n) % n,
    /** Diferencia con signo más corta de a -> b en un mundo circular de anchura W. */
    wdx(a, b, W) { let d = ((b - a) % W + W) % W; if (d > W / 2) d -= W; return d; },
    /** Coordenada de pantalla de x de mundo dada la cámara (continua). */
    screenX(x, camX, W, margin) { const m = margin == null ? 96 : margin; return ((x - camX + m) % W + W) % W - m; },
    rng(seed) {
      let s = (seed >>> 0) || 1;
      const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
      f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
      f.pick = arr => arr[Math.floor(f() * arr.length)];
      return f;
    },
    weighted(rand, table) {
      let tot = 0; for (const k in table) tot += table[k];
      let r = rand() * tot;
      for (const k in table) { r -= table[k]; if (r <= 0) return k; }
      return Object.keys(table)[0];
    },
    /** Solapamiento de cajas (semiejes) en mundo circular. */
    hit(ax, ay, ahw, ahh, bx, by, bhw, bhh, W) {
      const dx = U.wdx(ax, bx, W);
      return Math.abs(dx) < ahw + bhw && Math.abs(by - ay) < ahh + bhh;
    },
    dist(ax, ay, bx, by, W) { const dx = U.wdx(ax, bx, W); const dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
  };

  // ---------------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------------
  const ACTIONS = ['up', 'down', 'left', 'right', 'fire', 'bomb', 'flash', 'equip', 'pause', 'back'];
  const DEFAULT_KEYS = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    fire: ['Space', 'KeyZ'], bomb: ['Mouse0', 'KeyX'], flash: ['Mouse2', 'KeyC'],
    equip: ['KeyE', 'Tab'], pause: ['Enter', 'KeyP'], back: ['Escape', 'Backspace']
  };

  const Input = RFS.Input = {
    ACTIONS,
    keys: {},            // código -> pulsado
    taps: {},            // códigos pulsados desde el último fotograma (no se pierden toques cortos)
    bindings: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
    virtual: null,       // objeto {accion: bool} para bots/pruebas
    cur: {}, prev: {},
    pad: null,
    lastKey: null,       // para reasignación
    resetBindings() { this.bindings = JSON.parse(JSON.stringify(DEFAULT_KEYS)); },
    attach(target) {
      target.addEventListener('keydown', e => {
        this.keys[e.code] = true; this.taps[e.code] = true; this.lastKey = e.code;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      });
      target.addEventListener('keyup', e => { this.keys[e.code] = false; });
      target.addEventListener('blur', () => { this.keys = {}; this.taps = {}; });
      // ratón: clic izquierdo = Mouse0, clic derecho = Mouse2
      target.addEventListener('mousedown', e => { this.keys['Mouse' + e.button] = true; this.taps['Mouse' + e.button] = true; this.lastKey = 'Mouse' + e.button; });
      target.addEventListener('mouseup', e => { this.keys['Mouse' + e.button] = false; });
      target.addEventListener('contextmenu', e => e.preventDefault());
    },
    pollPad() {
      this.pad = null;
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    },
    update() {
      this.prev = this.cur;
      const c = {};
      if (this.virtual) { for (const a of ACTIONS) c[a] = !!this.virtual[a]; this.cur = c; this.taps = {}; return; }
      // una tecla pulsada y soltada entre dos fotogramas cuenta como pulsada en este
      for (const a of ACTIONS) c[a] = this.bindings[a].some(k => this.keys[k] || this.taps[k]);
      this.lastTaps = this.taps; this.taps = {};
      this.pollPad();
      const p = this.pad;
      if (p) {
        const b = i => p.buttons[i] && p.buttons[i].pressed;
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        c.left = c.left || b(14) || ax < -0.4; c.right = c.right || b(15) || ax > 0.4;
        c.up = c.up || b(12) || ay < -0.4; c.down = c.down || b(13) || ay > 0.4;
        c.fire = c.fire || b(0) || b(5); c.bomb = c.bomb || b(1) || b(2) || b(4);
        c.flash = c.flash || b(3); c.equip = c.equip || b(8); c.pause = c.pause || b(9);
        c.back = c.back || b(1);
      }
      this.cur = c;
    },
    down(a) { return !!this.cur[a]; },
    pressed(a) { return !!this.cur[a] && !this.prev[a]; },
    keyName(code) {
      const N = { Mouse0: 'CLIC IZQ', Mouse1: 'CLIC CEN', Mouse2: 'CLIC DER', Space: 'ESPACIO', Escape: 'ESC', Backspace: 'RETROCESO', Enter: 'ENTER', NumpadEnter: 'ENTER NUM',
        ArrowUp: 'FLECHA ARRIBA', ArrowDown: 'FLECHA ABAJO', ArrowLeft: 'FLECHA IZQ', ArrowRight: 'FLECHA DER', ShiftLeft: 'MAYÚS IZQ', ShiftRight: 'MAYÚS DER',
        ControlLeft: 'CTRL IZQ', ControlRight: 'CTRL DER', AltLeft: 'ALT', AltRight: 'ALT GR', CapsLock: 'BLOQ MAYÚS', Tab: 'TAB',
        Period: '.', Comma: ',', Minus: '-', Slash: '/', Quote: "'", Equal: '=' };
      return N[code] || (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
