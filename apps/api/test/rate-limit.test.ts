import { test } from "node:test";
import assert from "node:assert/strict";
import { ipKey } from "../src/lib/rate-limit";

test("rate limit keys never contain the raw IP", () => {
  const k = ipKey("203.0.113.7");
  assert.match(k, /^[0-9a-f]{16}$/);
  assert.ok(!k.includes("203"));
  assert.equal(k, ipKey("203.0.113.7"));
  assert.notEqual(k, ipKey("203.0.113.8"));
});
