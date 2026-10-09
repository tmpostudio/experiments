/* Hero art: the brand tool's Automation (connecting dots), black on the hero's cyan.
   Runs only while the hero is on screen; one still frame under reduced motion. */
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { createAutomation } from "../../section-card-lock/src/illustrations/automation.js";

export function mountHero(box) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn("[hero art] WebGL unavailable", error);
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  box.appendChild(renderer.domElement);

  const art = createAutomation();
  art.set("firing", 3);
  const scene = new Scene();
  scene.add(art.group);
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.22, 12);
  camera.lookAt(0, 0.22, 0);
  camera.zoom = 0.95;

  const view = { camera, height: 1, pixelRatio: renderer.getPixelRatio() };

  function resize() {
    const { clientWidth: w, clientHeight: h } = box;
    if (!w || !h) return;
    const pr = renderer.getPixelRatio();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    art.setResolution(w * pr, h * pr);
    view.height = h * pr;
  }
  new ResizeObserver(() => { resize(); if (still) renderer.render(scene, camera); }).observe(box);
  resize();

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) {
    for (let t = 0; t < 4; t += 1 / 30) art.update(1 / 30, view);
    renderer.render(scene, camera);
    return;
  }

  let frame = 0;
  let last = 0;
  function tick(now) {
    frame = requestAnimationFrame(tick);
    art.update(Math.min((now - last) / 1000, 0.1), view);
    last = now;
    renderer.render(scene, camera);
  }
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!entry.isIntersecting && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }).observe(box);
}
