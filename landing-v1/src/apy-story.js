/* APY scroll story, from kamino-line art animations/apy-scroll-story, turned from a
   full page into a pinned section: progress comes from the section's scroll, the layers
   live in a sticky stage, and the loop only runs while the section is on screen. */
import {
  Color, Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer,
} from "three";

const BLUE = 0xc2edfb;
// Ring values tuned in the illustration tool (02 — APY)
const DOT_COUNT = 24;
const RING_RADIUS = 3.64;
const DOT_RADIUS = 0.07;
const RING_SPEED = 0.3;

const VIEW_TOP = { x: Math.PI / 2, z: 0 };
const VIEW_SIDE = { x: MathUtils.degToRad(10), z: 0.15 };
const TEXT_LOCK = 0.3;

// dive 0–0.5 · headline 0.04–0.44 · flood 0.44–0.60 · stats 0.60–1
// Each stat rolls in over ROLL of progress from its start, and stays; they stack as they arrive.
const STAT_STARTS = [0.6, 0.71, 0.82];
const ROLL = 0.085;
// Stack scale by how many stats have arrived (1, 2, 3): a lone stat reads bigger
const STACK_SCALE = [1.45, 1.18, 1];
// Radius of the drum the stats sit on (px, in stack units); smaller = more curved
const DRUM_RADIUS = 1120;
// Angle (radians) at which a row has turned far enough away to fade out
const DRUM_FADE = 1.25;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeIn = (p) => p * p * p;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);

