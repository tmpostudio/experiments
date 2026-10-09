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
  const load = (file) => import(new URL(file, here).href);
  const heroArt = $("#hero-art");
  if (heroArt) load("hero-art.js").then((m) => m.mountHero(heroArt)).catch((e) => console.warn("[hero art]", e));
  const apy = $("#apy");
  whenNear(apy, () => load("apy-story.js").then((m) => m.mountApy(apy)).catch((e) => console.warn("[apy story]", e)), "800px 0px");

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
    if (remember) try { localStorage.setItem("landing-v3:hero", name); } catch (e) {}
  }
  heroButtons.forEach((b) => b.addEventListener("click", () => setHero(b.dataset.heroSet, true)));
  let startHero = new URLSearchParams(location.search).get("hero");
  if (!startHero) try { startHero = localStorage.getItem("landing-v3:hero"); } catch (e) {}
  setHero(["dots", "studio"].includes(startHero) ? startHero : "app", false); // default: App screen

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
  setProducts(startProducts === "grid" ? "grid" : "row", false); // default: Row

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

  // ---------- Commodity: slow parallax on the photo ----------
  const commodity = $(".l-commodity");
  if (commodity && !reduced) {
    const bg = $(".l-commodity__bg", commodity);
    let queued = false;
    const move = () => {
      queued = false;
      const r = commodity.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1..1 around centre
      bg.style.transform = `translateY(${(p * 60).toFixed(1)}px) scale(1.08)`;
    };
    window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(move); } }, { passive: true });
    move();
  }

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
  const cycle = $("[data-cycle]");
  if (cycle) {
    const items = $$("li", cycle);
    let index = 0;
    let paused = false;
    const show = (i) => { index = i; items.forEach((li, j) => li.classList.toggle("is-on", j === i)); };
    items.forEach((li, i) => {
      li.addEventListener("mouseenter", () => { paused = true; show(i); });
      li.addEventListener("mouseleave", () => { paused = false; });
    });
    if (!reduced) setInterval(() => { if (!paused) show((index + 1) % items.length); }, 1800);
  }

  // ---------- Placeholder links don't jump to the top ----------
  $$('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

  // ---------- Gentle reveal for section content ----------
  if (!reduced && "IntersectionObserver" in window) {
    const targets = $$(".l-products .l-headline, .l-product, .l-trust .l-headline, .l-quote, .l-record .l-split, .l-bento > div, .l-audits, .l-stories .l-split, .l-build .l-split, .l-build__grid > *, .l-news__inner > *");
    targets.forEach((el, i) => {
      el.classList.add("l-reveal");
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
    });
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    }), { rootMargin: "0px 0px -10% 0px" });
    targets.forEach((el) => io.observe(el));
  }
})();
