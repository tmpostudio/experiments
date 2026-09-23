/* v2: keeps the image stage scaled to its box and fits long names onto the dotted line. */
(function () {
  const media = document.querySelector(".newsletter__media");
  const stage = media.querySelector(".stage");
  const signatureEl = stage.querySelector(".signature");
  const line = signatureEl.querySelector(".signature__line");

  const STAGE_WIDTH = 650;
  const LINE_WIDTH = 231;
  const OVERHANG = 4; // ink may run just past the end of the line, but never off the paper
  const MAX_SCALE = 2.2; // short names are written large; up to 20 characters still fit

  // Scale the 650×518 stage to whatever size the media box renders at
  new ResizeObserver(([entry]) => {
    stage.style.setProperty("--stage-scale", entry.contentRect.width / STAGE_WIDTH);
  }).observe(media);

  // Write as large as possible while keeping every stroke on the paper.
  // Measures the actual ink (swashes reach outside their letter boxes), not the layout box.
  function inkExtent() {
    const paths = line.querySelectorAll("path");
    if (!paths.length) return null;
    const box = line.getBoundingClientRect();
    const currentScale = box.width / line.offsetWidth || 1;
    let left = Infinity, right = -Infinity;
    paths.forEach((p) => {
      const r = p.getBoundingClientRect();
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    });
    // in unscaled signature px, relative to the signature's origin
    return { left: (left - box.left) / currentScale, right: (right - box.left) / currentScale };
  }

  function fit() {
    const inset = parseFloat(getComputedStyle(signatureEl).getPropertyValue("--inset")) || 0;
    const available = LINE_WIDTH + OVERHANG;
    const ink = inkExtent();
    let scale = MAX_SCALE;
    let offset = inset;
    if (ink) {
      scale = Math.min(scale, (available - inset) / ink.right);
      if (ink.left < 0) scale = Math.min(scale, available / (ink.right - ink.left));
      offset = Math.max(inset, -ink.left * scale); // nudge right if a swash would poke off the left
    }
    signatureEl.style.setProperty("--fit", scale.toFixed(3));
    signatureEl.style.setProperty("--offset", offset.toFixed(1) + "px");
  }

  document.addEventListener("signature:change", fit);
  fit();
})();
