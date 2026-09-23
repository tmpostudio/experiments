/*
 * Handwritten signature renderer.
 * Adapted from "Signature animation" by kiranpate1 (codepen.io/kiranpate1/pen/ExBpaeW).
 *
 * Differences from the original:
 *  - listens to `input` instead of `keydown`, so paste, autofill, mobile keyboards
 *    and mid-string edits all work
 *  - stroke lengths are measured at runtime instead of hard-coded
 *  - letters are queued like a pen: pasting "Alexandra" writes each letter in turn
 *  - accented letters are drawn as their base letter (é → e)
 */
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GLYPHS = window.SIGNATURE_GLYPHS;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function normalise(value) {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function createGlyph(char) {
    if (char === " " || char === "-") {
      const space = document.createElement("span");
      space.className = "glyph glyph--space";
      return space;
    }
    const lower = char.toLowerCase();
    if (lower < "a" || lower > "z" || lower.length !== 1) return null;

    const set = char === lower ? "lo" : "up";
    const data = GLYPHS[set][lower];

    const wrap = document.createElement("span");
    wrap.className = "glyph glyph--" + set;
    wrap.style.width = data.w + "px";
    wrap.style.marginLeft = data.ml + "px";
    wrap.style.marginRight = data.mr + "px";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + data.w + " 51");
    svg.setAttribute("width", data.w);
    svg.setAttribute("height", 51);
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", data.d);
    svg.appendChild(path);
    wrap.appendChild(svg);
    return wrap;
  }

  class Signature {
    constructor(container) {
      this.container = container;
      this.text = "";
      this.penFreeAt = 0; // timestamp when the "pen" finishes the current letter
    }

    /** Update to a new value, animating only newly appended characters. */
    set(value) {
      const next = normalise(value);
      if (next === this.text) return;

      if (next.startsWith(this.text)) {
        this.append(next.slice(this.text.length), true);
      } else {
        // Deletion or mid-string edit: redraw instantly (as the original does on backspace)
        this.container.textContent = "";
        this.penFreeAt = 0;
        this.append(next, false);
      }
      this.text = next;
    }

    clear() {
      this.set("");
    }

    append(chars, animate) {
      for (const char of chars) {
        const glyph = createGlyph(char);
        if (!glyph) continue;
        this.container.appendChild(glyph);
        const path = glyph.querySelector("path");
        if (!path) continue;
        if (animate && !reduceMotion.matches) this.stroke(path);
      }
    }

    stroke(path) {
      const length = Math.ceil(path.getTotalLength()) + 1;
      // Longer strokes take longer, like real handwriting
      const duration = Math.min(520, Math.max(160, length * 2.4));
      const now = performance.now();
      const delay = Math.max(0, this.penFreeAt - now);
      this.penFreeAt = now + delay + duration * 0.85; // slight overlap between letters

      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
      path.getBoundingClientRect(); // commit starting state
      path.style.transition =
        "stroke-dashoffset " + duration + "ms cubic-bezier(0.45, 0.05, 0.4, 1) " + delay + "ms";
      path.style.strokeDashoffset = "0";
    }
  }

  window.Signature = Signature;
})();
