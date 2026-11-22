// TDD: end-to-end — main.ts answers the whole practice set on disk.
// RED phase: main.ts does not exist yet.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLevel } from "../src/level.ts";
import { replay } from "../src/replay.ts";
import { loadPractice, MANIFEST, PRACTICE } from "./helpers.mjs";

const REPO = dirname(join(fileURLToPath(import.meta.url), ".."));
const MAIN = join(REPO, "main.ts");

test("main.ts writes a solving solution.txt for every practice instance", () => {
  const out = mkdtempSync(join(tmpdir(), "sokoban-out-"));
  execFileSync("node", [MAIN, PRACTICE, out], { timeout: 120_000 });
  for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
    const file = join(out, id, "solution.txt");
    assert.ok(existsSync(file), `${id}: solution.txt missing`);
    const moves = readFileSync(file, "utf8");
    assert.ok(Buffer.byteLength(moves, "utf8") <= 65536, `${id}: over size cap`);
    const level = parseLevel(loadPractice(id));
    const check = replay(level, moves);
    assert.equal(check.legal, true, `${id}: illegal solution`);
    assert.equal(check.solved, true, `${id}: unsolved`);
    assert.equal(
      check.pushes,
      MANIFEST[id].pushes,
      `${id}: ${check.pushes} pushes != P* ${MANIFEST[id].pushes}`,
    );
  }
  assert.deepEqual(readdirSync(out).sort(), ["i001", "i002", "i003", "i004", "i005"]);
});

test("main.ts run twice produces byte-identical outputs", () => {
  const outA = mkdtempSync(join(tmpdir(), "sokoban-a-"));
  const outB = mkdtempSync(join(tmpdir(), "sokoban-b-"));
  execFileSync("node", [MAIN, PRACTICE, outA], { timeout: 120_000 });
  execFileSync("node", [MAIN, PRACTICE, outB], { timeout: 120_000 });
  for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
    assert.equal(
      readFileSync(join(outA, id, "solution.txt"), "utf8"),
      readFileSync(join(outB, id, "solution.txt"), "utf8"),
      `${id}: nondeterministic output`,
    );
  }
});

test("main.ts honours MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR (grader mounts)", () => {
  // The grader's process driver passes the mounts as environment
  // variables; the container run uses /input and /output. Without CLI
  // arguments, main.ts must read the variables.
  const out = mkdtempSync(join(tmpdir(), "sokoban-env-"));
  execFileSync("node", [MAIN], {
    timeout: 120_000,
    env: {
      ...process.env,
      MAKEFUN_INPUT_DIR: PRACTICE,
      MAKEFUN_OUTPUT_DIR: out,
    },
  });
  for (const id of ["i001", "i002", "i003", "i004", "i005"]) {
    const file = join(out, id, "solution.txt");
    assert.ok(existsSync(file), `${id}: solution.txt missing`);
    const level = parseLevel(loadPractice(id));
    const check = replay(level, readFileSync(file, "utf8"));
    assert.equal(check.legal, true, `${id}: illegal solution`);
    assert.equal(check.solved, true, `${id}: unsolved`);
    assert.equal(check.pushes, MANIFEST[id].pushes, `${id}: pushes != P*`);
  }
});
