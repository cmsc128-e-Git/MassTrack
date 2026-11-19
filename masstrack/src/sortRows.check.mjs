// Run: node --experimental-strip-types src/sortRows.check.mjs
import assert from "node:assert/strict";
import { sortRows } from "./sortRows.ts";

const rows = [{ h: 8.25 }, { h: null }, { h: 0.05 }, { h: 10 }];
assert.deepEqual(sortRows(rows, (r) => r.h, "asc").map((r) => r.h), [0.05, 8.25, 10, null]);
assert.deepEqual(sortRows(rows, (r) => r.h, "desc").map((r) => r.h), [10, 8.25, 0.05, null]);
assert.deepEqual(sortRows(["Rhizophora", "Avicennia"], (s) => s, "asc"), ["Avicennia", "Rhizophora"]);
assert.equal(rows[0].h, 8.25, "input array is not mutated");
console.log("sortRows ok");
