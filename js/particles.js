const QI_COLORS = ['#22e5ff', '#39ff8f', '#6c5ce7', '#ff2d9e', '#7dd3fc', '#ff6ec7'];

export function initParticles(canvas, { lowPower = false } = {}) {
  if (!canvas) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let width, height, dpr;
  let particles = [];
  let running = true;
  let rafId = null;

  const COUNT = lowPower ? 16 : 42;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.6 + 0.6,
      vy: -(Math.random() * 0.12 + 0.03),
      vx: (Math.random() - 0.5) * 0.05,
      color: QI_COLORS[Math.floor(Math.random() * QI_COLORS.length)],
      alpha: Math.random() * 0.5 + 0.15,
      twinkleSpeed: Math.random() * 0.01 + 0.003,
      twinklePhase: Math.random() * Math.PI * 2,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, makeParticle);
  }

  let lastFrameTime = performance.now();
  let slowFrames = 0;

  function tick(now) {
    if (!running) return;
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    // Cheap adaptive quality: if frames are consistently slow, drop particle count once.
    if (dt > 42) {
      slowFrames++;
      if (slowFrames === 40 && particles.length > 10) {
        particles = particles.slice(0, Math.ceil(particles.length / 2));
      }
    }

    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.twinklePhase += p.twinkleSpeed;
      const twinkle = (Math.sin(p.twinklePhase) + 1) / 2;
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -5) { p.y = height + 5; p.x = Math.random() * width; }
      if (p.x < -5) p.x = width + 5;
      if (p.x > width + 5) p.x = -5;

      ctx.globalAlpha = p.alpha * (0.4 + twinkle * 0.6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(tick);
  }

  init();
  rafId = requestAnimationFrame(tick);

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(tick);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });
}
