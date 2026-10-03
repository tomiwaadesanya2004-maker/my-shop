const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function checkoutFixture() {
  const calls = [];
  const order = {
    id: "order-1",
    status: "pending",
    authorization_url: "https://checkout.paystack.com/existing-link",
  };
  const db = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: order.id };
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return { data: order };
        },
      };
    },
  };
  const server = {
    authenticate: async () => ({
      db,
      user: { id: "authenticated-user", email: "real@example.com" },
    }),
    env: () => "https://shop.example.com",
    HttpError,
    failure: (error) =>
      Response.json({ error: error.message }, { status: error.status || 500 }),
    paystack: async () => {
      throw new Error("Existing payment link should be reused");
    },
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../app/api/checkout/route.ts"),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(code, {
    module: compiled,
    exports: compiled.exports,
    require: () => server,
    Response,
    URL,
  });
  return { route: compiled.exports, calls };
}
const details = {
  name: "Test Buyer",
  address: "12 Test Street",
  city: "Lagos",
  phone: "+2348012345678",
  checkoutKey: "12345678-1234-1234-1234-123456789abc",
};
function request(body) {
  return new Request("https://shop.example.com/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
test("Checkout ignores browser prices, items, email and user identity", async () => {
  const { route, calls } = checkoutFixture();
  const response = await route.POST(
    request({
      ...details,
      total: 1,
      price_kobo: 1,
      items: [{ price: 1 }],
      user_id: "attacker",
      email: "fake@example.com",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls[0].args.p_user_id, "authenticated-user");
  assert.equal(calls[0].args.p_email, "real@example.com");
  assert.equal(Object.hasOwn(calls[0].args, "total"), false);
  assert.equal(Object.hasOwn(calls[0].args, "items"), false);
  assert.equal(
    (await response.json()).url,
    "https://checkout.paystack.com/existing-link",
  );
});
test("Malformed checkout body returns 400 before touching the database", async () => {
  const { route, calls } = checkoutFixture();
  const response = await route.POST(request(null));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
test("Invalid delivery details cannot create an order", async () => {
  const { route, calls } = checkoutFixture();
  const response = await route.POST(request({ ...details, phone: "+++++++" }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
test("Invalid UUIDs cannot reach the checkout RPC", async () => {
  const { route, calls } = checkoutFixture();
  const response = await route.POST(
    request({ ...details, checkoutKey: "-".repeat(36) }),
  );
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
