// node website/test/parity.mjs — checks the website's JS engine against the C engine:
// every case in tests/test_transliterator.c, then random key sequences.
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "../js/engine.js";

const { convert } = globalThis.Ankuron;
const root = new URL("../../", import.meta.url).pathname;
const bin = join(mkdtempSync(join(tmpdir(), "ankuron-parity-")), "convert_lines");
execFileSync("clang", ["-std=c11", "-O2", join(root, "core/transliterator.c"),
  join(root, "website/test/convert_lines.c"), "-o", bin]);

const source = readFileSync(join(root, "tests/test_transliterator.c"), "utf8");
const cases = [...source.matchAll(/\{"((?:[^"\\]|\\.)*)", "/g)].map((m) => m[1]);

const keys = "abcdefghijklmnopqrstuvwxyzTDNSXRHG0123456789`.^~&* ,-'";
let seed = 2026;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const fuzz = Array.from({ length: 20000 }, () =>
  Array.from({ length: 1 + Math.floor(random() * 12) }, () => keys[Math.floor(random() * keys.length)]).join(""));

const inputs = [...cases, ...fuzz];
const expected = execFileSync(bin, { input: inputs.join("\n") + "\n" }).toString().split("\n");
let failures = 0;
inputs.forEach((input, i) => {
  const got = convert(input);
  if (got !== expected[i] && failures++ < 20) console.log(`FAIL ${JSON.stringify(input)}: js ${got}, c ${expected[i]}`);
});
console.log(failures ? `${failures} of ${inputs.length} differ` : `JS engine matches C on all ${inputs.length} inputs`);
process.exit(failures ? 1 : 0);
