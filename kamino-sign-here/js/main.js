(function () {
  const form = document.getElementById("newsletter-form");
  const nameInput = form.elements.firstName;
  const emailInput = form.elements.email;
  const consentInput = form.elements.consent;
  const consentLabel = consentInput.closest(".consent");
  const button = form.querySelector(".button");
  const buttonLabel = form.querySelector(".button__label");
  const status = form.querySelector(".status");
  const signatureEl = document.querySelector(".signature");
  const signature = new window.Signature(document.querySelector(".signature__line"));

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // ---- Live signature ----
  function syncSignature() {
    const value = nameInput.value.trim() ? nameInput.value.replace(/^\s+/, "") : "";
    signatureEl.classList.toggle("is-active", value.length > 0);
    signature.set(value);
    document.dispatchEvent(new CustomEvent("signature:change", { detail: { value } }));
  }
  nameInput.addEventListener("input", syncSignature);
  syncSignature(); // handles browser-restored values

  // ---- Validation ----
  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", !!isError);
  }

  function validate() {
    const errors = [];
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    nameInput.setAttribute("aria-invalid", String(!name));
    emailInput.setAttribute("aria-invalid", String(!EMAIL_RE.test(email)));
    consentLabel.classList.toggle("is-invalid", !consentInput.checked);

    if (!name) errors.push({ el: nameInput, msg: "Add your first name to sign." });
    if (!EMAIL_RE.test(email)) errors.push({ el: emailInput, msg: "Enter a valid email address." });
    if (!consentInput.checked) errors.push({ el: consentInput, msg: "Tick the box to receive the newsletter." });
    return errors;
  }

  [nameInput, emailInput].forEach((input) =>
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") validate();
    })
  );
  consentInput.addEventListener("change", () => consentLabel.classList.remove("is-invalid"));

  // ---- Submit ----
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errors = validate();
    if (errors.length) {
      setStatus(errors[0].msg, true);
      errors[0].el.focus();
      return;
    }

    const payload = {
      firstName: nameInput.value.trim(),
      email: emailInput.value.trim(),
      consent: true,
    };

    button.disabled = true;
    buttonLabel.textContent = "Signing…";
    setStatus("", false);

    try {
      const endpoint = form.dataset.endpoint;
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Request failed: " + res.status);
      } else {
        // Demo mode: no endpoint configured
        await new Promise((r) => setTimeout(r, 700));
      }

      form.classList.add("is-success");
      buttonLabel.textContent = "Signed";
      setStatus("Thanks, " + payload.firstName + ". You're on the list for alpha.", false);
    } catch (err) {
      console.error(err);
      button.disabled = false;
      buttonLabel.textContent = "Sign";
      setStatus("Something went wrong. Please try again.", true);
    }
  });
})();
