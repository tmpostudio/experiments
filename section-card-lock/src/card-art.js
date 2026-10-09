/* Card art: the four live line illustrations from the brand tool, drawn by ONE WebGL
   renderer. Its canvas rides in the pinned head over the cards' art column, and each
   card's scene is rendered into that card's .card__art box with setViewport/setScissor,
   clipped wherever a later card covers it. Loaded on demand by js/stack.js.
   Build: npm run build  (bundles this + three into js/card-art.js) */
import { MathUtils, OrthographicCamera, PerspectiveCamera, Scene, Spherical, Vector3, WebGLRenderer } from "three";
import { createCredit } from "./illustrations/credit.js";
import { createLiquidity3 } from "./illustrations/liquidity3.js";
import { createDipole } from "./illustrations/dipole.js";
import { createAutomation } from "./illustrations/automation.js";

// Brand tool framing: ortho frustum 9.5 units tall, every camera 12 units from the origin
const FRUSTUM_HEIGHT = 9.5;
const DISTANCE = 12;
const MAX_DT = 0.1;       // tab-switch protection
const STILL_AT = 4;       // reduced motion: default seconds to run before the still frame
const STILL_STEP = 1 / 30;

// Keyed by the card's data-art. Param defaults are the brand tool's; only overrides go here.
// camera.target is the point the camera orbits and looks at (the brand tool's controls.target).
// Zoom and target are framed on each piece's largest outline over the whole animation.
// ink recolours the line work (it's black in every module); stillAt / stillParams shape the
// reduced-motion frame only.
const ART = {
  // Credit: its field rises from the floor, so it looks 1.37 up the spin axis to sit centred;
  // fills ~72% of the box height fully drawn. Held at its composed 3/4 angle for the still
  // (the auto orbit would have turned it edge-on).
  credit: { create: createCredit, camera: { type: "ortho", zoom: 1.72, azimuth: -12, elevation: 24, target: [0, 1.37, 0] }, stillParams: { rotation: 0 } },
  // Liquidity 3: zoomed out from 1 so the widest wake rings stay inside the box; the still
  // waits out a full 6s ring life so the wake is at its full length
  liquidity: { create: createLiquidity3, camera: { type: "perspective", zoom: 0.75, azimuth: 0, elevation: 0 }, stillAt: 7 },
  // Yield: the brand tool's Earn (dipole), zoomed from the tool's 0.57 to fill ~70% of the box
  // height, about the size the Figma static art had. Slowed from 0.3, and 1px lines (from 1.5)
  // to match Credit and Liquidity.
  yield: { create: createDipole, camera: { type: "ortho", zoom: 1, azimuth: -32, elevation: 24 }, params: { speed: 0.15, lineWidth: 1 } },
  // Curation: the brand tool's Automation, drawn white on the dark card. Its cluster fills the
  // box at zoom 1, so 0.92 keeps the widest orbit ~6% inside the edges.
  curation: { create: createAutomation, camera: { type: "perspective", zoom: 0.92, azimuth: 0, elevation: 0, target: [0, 0.22, 0] }, params: { firing: 3 }, ink: 0xffffff },
};

function createCamera({ type, zoom, azimuth, elevation, target = [0, 0, 0] }) {
  const camera = type === "ortho"
    ? new OrthographicCamera(-1, 1, FRUSTUM_HEIGHT / 2, -FRUSTUM_HEIGHT / 2, 0.1, 100)
    : new PerspectiveCamera(40, 1, 0.1, 100);
  const polar = MathUtils.degToRad(90 - elevation);
  const center = new Vector3(...target);
  camera.position.setFromSpherical(new Spherical(DISTANCE, polar, MathUtils.degToRad(azimuth))).add(center);
  camera.lookAt(center);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  return camera;
}

// Recolours every line and dot material in the illustration, from outside the module (as the
// brand tool's Chrome mode swaps materials). Automation builds its materials up front and shares
// them with anything it creates later, so one pass covers it.
function setInk(group, color) {
  group.traverse((object) => {
    if (object.material?.color) object.material.color.set(color);
  });
}

function setAspect(camera, aspect) {
  if (camera.isOrthographicCamera) {
    camera.left = (-FRUSTUM_HEIGHT / 2) * aspect;
    camera.right = (FRUSTUM_HEIGHT / 2) * aspect;
  } else {
    camera.aspect = aspect;
  }
  camera.updateProjectionMatrix();
}