export function mountApy(section) {
  const stage = section.querySelector(".apy__stage");
  const canvas = section.querySelector(".apy__canvas");
  const headline = section.querySelector(".apy__headline");
  const flood = section.querySelector(".apy__flood");
  const stats = section.querySelector(".apy__stats");
  const statEls = [...section.querySelectorAll(".apy__stat")];
  const stack = section.querySelector(".apy__stack");
  const hint = section.querySelector(".apy__hint");

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    console.warn("[apy story] WebGL unavailable", error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene();
  scene.background = new Color(0x000000);
  const camera = new PerspectiveCamera(42, 1, 0.05, 100);
  camera.position.set(0, 0, 26);

  const ringTilt = new Group();
  const ring = new Group();
  ringTilt.add(ring);
  scene.add(ringTilt);
  ringTilt.rotation.set(VIEW_TOP.x, 0, VIEW_TOP.z);

  const dotMaterial = new MeshBasicMaterial({ color: BLUE });
  const sphere = new SphereGeometry(1, 32, 16);
  for (let i = 0; i < DOT_COUNT; i++) {
    const theta = (i / DOT_COUNT) * Math.PI * 2;
    const dot = new Mesh(sphere, dotMaterial);
    dot.position.set(Math.cos(theta) * RING_RADIUS, 0, Math.sin(theta) * RING_RADIUS);
    dot.scale.setScalar(DOT_RADIUS);
    ring.add(dot);
  }

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const progress = () => {
    const r = section.getBoundingClientRect();
    const run = r.height - stage.clientHeight;
    return run > 0 ? clamp01(-r.top / run) : 0;
  };

  let P = progress();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function draw(dt) {
    P = reduced ? progress() : P + (progress() - P) * Math.min(1, dt * 7);
    ring.rotation.y += dt * RING_SPEED;

    const view = easeInOut(seg(P, 0.02, 0.4));
    ringTilt.rotation.x = MathUtils.lerp(VIEW_TOP.x, VIEW_SIDE.x, view);
    ringTilt.rotation.z = MathUtils.lerp(VIEW_TOP.z, VIEW_SIDE.z, view);

    const zAt = (p) => MathUtils.lerp(26, 3.4, easeInOut(seg(p, 0, 0.5)));
    camera.position.z = zAt(P);

    headline.style.opacity = seg(P, 0.02, 0.2).toFixed(3);
    const raw = zAt(TEXT_LOCK) / camera.position.z;
    const LOCK_BAND = 0.15;
    let headScale;
    if (raw < 1 - LOCK_BAND) {
      headScale = raw;
    } else {
      const t = Math.min((raw - (1 - LOCK_BAND)) / (2 * LOCK_BAND), 1);
      headScale = 1 - LOCK_BAND + LOCK_BAND * (1 - (1 - t) * (1 - t));
    }
    headline.style.transform = `scale(${headScale.toFixed(4)})`;

    const floodF = easeIn(seg(P, 0.36, 0.56));
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const coverScale = (Math.hypot(w, h) * 1.15) / 100;
    const floodScale = coverScale * (0.3 + 0.7 * floodF);
    const offscreen = w * 0.5 + 50 * floodScale + 20;
    const slideX = (1 - easeOut(floodF)) * -offscreen;
    flood.style.transform = `translateX(${slideX.toFixed(1)}px) scale(${floodScale.toFixed(3)})`;
    flood.style.visibility = floodF > 0 ? "visible" : "hidden";
    flood.style.setProperty("--white", easeInOut(seg(P, 0.42, 0.55)).toFixed(3)); // blue dot → page white as it fills

    stats.style.opacity = seg(P, 0.545, 0.58).toFixed(3);
    // Drum: the stats are printed round a cylinder that turns as they arrive. Each row sits at an
    // angle on it (one row-pitch of arc apart); the drum's rotation keeps the arrived rows centred,
    // so the earlier ones roll up and over the top while the newest rolls up from underneath.
    const enters = statEls.map((el, i) => easeOut(seg(P, STAT_STARTS[i], STAT_STARTS[i] + ROLL)));
    const k = enters.reduce((sum, e) => sum + e, 0);
    const rowH = statEls[0].offsetHeight;
    const pitch = statEls[1] ? statEls[1].offsetTop - statEls[0].offsetTop : rowH; // row + gap
    const step = pitch / DRUM_RADIUS; // radians between rows
    const turn = (Math.max(k, 1) - 1) / 2; // which row sits at the front, continuously
    const kk = Math.min(Math.max(k, 1), 3);
    const scale = kk <= 2
      ? MathUtils.lerp(STACK_SCALE[0], STACK_SCALE[1], kk - 1)
      : MathUtils.lerp(STACK_SCALE[1], STACK_SCALE[2], kk - 2);
    stack.style.setProperty("--stack-y", "0px");
    stack.style.setProperty("--stack-s", scale.toFixed(4));
    statEls.forEach((el, i) => {
      const e = enters[i];
      // Not yet arrived: still further round underneath, turning up into view as it lands
      const angle = (i - turn) * step + (1 - e) * step * 0.9;
      const y = DRUM_RADIUS * Math.sin(angle);
      const z = -DRUM_RADIUS * (1 - Math.cos(angle));
      const layoutY = (i - (statEls.length - 1) / 2) * pitch; // where the grid put the row
      // Faces turned away from you dim, as on a real drum
      const facing = clamp01((Math.cos(angle) - Math.cos(DRUM_FADE)) / (1 - Math.cos(DRUM_FADE)));
      el.style.opacity = (e * facing).toFixed(3);
      el.style.transform =
        `translateY(${(y - layoutY).toFixed(1)}px) translateZ(${z.toFixed(1)}px) rotateX(${(-angle * 180 / Math.PI).toFixed(2)}deg)`;
    });

    hint.style.opacity = String(1 - seg(P, 0.02, 0.06));

    if (floodF < 1) renderer.render(scene, camera);
  }

  let frame = 0;
  let last = 0;
  function tick(now) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    draw(dt);
  }

  if (reduced) {
    // Scroll still drives the story; the ring just doesn't spin on its own
    let queued = false;
    const redraw = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; draw(0); });
    };
    window.addEventListener("scroll", redraw, { passive: true });
    window.addEventListener("resize", redraw);
    draw(0);
    return;
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!entry.isIntersecting && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }).observe(section);
  draw(0);
}
