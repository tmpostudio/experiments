/* v2: a tight grid of invisible white dots over the image. The pointer lights up the
   dots around it; they hold, then fade back out, leaving a short trail. Drawn in stage
   coordinates (650×518) so the grid stays locked to the image at any size. */
(function () {
  const media = document.querySelector(".newsletter__media");
  const stage = media.querySelector(".stage");

  const STAGE_W = 650;
  const STAGE_H = 518;
  const SPACING = 24;     // grid pitch
  const DOT_RADIUS = 8;
  const REACH = 44;       // how far from the pointer dots light up
  const HOLD_MS = 700;    // how long a lit dot stays at full brightness
  const FADE_MS = 1000;   // then how long it takes to disappear
  const MAX_ALPHA = 0.85;

  const canvas = document.createElement("canvas");
  canvas.className = "stage__dots";
  canvas.setAttribute("aria-hidden", "true");
  stage.querySelector(".stage__image").after(canvas);
  const ctx = canvas.getContext("2d");

  const cols = Math.floor(STAGE_W / SPACING) + 1;
  const rows = Math.floor(STAGE_H / SPACING) + 1;
  const originX = (STAGE_W - (cols - 1) * SPACING) / 2;
  const originY = (STAGE_H - (rows - 1) * SPACING) / 2;
  const peak = new Float32Array(cols * rows);   // brightness when last lit
  const litAt = new Float64Array(cols * rows);  // when it was last lit

  let running = false;
  let prev = null;

  function brightness(i, now) {
    const t = (now - litAt[i] - HOLD_MS) / FADE_MS;
    if (t <= 0) return peak[i];
    if (t >= 1) return 0;
    return peak[i] * (1 - t * t * (3 - 2 * t));
  }

  function resize() {
    const scale = media.clientWidth / STAGE_W;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(STAGE_W * scale * dpr);
    canvas.height = Math.round(STAGE_H * scale * dpr);
    ctx.setTransform(canvas.width / STAGE_W, 0, 0, canvas.height / STAGE_H, 0, 0);
    draw(performance.now());
  }
  new ResizeObserver(resize).observe(media);

  function toStage(event) {
    const rect = media.getBoundingClientRect();
    const scale = rect.width / STAGE_W;
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }

  // Raise every dot near (x, y); brightest at the pointer, soft falloff to REACH
  function light(x, y, now) {
    const c0 = Math.max(0, Math.ceil((x - REACH - originX) / SPACING));
    const c1 = Math.min(cols - 1, Math.floor((x + REACH - originX) / SPACING));
    const r0 = Math.max(0, Math.ceil((y - REACH - originY) / SPACING));
    const r1 = Math.min(rows - 1, Math.floor((y + REACH - originY) / SPACING));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(originX + c * SPACING - x, originY + r * SPACING - y);
        if (d >= REACH) continue;
        const t = 1 - d / REACH;
        const v = t * t * (3 - 2 * t);
        const i = r * cols + c;
        if (v >= brightness(i, now)) {
          peak[i] = v;
          litAt[i] = now;
        }
      }
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    ctx.fillStyle = "#fff";
    let lit = false;
    for (let i = 0; i < peak.length; i++) {
      const v = brightness(i, now);
      if (v < 0.01) continue;
      lit = true;
      ctx.globalAlpha = v * MAX_ALPHA;
      ctx.beginPath();
      ctx.arc(originX + (i % cols) * SPACING, originY + Math.floor(i / cols) * SPACING, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return lit;
  }

  function frame() {
    if (draw(performance.now())) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  media.addEventListener("pointermove", (event) => {
    const p = toStage(event);
    const now = performance.now();
    // Fill in between samples so fast movements leave a continuous trail
    if (prev) {
      const steps = Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / REACH);
      for (let s = 1; s < steps; s++) {
        light(prev.x + ((p.x - prev.x) * s) / steps, prev.y + ((p.y - prev.y) * s) / steps, now);
      }
    }
    light(p.x, p.y, now);
    prev = p;
    start();
  });
  media.addEventListener("pointerleave", () => (prev = null));
})();
