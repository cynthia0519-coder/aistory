import { test } from "node:test";
import assert from "node:assert/strict";
import { inviteRequired, isValidInvite } from "../src/lib/invite";

test("without INVITE_CODES nothing is checked", () => {
  delete process.env.INVITE_CODES;
  assert.equal(inviteRequired(), false);
  assert.equal(isValidInvite(null), true);
});

test("with INVITE_CODES only listed codes pass, case-insensitive", () => {
  process.env.INVITE_CODES = "MOON-7K2Q, star-9ab3";
  assert.equal(inviteRequired(), true);
  assert.equal(isValidInvite("moon-7k2q"), true);
  assert.equal(isValidInvite(" STAR-9AB3 "), true);
  assert.equal(isValidInvite("MOON-0000"), false);
  assert.equal(isValidInvite(null), false);
  assert.equal(isValidInvite(""), false);
  delete process.env.INVITE_CODES;
});
