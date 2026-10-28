/* Landing v1 pasteboard — the scripts of the cut sections, each under its own heading. */
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ================= Trusted by (cut 27 Oct 2026) =================

  // ---------- Trusted: card carousel ----------
  // The card in focus locks to the headline's left edge, widens and turns blue (CSS transitions);
  // the track glides so it lands there. Drag / swipe, sideways scroll, arrow keys or click a card.
  // Infinite: the cards are cloned into two sets either side; once a move has fully settled outside
  // the middle set, it jumps (with every transition off) to the identical card in the middle set.
  const tcar = $(".l-tcar");
  function layoutTrust() {}
  if (tcar) {
    const track = $(".l-tcar__track", tcar);
    const originals = $$(".l-tcard", tcar);
    const n = originals.length;
    const clone = (c) => {
      const copy = c.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      return copy;
    };
    const SETS = 5; // the middle one is the real cards
    for (let k = 0; k < (SETS - 1) / 2; k++) {
      track.prepend(...originals.map(clone));
      track.append(...originals.map(clone));
    }
    const lo = n * (SETS - 1) / 2; // first index of the middle set
    const tcards = $$(".l-tcard", tcar);
    const title = $(".l-trust2__title");
    const GAP = 24;
    let index = lo + Math.min(1, n - 1);
    let off = 432, left = 0;
    let settleTimer = 0;
    let dragging = false;
    // Brand names under the title jump the carousel to that brand's card
    const brandLinks = $$("[data-brand]");

    const offsetFor = (i) => left - i * (off + GAP);
    const setX = (x) => track.style.setProperty("--x", `${x.toFixed(1)}px`);
    function instantly(fn) {
      tcar.classList.add("is-instant");
      fn();
      void track.offsetWidth; // apply without transitions
      requestAnimationFrame(() => requestAnimationFrame(() => tcar.classList.remove("is-instant")));
    }
    function go(i) {
      index = Math.max(0, Math.min(tcards.length - 1, i));
      tcards.forEach((c, k) => {
        c.classList.toggle("is-active", k === index);
        if (k >= lo && k < lo + n) c.setAttribute("aria-current", String(k === index));
      });
      const brand = (((index - lo) % n) + n) % n; // which original card is in focus
      brandLinks.forEach((b) => b.classList.toggle("is-on", Number(b.dataset.brand) === brand));
      setX(offsetFor(index));
      clearTimeout(settleTimer);
      settleTimer = setTimeout(recentre, 800); // fallback if transitionend doesn't arrive
    }
    // Back into the middle set once the glide has finished
    function recentre() {
      clearTimeout(settleTimer);
      if (dragging || (index >= lo && index < lo + n)) return;
      const same = lo + (((index - lo) % n) + n) % n;
      instantly(() => go(same));
      clearTimeout(settleTimer);
    }
    track.addEventListener("transitionend", (e) => {
      if (e.target === track && e.propertyName === "transform") recentre();
    });
    layoutTrust = function () {
      if (!title.offsetParent) return; // section hidden by the switch
      left = title.getBoundingClientRect().left;
      off = Math.min(432, innerWidth * 0.72);
      track.style.setProperty("--off", `${off}px`);
      track.style.setProperty("--on", `${Math.min(880, innerWidth - left * 2)}px`);
      instantly(() => go(index));
    };
    layoutTrust();
    window.addEventListener("resize", layoutTrust);
    brandLinks.forEach((b) => b.addEventListener("click", () => {
      // nearest copy of that card, so it glides the short way round
      const target = lo + Number(b.dataset.brand);
      const d = ((((target - index) % n) + n + n / 2) % n) - n / 2;
      go(index + d);
    }));

    // Drag / swipe: the track follows the pointer, then locks to the nearest card
    let startX = 0, dx = 0, moved = false, downCard = null, vel = 0, lastX = 0, lastT = 0;
    tcar.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      dx = 0;
      vel = 0;
      startX = lastX = e.clientX;
      lastT = performance.now();
      downCard = e.target.closest(".l-tcard");
      clearTimeout(settleTimer);
      tcar.setPointerCapture(e.pointerId);
    });
    tcar.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const now = performance.now();
      vel = vel * 0.5 + 0.5 * ((e.clientX - lastX) / Math.max(1, now - lastT)); // px/ms, smoothed
      lastX = e.clientX;
      lastT = now;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        tcar.classList.add("is-dragging");
      }
      if (moved) setX(offsetFor(index) + dx);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      tcar.classList.remove("is-dragging");
      if (moved) {
        // One card per swipe (a long drag across several cards can still move several);
        // a short quick flick still counts as one
        let steps = Math.round(-dx / (off + GAP));
        const fresh = performance.now() - lastT < 80; // finger still moving at release
        if (!steps && (Math.abs(dx) > 30 || (fresh && Math.abs(vel) > 0.25))) steps = dx < 0 ? 1 : -1;
        go(index + steps);
      } else {
        go(downCard ? tcards.indexOf(downCard) : index);
      }
    };
    tcar.addEventListener("pointerup", endDrag);
    tcar.addEventListener("pointercancel", endDrag);

    // Trackpad sideways scroll: one card per swipe. After a step it ignores the rest of that swipe
    // and its momentum. A fresh swipe is only recognised once the momentum has been dying away (the
    // deltas were shrinking) and then jumps back up, or the direction reverses, and never within
    // 220ms of a step: a swipe's own ramp-up must not count as a second swipe.
    let wheelSum = 0, wheelLocked = false, wheelTimer = 0, lastDelta = 0, decaying = false, steppedAt = 0;
    tcar.addEventListener("wheel", (e) => {
      const ax = Math.abs(e.deltaX);
      if (ax <= Math.abs(e.deltaY) * 0.8) return;
      e.preventDefault();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelLocked = false; wheelSum = 0; lastDelta = 0; decaying = false; }, 160);
      if (wheelLocked) {
        const prev = Math.abs(lastDelta);
        if (ax < prev) decaying = true;
        const reversed = lastDelta && Math.sign(e.deltaX) !== Math.sign(lastDelta) && ax > 4;
        const reaccelerated = decaying && ax > 8 && ax > prev * 2;
        if (performance.now() - steppedAt > 220 && (reversed || reaccelerated)) { wheelLocked = false; wheelSum = 0; decaying = false; }
      }
      lastDelta = e.deltaX;
      if (wheelLocked) return;
      wheelSum += e.deltaX;
      if (Math.abs(wheelSum) > 28) {
        go(index + (wheelSum > 0 ? 1 : -1));
        wheelLocked = true;
        wheelSum = 0;
        decaying = false;
        steppedAt = performance.now();
      }
    }, { passive: false });

    tcar.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { go(index + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(index - 1); e.preventDefault(); }
    });
  }

  // ---------- Testimonials ----------
  const quote = $(".l-quote");
  if (quote) {
    // Only Binance has approved copy in the Figma; the others are marked as placeholders
    const QUOTES = [
      { text: $("[data-quote]").textContent, name: "Peter Welinder", role: "VP of Product and Partnerships<br>Binance", photo: "assets/testimonial-binance.jpg", logo: "assets/logos/binance-overlay.svg" },
      { text: "[Kraken testimonial — copy to come]", name: "Name Surname", role: "Title<br>Kraken", photo: "", logo: "" },
      { text: "[Anchorage Digital testimonial — copy to come]", name: "Name Surname", role: "Title<br>Anchorage Digital", photo: "", logo: "" },
      { text: "[OKX testimonial — copy to come]", name: "Name Surname", role: "Title<br>OKX", photo: "", logo: "" },
    ];
    const tabs = $$("[data-quote-tab]");
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      const q = QUOTES[+tab.dataset.quoteTab];
      tabs.forEach((t) => t.classList.toggle("is-on", t === tab));
      quote.classList.add("is-swapping");
      setTimeout(() => {
        $("[data-quote]").textContent = q.text;
        $("[data-quote-name]").textContent = q.name;
        $("[data-quote-role]").innerHTML = q.role;
        const photo = $("[data-quote-photo]");
        const logo = $("[data-quote-logo]");
        photo.hidden = !q.photo;
        logo.hidden = !q.logo;
        if (q.photo) photo.src = q.photo;
        if (q.logo) logo.src = q.logo;
        quote.classList.remove("is-swapping");
      }, 280);
    }));
  }

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

  { // own scope: the two accordions share names
  // ---------- Partners accordion, turning-card version (copy 27 Oct 2026) ----------
  // Click a slot to open it and the open one closes. Each slot has a progress p (0 closed, 1 open)
  // that runs through the page's ease; from p come the slot's width, the card's unturned size and
  // its turn (a quarter anticlockwise when closed). The rule: a turning card never leaves its slot.
  // Each frame the card is scaled to the largest size whose turned bounding box still fits the slot
  // at that instant, so nothing ever overlaps a neighbour, whatever the row width. The blue and the
  // quote fade in CSS off the is-open class; on phones (stacked bars) CSS does the whole move.
  const acc = $(".pb-turn");
  if (acc) {
    const items = $$(".pb-turn__item", acc);
    const cards = items.map((it) => $(".pb-turn__card", it));
    const hits = items.map((it) => $(".pb-turn__hit", it));
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
  }

  { // own scope: the two accordions share names
  // ---------- Partners accordion, swing-logo version (set aside 27 Oct 2026) ----------
  // Click a panel to open it and the others close (CSS transitions do the glide). The open width
  // is the row minus the closed strips, set in px (--on) so it transitions, re-measured on resize.
  const acc = $(".pb-swing");
  if (acc) {
    const items = $$(".pb-swing__item", acc);
    const hits = items.map((it) => $(".pb-swing__hit", it));
    const size = () => {
      const cs = getComputedStyle(acc);
      const off = parseFloat(cs.getPropertyValue("--off")) || 132;
      const gap = parseFloat(cs.getPropertyValue("--gap")) || 12;
      acc.classList.add("is-instant"); // re-measuring snaps the open panel to its new width
      acc.style.setProperty("--on", `${acc.clientWidth - (items.length - 1) * (off + gap)}px`);
      void acc.offsetWidth;
      setTimeout(() => acc.classList.remove("is-instant"), 50);
    };
    size();
    window.addEventListener("resize", size);
    const open = (item) => items.forEach((it, i) => {
      const on = it === item;
      it.classList.toggle("is-open", on);
      hits[i].setAttribute("aria-expanded", String(on));
    });
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
  }

  // ---------- Build screen: code types out line by line on the photo's screen ----------
  // Placeholder snippets for each way to build; the tab picks which one runs. It moves on to the
  // next tab by itself every so often until someone picks one.
  const codeLines = $("[data-code-lines]");
  if (codeLines) {
    const k = (t) => `<span class="k">${t}</span>`;
    const st = (t) => `<span class="s">${t}</span>`;
    const cm = (t) => `<span class="c">${t}</span>`;
    const SNIPPETS = {
      api: { label: "API · REST", lines: [
        cm("GET /v2/markets/main/reserves/metrics"),
        "[",
        "  {",
        `    ${k('"symbol"')}: ${st('"USDC"')},`,
        `    ${k('"supplyApy"')}: 0.0712,`,
        `    ${k('"borrowApy"')}: 0.0894,`,
        `    ${k('"totalSupply"')}: ${st('"412,880,190.42"')},`,
        `    ${k('"totalBorrow"')}: ${st('"301,557,004.10"')},`,
        `    ${k('"utilization"')}: 0.7304,`,
        `    ${k('"maxLtv"')}: 0.80`,
        "  },",
        "  {",
        `    ${k('"symbol"')}: ${st('"SOL"')},`,
        `    ${k('"supplyApy"')}: 0.0418,`,
        `    ${k('"borrowApy"')}: 0.0663,`,
        `    ${k('"totalSupply"')}: ${st('"5,120,774.88"')},`,
        `    ${k('"utilization"')}: 0.6129`,
        "  }",
        "]",
        "",
      ] },
      sdk: { label: "SDK · TYPESCRIPT", lines: [
        `${k("import")} { KaminoMarket }`,
        `  ${k("from")} ${st('"@kamino-finance/klend-sdk"')};`,
        "",
        `${k("const")} market = ${k("await")} KaminoMarket.load(`,
        `  connection, MAIN_MARKET`,
        `);`,
        `${k("const")} usdc = market.getReserveBySymbol(${st('"USDC"')});`,
        "",
        cm("// Live rates"),
        `console.log(usdc.totalSupplyAPY());`,
        `console.log(usdc.totalBorrowAPY());`,
        "",
        cm("// Deposit 1,000 USDC"),
        `${k("const")} tx = ${k("await")} market.deposit({`,
        `  owner: wallet.publicKey,`,
        `  reserve: usdc,`,
        `  amount: 1_000_000_000n,`,
        `});`,
        `${k("await")} sendAndConfirm(tx);`,
        "",
      ] },
      cli: { label: "CLI", lines: [
        `${cm("$")} kamino markets list`,
        `MARKET        RESERVES   TVL`,
        `main          28         $2.94B`,
        `jlp           6          $214.6M`,
        `altcoins      11         $88.2M`,
        "",
        `${cm("$")} kamino reserve show USDC --market main`,
        `supply apy    7.12%`,
        `borrow apy    8.94%`,
        `utilization   73.0%`,
        "",
        `${cm("$")} kamino deposit 1000 USDC --market main`,
        `${k("✓")} deposited 1,000.00 USDC`,
        `  tx 4mQe…9Rz2`,
        "",
      ] },
      custom: { label: "CUSTOM · ON-CHAIN", lines: [
        cm("// Compose Kamino Lend into your own program"),
        `${k("use")} kamino_lending::cpi::{`,
        `    accounts::DepositReserveLiquidity, deposit,`,
        `};`,
        "",
        `${k("pub fn")} sweep_to_kamino(`,
        `    ctx: Context&lt;Sweep&gt;, amount: ${k("u64")},`,
        `) -&gt; Result&lt;()&gt; {`,
        `  ${k("let")} accounts = DepositReserveLiquidity {`,
        `    owner: ctx.accounts.vault.to_account_info(),`,
        `    reserve: ctx.accounts.reserve.to_account_info(),`,
        `    lending_market: ctx.accounts.market(),`,
        `    ..ctx.accounts.kamino()`,
        `  };`,
        `  ${k("let")} program = ctx.accounts.klend();`,
        `  deposit(CpiContext::new(program, accounts), amount)`,
        `}`,
        "",
      ] },
    };
    const label = $("[data-code-label]");
    const tabs = $$("[data-code-tab]");
    const MAX_LINES = 120;
    const LINE_MS = 140; // a new line every this many ms
    let current = "api", cursor = 0, timer = 0, rotate = 0, userPicked = false;

    function addLine() {
      const snippet = SNIPPETS[current].lines;
      const row = document.createElement("div");
      row.innerHTML = snippet[cursor % snippet.length] || "&nbsp;";
      row.className = "is-new";
      codeLines.appendChild(row);
      cursor++;
      // Every so often drop a batch of lines long gone off the top (without animating that jump)
      if (codeLines.children.length > MAX_LINES) {
        for (let n = MAX_LINES / 2; n > 0; n--) codeLines.firstElementChild.remove();
        codeLines.style.transition = "none";
        slide();
        void codeLines.offsetHeight;
        codeLines.style.transition = "";
        return;
      }
      slide();
    }
    function slide() {
      const overflow = codeLines.scrollHeight - codeLines.parentElement.clientHeight;
      codeLines.style.transform = `translateY(${-Math.max(0, overflow)}px)`;
    }
    // Wires: one hairline per tab from the page's right edge into the screen. The selected tab's
    // line darkens and a light blue comet (as on the product buttons) runs along it into the screen.
    const wires = $(".l-bsq__wires");
    const media = wires && wires.parentElement;
    const NS = "http://www.w3.org/2000/svg";
    const wireEls = [];
    let comet, grad, wireOn = 0, wireFrame = 0, wireStart = 0, wiresVisible = false;
    const COMET = 70; // px
    const TRAVEL = 0.9; // s from the page edge to the screen
    const GAP = 0.25; // s before the next pulse sets off
    if (wires) {
      wires.innerHTML = `<defs><linearGradient id="bsq-comet" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#6cc8f5" stop-opacity="0"/><stop offset="0.8" stop-color="#6cc8f5"/><stop offset="1" stop-color="#d8f6ff"/>
      </linearGradient></defs>`;
      grad = wires.querySelector("linearGradient");
      tabs.forEach(() => { const p = document.createElementNS(NS, "path"); wires.appendChild(p); wireEls.push(p); });
      comet = document.createElementNS(NS, "polyline");
      comet.setAttribute("stroke", "url(#bsq-comet)");
      wires.appendChild(comet);
      const layout = () => {
        const W = wires.getBoundingClientRect().width;
        const m = media.clientWidth;
        const H = media.clientHeight;
        wires.setAttribute("viewBox", `0 0 ${W} ${H}`);
        // A rigid band: each wire comes in level above the screen, turns down, then turns again
        // into the screen frame's right edge (74.7% of the square). Same spacing throughout, and
        // the top wire turns innermost so they nest without crossing. Corners lightly rounded.
        const xe = 0.747 * m;
        const gap = 0.02 * H;
        const r = 5;
        wireEls.forEach((p, i) => {
          const ys = H * 0.1 + i * gap;
          const ye = H * 0.34 + i * gap;
          const xv = xe + 0.1 * m + i * gap;
          p.setAttribute("d", `M${W},${ys} H${xv + r} Q${xv},${ys} ${xv},${ys + r} V${ye - r} Q${xv},${ye} ${xv - r},${ye} H${xe}`);
        });
      };
      new ResizeObserver(layout).observe(media);
      layout();
    }
    function wireTick(now) {
      wireFrame = requestAnimationFrame(wireTick);
      const p = wireEls[wireOn];
      const total = p.getTotalLength();
      const t = ((now - wireStart) / 1000) % (TRAVEL + GAP);
      const head = (t / TRAVEL) * (total + COMET); // runs on until the tail has gone into the screen
      if (t > TRAVEL) { comet.setAttribute("points", ""); return; }
      const pts = [];
      for (let n = 0; n <= 10; n++) {
        const at = Math.min(total, Math.max(0, head - COMET + (COMET * n) / 10));
        const pt = p.getPointAtLength(at);
        pts.push(pt);
      }
      comet.setAttribute("points", pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" "));
      grad.setAttribute("x1", pts[0].x); grad.setAttribute("y1", pts[0].y);
      grad.setAttribute("x2", pts[10].x); grad.setAttribute("y2", pts[10].y + 0.01);
    }
    function wireSync() {
      const run = wires && wiresVisible && !reduced;
      if (run && !wireFrame) { wireStart = performance.now(); wireFrame = requestAnimationFrame(wireTick); }
      else if (!run && wireFrame) { cancelAnimationFrame(wireFrame); wireFrame = 0; }
    }
    function setWire(name) {
      if (!wires) return;
      wireOn = Math.max(0, tabs.findIndex((t) => t.dataset.codeTab === name));
      wireEls.forEach((p, i) => p.classList.toggle("is-on", i === wireOn));
      comet.setAttribute("points", "");
      wireStart = performance.now();
    }
    function play(name) {
      current = name;
      cursor = 0;
      setWire(name);
      label.textContent = SNIPPETS[name].label;
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.codeTab === name)));
      codeLines.innerHTML = "";
      codeLines.style.transition = "none";
      codeLines.style.transform = "translateY(0)";
      void codeLines.offsetHeight;
      codeLines.style.transition = "";
      clearInterval(timer);
      if (reduced) { SNIPPETS[name].lines.forEach(addLine); return; }
      addLine();
      timer = setInterval(addLine, LINE_MS);
    }
    tabs.forEach((t) => t.addEventListener("click", () => {
      userPicked = true;
      clearInterval(rotate);
      play(t.dataset.codeTab);
    }));
    // Only type while the section is on screen
    let started = false;
    const order = tabs.map((t) => t.dataset.codeTab);
    new IntersectionObserver(([entry]) => {
      wiresVisible = entry.isIntersecting;
      wireSync();
      if (entry.isIntersecting) {
        if (!started) {
          started = true;
          play(current);
          if (!reduced) rotate = setInterval(() => { if (!userPicked) play(order[(order.indexOf(current) + 1) % order.length]); }, 9000);
        } else if (!timer && !reduced) timer = setInterval(addLine, LINE_MS);
      } else {
        clearInterval(timer);
        timer = 0;
      }
    }).observe(codeLines.closest(".l-bsq"));
  }

  {
  // ---------- Build folio: four folded sheets, one per way to build ----------
  // Click a tab to pull its sheet to the front (CSS does the lift and the cascade of lines). Until
  // someone picks one, the front sheet moves on by itself while the folio is on screen.
  const folio = $(".pb-folio1__stage");
  if (folio) {
    const sheets = $$(".pb-folio1__sheet", folio);
    const tabs = sheets.map((s) => $(".pb-folio1__tab", s));
    $$(".pb-folio1__code", folio).forEach((code) => $$("i", code).forEach((line, n) => line.style.setProperty("--n", n)));
    let front = Math.max(0, sheets.findIndex((s) => s.classList.contains("is-front")));
    let picked = false, rotate = 0;
    const show = (i) => {
      front = i;
      sheets.forEach((s, k) => {
        s.classList.toggle("is-front", k === i);
        tabs[k].setAttribute("aria-selected", String(k === i));
        tabs[k].tabIndex = k === i ? 0 : -1;
      });
    };
    show(front);
    tabs.forEach((t, i) => t.addEventListener("click", () => { picked = true; clearInterval(rotate); show(i); }));
    folio.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      const i = (front + step + sheets.length) % sheets.length;
      picked = true;
      clearInterval(rotate);
      show(i);
      tabs[i].focus();
      e.preventDefault();
    });
    if (!reduced && "IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        clearInterval(rotate);
        rotate = 0;
        if (entry.isIntersecting && !picked) rotate = setInterval(() => show((front + 1) % sheets.length), 7000);
      }).observe(folio);
    }
  }
  }

  {
  // ---------- What's new: accordion; one story open at a time ----------
  const newsItems = $$(".l-news__item");
  const newsImages = $$(".l-news__media img");
  newsItems.forEach((item) => {
    $(".l-news__toggle", item).addEventListener("click", () => {
      const open = !item.classList.contains("is-open");
      newsItems.forEach((other) => {
        const on = other === item && open;
        other.classList.toggle("is-open", on);
        $(".l-news__toggle", other).setAttribute("aria-expanded", String(on));
      });
      // Show this article's image (stays on the last one if everything is closed)
      if (open) newsImages.forEach((img, k) => img.classList.toggle("is-on", k === Number(item.dataset.image)));
    });
  });
  }

  // ---------- Placeholder links don't jump to the top ----------
  $$('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

  // ---------- Gentle reveal for section content ----------
  if (!reduced && "IntersectionObserver" in window) {
    const targets = $$(".l-trust .l-headline, .l-quote, .l-trust2__title");
    targets.forEach((el, i) => {
      el.classList.add("l-reveal");
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
    });
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
      setTimeout(() => (entry.target.style.transitionDelay = ""), 1100);
    }), { rootMargin: "0px 0px -10% 0px" });
    targets.forEach((el) => io.observe(el));
  }
})();
