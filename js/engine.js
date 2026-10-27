/* Romanized Assamese → Assamese script: a line-for-line port of core/transliterator.c
 * for the website's typing demo. website/test/parity.mjs checks it against the C engine,
 * so change both together. A plain script, not a module, so the page also works opened
 * straight from disk; it defines globalThis.Ankuron.convert. */
(() => {

/* Letters whose case changes meaning; every other capital is read as lowercase. */
const caseSensitive = "TDNSXRHG";

const consonants = {
  k: "ক", kh: "খ", g: "গ", gh: "ঘ", Ng: "ঙ",
  c: "চ", ch: "ছ", j: "জ", jh: "ঝ", nG: "ঞ",
  T: "ট", Th: "ঠ", D: "ড", Dh: "ঢ", N: "ণ",
  t: "ত", th: "থ", d: "দ", dh: "ধ", n: "ন",
  p: "প", ph: "ফ", f: "ফ", b: "ব", bh: "ভ", m: "ম",
  z: "য", r: "ৰ", l: "ল", w: "ৱ", v: "ৱ",
  x: "শ", sh: "শ", S: "ষ", s: "স", h: "হ",
  X: "ক্ষ", R: "ড়", Rh: "ঢ়", G: "জ্ঞ",
};

/* [independent form, vowel sign] */
const vowels = {
  a: ["অ", ""], aa: ["আ", "া"],
  i: ["ই", "ি"], ii: ["ঈ", "ী"], ee: ["ঈ", "ী"],
  u: ["উ", "ু"], uu: ["ঊ", "ূ"], rri: ["ঋ", "ৃ"],
  e: ["এ", "ে"], oi: ["ঐ", "ৈ"], o: ["ও", "ো"], ou: ["ঔ", "ৌ"],
};

const signs = {
  ng: "ং", H: "ঃ", "^": "ঁ", "t~": "ৎ", "&": "°", "*": "৺",
  0: "০", 1: "১", 2: "২", 3: "৩", 4: "৪", 5: "৫", 6: "৬", 7: "৭", 8: "৮", 9: "৯",
};

/* Standard Assamese conjuncts: the second letters each first letter joins with.
 * Pairs not listed stay separate (raamdhenu → ৰামধেনু); "`" forces a join. */
const conjuncts = {
  "ক": "ক ট ত ন ব ম ল ষ স", "গ": "গ ধ ন ব ম ল", "ঘ": "ন", "ঙ": "ক খ গ ঘ ম ক্ষ",
  "চ": "চ ছ ঞ", "জ": "জ ঝ ঞ ব", "ঞ": "চ ছ জ ঝ", "ট": "ট ব ম", "ড": "ড ব",
  "ণ": "ট ঠ ড ঢ ণ ব ম", "ত": "ত থ ন ব ম", "থ": "ব", "দ": "গ ঘ দ ধ ব ভ ম", "ধ": "ন ব",
  "ন": "ট ঠ ড ত থ দ ধ ন ব ম স", "প": "ট ত ন প ল স", "ফ": "ল", "ব": "জ দ ধ ব ল",
  "ভ": "ল", "ম": "ন প ফ ব ভ ম ল", "ল": "ক গ ট ড প ব ম ল", "শ": "চ ছ ন ব ম ল",
  "ষ": "ক ট ঠ ণ প ফ ম", "স": "ক খ ট ত থ ন প ফ ব ম ল", "হ": "ণ ন ব ম ল", "ক্ষ": "ণ ম",
};
for (const first in conjuncts) conjuncts[first] = conjuncts[first].split(" ");

const MAX_KEY_LENGTH = 3;

function joins(first, second) {
  /* ৰেফ, ৰ-ফলা and য-ফলা form with any consonant. */
  if (first === "ৰ" || second === "ৰ" || second === "য") return true;
  return (conjuncts[first] || []).includes(second);
}

/* Matches the longest table key at the start of s; returns [token, key length] or null. */
function match(s) {
  for (let len = Math.min(s.length, MAX_KEY_LENGTH); len > 0; len--) {
    const key = s.slice(0, len);
    if (Object.hasOwn(vowels, key)) {
      const [text, sign] = vowels[key];
      return [{ type: "vowel", text, sign }, len];
    }
    if (Object.hasOwn(consonants, key)) return [{ type: "consonant", text: consonants[key] }, len];
    if (Object.hasOwn(signs, key)) {
      const type = key[0] >= "0" && key[0] <= "9" ? "digit" : "sign";
      return [{ type, text: signs[key] }, len];
    }
  }
  return null;
}

function convert(roman) {
  const input = [...roman]
    .map((c) => (c >= "A" && c <= "Z" && !caseSensitive.includes(c) ? c.toLowerCase() : c))
    .join("");

  const tokens = [];
  for (let i = 0; i < input.length; ) {
    const prev = tokens.at(-1);
    const found = match(input.slice(i));
    let tok;
    if (found) {
      [tok] = found;
      i += found[1];
      /* w after a consonant is ব-ফলা, which is written with ব (twa → ত্ব). */
      if (tok.type === "consonant" && tok.text === "ৱ" && prev?.type === "consonant" &&
          joins(prev.text, "ব"))
        tok.text = "ব";
    } else {
      const c = String.fromCodePoint(input.codePointAt(i));
      i += c.length;
      if (c === "y") {
        /* After a consonant or ` y is য-ফলা (raajya → ৰাজ্য, e`yaap → এ্যাপ);
         * elsewhere it is য়. */
        const ya = prev?.type === "consonant" || prev?.type === "hasanta" ? "য" : "য়";
        tok = { type: "consonant", text: ya };
      } else if (c === "`") {
        tok = { type: "hasanta", text: "্" };
      } else if (c === ".") {
        /* Keep decimal points in numbers; otherwise a full stop is the দাড়ি. */
        tok = { type: "literal", text: prev?.type === "digit" ? "." : "।" };
      } else {
        tok = { type: "literal", text: c };
      }
    }
    tokens.push(tok);
  }

  let out = "";
  tokens.forEach((tok, i) => {
    const prev = tokens[i - 1];
    const afterConsonant = prev?.type === "consonant";
    if (tok.type === "consonant") {
      if (afterConsonant && joins(prev.text, tok.text)) out += "্";
      out += tok.text;
    } else if (tok.type === "vowel") {
      out += afterConsonant ? tok.sign : tok.text;
    } else {
      out += tok.text;
    }
  });
  return out;
}

globalThis.Ankuron = { convert };
})();
