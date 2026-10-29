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

  { // stepped folio, set aside 28 Oct 2026 (its own copy of the folio drawing)
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
  $$("[data-pb-folio2]").forEach((stage) => {
    const kind = stage.dataset.pbFolio2; // "steps" | "file"
    const sheets = $$(".pb-folio2__sheet", stage);
    const tabs = sheets.map((s) => $(".pb-folio2__tab", s));
    const n = sheets.length;
    const uid = stage.id || kind;
    $$(".pb-folio2__code", stage).forEach((code) => $$("i", code).forEach((line, k) => line.style.setProperty("--n", k)));
    sheets.forEach((s, i) => {
      $(".pb-folio2__shape", s).innerHTML =
        `<defs><clipPath id="${uid}-k${i}"><path class="pb-folio2__clip"/></clipPath>` +
        `<filter id="${uid}-g${i}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${i + 3}"/>` +
        `<feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.2  0 0 0 0 0.28  0 0 0 0.5 0"/></filter>` +
        `<clipPath id="${uid}-c${i}" clip-path="url(#${uid}-k${i})"><path/></clipPath></defs>` +
        `<g clip-path="url(#${uid}-k${i})"><path class="pb-folio2__fill"/></g>` +
        `<rect class="pb-folio2__grain" clip-path="url(#${uid}-c${i})" filter="url(#${uid}-g${i})"/>`;
    });
    let c = null, W = 0;
    let order = sheets.map((_, i) => i); // order[slot] = sheet; the last slot is the front
    const at = sheets.map(() => ({ x: 0, from: 0, to: 0 })); // each tab's left base, animated
    // Where the tab of a sheet in this slot sits (its left base)
    const slotX = (slot) => kind === "file" ? c.lead : slot * (W / n); // file: a short ledge before the lip so its curve runs out flat
    const sheetH = () => c.h;
    const draw = (i) => {
      const s = sheets[i], svg = $(".pb-folio2__shape", s);
      const tL = at[i].x, tR = tL + c.tw;
      const d = sheetPath(W, sheetH(i), tL, tR, c.th, c.sL, c.sR, c.rc);
      $$("path:not(.pb-folio2__clip)", svg).forEach((p) => p.setAttribute("d", d));
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
        const svg = $(".pb-folio2__shape", s);
        svg.setAttribute("viewBox", `0 0 ${W} ${sheetH(i)}`);
        $$("rect", svg).forEach((r) => { r.setAttribute("width", W); r.setAttribute("height", sheetH(i)); });
        s.style.setProperty("--sh", `${sheetH(i)}px`);
        // the outer trim: top corners rc, bottom corners rb
        const H = sheetH(i), rc = c.rc, rb = c.rb;
        $(".pb-folio2__clip", svg).setAttribute("d", `M0 ${rc} A${rc} ${rc} 0 0 1 ${rc} 0 H${W - rc} A${rc} ${rc} 0 0 1 ${W} ${rc} V${H - rb} A${rb} ${rb} 0 0 1 ${W - rb} ${H} H${rb} A${rb} ${rb} 0 0 1 0 ${H - rb} Z`);
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
  }

  // ================= What's new, second take (cut 29 Oct 2026) =================

  // ---------- What's new index (second take) ----------
  // Hover only nudges a row's text (CSS). Clicking a row opens it and closes any other; clicking
  // an open row's header closes it. The Read article link inside follows as a normal link, and
  // clicks inside the open preview (to select text, say) leave it open. Closed previews are inert,
  // so their links stay out of the tab order.
  const pbIndex = $(".pb-index__list");
  if (pbIndex) {
    const items = $$(".pb-index__item", pbIndex);
    const setOpen = (it, on) => {
      it.classList.toggle("is-open", on);
      $(".pb-index__toggle", it).setAttribute("aria-expanded", String(on));
      $(".pb-index__more", it).inert = !on;
    };
    items.forEach((item) => item.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const more = $(".pb-index__more", item);
      if (item.classList.contains("is-open") && more.contains(e.target)) return;
      const on = !item.classList.contains("is-open");
      items.forEach((it) => setOpen(it, on && it === item));
    }));
    pbIndex.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const item = e.target.closest(".pb-index__item");
      if (item?.classList.contains("is-open")) { setOpen(item, false); $(".pb-index__toggle", item).focus(); }
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
