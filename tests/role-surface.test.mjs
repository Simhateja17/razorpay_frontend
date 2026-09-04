import assert from "node:assert/strict";
import test from "node:test";

import { navigationForRole, redirectForRole, roleFromMetadata } from "../lib/role-surface.ts";

test("customer navigation excludes merchant surfaces", () => {
  assert.deepEqual(
    navigationForRole("customer").map((tab) => tab.href),
    ["/storefront", "/evidence"],
  );
});

test("operator navigation excludes customer surfaces", () => {
  assert.deepEqual(
    navigationForRole("merchant_operator").map((tab) => tab.href),
    ["/portal", "/evidence", "/operations"],
  );
});

test("direct navigation redirects to a surface owned by the signed-in role", () => {
  assert.equal(redirectForRole("merchant_operator", "/storefront"), "/portal");
  assert.equal(redirectForRole("merchant_operator", "/evidence"), null);
  assert.equal(redirectForRole("customer", "/portal"), "/storefront");
  assert.equal(redirectForRole("customer", "/operations"), "/storefront");
  assert.equal(redirectForRole("customer", "/evidence"), null);
  assert.equal(redirectForRole("merchant_operator", "/operations"), null);
});

test("only verified operator metadata selects the operator role", () => {
  assert.equal(roleFromMetadata({ cartisan_role: "merchant_operator" }), "merchant_operator");
  assert.equal(roleFromMetadata({ cartisan_role: "customer" }), "customer");
  assert.equal(roleFromMetadata({ cartisan_role: "operator" }), "customer");
  assert.equal(roleFromMetadata({ user_metadata: { cartisan_role: "merchant_operator" } }), "customer");
  assert.equal(roleFromMetadata(undefined), "customer");
});
