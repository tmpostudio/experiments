/* "One platform" as a row of cards (Figma 4895:29650). Same live line art as the card stack,
   drawn by one WebGL renderer whose canvas lies over the whole row; each card's scene is
   rendered into that card's art box with its own viewport. Loaded on demand by js/landing.js. */
import { Scene, WebGLRenderer } from "three";
import { ART, createCamera, setAspect, setInk } from "../../section-card-lock/src/card-art.js";
import { createYield } from "../../section-card-lock/src/illustrations/yield.js";

const MAX_DT = 0.1;
const STILL_AT = 4;
const STILL_STEP = 1 / 30;
const MAX_BUFFER = 4096;

// Keyed by the card's data-art. The stack's framing, re-zoomed for these taller, narrower boxes.
const zoomed = (spec, zoom) => ({ ...spec, camera: { ...spec.camera, zoom } });
const ROW = {
  credit: ART.credit,
  // Yield: the brand tool's newer "19 — Yield" (pole, dotted track, orbiting dots), seen from
  // slightly above so the track opens into a thin ellipse across the pole, as on the board
  yield: { create: createYield, camera: { type: "ortho", zoom: 0.92, azimuth: 0, elevation: 21 }, params: { lineWidth: 1 } },
  liquidity: zoomed(ART.liquidity, 0.66),
  curation: zoomed(ART.curation, 0.85),
};

export function mountRow(section) {
  const track = section.querySelector(".l-prow__track");
  const cards = [];
  for (const el of section.querySelectorAll(".l-pcard")) {
    const spec = ROW[el.dataset.art];
    const box = el.querySelector(".l-pcard__art");
    if (!spec || !box) continue;
    const illustration = spec.create();
    for (const [key, value] of Object.entries(spec.params || {})) illustration.set(key, value);
    if (spec.ink !== undefined) setInk(illustration.group, spec.ink);
    const scene = new Scene();
    scene.add(illustration.group);
    cards.push({
      box, illustration, scene,
      camera: createCamera(spec.camera),
      stillAt: spec.stillAt ?? STILL_AT,
      stillParams: spec.stillParams || {},
      width: 0, height: 0, pixelRatio: 0,
    });
  }
  if (!track || !cards.length) return;

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn("[platform row] WebGL unavailable", error);
    return;
  }
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "l-prow__art";
  canvas.setAttribute("aria-hidden", "true");
  track.appendChild(canvas);

  let bufferWidth = 0;
  let bufferHeight = 0;

  function draw(dt) {
    const frame = track.getBoundingClientRect();
    if (frame.width < 1 || frame.height < 1) return;
    // The canvas spans every card (it scrolls with them on narrow screens), so keep its buffer in bounds
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, MAX_BUFFER / frame.width, MAX_BUFFER / frame.height);
    if (frame.width !== bufferWidth || frame.height !== bufferHeight || pixelRatio !== renderer.getPixelRatio()) {
      bufferWidth = frame.width;
      bufferHeight = frame.height;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(frame.width, frame.height, false);
    }
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    for (const card of cards) {
      const box = card.box.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.width !== card.width || box.height !== card.height || pixelRatio !== card.pixelRatio) {
        card.width = box.width;
        card.height = box.height;
        card.pixelRatio = pixelRatio;
        setAspect(card.camera, box.width / box.height);
        card.illustration.setResolution(box.width * pixelRatio, box.height * pixelRatio);
      }
      card.illustration.update(dt, { camera: card.camera, height: box.height * pixelRatio, pixelRatio });
      const x = box.left - frame.left;
      const y = frame.bottom - box.bottom;
      renderer.setViewport(x, y, box.width, box.height);
      renderer.setScissor(x, y, box.width, box.height);
      renderer.render(card.scene, card.camera);
    }
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  let frameId = 0;
  let last = 0;
  let settled = false;

  function tick(now) {
    frameId = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    draw(dt);
  }

  // Reduced motion: run each illustration to a representative moment once, then just redraw it
  function still() {
    if (!settled) {
      settled = true;
      draw(0);
      for (const card of cards) {
        for (const [key, value] of Object.entries(card.stillParams)) card.illustration.set(key, value);
        const view = { camera: card.camera, height: card.height * card.pixelRatio, pixelRatio: card.pixelRatio };
        for (let t = 0; t < card.stillAt; t += STILL_STEP) card.illustration.update(STILL_STEP, view);
      }
    }
    draw(0);
  }

  // The loop only runs while the row is on screen (a hidden section never intersects)
  function sync() {
    const animate = visible && !reducedMotion.matches;
    if (animate && !frameId) {
      last = performance.now();
      frameId = requestAnimationFrame(tick);
    } else if (!animate && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
    section.dataset.art = reducedMotion.matches ? "still" : animate ? "running" : "paused";
    if (reducedMotion.matches && visible) requestAnimationFrame(still);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(section);
  reducedMotion.addEventListener("change", sync);
  window.addEventListener("resize", () => reducedMotion.matches && visible && requestAnimationFrame(still));

  window.__platformRow = { renderer, cards, draw };
}
