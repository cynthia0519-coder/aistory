import { test } from "node:test";
import assert from "node:assert/strict";

// cors.ts 在載入時讀 ALLOWED_ORIGINS，所以先設好再動態載入
process.env.ALLOWED_ORIGINS = "https://web.example, capacitor://localhost";
const cors = import("../src/lib/cors");

const optionsFrom = async (origin?: string) =>
  (await cors).preflight(new Request("https://api.example/api/tts", { method: "OPTIONS", headers: origin ? { origin } : {} }));

test("only listed origins are allowed; a missing origin is not", async () => {
  const { isAllowedOrigin } = await cors;
  assert.equal(isAllowedOrigin("https://web.example"), true);
  assert.equal(isAllowedOrigin("capacitor://localhost"), true);
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  assert.equal(isAllowedOrigin(null), false);
});

test("preflight echoes an allowed origin and rejects others with 403", async () => {
  const ok = await optionsFrom("https://web.example");
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://web.example");

  for (const res of [await optionsFrom("https://evil.example"), await optionsFrom()]) {
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await res.json(), { error: "forbidden_origin" });
  }
});
