import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidEmail,
  isNonEmptyString,
  isValidObjectId,
} from "../src/utils/validation.js";

test("isValidEmail validates common email cases", () => {
  assert.equal(isValidEmail("anna@example.com"), true);
  assert.equal(isValidEmail("bad-email"), false);
  assert.equal(isValidEmail(""), false);
});

test("isNonEmptyString requires non-empty trimmed string", () => {
  assert.equal(isNonEmptyString("hello"), true);
  assert.equal(isNonEmptyString("   "), false);
  assert.equal(isNonEmptyString(null), false);
});

test("isValidObjectId validates mongoose object ids", () => {
  assert.equal(isValidObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isValidObjectId("not-an-id"), false);
  assert.equal(isValidObjectId(""), false);
});
