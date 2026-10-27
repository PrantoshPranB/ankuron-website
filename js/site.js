(() => {
const { convert } = globalThis.Ankuron;

const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero: English letters type themselves and the Assamese grows above them, as in the video. */
const heroWords = ["asamiiyaa", "bihu", "gaamocaa", "pradhaan", "brahmaputra", "krriSNa", "angkuraN"];
const heroEn = $("#hero-en");
const heroAs = $("#hero-as");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function typeHero() {
  for (let i = 0; ; i = (i + 1) % heroWords.length) {
    const word = heroWords[i];
    for (let n = 1; n <= word.length; n++) {
      heroEn.textContent = word.slice(0, n);
      heroAs.textContent = convert(word.slice(0, n));
      await wait(130);
    }
    await wait(1900);
    for (let n = word.length - 1; n >= 0; n--) {
      heroEn.textContent = word.slice(0, n);
      heroAs.textContent = convert(word.slice(0, n));
      await wait(40);
    }
    await wait(350);
  }
}
if (!reducedMotion) typeHero();

/* Live demo, limited to MAX_WORDS words (and the textarea's maxlength); the apps have no limit. */
const MAX_WORDS = 20;
const input = $("#demo-input");
const output = $("#demo-output");
const count = $("#demo-count");
function render() {
  if (input.value.length > input.maxLength) input.value = input.value.slice(0, input.maxLength);
  const words = [...input.value.matchAll(/\S+/g)];
  if (words.length > MAX_WORDS) {
    const last = words[MAX_WORDS - 1];
    input.value = input.value.slice(0, last.index + last[0].length);
    words.length = MAX_WORDS;
  }
  const full = words.length >= MAX_WORDS;
  count.classList.toggle("full", full);
  count.innerHTML = full
    ? `${MAX_WORDS} / ${MAX_WORDS} words. <a href="#download">Download Ankuron</a> to type as much as you like.`
    : `${words.length} / ${MAX_WORDS} words`;
  output.textContent = convert(input.value);
}
input.addEventListener("input", render);
render();

function tryText(text, { append = false } = {}) {
  input.value = append ? input.value + text : text;
  render();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

document.querySelectorAll("[data-try]").forEach((button) =>
  button.addEventListener("click", () => tryText(button.dataset.try)));

const copy = $("#demo-copy");
copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.textContent);
    copy.textContent = "Copied";
  } catch {
    copy.textContent = "Select and copy";
  }
  setTimeout(() => { copy.textContent = "Copy"; }, 1500);
});

/* Typing guide: every key is shown with what the engine itself types for it. */
const guide = {
  vowels: ["a", "aa", "i", "ii", "ee", "u", "uu", "rri", "e", "oi", "o", "ou"],
  consonants: [
    "k", "kh", "g", "gh", "Ng", "c", "ch", "j", "jh", "nG",
    "T", "Th", "D", "Dh", "N", "t", "th", "d", "dh", "n",
    "p", "ph f", "b", "bh", "m", "z", "y", "r", "l", "w v",
    "x sh", "S", "s", "h", "X", "R", "Rh", "G",
  ],
  signs: ["ng", "H", "^", "t~", "`", "&", "*", ".", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
};

function key(keys, shows) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "key";
  const glyph = document.createElement("b");
  glyph.textContent = shows;
  const label = document.createElement("span");
  label.textContent = keys.split(" ").join(" / ");
  button.append(glyph, label);
  button.addEventListener("click", () => {
    $("#try").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    tryText(keys.split(" ")[0], { append: true });
  });
  return button;
}

for (const v of guide.vowels) {
  /* The independent vowel, then its sign as written after ক. */
  const sign = convert("k" + v).slice(1);
  $("#guide-vowels").append(key(v, sign ? `${convert(v)} ◌${sign}` : convert(v)));
}
for (const c of guide.consonants) $("#guide-consonants").append(key(c, convert(c.split(" ")[0])));
for (const s of guide.signs) {
  /* ৎ, ং, ঃ, ঁ and হসন্ত are shown on a letter. */
  const shows = ["t~", "`", "ng", "H", "^"].includes(s) ? convert((s === "t~" ? "" : "k") + s) : convert(s);
  $("#guide-signs").append(key(s, shows));
}
})();

/* Download sign-up: every download asks for a name and email, which the downloads Worker
 * stores and counts (downloads-worker/). */
(() => {
  const dialog = document.querySelector("#signup");
  const form = document.querySelector("#signup-form");
  const done = document.querySelector("#signup-done");
  const error = form.querySelector(".error");
  const submit = form.querySelector("[type=submit]");
  const api = document.querySelector('meta[name="downloads-api"]').content;
  const names = { mac: "Mac", windows: "Windows" };
  let platform = "mac";

  document.querySelectorAll("[data-download]").forEach((button) =>
    button.addEventListener("click", () => {
      platform = button.dataset.download;
      dialog.querySelectorAll("[data-platform-name]").forEach((el) => { el.textContent = names[platform]; });
      form.hidden = false;
      done.hidden = true;
      error.hidden = true;
      dialog.showModal();
      form.elements.name.focus();
    }));
  dialog.querySelectorAll(".close").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  const showError = (message) => { error.textContent = message; error.hidden = false; };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    if (!name) return showError("Please enter your name.");
    if (!form.elements.email.checkValidity() || !email) return showError("Please enter a valid email address.");
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = "Signing up…";
    try {
      const response = await fetch(`${api}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, platform, website: form.elements.website.value }),
      });
      const result = await response.json();
      if (!result.ok) return showError(result.error || "Something went wrong. Please try again.");
      if (result.url) {
        location.href = result.url;
        dialog.close();
        return;
      }
      done.querySelector("[data-person]").textContent = name.split(/\s+/)[0];
      form.hidden = true;
      done.hidden = false;
    } catch {
      showError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign up and download";
    }
  });
})();
