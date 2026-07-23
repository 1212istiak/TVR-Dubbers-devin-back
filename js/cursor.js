export function initCursor() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (isFinePointer && !prefersReducedMotion) {
    initDesktopCursor();
  } else if (!isFinePointer) {
    initTapGlow();
  }
}

function initDesktopCursor() {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let dotX = mouseX, dotY = mouseY;
  let ringX = mouseX, ringY = mouseY;
  let orbitAngle = 0;
  let caughtUp = false;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    document.body.classList.add('cursor-active');
  }, { passive: true });

  document.addEventListener('mouseleave', () => document.body.classList.remove('cursor-active'));

  // Interactive elements slightly grow the ring for affordance.
  const growSelector = 'a, button, input, textarea, select, .episode-tile, [role="button"]';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest && e.target.closest(growSelector)) ring.style.width = ring.style.height = '44px';
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest && e.target.closest(growSelector)) ring.style.width = ring.style.height = '30px';
  });

  function loop() {
    // Dot: snaps almost instantly to the real cursor.
    dotX += (mouseX - dotX) * 0.45;
    dotY += (mouseY - dotY) * 0.45;
    dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`;

    const dx = dotX - ringX;
    const dy = dotY - ringY;
    const dist = Math.hypot(dx, dy);

    if (!caughtUp && dist > 4) {
      // Ring is still catching up to the dot.
      ringX += dx * 0.12;
      ringY += dy * 0.12;
      if (dist < 6) caughtUp = true;
    } else {
      // Ring has caught up — now it gently orbits the dot instead of sitting on it.
      caughtUp = true;
      orbitAngle += 0.05;
      const orbitRadius = 13;
      const targetX = dotX + Math.cos(orbitAngle) * orbitRadius;
      const targetY = dotY + Math.sin(orbitAngle) * orbitRadius;
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      // If the real cursor jumps far away, drop out of orbit mode and re-chase.
      if (Math.hypot(mouseX - ringX, mouseY - ringY) > 120) caughtUp = false;
    }

    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function initTapGlow() {
  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const glow = document.createElement('div');
    glow.className = 'tap-glow';
    glow.style.left = touch.clientX + 'px';
    glow.style.top = touch.clientY + 'px';
    document.body.appendChild(glow);
    glow.addEventListener('animationend', () => glow.remove());
  }, { passive: true });
}
