// Pocket (pocket.html): a Swiss-grid exploration of the Kamino home. Self-contained; shares nothing
// with js/landing.js.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";

  // ---------- The wordmark fills its panel's width exactly ----------
  const word = $("[data-fit]");
  if (word) {
    const fit = () => {
      const box = word.parentElement;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      word.style.fontSize = "100px";
      const w = word.getBoundingClientRect().width;
      if (w) word.style.fontSize = `${(100 * avail) / w}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    new ResizeObserver(fit).observe(word.parentElement);
  }

  // ---------- Isometric line drawings ----------
  // World points (x, y, z) project onto the page at 30°: x runs down-right, y down-left, z straight up.
  const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
  function draw(svg, kind) {
    const [vbW, vbH] = svg.getAttribute("viewBox").split(" ").slice(2).map(Number);
    const big = kind === "hero";
    const cx = vbW / 2, cy = big ? vbH * 0.6 : vbH * 0.66;
    const P = (x, y, z = 0) => [cx + (x - y) * C30, cy + (x + y) * S30 - z];
    const el = (tag, attrs, parent = svg) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    };
    const pts = (list) => list.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
    // A square plane of half-size a at height z, centred on (ox, oy)
    const plane = (a, z, cls = "ln", ox = 0, oy = 0) =>
      el("polygon", { class: cls, points: pts([P(ox - a, oy - a, z), P(ox + a, oy - a, z), P(ox + a, oy + a, z), P(ox - a, oy + a, z)]) });
    // Small black wedges filling each corner of a plane: the reference's notches
    const wedges = (a, z, size, ox = 0, oy = 0) => {
      const c = [P(ox - a, oy - a, z), P(ox + a, oy - a, z), P(ox + a, oy + a, z), P(ox - a, oy + a, z)];
      c.forEach((p, i) => {
        const n1 = c[(i + 1) % 4], n0 = c[(i + 3) % 4];
        const toward = (q) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy); return [p[0] + (dx / L) * size, p[1] + (dy / L) * size]; };
        el("polygon", { class: "fill", points: pts([p, toward(n1), toward(n0)]) });
      });
    };
    // A circle of radius r on the plane at height z (an ellipse once projected)
    const ring = (r, z, cls = "ln", ox = 0, oy = 0) => {
      const [x, y] = P(ox, oy, z);
      return el("ellipse", { class: cls, cx: x.toFixed(1), cy: y.toFixed(1), rx: (r * C30 * Math.SQRT2).toFixed(1), ry: (r * S30 * Math.SQRT2).toFixed(1) });
    };
    const cylinder = (r, z0, z1, ox = 0, oy = 0) => {
      const rx = r * C30 * Math.SQRT2;
      const [x0, y0] = P(ox, oy, z0), [, y1] = P(ox, oy, z1);
      ring(r, z0, "ln ln--2", ox, oy);
      el("line", { class: "ln", x1: x0 - rx, y1: y0, x2: x0 - rx, y2: y1 });
      el("line", { class: "ln", x1: x0 + rx, y1: y0, x2: x0 + rx, y2: y1 });
      ring(r, z1, "ln", ox, oy);
    };
    const dot = (x, y, z, r, anim = {}) => {
      const [px, py] = P(x, y, z);
      const d = el("circle", { class: `dot${anim.cls ? " " + anim.cls : ""}`, cx: px.toFixed(1), cy: py.toFixed(1), r });
      if (anim.d) d.style.setProperty("--d", anim.d);
      if (anim.dl) d.style.setProperty("--dl", anim.dl);
      if (anim.a) d.style.setProperty("--a", anim.a);
      return d;
    };
    const stem = (x, y, z0, z1, cls = "ln ln--3 ln--dash") => {
      const [a0, b0] = P(x, y, z0), [a1, b1] = P(x, y, z1);
      el("line", { class: cls, x1: a0, y1: b0, x2: a1, y2: b1 });
    };

    if (kind === "hero") {
      // Three planes stacked a step apart, the top one notched; a cylinder rising from its centre;
      // dots drifting above, one falling through into the cylinder over and over.
      plane(150, -34, "ln ln--3");
      plane(150, -17, "ln ln--2");
      plane(150, 0);
      plane(136, 0, "ln ln--3");
      wedges(150, 0, 15);
      cylinder(52, 0, 34);
      ring(52, -17, "ln ln--3");
      stem(0, 0, 34, 262);
      dot(0, 0, 262, 3.6, { cls: "bob", d: "7s", a: "5px" });
      dot(-36, -8, 228, 3.6, { cls: "bob", d: "5.5s", dl: "-2s", a: "7px" });
      dot(14, -26, 184, 3.6, { cls: "bob", d: "6.5s", dl: "-1s", a: "6px" });
      dot(-22, 18, 120, 3.6, { cls: "bob", d: "5s", dl: "-3s", a: "5px" });
      dot(18, 6, 86, 3.6, { cls: "bob", d: "6s", dl: "-4s", a: "4px" });
      if (!reduced) dot(0, 0, 190, 3.6, { cls: "fall" });
    } else if (kind === "earn") {
      // Vaults: deposits stacked as rising planes, yield floating off the top
      plane(66, 0, "ln ln--3");
      plane(66, 22, "ln ln--2");
      plane(66, 44);
      wedges(66, 44, 9);
      stem(0, 0, 44, 120);
      dot(0, 0, 120, 3, { cls: "bob", d: "5s", a: "5px" });
      dot(-24, 10, 86, 3, { cls: "bob", d: "6s", dl: "-2s", a: "4px" });
    } else if (kind === "borrow") {
      // Collateral held in a cylinder; the loan drawn off as a smaller plane above it
      plane(80, 0, "ln ln--3");
      cylinder(42, 0, 34);
      stem(0, 0, 34, 104);
      plane(38, 104);
      wedges(38, 104, 7);
      dot(0, 0, 104, 3, { cls: "bob", d: "6s", a: "4px" });
    } else if (kind === "swap") {
      // Two planes, a dashed route between them, a token travelling the route
      plane(42, 0, "ln", -48, 48);
      plane(42, 0, "ln", 48, -48);
      plane(30, 0, "ln ln--3", -48, 48);
      plane(30, 0, "ln ln--3", 48, -48);
      const [ax, ay] = P(-48, 48, 6), [bx, by] = P(48, -48, 6);
      const route = el("path", { class: "ln ln--2 ln--dash", d: `M${ax} ${ay} C${ax} ${ay - 90} ${bx} ${by - 90} ${bx} ${by}` });
      dot(-48, 48, 6, 3);
      dot(48, -48, 6, 3);
      if (!reduced) {
        const t = el("circle", { class: "dot", r: 3 });
        const m = el("animateMotion", { dur: "3.2s", repeatCount: "indefinite", keyPoints: "0;1;1", keyTimes: "0;0.7;1", calcMode: "spline", keySplines: "0.5 0 0.3 1;0 0 1 1" }, t);
        m.appendChild(document.createElementNS(NS, "mpath")).setAttribute("href", "#pk-route");
        route.id = "pk-route";
      }
    } else if (kind === "multiply") {
      // One position, looped: the same plane stepping up and out
      plane(30, 56);
      plane(54, 28, "ln ln--2");
      plane(78, 0, "ln ln--3");
      wedges(30, 56, 7);
      stem(0, 0, 0, 56);
      stem(0, 0, 56, 124);
      dot(0, 0, 124, 3, { cls: "bob", d: "5.5s", a: "5px" });
    }
  }
  $$("[data-iso]").forEach((svg) => draw(svg, svg.dataset.iso));

  // ---------- Reveal: each panel's content rises in once ----------
  const cells = $$(".pk-page .pk-cell").filter((c) => !c.classList.contains("pk-mark"));
  if (!reduced && "IntersectionObserver" in window) {
    cells.forEach((c) => c.classList.add("pk-reveal"));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }), { rootMargin: "0px 0px -8% 0px" });
    cells.forEach((c) => io.observe(c));
  }

  // ---------- Counters run up once when they come into view ----------
  const counters = $$("[data-count]");
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  if (!reduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target, to = Number(el.dataset.count), t0 = performance.now(), D = 1400;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - t, 4);
        el.textContent = fmt(to * k);
        if (t < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    }), { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }

  // ---------- Voices: a logo tab swaps the quote ----------
  const voices = $(".pk-voices");
  if (voices) {
    const tabs = $$(".pk-tab", voices);
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      if (tab.getAttribute("aria-selected") === "true") return;
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      voices.classList.add("is-swapping");
      setTimeout(() => {
        $("[data-quote]", voices).textContent = tab.dataset.text;
        $("[data-quote-name]", voices).textContent = tab.dataset.name;
        $("[data-quote-role]", voices).textContent = tab.dataset.role;
        $("[data-quote-logo]", voices).src = tab.dataset.logo;
        voices.classList.remove("is-swapping");
      }, reduced ? 0 : 260);
    }));
  }

  // ---------- What's new: a row swaps places with the featured article ----------
  const feature = $(".pk-feature");
  if (feature) {
    const copy = $("[data-feature-copy]", feature);
    const media = $(".pk-feature__media", feature);
    const current = () => ({
      title: $("[data-feature-title]", feature).textContent,
      meta: $("[data-feature-meta]", feature).textContent,
      text: $("[data-feature-text]", feature).textContent,
      image: $("img", media).getAttribute("src"),
    });
    $$(".pk-index__row").forEach((row) => row.addEventListener("click", () => {
      const next = { title: row.dataset.title, meta: row.dataset.meta, text: row.dataset.text, image: row.dataset.image };
      const prev = current();
      // the feature takes the row's article
      $("[data-feature-title]", feature).textContent = next.title;
      $("[data-feature-meta]", feature).textContent = next.meta;
      $("[data-feature-text]", feature).textContent = next.text;
      copy.classList.remove("is-in"); void copy.offsetWidth; copy.classList.add("is-in");
      const img = new Image();
      img.alt = ""; img.src = next.image; img.className = "is-in";
      media.appendChild(img);
      const old = $$("img", media).filter((x) => x !== img);
      const drop = () => old.forEach((x) => x.remove());
      if (reduced) drop(); else img.addEventListener("animationend", drop, { once: true });
      // and the row takes the one that was featured
      Object.assign(row.dataset, prev);
      const [cat, date] = prev.meta.split(" · ");
      const spans = row.children;
      spans[0].textContent = prev.title;
      spans[1].textContent = cat;
      spans[2].textContent = (date || "").replace(/ \d{4}$/, "");
    }));
  }

  // ---------- Newsletter: a mock sign-up ----------
  const form = $(".pk-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    $(".pk-form__done", form).hidden = false;
    $("button[type=submit]", form).disabled = true;
  });

  // ---------- Placeholder links don't jump to the top ----------
  $$('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
})();
