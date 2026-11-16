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
      fullscreen: () => { const el = document.documentElement; if (!document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen).call(el); else document.exitFullscreen(); }
    }
  });
  window.__game = game;
  if (params.has('debug') && params.get('level')) { RFS.Audio.unlock(); game.newGame(Math.max(0, Math.min(7, (parseInt(params.get('level'), 10) || 1) - 1))); }

  function resize() {
    const maxS = Math.max(1, Math.floor(Math.min(window.innerWidth / C.w, window.innerHeight / C.h)));
    const s = game.settings.scale ? Math.min(game.settings.scale, maxS) : maxS;
    canvas.style.width = C.w * s + 'px'; canvas.style.height = C.h * s + 'px';
  }
  window.addEventListener('resize', resize); resize();

  const unlock = () => RFS.Audio.unlock();
  window.addEventListener('keydown', unlock); window.addEventListener('pointerdown', unlock);
  window.addEventListener('gamepadconnected', () => game.notice('MANDO CONECTADO'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['play', 'boss', 'bosswarn', 'coinrain'].includes(game.state)) { game.returnState = game.state; game.setState('pause'); game.menu.i = 0; }
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
