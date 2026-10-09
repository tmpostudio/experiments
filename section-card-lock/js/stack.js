/* Card stack. The motion is plain position: sticky (css/styles.css); this measures the
   layout the CSS needs, picks a mode that fits the viewport, and keeps the index and
   .is-active in step with the card in front. */
(function () {
  const section = document.querySelector(".platform");
  if (!section) return;

  // Pages that bundle the art themselves point data-art-src at their build (e.g. landing-v1)
  const artURL = section.dataset.artSrc
    ? new URL(section.dataset.artSrc, document.baseURI).href
    : new URL("card-art.js", document.currentScript.src).href;

  const head = section.querySelector(".platform__head");
  const title = section.querySelector(".platform__title");
  const rail = section.querySelector(".platform__rail");
  const slot = section.querySelector(".platform__slot");
  const cards = Array.from(section.querySelectorAll(".card"));
  const links = Array.from(section.querySelectorAll(".platform__index a"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // 100svh in px: the height the CSS sizes the cards against
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
  document.body.appendChild(viewport);

  let locks = []; // scrollY at which each card locks
  let flips = []; // scrollY at which each card takes over the index
  let active = -1;

  section.style.setProperty("--last", cards.length - 1);
  cards.forEach((card, i) => card.style.setProperty("--i", i));

  function setMode(mode, pinOffset) {
    if (mode) section.dataset.stack = mode;
    else delete section.dataset.stack;
    section.style.setProperty("--pin-offset", pinOffset + "px");
  }

  function layout() {
    const viewH = viewport.offsetHeight;

    // Pinned: headline, index and stack all stay put
    setMode("pinned", 0);
    const headTop = head.getBoundingClientRect().top;
    const stackTop = slot.getBoundingClientRect().top - headTop;
    section.style.setProperty("--stack-top", stackTop + "px");

    if (stackTop + slot.offsetHeight > viewH) {
      // Compact: not enough height for the headline too, so it scrolls away and the index + stack pin near the top
      const compactTop = parseFloat(getComputedStyle(section).getPropertyValue("--compact-top")) || 0;
      const pinOffset = rail.getBoundingClientRect().top - headTop - compactTop;
      setMode("compact", pinOffset);

      // Plain list: too short to stack at all (e.g. a landscape phone)
      if (stackTop - pinOffset + slot.offsetHeight > viewH) setMode(null, 0);
    }

    if (!section.dataset.stack) {
      locks = [];
      flips = [];
      return;
    }

    // A card locks once it has scrolled up to its sticky offset from its in-flow position
    section.classList.add("is-measuring");
    const flowTops = cards.map((card) => card.getBoundingClientRect().top + window.scrollY);
    section.classList.remove("is-measuring");
    const stickyTops = cards.map((card) => parseFloat(getComputedStyle(card).top));
    locks = cards.map((card, i) => flowTops[i] - stickyTops[i]);

    // ...and takes over the index halfway between entering at the bottom of the screen and locking
    flips = cards.map((card, i) => locks[i] - (viewH - stickyTops[i]) / 2);
  }

  function update() {
    let next = 0;
    for (let i = 1; i < flips.length; i++) {
      if (window.scrollY >= flips[i]) next = i;
    }
    if (next === active) return;
    active = next;

    cards.forEach((card, i) => card.classList.toggle("is-active", i === active));
    links.forEach((link, i) => {
      if (i === active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    section.dispatchEvent(new CustomEvent("platform:change", { detail: { index: active, card: cards[active] } }));
  }

  // Index jumps to the scroll position where that card locks
  links.forEach((link, i) => {
    link.addEventListener("click", (event) => {
      if (!locks.length) return; // plain list: let the anchor jump
      event.preventDefault();
      window.scrollTo({ top: locks[i], behavior: reducedMotion.matches ? "auto" : "smooth" });
    });
  });

  // Tabbing into a covered card brings it to the front
  cards.forEach((card, i) => {
    card.addEventListener("focusin", () => {
      if (locks.length && i !== active) window.scrollTo({ top: locks[i], behavior: "auto" });
    });
  });

  // "Explore" links are placeholders until the product pages exist
  section.querySelectorAll('a[href="#"]').forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });

  let scrollFrame = 0;
  window.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      update();
    });
  }, { passive: true });

  let layoutFrame = 0;
  function queueLayout() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layout();
      update();
    });
  }

  window.addEventListener("resize", queueLayout);
  if ("ResizeObserver" in window) new ResizeObserver(queueLayout).observe(title);
  if (document.fonts) document.fonts.ready.then(queueLayout);

  layout();
  update();

  // Card art (three.js + the four illustrations, js/card-art.js) loads once the section is within 400px
  function loadArt() {
    import(artURL)
      .then((art) => art.mount(section))
      .catch((error) => console.warn("[card art] failed to load", error));
  }

  if ("IntersectionObserver" in window) {
    const nearby = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      nearby.disconnect();
      loadArt();
    }, { rootMargin: "400px 0px" });
    nearby.observe(section);
  } else {
    loadArt();
  }
})();