export function mount(section) {
  const head = section.querySelector(".platform__head");
  const cards = [];
  for (const el of section.querySelectorAll(".card")) {
    const spec = ART[el.dataset.art];
    const box = el.querySelector(".card__art");
    if (!spec || !box) continue;
    const illustration = spec.create();
    for (const [key, value] of Object.entries(spec.params || {})) illustration.set(key, value);
    if (spec.ink !== undefined) setInk(illustration.group, spec.ink);
    const scene = new Scene();
    scene.add(illustration.group);
    cards.push({
      el, box, illustration, scene,
      camera: createCamera(spec.camera),
      stillAt: spec.stillAt ?? STILL_AT,
      stillParams: spec.stillParams || {},
      width: 0, height: 0, pixelRatio: 0,
    });
  }
  if (!head || !cards.length) return;

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn("[card art] WebGL unavailable", error);
    return;
  }
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "platform__art";
  canvas.setAttribute("aria-hidden", "true");
  head.appendChild(canvas);

  let bufferWidth = 0;
  let bufferHeight = 0;

  // Keeps the canvas over the art column (every card shares it) and the drawing buffer at its size
  function fit() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (pixelRatio !== renderer.getPixelRatio()) {
      renderer.setPixelRatio(pixelRatio);
      bufferWidth = 0;
    }
    const column = cards[0].box.getBoundingClientRect();
    let frame = canvas.getBoundingClientRect();
    if (Math.abs(column.left - frame.left) > 0.5 || Math.abs(column.width - frame.width) > 0.5) {
      canvas.style.left = (parseFloat(canvas.style.left) || 0) + column.left - frame.left + "px";
      canvas.style.width = column.width + "px";
      frame = canvas.getBoundingClientRect();
    }
    if (frame.width !== bufferWidth || frame.height !== bufferHeight) {
      bufferWidth = frame.width;
      bufferHeight = frame.height;
      renderer.setSize(frame.width, frame.height, false);
    }
    return frame;
  }

  function draw(dt) {
    const frame = fit();
    const pixelRatio = renderer.getPixelRatio();
    const tops = cards.map((card) => card.el.getBoundingClientRect().top);

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    cards.forEach((card, i) => {
      const box = card.box.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;

      if (box.width !== card.width || box.height !== card.height || pixelRatio !== card.pixelRatio) {
        card.width = box.width;
        card.height = box.height;
        card.pixelRatio = pixelRatio;
        setAspect(card.camera, box.width / box.height);
        // Line weight is screen-space. Line2 also re-reads the viewport before each draw,
        // which is why every card gets its own viewport rather than sharing the canvas's.
        card.illustration.setResolution(box.width * pixelRatio, box.height * pixelRatio);
      }
      card.illustration.update(dt, { camera: card.camera, height: box.height * pixelRatio, pixelRatio });

      // Draw only the part of the box that's on the canvas and not under a later card
      const top = Math.max(box.top, frame.top);
      const bottom = Math.min(box.bottom, frame.bottom, ...tops.slice(i + 1));
      if (bottom - top < 1) return;
      const x = box.left - frame.left;
      renderer.setViewport(x, frame.bottom - box.bottom, box.width, box.height);
      renderer.setScissor(x, frame.bottom - bottom, box.width, bottom - top);
      renderer.render(card.scene, card.camera);
    });
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  let frameId = 0;
  let frames = 0;
  let last = 0;

  function tick(now) {
    frameId = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    frames++;
    draw(dt);
  }

  // Reduced motion: run each illustration to a representative moment once, then only
  // redraw that frame (dt 0) when scrolling or resizing moves the cards
  let settled = false;
  function still() {
    if (!settled) {
      settled = true;
      draw(0); // sizes the cameras and line resolutions
      for (const card of cards) {
        for (const [key, value] of Object.entries(card.stillParams)) card.illustration.set(key, value);
        const view = { camera: card.camera, height: card.height * card.pixelRatio, pixelRatio: card.pixelRatio };
        for (let t = 0; t < card.stillAt; t += STILL_STEP) card.illustration.update(STILL_STEP, view);
      }
    }
    frames++;
    draw(0);
  }

  // Back to motion: restore the defaults the still frame overrode
  function unsettle() {
    if (!settled) return;
    settled = false;
    for (const card of cards) {
      for (const key of Object.keys(card.stillParams)) {
        const param = card.illustration.params.find((p) => p.key === key);
        if (param) card.illustration.set(key, param.value);
      }
    }
  }

  let stillQueued = false;
  function queueStill() {
    if (!reducedMotion.matches || !visible || stillQueued) return;
    stillQueued = true;
    requestAnimationFrame(() => {
      stillQueued = false;
      still();
    });
  }

  function setState(state) {
    if (section.dataset.art === state) return;
    section.dataset.art = state;
    console.info(`[card art] ${state}`);
  }

  // The loop only runs while the section is on screen
  function sync() {
    const animate = visible && !reducedMotion.matches;
    if (animate && !frameId) {
      last = performance.now();
      frameId = requestAnimationFrame(tick);
    } else if (!animate && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
    if (reducedMotion.matches) {
      setState("still");
      queueStill();
    } else {
      unsettle();
      setState(animate ? "running" : "paused");
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(section);
  reducedMotion.addEventListener("change", sync);
  window.addEventListener("scroll", queueStill, { passive: true });
  window.addEventListener("resize", queueStill);

  // Debug handle, like the brand tool's window.__kamino
  window.__cardArt = {
    renderer,
    cards,
    get frames() {
      return frames;
    },
    get state() {
      return section.dataset.art;
    },
  };
}
