/* Arranque en navegador: lienzo escalado píxel a píxel, bucle de paso fijo a
 * 60 Hz (independiente de la frecuencia del monitor) y desbloqueo de audio. */
(function () {
  const RFS = window.RFS, C = RFS.CONFIG.screen;
  const canvas = document.getElementById('screen');
  canvas.width = C.w; canvas.height = C.h;
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);

  RFS.Renderer.init();
  RFS.Input.attach(window);

  const game = new RFS.Game({
    debug: params.has('debug'),
    hooks: {
      resize: () => resize(),
      fullscreen: () => toggleFullscreen()
    }
  });
  window.__game = game;
  if (params.has('debug') && params.get('level')) { game.newGame(Math.max(0, Math.min(7, (parseInt(params.get('level'), 10) || 1) - 1))); }

  // Pantalla completa desde el menú de opciones. Dentro de un iframe sin
  // permiso (o en navegadores sin la API) se avisa en vez de lanzar errores.
  function toggleFullscreen() {
    const d = document, el = d.documentElement, fail = () => game.notice('PANTALLA COMPLETA NO DISPONIBLE');
    try {
      let p;
      if (d.fullscreenElement || d.webkitFullscreenElement) p = (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req || d.fullscreenEnabled === false || (d.fullscreenEnabled == null && d.webkitFullscreenEnabled === false)) { fail(); return; }
        p = req.call(el);
      }
      if (p && p.catch) p.catch(fail);
    } catch (e) { fail(); }
  }

  // Escalado entero en píxeles físicos (nítido también con zoom del sistema
  // al 125 % o 150 %) y centrado alineado a píxel. ESCALA nx = n veces en CSS.
  function resize() {
    const dpr = window.devicePixelRatio || 1, vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
    const maxS = Math.max(1, Math.floor(Math.min(vw / C.w, vh / C.h)));
    const s = game.settings.scale ? Math.max(1, Math.min(Math.round(game.settings.scale * dpr), maxS)) : maxS;
    canvas.style.width = C.w * s / dpr + 'px'; canvas.style.height = C.h * s / dpr + 'px';
    canvas.style.left = Math.max(0, Math.floor((vw - C.w * s) / 2)) / dpr + 'px';
    canvas.style.top = Math.max(0, Math.floor((vh - C.h * s) / 2)) / dpr + 'px';
  }
  window.addEventListener('resize', resize); resize();

  const unlock = () => RFS.Audio.unlock();
  window.addEventListener('keydown', unlock); window.addEventListener('pointerdown', unlock);
  window.addEventListener('gamepadconnected', () => game.notice('MANDO CONECTADO'));
  // Pausa automática al cambiar de pestaña o al perder el foco (por ejemplo,
  // al hacer clic fuera del iframe en la página de itch.io).
  const autoPause = () => {
    if (['play', 'boss', 'bosswarn', 'coinrain'].includes(game.state)) { game.returnState = game.state; game.setState('pause'); game.menu.i = 0; }
  };
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => {
    const A = RFS.Audio;
    if (document.hidden) { autoPause(); if (A.ctx && A.ctx.state === 'running') A.ctx.suspend().catch(() => {}); }
    else if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  });

  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(250, now - last); last = now;
    let n = 0;
    try {
      while (acc >= STEP && n < 5) { game.update(); acc -= STEP; n++; }
      if (n === 5) acc = 0;
      RFS.Renderer.draw(ctx, game);
    } catch (e) { console.error(e); acc = 0; } // un error no congela el bucle
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
