/* Landing v1 interactions. The card stack (section-card-lock/js/stack.js) and the
   newsletter (kamino-sign-here/js/*) run their own scripts; this file covers the rest
   and lazy-loads the three.js pieces built into this folder (npm run build). */
(function () {
  const here = document.currentScript.src;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const usd = (n) => "$" + fmt(Math.round(n));

  // The CSS cubic-bezier(x1, y1, x2, y2) timing function as a function of progress 0–1
  function cubicBezier(x1, y1, x2, y2) {
    const at = (t, a, b) => (((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t + 3 * a) * t;
    const slope = (t, a, b) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { // Newton on the x curve
        const d = slope(t, x1, x2);
        if (!d) break;
        t -= (at(t, x1, x2) - x) / d;
      }
      return at(t, y1, y2);
    };
  }

  // Runs fn once when el comes within `margin` of the viewport
  function whenNear(el, fn, margin = "0px") {
    if (!el) return;
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      fn();
    }, { rootMargin: margin });
    io.observe(el);
  }

  // ---------- three.js pieces ----------
  // Carries landing.js's ?v= cache-buster onto the lazy modules (their chunks are content-hashed)
  const load = (file) => import(new URL(file + new URL(here).search, here).href);
  const heroArt = $("#hero-art");
  if (heroArt) load("hero-art.js").then((m) => m.mountHero(heroArt)).catch((e) => console.warn("[hero art]", e));
  const apy = $("#apy");
  whenNear(apy, () => load("apy-story.js").then((m) => m.mountApy(apy)).catch((e) => console.warn("[apy story]", e)), "800px 0px");

  // ---------- Floating nav: hides on the way down, slides back in (on glass) on the way up ----------
  const nav = $(".l-nav");
  const navHero = $(".l-hero");
  if (nav && navHero) {
    const slot = document.createElement("div"); // keeps the header's layout while the nav is lifted out
    let floating = false, shown = false, lastY = scrollY, ticking = false;
    const setShown = (v) => { shown = v; nav.classList.toggle("is-shown", v); };
    function float(on) {
      floating = on;
      if (on) {
        slot.style.height = `${nav.offsetHeight}px`;
        nav.before(slot);
        nav.classList.add("is-floating", "no-anim"); // starts out of view, no slide
        setShown(false);
        requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.remove("no-anim")));
      } else {
        nav.classList.remove("is-floating", "is-shown", "no-anim");
        slot.remove();
      }
    }
    function update() {
      ticking = false;
      const y = scrollY;
      const pastHeader = y > navHero.offsetTop + navHero.offsetHeight;
      if (!floating && pastHeader) float(true);
      else if (floating && y <= 0) float(false); // back at the very top: home in the header
      if (floating) {
        const dy = y - lastY;
        const menuOpen = !!$(".l-menu.is-open", nav);
        if (dy > 6 && !menuOpen) setShown(false);
        else if (dy < -6) setShown(true);
      }
      lastY = y;
    }
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ---------- Nav dropdowns: hover on desktop, click/keyboard everywhere ----------
  const menus = $$(".l-menu");
  const closeAll = (except) => menus.forEach((m) => {
    if (m === except) return;
    m.classList.remove("is-open");
    $(".l-menu__button", m).setAttribute("aria-expanded", "false");
  });
  menus.forEach((menu) => {
    const button = $(".l-menu__button", menu);
    let timer = 0;
    const open = () => { clearTimeout(timer); closeAll(menu); menu.classList.add("is-open"); button.setAttribute("aria-expanded", "true"); };
    const close = () => { timer = setTimeout(() => { menu.classList.remove("is-open"); button.setAttribute("aria-expanded", "false"); }, 120); };
    menu.addEventListener("mouseenter", open);
    menu.addEventListener("mouseleave", close);
    button.addEventListener("click", () => (menu.classList.contains("is-open") ? closeAll() : open()));
    menu.addEventListener("focusout", (e) => { if (!menu.contains(e.relatedTarget)) close(); });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".l-menu")) closeAll(); });

  // ---------- Header concept switch (Resources menu; also ?hero=dots|studio|app) ----------
  const hero = $(".l-hero");
  const heroButtons = $$("[data-hero-set]");
  function setHero(name, remember) {
    if (!hero) return;
    hero.dataset.hero = name;
    $$("[data-hero-variant]", hero).forEach((el) => (el.hidden = el.dataset.heroVariant !== name));
    heroButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.heroSet === name)));
    if (remember) try { localStorage.setItem("landing-v4:hero", name); } catch (e) {}
  }
  heroButtons.forEach((b) => b.addEventListener("click", () => setHero(b.dataset.heroSet, true)));
  let startHero = new URLSearchParams(location.search).get("hero");
  if (!startHero) try { startHero = localStorage.getItem("landing-v4:hero"); } catch (e) {}
  setHero(["app", "half", "dash"].includes(startHero) ? startHero : "studio", false); // default: Studio (the Dots header is retired from the switch)

  // ---------- Dash header: the pinned copy eases up a little as the page scrolls ----------
  // A third of the scroll, up to 90px, followed through a soft lerp so it glides rather than tracks
  const dashCopy = $(".l-hero__copy--dash");
  if (dashCopy && hero && !reduced) {
    let now = 0, raf = 0;
    const target = () => -Math.min(90, scrollY * 0.3);
    const step = () => {
      const t = target();
      now += (t - now) * 0.14;
      if (Math.abs(t - now) < 0.1) now = t;
      dashCopy.style.setProperty("--drift", `${now.toFixed(2)}px`);
      raf = now === t ? 0 : requestAnimationFrame(step);
    };
    window.addEventListener("scroll", () => { if (hero.dataset.hero === "dash" && !raf) raf = requestAnimationFrame(step); }, { passive: true });
  }

  // ---------- Hover dot grid: header photos (App screen, Studio) and the commodity video ----------
  // After kamino-sign-here/js/dots.js, reworked for the header: a fine grid of invisible
  // white dots. The pointer lights a wide soft pool around it and sends out ripples;
  // every lit dot twinkles at its own pace, so the trail glimmers as it fades.
  // mountDots(host, canvas, active): host takes the pointer and sets the size; active() can
  // switch it off (e.g. headers it doesn't suit). Used by the header and the commodity section.
  function mountDots(host, dotCanvas, active = () => true) {
    if (!host || !dotCanvas || reduced) return;
    const SPACING = 11;          // grid pitch
    const DOT_MIN = 0.7;         // dot radius when barely lit…
    const DOT_MAX = 2.1;         // …and at full brightness
    const REACH = 150;           // pool of light around the pointer
    const HOLD_MS = 120;         // how long the pool stays at full brightness
    const FADE_MS = 1300;        // then how long it takes to disappear
    const RIPPLE_SPEED = 300;    // px per second
    const RIPPLE_LIFE = 1500;    // ms; a ripple reaches ~450px before it dies
    const RIPPLE_WIDTH = 30;     // thickness of the wavefront
    const RIPPLE_EVERY = 70;     // px of pointer travel between ripples
    const MAX_ALPHA = 0.9;
    const ctx = dotCanvas.getContext("2d");
    let w = 0, h = 0, cols = 0, rows = 0, originX = 0, originY = 0;
    let peak = new Float32Array(0);    // pool brightness when last lit
    let litAt = new Float64Array(0);   // when it was last lit
    let val = new Float32Array(0);     // this frame's brightness
    let phase = new Float32Array(0);   // per-dot twinkle offset
    let rate = new Float32Array(0);    // per-dot twinkle speed
    let ripples = [];
    let running = false;
    let prev = null;
    let sinceRipple = 0;

    function pool(i, now) {
      const t = (now - litAt[i] - HOLD_MS) / FADE_MS;
      if (t <= 0) return peak[i];
      if (t >= 1) return 0;
      return peak[i] * (1 - t) * (1 - t);
    }

    function resize() {
      w = host.clientWidth;
      h = host.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dotCanvas.width = Math.round(w * dpr);
      dotCanvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(w / SPACING) + 1;
      rows = Math.floor(h / SPACING) + 1;
      originX = (w - (cols - 1) * SPACING) / 2;
      originY = (h - (rows - 1) * SPACING) / 2;
      const n = cols * rows;
      peak = new Float32Array(n);
      litAt = new Float64Array(n);
      val = new Float32Array(n);
      phase = new Float32Array(n);
      rate = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        phase[i] = Math.random() * Math.PI * 2;
        rate[i] = 0.004 + Math.random() * 0.009;
      }
      ripples = [];
    }
    new ResizeObserver(resize).observe(host);

    // Calls fn(index, distance) for every dot within `radius` of (x, y)
    function near(x, y, radius, fn) {
      const c0 = Math.max(0, Math.ceil((x - radius - originX) / SPACING));
      const c1 = Math.min(cols - 1, Math.floor((x + radius - originX) / SPACING));
      const r0 = Math.max(0, Math.ceil((y - radius - originY) / SPACING));
      const r1 = Math.min(rows - 1, Math.floor((y + radius - originY) / SPACING));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const d = Math.hypot(originX + c * SPACING - x, originY + r * SPACING - y);
          if (d < radius) fn(r * cols + c, d);
        }
      }
    }

    // Soft pool around the pointer; brightest at the centre
    function light(x, y, now) {
      near(x, y, REACH, (i, d) => {
        const t = 1 - d / REACH;
        const v = t * t * (3 - 2 * t) * 0.8;
        if (v >= pool(i, now)) {
          peak[i] = v;
          litAt[i] = now;
        }
      });
    }

    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (let i = 0; i < val.length; i++) {
        val[i] = pool(i, now);
        if (val[i] > 0.01) alive = true;
      }
      // Ripples: an expanding ring that fades as it grows
      ripples = ripples.filter((rp) => now - rp.t < RIPPLE_LIFE);
      for (const rp of ripples) {
        const age = (now - rp.t) / RIPPLE_LIFE;
        const radius = ((now - rp.t) / 1000) * RIPPLE_SPEED;
        const strength = (1 - age) * (1 - age);
        near(rp.x, rp.y, radius + RIPPLE_WIDTH * 2, (i, d) => {
          const k = (d - radius) / RIPPLE_WIDTH;
          const v = strength * Math.exp(-k * k);
          if (v > val[i]) val[i] = v;
        });
        alive = true;
      }
      ctx.fillStyle = "#fff";
      for (let i = 0; i < val.length; i++) {
        let v = val[i];
        if (v < 0.02) continue;
        // Glimmer: each dot pulses on its own clock, with the odd bright spark
        const tw = 0.5 + 0.5 * Math.sin(now * rate[i] + phase[i]);
        v *= 0.35 + 0.65 * tw * tw;
        ctx.globalAlpha = Math.min(1, v * MAX_ALPHA * 1.25);
        const radius = DOT_MIN + (DOT_MAX - DOT_MIN) * v;
        ctx.beginPath();
        ctx.arc(originX + (i % cols) * SPACING, originY + Math.floor(i / cols) * SPACING, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return alive;
    }

    function frame() {
      if (draw(performance.now())) requestAnimationFrame(frame);
      else running = false;
    }

    host.addEventListener("pointermove", (event) => {
      if (!active()) return;
      const rect = host.getBoundingClientRect();
      const p = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const now = performance.now();
      // Fill in between samples so fast movements leave a continuous trail
      if (prev) {
        const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
        const steps = Math.ceil(dist / (REACH / 2));
        for (let s = 1; s < steps; s++) {
          light(prev.x + ((p.x - prev.x) * s) / steps, prev.y + ((p.y - prev.y) * s) / steps, now);
        }
        sinceRipple += dist;
      } else {
        sinceRipple = RIPPLE_EVERY; // entering the header: ripple straight away
      }
      light(p.x, p.y, now);
      if (sinceRipple >= RIPPLE_EVERY) {
        sinceRipple = 0;
        ripples.push({ x: p.x, y: p.y, t: now });
        if (ripples.length > 14) ripples.shift();
      }
      prev = p;
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    });
    host.addEventListener("pointerleave", () => (prev = null));
  }
  mountDots(hero, $(".l-hero__dots"), () => !["dots", "half", "dash"].includes(hero.dataset.hero)); // full-bleed photo headers only
  mountDots($(".l-commodity"), $(".l-commodity__dots"));

  // ---------- Titles switch (Resources menu; also ?titles=serif) ----------
  const titleButtons = $$("[data-titles-set]");
  function setTitles(name, remember) {
    document.body.classList.toggle("is-serif", name === "serif");
    titleButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.titlesSet === name)));
    if (remember) try { localStorage.setItem("landing-v2:titles", name); } catch (e) {}
  }
  titleButtons.forEach((b) => b.addEventListener("click", () => setTitles(b.dataset.titlesSet, true)));
  let startTitles = new URLSearchParams(location.search).get("titles");
  if (!startTitles) try { startTitles = localStorage.getItem("landing-v2:titles"); } catch (e) {}
  setTitles(startTitles === "serif" ? "serif" : "sans", false); // default: Sans

  // ---------- Platform section switch (Resources menu; also ?platform=stack) ----------
  // Stack: the pinned card stack. Row: four cards side by side with the same live line art.
  const platformStack = $("#platform");
  const platformRow = $("#platform-row");
  const platformButtons = $$("[data-platform-set]");
  let platformRowLoaded = false;
  function setPlatform(name, remember) {
    if (!platformStack || !platformRow) return;
    platformStack.hidden = name === "row";
    platformRow.hidden = name !== "row";
    platformButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.platformSet === name)));
    if (remember) try { localStorage.setItem("landing-v4:platform", name); } catch (e) {}
    if (name === "row" && !platformRowLoaded) {
      platformRowLoaded = true;
      whenNear(platformRow, () => load("platform-row.js").then((m) => m.mountRow(platformRow)).catch((e) => console.warn("[platform row]", e)), "600px 0px");
    }
    window.dispatchEvent(new Event("resize")); // the stack and the pinned products row re-measure
  }
  platformButtons.forEach((b) => b.addEventListener("click", () => setPlatform(b.dataset.platformSet, true)));
  let startPlatform = new URLSearchParams(location.search).get("platform");
  if (!startPlatform) try { startPlatform = localStorage.getItem("landing-v4:platform"); } catch (e) {}

  // ---------- Partners accordion ----------
  // Click a slot to open it and the open one closes. Each slot has a progress p (0 closed, 1 open)
  // that runs through the page's ease; from p come the slot's width, the card's unturned size and
  // its turn (a quarter anticlockwise when closed). The rule: a turning card never leaves its slot.
  // Each frame the card is scaled to the largest size whose turned bounding box still fits the slot
  // at that instant, so nothing ever overlaps a neighbour, whatever the row width. The blue and the
  // quote fade in CSS off the is-open class; on phones (stacked bars) CSS does the whole move.
  const acc = $(".l-acc");
  if (acc) {
    const items = $$(".l-acc__item", acc);
    const cards = items.map((it) => $(".l-acc__card", it));
    const hits = items.map((it) => $(".l-acc__hit", it));
    const stacked = window.matchMedia("(max-width: 720px)");
    const ease = cubicBezier(0.22, 1, 0.36, 1); // --l-ease
    const dims = { off: 132, gap: 12, h: 520, on: 600, dur: 650 };
    const state = items.map((it) => ({ p: it.classList.contains("is-open") ? 1 : 0, from: 0, to: 0, t0: 0 }));
    const measure = () => {
      const cs = getComputedStyle(acc);
      const v = (name, fallback) => parseFloat(cs.getPropertyValue(name)) || fallback;
      dims.off = v("--off", 132);
      dims.gap = v("--gap", 12);
      dims.h = v("--h", 520);
      dims.dur = v("--a-dur", 0.65) * 1000;
      dims.on = acc.clientWidth - (items.length - 1) * (dims.off + dims.gap);
      acc.style.setProperty("--on", `${dims.on}px`); // the quote's measure reads it
    };
    const render = (i) => {
      const it = items[i], card = cards[i], p = state[i].p;
      if (stacked.matches) { // bars: leave it to the CSS
        it.style.width = "";
        card.style.width = card.style.height = card.style.transform = "";
        return;
      }
      const { off, h, on } = dims;
      const sw = off + (on - off) * p; // the slot now
      const w = h + (on - h) * p; // the card before its turn
      const ch = off + (h - off) * p;
      const a = (-Math.PI / 2) * (1 - p);
      const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
      const fit = Math.min(1, sw / (w * c + ch * s), h / (w * s + ch * c)); // turned box inside the slot
      it.style.width = `${sw.toFixed(2)}px`;
      card.style.width = `${w.toFixed(2)}px`;
      card.style.height = `${ch.toFixed(2)}px`;
      card.style.transform = `translate(-50%, -50%) rotate(${((a * 180) / Math.PI).toFixed(3)}deg) scale(${fit.toFixed(4)})`;
    };
    const renderAll = () => items.forEach((_, i) => render(i));
    measure();
    renderAll();
    window.addEventListener("resize", () => { measure(); renderAll(); });
    let raf = 0;
    const tick = (now) => {
      let busy = false;
      state.forEach((st, i) => {
        if (!st.t0) return;
        const t = Math.min(1, (now - st.t0) / dims.dur);
        st.p = st.from + (st.to - st.from) * ease(t);
        if (t < 1) busy = true; else st.t0 = 0;
        render(i);
      });
      raf = busy ? requestAnimationFrame(tick) : 0;
    };
    const open = (item) => {
      const now = performance.now();
      items.forEach((it, i) => {
        const on = it === item;
        it.classList.toggle("is-open", on);
        hits[i].setAttribute("aria-expanded", String(on));
        const st = state[i], to = on ? 1 : 0;
        if (st.p === to && !st.t0) return;
        if (reduced || stacked.matches) { st.p = to; st.t0 = 0; render(i); return; }
        st.from = st.p; // picks up mid-move
        st.to = to;
        st.t0 = now;
      });
      if (!raf) raf = requestAnimationFrame(tick);
    };
    hits.forEach((hit, i) => hit.addEventListener("click", () => open(items[i])));
    acc.addEventListener("keydown", (e) => {
      const i = hits.indexOf(document.activeElement);
      if (i < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      const next = (i + step + items.length) % items.length;
      open(items[next]);
      hits[next].focus();
      e.preventDefault();
    });
  }

  // ---------- Partner stories: flip carousel ----------
  // Paper-thin cards standing in a row under a near-orthographic camera. Stacked cards are turned
  // ANGLE about their upright axis (right edge away) and tipped TIP, so they read as overlapping
  // parallelograms receding to the right, each lying over the one before. The card in focus turns
  // back flat and square to you; the turn is a real 3D rotation, eased with the position. The
  // stories repeat, so it loops endlessly. pos is a float card index eased towards target.
  const flip = $(".l-flip");
  if (flip) {
    const fcards = $$(".l-fcard", flip);
    const N = fcards.length;
    const ANGLE = 74;     // how far a stacked card is turned about its upright axis (deg; was 64)
    const TIP = 0;        // and tipped, so its far edge rides higher (deg); 0 = head-on, eye level with the cards (was 23)
    const LEFT = 4;       // cards kept to the left of the focus card (they sit off screen); the rest run right
    let pos = 0, target = 0, step = 80, inner = 360, width = 380;
    let raf = 0, lastT = 0, dragging = false, moved = false, startX = 0, startPos = 0, downCard = null;
    let vel = 0, lastX = 0, lastMoveT = 0, dragTo = 0;

    const smooth = (t) => t * t * (3 - 2 * t);
    // Position round the loop, offset so most cards sit to the right: from -LEFT to N - LEFT
    const wrap = (d) => ((((d + LEFT) % N) + N) % N) - LEFT;
    const stage = $(".l-flip__stage", flip);
    const flipTitle = $("#stories-flip-title");
    function measure() {
      width = fcards[0].offsetWidth || 380; // from the CSS --w
      // The card in focus starts on the first column, in line with the section title
      if (flipTitle.offsetParent) stage.style.left = `${flipTitle.getBoundingClientRect().left - flip.getBoundingClientRect().left + width / 2}px`;
      step = width * (innerWidth < 720 ? 0.13 : 0.215); // spacing between stacked cards
      // centre of the first stacked card: past the focused card's edge plus half a turned card
      inner = width / 2 + (innerWidth < 720 ? 24 : 80) + (width * Math.cos(ANGLE * Math.PI / 180)) / 2;
    }
    function render() {
      fcards.forEach((card, i) => {
        const d = wrap(i - pos);
        const ad = Math.abs(d);
        const t = smooth(Math.min(ad, 1)); // 0 in focus → 1 stacked
        const x = Math.sign(d) * (t * inner + Math.max(ad - 1, 0) * step);
        card.style.transform = `translateX(${x.toFixed(1)}px) rotateX(${(-TIP * t).toFixed(2)}deg) rotateY(${(t * ANGLE).toFixed(2)}deg)`;
        card.style.setProperty("--turn", t.toFixed(3));
        // Cards wrap round at the far left (off screen); fade them there so the jump never shows
        const fade = Math.max(0, Math.min(1, LEFT - 0.5 + d));
        card.style.opacity = fade.toFixed(3);
        card.style.visibility = fade > 0 ? "visible" : "hidden";
        card.classList.toggle("is-front", ad < 0.5);
      });
    }
    function tick(now) {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      const goal = dragging ? dragTo : target;
      pos += (goal - pos) * (reduced ? 1 : 1 - Math.exp(-dt * (dragging ? 18 : 6.5)));
      render();
      if (dragging || Math.abs(goal - pos) > 0.0005) raf = requestAnimationFrame(tick);
      else { pos = goal; render(); raf = 0; }
    }
    function kick() {
      if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    }
    const go = (i) => { target = Math.round(i); kick(); };

    measure();
    render();
    window.addEventListener("resize", () => { measure(); render(); });


    // Drag: the cards follow the pointer (lightly smoothed); on release they settle on the nearest
    // card, carried further by the flick speed
    const PX_PER_CARD = () => step * 2.6;
    flip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      startX = lastX = e.clientX; startPos = dragTo = pos; vel = 0; lastMoveT = performance.now();
      downCard = e.target.closest(".l-fcard");
      flip.setPointerCapture(e.pointerId);
      kick();
    });
    flip.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; flip.classList.add("is-dragging"); }
      if (!moved) return;
      const now = performance.now();
      vel = vel * 0.6 + 0.4 * ((e.clientX - lastX) / Math.max(1, now - lastMoveT)); // px per ms
      lastX = e.clientX; lastMoveT = now;
      dragTo = startPos - dx / PX_PER_CARD();
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      flip.classList.remove("is-dragging");
      if (moved) go(dragTo - vel * 220 / PX_PER_CARD());
      else if (downCard && !downCard.classList.contains("is-front")) go(pos + wrap(fcards.indexOf(downCard) - pos));
      else go(target);
    };
    flip.addEventListener("pointerup", endDrag);
    flip.addEventListener("pointercancel", endDrag);
    flip.addEventListener("click", (e) => { if (moved) e.preventDefault(); }, true);

    // Trackpad sideways scroll moves through freely, then settles on a card
    let wheelTimer = 0;
    flip.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      target += e.deltaX / 140;
      kick();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => go(target), 140);
    }, { passive: false });

    flip.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { go(target + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(target - 1); e.preventDefault(); }
    });
    $("[data-flip-prev]").addEventListener("click", () => go(target - 1));
    $("[data-flip-next]").addEventListener("click", () => go(target + 1));
  }

  // ---------- Partner stories switch (Resources menu; also ?stories=photos) ----------
  const storiesPhotos = $("#stories");
  const storiesFlip = $("#stories-flip");
  const storiesButtons = $$("[data-stories-set]");
  function setStories(name, remember) {
    if (!storiesPhotos || !storiesFlip) return;
    storiesPhotos.hidden = name !== "photos";
    storiesFlip.hidden = name === "photos";
    storiesButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.storiesSet === name)));
    if (remember) try { localStorage.setItem("landing-v3:stories", name); } catch (e) {}
    window.dispatchEvent(new Event("resize"));
  }
  storiesButtons.forEach((b) => b.addEventListener("click", () => setStories(b.dataset.storiesSet, true)));
  let startStories = new URLSearchParams(location.search).get("stories");
  if (!startStories) try { startStories = localStorage.getItem("landing-v3:stories"); } catch (e) {}

  // ---------- Products layout switch (Resources menu; also ?products=row) ----------
  // Row: the section pins and vertical scrolling carries the cards sideways. On screens too
  // short or narrow to hold a pinned card it stays a plain sideways swipe.
  const products = $(".l-products");
  const productButtons = $$("[data-products-set]");
  const productRow = $(".l-products__grid");
  let productTravel = 0;
  let productLead = 0;

  function moveProducts() {
    if (!products.classList.contains("is-pinned")) return;
    // Hold for --lead px of scroll, then move 1:1 with it
    const scrolled = -products.getBoundingClientRect().top - productLead;
    const p = Math.min(1, Math.max(0, scrolled / (productTravel || 1)));
    productRow.style.setProperty("--x", `${(-p * productTravel).toFixed(1)}px`);
  }

  function layoutProducts() {
    if (!products) return;
    const pin = products.dataset.layout === "row" && innerWidth > 720 && innerHeight >= 740;
    products.classList.toggle("is-pinned", pin);
    productRow.style.setProperty("--x", "0px");
    if (pin) {
      // How far the row overflows the screen: last card's right edge plus the same inset as the left
      const row = productRow.getBoundingClientRect();
      const rects = $$(".l-product", productRow).map((c) => c.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left)) - row.left;
      const right = Math.max(...rects.map((r) => r.right)) - row.left;
      productTravel = Math.max(0, right + left - row.width);
      products.style.setProperty("--travel", `${productTravel}px`);
      productLead = innerHeight * (parseFloat(getComputedStyle(products).getPropertyValue("--lead")) || 0) / 100;
      moveProducts();
    } else {
      productRow.scrollLeft = 0;
    }
  }

  function setProducts(name, remember) {
    if (!products) return;
    products.dataset.layout = name;
    productButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.productsSet === name)));
    layoutProducts();
    // The section's height just changed: let the card stack below re-measure its lock points
    window.dispatchEvent(new Event("resize"));
    if (remember) try { localStorage.setItem("landing-v2:products", name); } catch (e) {}
  }
  productButtons.forEach((b) => b.addEventListener("click", () => setProducts(b.dataset.productsSet, true)));
  if (products) {
    let queued = false;
    window.addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; moveProducts(); });
    }, { passive: true });
    window.addEventListener("resize", layoutProducts);
  }
  let startProducts = new URLSearchParams(location.search).get("products");
  if (!startProducts) try { startProducts = localStorage.getItem("landing-v2:products"); } catch (e) {}
  setProducts("row", false); // Products switch retired from the menu: always the row
  setPlatform(startPlatform === "stack" ? "stack" : "row", false); // default: Row (four cards)
  setStories(startStories === "photos" ? "photos" : "flip", false); // default: Flip

  // ---------- Marquee: second copy of the row for a seamless loop ----------
  const row = $(".l-marquee__row");
  if (row) {
    const copy = row.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    row.after(copy);
  }

  // ---------- Product widgets (sample-UI kit: .w-*) ----------

  // Dark fill on the slider track up to the thumb
  const fill = (range) => {
    const min = +range.min, max = +range.max;
    range.style.setProperty("--fill", `${((+range.value - min) / (max - min)) * 100}%`);
  };
  $$(".w-range").forEach((range) => { fill(range); range.addEventListener("input", () => fill(range)); });

  // Tab groups: one active tab, optional callback
  function tabs(root, onChange) {
    const all = $$(".w-tab", root);
    all.forEach((tab, i) => tab.addEventListener("click", () => {
      all.forEach((t) => t.classList.toggle("is-on", t === tab));
      onChange?.(tab, i);
    }));
  }

  // CTA: a short confirmation beat
  function confirm(button, doneLabel) {
    button.addEventListener("click", () => {
      if (button.classList.contains("is-done")) return;
      const label = button.textContent;
      button.textContent = "Confirming…";
      setTimeout(() => {
        button.textContent = doneLabel;
        button.classList.add("is-done");
        setTimeout(() => { button.textContent = label; button.classList.remove("is-done"); }, 1600);
      }, 700);
    });
  }

  const setRange = (range, value) => {
    range.value = value;
    fill(range);
    range.dispatchEvent(new Event("input"));
  };

  // Dot-matrix chart. draw(heights, lit): column i shows heights[i] dots; the first `lit`
  // columns are black, the rest grey. Dots animate in from the bottom of each column.
  const DOT_COLS = 58;
  const DOT_ROWS = 14;
  function dotChart(el) {
    const cols = [];
    for (let c = 0; c < DOT_COLS; c++) {
      const col = document.createElement("span");
      col.className = "w-dots__col";
      const dots = [];
      for (let r = 0; r < DOT_ROWS; r++) {
        const dot = document.createElement("i");
        dot.style.transitionDelay = `${r * 10}ms`;
        col.appendChild(dot);
        dots.push(dot);
      }
      el.appendChild(col);
      cols.push(dots);
    }
    return (heights, lit) => cols.forEach((dots, c) => dots.forEach((dot, r) => {
      const shown = r < heights[c];
      dot.classList.toggle("is-on", shown && c < lit);
      dot.classList.toggle("is-dim", shown && c >= lit);
    }));
  }

  // ---------- Swap ----------
  const swap = $('[data-widget="swap"]');
  if (swap) {
    const PRICE = { USDC: 1, SOL: 142.3 };
    const BALANCE = { USDC: 9144.13, SOL: 42.5 };
    let sell = "USDC";
    let buy = "SOL";
    const input = $("[data-in]", swap);
    const go = $("[data-go]", swap);
    const render = () => {
      const amount = Math.max(0, parseFloat(input.value) || 0);
      const received = (amount * PRICE[sell]) / PRICE[buy];
      $("[data-out]", swap).textContent = amount ? fmt(received, received < 10 ? 4 : 2) : "0";
      $("[data-in-usd]", swap).textContent = usd(amount * PRICE[sell]);
      $("[data-out-usd]", swap).textContent = usd(received * PRICE[buy]);
      $("[data-rate]", swap).textContent = `1 ${sell} ≈ ${fmt(PRICE[sell] / PRICE[buy], sell === "USDC" ? 6 : 2)} ${buy}`;
      $('[data-bal="sell"]', swap).textContent = `${fmt(BALANCE[sell], 2)} ${sell}`;
      $('[data-bal="buy"]', swap).textContent = `${fmt(BALANCE[buy], 2)} ${buy}`;
      $$('[data-token="sell"]', swap).forEach((el) => (el.textContent = sell));
      $$('[data-token="buy"]', swap).forEach((el) => (el.textContent = buy));
      $('[data-token-coin="sell"]', swap).dataset.coin = sell;
      $('[data-token-coin="buy"]', swap).dataset.coin = buy;
    };
    input.addEventListener("input", render);
    $("[data-half]", swap).addEventListener("click", () => { input.value = +(BALANCE[sell] / 2).toFixed(2); render(); });
    $("[data-max]", swap).addEventListener("click", () => { input.value = BALANCE[sell]; render(); });
    $("[data-flip]", swap).addEventListener("click", () => { [sell, buy] = [buy, sell]; render(); });
    const labels = ["Swap", "Place limit order", "Start recurring buy"];
    tabs(swap, (tab, i) => { go.textContent = labels[i]; });
    confirm(go, "Swapped ✓");
    render();
  }

  // ---------- Earn ----------
  const earn = $('[data-widget="earn"]');
  if (earn) {
    let apyRate = 8.2;
    let coin = "USDC";
    const PRICE = { USDC: 1, SOL: 142.3, PYUSD: 1 };
    const slider = $("[data-deposit]", earn);
    const drawDots = dotChart($("[data-dots]", earn));
    const BEST_APY = 9.1; // tallest vault fills the chart
    const render = () => {
      const deposit = +slider.value; // in the vault's token
      const value = deposit * PRICE[coin];
      const year = value * (apyRate / 100);
      $("[data-deposit-out]", earn).textContent = fmt(deposit);
      $("[data-deposit-usd]", earn).textContent = usd(value);
      $("[data-year]", earn).textContent = usd(year);
      $("[data-month]", earn).textContent = usd(year / 12);
      $("[data-apy-out]", earn).textContent = `${apyRate}% APY`;
      $$('[data-token="vault"]', earn).forEach((el) => (el.textContent = coin));
      $('[data-token-coin="vault"]', earn).dataset.coin = coin;
      // Columns span the slider's range: a compounding curve whose height scales with the
      // vault's APY, lit up to the deposit you've dialled in
      const heights = [];
      for (let c = 0; c < DOT_COLS; c++) {
        const growth = Math.pow((c + 1) / DOT_COLS, 1.6);
        heights.push(Math.max(1, Math.round(1 + (DOT_ROWS - 1) * growth * (apyRate / BEST_APY))));
      }
      const share = (deposit - +slider.min) / (+slider.max - +slider.min);
      drawDots(heights, Math.max(1, Math.round(share * DOT_COLS)));
    };
    slider.addEventListener("input", render);
    $("[data-half]", earn).addEventListener("click", () => setRange(slider, 125000));
    $("[data-max]", earn).addEventListener("click", () => setRange(slider, 250000));
    tabs(earn, (tab) => { apyRate = +tab.dataset.apy; coin = tab.dataset.coin; render(); });
    confirm($("[data-go]", earn), "Deposited ✓");
    render();
  }

  // ---------- Borrow ----------
  const borrow = $('[data-widget="borrow"]');
  if (borrow) {
    const SOL = 142.3;
    const MAX_LTV = 0.75;
    const LIQ_LTV = 0.8;
    const coll = $("[data-coll]", borrow);
    const size = $("[data-borrow]", borrow);
    const go = $("[data-go]", borrow);
    const render = () => {
      const collateral = +coll.value;
      const value = collateral * SOL;
      const debt = value * MAX_LTV * (+size.value / 100);
      const ltv = debt / value;
      $("[data-coll-out]", borrow).textContent = fmt(collateral);
      $("[data-coll-usd]", borrow).textContent = usd(value);
      $("[data-borrow-out]", borrow).textContent = fmt(Math.round(debt));
      $("[data-borrow-pct]", borrow).textContent = `${size.value}% of max`;
      $("[data-ltv]", borrow).textContent = `${Math.round(ltv * 100)}%`;
      const bar = $("[data-health]", borrow);
      bar.style.width = `${ltv * 100}%`;
      bar.style.backgroundColor = ltv < 0.5 ? "#1f6f45" : ltv < 0.65 ? "#c08a1e" : "#c4321f";
      $("[data-liq]", borrow).textContent = debt ? `$${fmt(debt / (collateral * LIQ_LTV), 2)}` : "—";
    };
    coll.addEventListener("input", render);
    size.addEventListener("input", render);
    $("[data-half]", borrow).addEventListener("click", () => setRange(coll, 500));
    $("[data-max]", borrow).addEventListener("click", () => setRange(coll, 1000));
    tabs(borrow, (tab, i) => { go.textContent = i ? "Repay" : "Borrow"; });
    confirm(go, "Done ✓");
    render();
  }

  // ---------- Multiply ----------
  const multiply = $('[data-widget="multiply"]');
  if (multiply) {
    const SUPPLY = 7.1; // staking yield on the looped asset
    const COST = 5.2;   // borrow rate
    const LIQ = 0.9;    // liquidation LTV for correlated pairs
    const lev = $("[data-lev]", multiply);
    const drawDots = dotChart($("[data-dots]", multiply));
    const net = (l) => SUPPLY * l - COST * (l - 1);
    const MIN = +lev.min, MAX = +lev.max;
    // One column per step of leverage; height follows net APY from 1.1× to 5×
    const heights = [];
    for (let c = 0; c < DOT_COLS; c++) {
      const l = MIN + ((MAX - MIN) * c) / (DOT_COLS - 1);
      heights.push(Math.max(1, Math.round(1 + (DOT_ROWS - 1) * ((net(l) - net(MIN)) / (net(MAX) - net(MIN))))));
    }
    const tabEls = $$(".w-tab", multiply);
    const render = () => {
      const l = +lev.value;
      const n = net(l);
      $("[data-lev-out]", multiply).textContent = `${l.toFixed(1)}×`;
      $("[data-net]", multiply).textContent = `${n.toFixed(1)}%`;
      $("[data-net-badge]", multiply).textContent = `${n.toFixed(1)}% APY`;
      const drop = l > 1 ? 1 - (l - 1) / (l * LIQ) : 1;
      $("[data-drop]", multiply).textContent = `−${Math.round(drop * 100)}%`;
      drawDots(heights, Math.max(1, Math.round(1 + ((l - MIN) / (MAX - MIN)) * (DOT_COLS - 1))));
      tabEls.forEach((t) => t.classList.toggle("is-on", +t.dataset.preset === l));
    };
    lev.addEventListener("input", render);
    tabs(multiply, (tab) => setRange(lev, tab.dataset.preset));
    confirm($("[data-go]", multiply), "Position open ✓");
    render();
  }

  // ---------- Slider drift ----------
  // Until someone touches a widget, its sliders slowly sweep back and forth on their own so
  // the demos play by themselves. Each slider starts from its set value and moves at its own
  // phase; the first pointer or key on a widget hands that widget over for good.
  if (products && !reduced) {
    const PERIOD = 22000; // ms for a full there-and-back
    const drifters = [];
    $$(".w", products).forEach((widget, w) => {
      const ranges = $$(".w-range", widget);
      if (!ranges.length) return;
      const stop = () => { drifters.forEach((d) => { if (d.widget === widget) d.on = false; }); };
      widget.addEventListener("pointerdown", stop, { capture: true });
      widget.addEventListener("keydown", stop, { capture: true });
      ranges.forEach((range, i) => {
        const min = +range.min, max = +range.max, step = +range.step || 1;
        // Phase so the sweep starts at the slider's own value, heading up
        const theta = Math.acos(1 - 2 * ((+range.value - min) / (max - min)));
        drifters.push({ widget, range, min, max, step, theta, speed: (2 * Math.PI) / (PERIOD * (1 + 0.12 * ((w + i) % 3))), on: true, last: +range.value });
      });
    });
    let raf = 0, lastT = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = lastT ? Math.min(now - lastT, 100) : 0;
      lastT = now;
      drifters.forEach((d) => {
        if (!d.on) return;
        d.theta += d.speed * dt;
        const raw = d.min + (d.max - d.min) * (0.5 - 0.5 * Math.cos(d.theta));
        const value = +(d.min + Math.round((raw - d.min) / d.step) * d.step).toFixed(4);
        if (value === d.last) return;
        d.last = value;
        setRange(d.range, value);
      });
      if (!drifters.some((d) => d.on)) { cancelAnimationFrame(raf); raf = 0; }
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !raf && drifters.some((d) => d.on)) { lastT = 0; raf = requestAnimationFrame(tick); }
        else if (!entry.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
      }).observe(products);
    } else {
      raf = requestAnimationFrame(tick);
    }
  }

  // ---------- Count-ups ----------
  $$("[data-count]").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = +(el.dataset.decimals || 0);
    if (reduced) return;
    el.textContent = fmt(0, decimals);
    whenNear(el, () => {
      const start = performance.now();
      const dur = 1600;
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt(target * eased, decimals);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, "-15% 0px");
  });

  // ---------- Commodity: background video plays only while the section is on screen ----------
  const commodityVideo = $("video.l-commodity__bg");
  if (commodityVideo && !reduced && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) commodityVideo.play().catch(() => {});
      else commodityVideo.pause();
    }, { rootMargin: "200px 0px" }).observe(commodityVideo);
  }

  // ---------- Video modal ----------
  const modal = $("[data-modal]");
  $("[data-modal-open]")?.addEventListener("click", () => modal.showModal());
  $("[data-modal-close]")?.addEventListener("click", () => modal.close());
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

  // ---------- Stories carousel: arrows + drag ----------
  const list = $("[data-stories]");
  if (list) {
    const prev = $("[data-story-prev]");
    const next = $("[data-story-next]");
    const stepSize = () => list.querySelector(".l-story").offsetWidth + 16;
    const sync = () => {
      prev.disabled = list.scrollLeft <= 2;
      next.disabled = list.scrollLeft >= list.scrollWidth - list.clientWidth - 2;
    };
    prev.addEventListener("click", () => list.scrollBy({ left: -stepSize(), behavior: reduced ? "auto" : "smooth" }));
    next.addEventListener("click", () => list.scrollBy({ left: stepSize(), behavior: reduced ? "auto" : "smooth" }));
    list.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();

    let startX = 0;
    let startScroll = 0;
    let moved = false;
    list.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      startX = e.clientX;
      startScroll = list.scrollLeft;
      moved = false;
      list.setPointerCapture(e.pointerId);
      list.classList.add("is-dragging");
    });
    list.addEventListener("pointermove", (e) => {
      if (!list.classList.contains("is-dragging")) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      list.scrollLeft = startScroll - dx;
    });
    const end = () => list.classList.remove("is-dragging");
    list.addEventListener("pointerup", end);
    list.addEventListener("pointercancel", end);
    list.addEventListener("click", (e) => { if (moved) e.preventDefault(); }, true);
    list.addEventListener("dragstart", (e) => e.preventDefault());
  }

  // ---------- Build: "Kamino is for" cycles; hovering an item holds it ----------
  $$("[data-cycle]").forEach((cycle) => {
    const items = $$("li", cycle);
    let index = 0;
    let paused = false;
    const show = (i) => { index = i; items.forEach((li, j) => li.classList.toggle("is-on", j === i)); };
    items.forEach((li, i) => {
      li.addEventListener("mouseenter", () => { paused = true; show(i); });
      li.addEventListener("mouseleave", () => { paused = false; });
    });
    if (!reduced) setInterval(() => { if (!paused) show((index + 1) % items.length); }, 1800);
  });

  // ---------- What's new: the index row clicked becomes the feature ----------
  // Each article's content rides on data attributes. Clicking a row swaps it with the feature: the
  // feature takes the row's article (new image in at 110% settling to 100% as it fades up, the copy
  // rising into place) and the row takes the article that was featured.
  const feed = $(".l-feed");
  if (feed) {
    const feature = $(".l-feed__feature", feed);
    const media = $(".l-feed__media", feed);
    const KEYS = ["title", "text", "tags", "date", "image"];
    const read = (el) => Object.fromEntries(KEYS.map((k) => [k, el.dataset[k]]));
    const write = (el, a) => KEYS.forEach((k) => (el.dataset[k] = a[k]));
    const metaHtml = (a) => a.tags.split("|").map((t) => `<span>${t}</span>`).join("") + `<time>${a.date}</time>`;
    // run the entrance animation once, then hand the element back (so hovers transition normally)
    const replay = (el) => {
      el.classList.remove("is-in");
      void el.offsetWidth;
      el.classList.add("is-in");
      clearTimeout(el._inTimer);
      el._inTimer = setTimeout(() => el.classList.remove("is-in"), 800);
    };
    const showFeature = (a) => {
      write(feature, a);
      $("h3", feature).textContent = a.title;
      $(".l-feed__copy p", feature).textContent = a.text;
      replay(feature);
      // the new image on top of the old, which goes once the new one has settled
      const img = new Image();
      img.alt = "";
      img.src = a.image;
      img.className = "is-in";
      media.appendChild(img);
      const old = $$("img", media).filter((x) => x !== img);
      img.addEventListener("animationend", () => old.forEach((x) => x.remove()), { once: true });
      if (reduced) old.forEach((x) => x.remove());
    };
    const showRow = (row, a) => {
      write(row, a);
      $(".l-feed__row-title", row).textContent = a.title;
      $(".l-feed__meta", row).innerHTML = metaHtml(a);
      replay(row);
    };
    $$(".l-feed__row", feed).forEach((row) => row.addEventListener("click", () => {
      const next = read(row), prev = read(feature);
      showFeature(next);
      showRow(row, prev);
    }));
  }

  // ---------- Build folios ----------
  // "file" has every tab on the left, and cycles instead: clicking the front sheet drops it off the
  // page under gravity with a slight tilt, then it fades back in at the back of the stack while
  // the others step forward. Clicking a sheet further back drops each one in front of it in turn.
  // Each [data-folio] stage holds four sheets stacked a step apart (the last slot is the front).
  // A sheet is an SVG silhouette drawn to the stage's width: a body with a tab rising from its top
  // edge on curved shoulders. The tab's place belongs to the slot, not the sheet: "steps" moves one
  // slot across per card (an even stagger), "file" alternates left, right, left, right down the
  // stack. Clicking a tab brings its sheet to the front; every sheet that changes slot slides to
  // its new height while its tab glides to the slot's place. Until someone picks one, the back
  // sheet comes forward every so often while the folio is on screen.
  // The outline: the tab spans tL..tR at the base (shoulders included), th tall, shoulders sL / sR
  // wide. A tab may run past either edge (its shoulder then falls outside); the rounded clip
  // (radius rc) trims it, so a tab sliding to an edge ends in a rounded corner with no jump.
  // straight: shoulders cut as plain slants with sharp joins instead of curves.
  function sheetPath(W, H, tL, tR, th, sL, sR, rc, straight) {
    const r0 = Math.max(0, Math.min(rc, tL)), r1 = Math.max(0, Math.min(rc, W - tR));
    const d = [tL >= 0 ? `M0 ${H} V${th + r0} Q0 ${th} ${r0} ${th} H${tL}` : `M${tL} ${H} V${th}`];
    d.push(straight
      ? `L${tL + sL} 0 H${tR - sR} L${tR} ${th}`
      : `C${tL + sL / 2} ${th} ${tL + sL / 2} 0 ${tL + sL} 0 H${tR - sR} C${tR - sR / 2} 0 ${tR - sR / 2} ${th} ${tR} ${th}`);
    d.push(tR <= W ? `H${W - r1} Q${W} ${th} ${W} ${th + r1} V${H} Z` : `V${H} Z`);
    return d.join(" ");
  }
  const folioEase = cubicBezier(0.22, 1, 0.36, 1); // --l-ease
  $$("[data-folio]").forEach((stage) => {
    const kind = stage.dataset.folio; // "steps" | "file"
    const sheets = $$(".l-folio__sheet", stage);
    const tabs = sheets.map((s) => $(".l-folio__tab", s));
    const n = sheets.length;
    const uid = stage.id || kind;
    $$(".l-folio__code", stage).forEach((code) => $$("i", code).forEach((line, k) => line.style.setProperty("--n", k)));
    sheets.forEach((s, i) => {
      $(".l-folio__shape", s).innerHTML =
        `<defs><clipPath id="${uid}-k${i}"><path class="l-folio__clip"/></clipPath>` +
        `<filter id="${uid}-g${i}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${i + 3}"/>` +
        `<feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.2  0 0 0 0 0.28  0 0 0 0.5 0"/></filter>` +
        `<clipPath id="${uid}-c${i}" clip-path="url(#${uid}-k${i})"><path/></clipPath></defs>` +
        `<g clip-path="url(#${uid}-k${i})"><path class="l-folio__fill"/></g>` +
        `<rect class="l-folio__grain" clip-path="url(#${uid}-c${i})" filter="url(#${uid}-g${i})"/>`;
    });
    let c = null, W = 0;
    let order = sheets.map((_, i) => i); // order[slot] = sheet; the last slot is the front
    const at = sheets.map(() => ({ x: 0, from: 0, to: 0 })); // each tab's left base, animated
    // Where the tab of a sheet in this slot sits (its left base)
    const slotX = (slot) => kind === "file" ? c.lead : slot * (W / n); // file: a short ledge before the lip so its curve runs out flat
    const sheetH = () => c.h;
    const draw = (i) => {
      const s = sheets[i], svg = $(".l-folio__shape", s);
      const tL = at[i].x, tR = tL + c.tw;
      const d = sheetPath(W, sheetH(i), tL, tR, c.th, c.sL, c.sR, c.rc);
      $$("path:not(.l-folio__clip)", svg).forEach((p) => p.setAttribute("d", d));
      // the label sits on the tab's flat top, clear of the shoulders
      const x0 = Math.max(0, tL + c.sL), x1 = Math.min(W, tR - c.sR);
      s.style.setProperty("--tab-x", `${x0.toFixed(1)}px`);
      s.style.setProperty("--tab-w", `${(x1 - x0).toFixed(1)}px`);
    };
    const layout = () => {
      W = stage.clientWidth;
      if (!W) return;
      const small = W < 560;
      c = kind === "file"
        ? { th: small ? 31 : 36, step: small ? 40 : 48, h: small ? 400 : 480, sL: small ? 14 : 24, sR: small ? 22 : 40, rc: 0, rb: 4, lead: small ? 10 : 18 }
        : { th: small ? 28 : 32, step: 24, h: small ? 440 : 480, sL: small ? 8 : 14, sR: small ? 14 : 28, rc: 6, rb: 6 };
      c.tw = kind === "file" ? W * (small ? 0.5 : 0.36) : W / n;
      stage.style.setProperty("--th", `${c.th}px`);
      stage.style.setProperty("--step", `${c.step}px`);
      stage.style.setProperty("--sheet-h", `${c.h}px`);
      stage.style.setProperty("--stage-h", `${(n - 1) * c.step + c.h}px`);
      sheets.forEach((s, i) => {
        const svg = $(".l-folio__shape", s);
        svg.setAttribute("viewBox", `0 0 ${W} ${sheetH(i)}`);
        $$("rect", svg).forEach((r) => { r.setAttribute("width", W); r.setAttribute("height", sheetH(i)); });
        s.style.setProperty("--sh", `${sheetH(i)}px`);
        // the outer trim: top corners rc, bottom corners rb
        const H = sheetH(i), rc = c.rc, rb = c.rb;
        $(".l-folio__clip", svg).setAttribute("d", `M0 ${rc} A${rc} ${rc} 0 0 1 ${rc} 0 H${W - rc} A${rc} ${rc} 0 0 1 ${W} ${rc} V${H - rb} A${rb} ${rb} 0 0 1 ${W - rb} ${H} H${rb} A${rb} ${rb} 0 0 1 0 ${H - rb} Z`);
        at[i].x = at[i].to = slotX(order.indexOf(i));
        draw(i);
      });
    };
    let raf = 0, t0 = 0;
    const DUR = 700;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / DUR), e = folioEase(t);
      sheets.forEach((_, i) => { at[i].x = at[i].from + (at[i].to - at[i].from) * e; draw(i); });
      raf = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    const place = (animate) => {
      order.forEach((i, slot) => {
        const s = sheets[i], front = slot === n - 1;
        s.style.setProperty("--slot", slot);
        s.style.zIndex = slot + 1;
        s.classList.toggle("is-front", front);
        s.classList.toggle("is-right", kind === "file" && slot % 2 === 1);
        tabs[i].setAttribute("aria-selected", String(front));
        tabs[i].tabIndex = front ? 0 : -1;
        at[i].from = at[i].x;
        at[i].to = slotX(slot);
      });
      if (!animate || reduced) { sheets.forEach((_, i) => { at[i].x = at[i].to; draw(i); }); return; }
      t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
    };
    if (kind === "file") {
      // One click is one planned move, so several sheets dropping never retarget each other: the
      // sheets in front of the one picked fall as a staggered cascade, everything behind glides
      // forward the whole way in a single motion, and each fallen sheet comes back in at the back,
      // straight into its final place. Clicks during a move are ignored.
      const FALL = 950, FADE = 260, BACK = 420, STAGGER = 110; // ms
      let moving = false;
      const mark = () => order.forEach((i, slot) => {
        const front = slot === n - 1;
        sheets[i].classList.toggle("is-front", front);
        tabs[i].setAttribute("aria-selected", String(front));
      });
      const settle = () => order.forEach((i, slot) => {
        const s = sheets[i];
        s.style.setProperty("--slot", slot);
        s.style.zIndex = slot + 2;
      });
      const cycle = (count) => {
        if (moving || count < 1) return;
        moving = true;
        const fallen = order.slice(n - count).reverse(); // front first
        order = order.slice(n - count).concat(order.slice(0, n - count)); // the fallen end up at the back
        mark();
        if (reduced) { settle(); moving = false; return; }
        // the rest: straight to their new slots, one smooth glide, above anything coming back in
        order.forEach((i, slot) => {
          if (fallen.includes(i)) return;
          sheets[i].style.setProperty("--slot", slot);
          sheets[i].style.zIndex = slot + 2;
        });
        const fall = innerHeight + stage.offsetHeight; // well down the page, over whatever is below
        let pending = fallen.length;
        const finish = () => {
          settle();
          // hand back to the stylesheet's slot transform without it gliding again
          fallen.forEach((i) => {
            const s = sheets[i];
            s.style.transition = "none";
            s.style.translate = s.style.transform = s.style.opacity = "";
            void s.offsetWidth;
            s.style.transition = "";
          });
          moving = false;
        };
        fallen.forEach((i, k) => {
          const s = sheets[i], from = (n - 1 - k) * c.step, to = order.indexOf(i);
          const tilt = (k % 2 ? 1 : -1) * (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 5); // 7–12°
          s.style.zIndex = n + 10 - k; // the front one stays in front as they fall
          s.classList.add("is-dropping");
          // the fall runs on the separate translate property with transform cleared, so the tilt turns the
          // card about its own centre and it only ever moves straight down
          s.style.transition = "none";
          s.style.transform = "none";
          s.style.translate = `0 ${from}px`;
          void s.offsetWidth;
          // gravity: starts slow and gathers speed; fully solid all the way, fading only at the very end, far down the page
          const delay = k * STAGGER;
          // the tilt has its own curve (the separate rotate property): it waits a beat, then builds as the sheet
          // gathers speed, so it is barely tipped near the stack and well tipped by the time it is far down
          s.style.transition = `translate ${FALL}ms cubic-bezier(0.55, 0, 0.85, 0.35) ${delay}ms, rotate ${FALL * 0.75}ms cubic-bezier(0.45, 0, 0.7, 0.6) ${delay + FALL * 0.25}ms, opacity ${FADE}ms linear ${delay + FALL - FADE}ms`;
          s.style.translate = `0 ${from + fall}px`;
          s.style.rotate = `${tilt.toFixed(2)}deg`;
          s.style.opacity = "0";
          // It comes back as soon as it has fallen out of view (or when the fall ends, whichever is first)
          let back = false;
          const comeBack = () => {
            if (back) return;
            back = true;
            // back in behind the stack: from a step above its final slot, settling into it
            s.classList.remove("is-dropping");
            s.style.transition = "none";
            s.style.rotate = "";
            s.style.zIndex = to + 2;
            s.style.setProperty("--slot", to);
            s.style.translate = `0 ${(to - 1) * c.step}px`;
            void s.offsetWidth;
            s.style.transition = `translate ${BACK}ms var(--l-ease), opacity ${BACK * 0.7}ms var(--l-ease)`;
            s.style.translate = `0 ${to * c.step}px`;
            s.style.opacity = "1";
            setTimeout(() => { if (--pending === 0) finish(); }, BACK);
          };
          const watch = () => {
            if (back) return;
            if (s.getBoundingClientRect().top > innerHeight) comeBack();
            else requestAnimationFrame(watch);
          };
          setTimeout(() => requestAnimationFrame(watch), delay + 120);
          setTimeout(comeBack, delay + FALL);
        });
      };
      // the front sheet drops itself; a sheet further back drops every sheet in front of it
      tabs.forEach((t, i) => t.addEventListener("click", () => cycle(Math.max(1, n - 1 - order.indexOf(i)))));
      stage.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
        cycle(1);
        e.preventDefault();
      });
      stage.classList.add("is-instant");
      layout();
      mark();
      settle();
      setTimeout(() => stage.classList.remove("is-instant"), 60);
      new ResizeObserver(layout).observe(stage);
      return;
    }
    const bring = (i) => { order = order.filter((k) => k !== i).concat(i); place(true); };
    let picked = false, rotate = 0;
    const pick = (i) => { picked = true; clearInterval(rotate); bring(i); };
    tabs.forEach((t, i) => t.addEventListener("click", () => pick(i)));
    stage.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      const i = (order[n - 1] + step + n) % n;
      pick(i);
      tabs[i].focus();
      e.preventDefault();
    });
    stage.classList.add("is-instant");
    layout();
    place(false);
    setTimeout(() => stage.classList.remove("is-instant"), 60);
    new ResizeObserver(layout).observe(stage);
    if (!reduced && "IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        clearInterval(rotate);
        rotate = 0;
        if (entry.isIntersecting && !picked) rotate = setInterval(() => bring(order[0]), 7000);
      }).observe(stage);
    }
  });

  // ---------- Placeholder links don't jump to the top ----------
  $$('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

  // ---------- Gentle reveal for section content ----------
  if (!reduced && "IntersectionObserver" in window) {
    const targets = $$(".l-products .l-headline, .l-product, .l-partners .l-headline, .l-acc, .l-record .l-split, .l-audits, .l-stories .l-split, .l-folio__head, .l-feed__title, .l-feed__grid");
    targets.forEach((el, i) => {
      el.classList.add("l-reveal");
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
    });
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("is-in");
      io.unobserve(el);
      // Drop the stagger once revealed, so later hovers on these elements aren't delayed by it
      setTimeout(() => (el.style.transitionDelay = ""), 1100);
    }), { rootMargin: "0px 0px -10% 0px" });
    targets.forEach((el) => io.observe(el));
  }
})();
