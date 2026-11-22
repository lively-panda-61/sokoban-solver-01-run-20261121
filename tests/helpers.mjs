// Shared helpers for the Sokoban solver test suite.
// Practice levels live in the kit; the manifest holds the ground-truth
// push-optimal counts (P*) per level and per room.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const KIT = join(HERE, "..", "..", "sokoban-solver-01-run-20261121-kit");
export const PRACTICE = join(KIT, "practice", "input");

export const MANIFEST = {
  i001: { pushes: 13, rooms: [13], boxes: 3 },
  i002: { pushes: 16, rooms: [16], boxes: 4 },
  i003: { pushes: 29, rooms: [15, 14], boxes: 8 },
  i004: { pushes: 47, rooms: [15, 17, 15], boxes: 12 },
  i005: { pushes: 60, rooms: [16, 14, 14, 16], boxes: 16 },
};

export function loadPractice(id) {
  return readFileSync(join(PRACTICE, id, "level.txt"), "utf8");
}

export function countPushes(moves) {
  // Pushes are counted by the replay, not here; this helper only counts
  // move letters so tests can sanity-check solution sizes.
  return (moves.match(/[udlr]/gi) || []).length;
}
