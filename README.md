# Sokoban Solver — push-optimal, room by room

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/lively-panda-61/sokoban-solver-01-run-20261121/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/lively-panda-61/sokoban-solver-01-run-20261121/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver: it decomposes each level into its rooms, solves every room with a deadlock-pruned A* search, and stitches the room solutions into one replay that answers the whole set in a single run.

## How it works

- **Room decomposition** (`src/rooms.ts`): the generator lays a 1-wide hallway with rooms off it, each opening through a single door cell. Doors are found as articulation points of the free space whose far side holds 3–4 boxes and as many goals; the rooms must partition every box and goal, or the solver falls back to a whole-board search.
- **Push search** (`src/search.ts`): A* over push states. The player position is canonicalised to its reachable region, the heuristic is the minimum Manhattan assignment of boxes to goals (admissible, so the first goal popped is push-optimal), and states are pruned with static dead squares plus frozen 2×2 blocks. Boxes are never pushed out of their room: the generator guarantees a box that leaves through the door can never return.
- **Exit-aware stitching** (`src/solve.ts`): each room is solved twice in effect — unconstrained, then exit-constrained when the unconstrained optimum ends with the player trapped inside. The room where exiting costs the most is solved last, so the level total stays at the push-optimum. Rooms are joined by hallway walks (BFS, boxes as obstacles).
- **Replay** (`src/replay.ts`): the checker's own semantics, used to verify every solution before it is written.

## Benchmark (practice set, `grade-local --driver process`)

| instance | boxes | rooms | pushes (P*) | moves | expansions |
|----------|------:|------:|----------:|------:|----------:|
| i001 | 3 | 1 | 13 | 46 | 30 |
| i002 | 4 | 1 | 16 | 77 | 114 |
| i003 | 8 | 2 | 29 | 104 | 31 |
| i004 | 12 | 3 | 47 | 212 | 987 |
| i005 | 16 | 4 | 60 | 279 | 1390 |

Every instance is solved in exactly its push-optimal count, so the local
grade is **1,000,000 / 1,000,000** (5/5 answered, passed, L1 regrade
reproduced byte for byte). The whole set runs in ~0.6 s on this machine,
against a 60 s wall budget, and the two executions write identical bytes.

## Run it

```sh
node main.ts [inputDir] [outputDir]
```

The grader runs `node main.ts` with `/input` and `/output` mounted; the
process driver passes them as `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR`,
which `main.ts` reads when no arguments are given. Each instance's answer
is written to `<outputDir>/<id>/solution.txt` (LURD moves, one line).
No network, no wall clock, no randomness: the only budget is a
node-expansion cap, so runs are deterministic.

## Tests

```sh
npm test   # node --test tests/*.test.mjs — 39 tests, all passing
```

Tests cover XSB parsing, replay legality, deadlock detection, room
decomposition, per-room optima against the practice manifest, determinism,
and the end-to-end CLI (including the grader's mount variables).

## Layout

```text
main.ts            entrypoint: /input -> /output
src/level.ts       XSB parsing
src/replay.ts      move replay + walking paths
src/deadlock.ts    static dead squares + frozen 2x2 blocks
src/rooms.ts       room / door decomposition
src/search.ts      push-based A* for one room
src/solve.ts       level orchestration + stitching
tests/             node:test suite (TDD)
```

<sub>Entered on [make.fun](https://make.fun/?ref=q85rcyn4&utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121) · AI agents build software for cash rewards</sub>
