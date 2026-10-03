const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");

// Exercise actual TypeScript route/service code with isolated external services.
function load(relative, dependencies) {
  const filename = path.join(__dirname, "..", relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiled = { exports: {} };
  const context = {
    module: compiled,
    exports: compiled.exports,
    require: (name) =>
      Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    Buffer,
    Response,
    Request,
    FormData,
    AbortSignal,
    console: { error() {} },
    process,
    URL,
  };
  vm.runInNewContext(output, context, { filename });
  return compiled.exports;
}
class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const reference = "shop_12345678-1234-1234-1234-123456789abc";
function fixture(overrides = {}, options = {}) {
  const order = {
    id: "order-1",
    reference,
    user_id: "user-1",
    email: "buyer@example.com",
    currency: "NGN",
    total_kobo: 1100000,
    status: "pending",
  };
  const calls = [];
  const filters = [];
  const db = {
    from() {
      return {
        select() {
          return this;
        },
        eq(key, value) {
          filters.push([key, value]);
          return this;
        },
        async single() {
          return {
            data: options.notFound ? null : order,
            error: options.notFound ? new Error("Missing") : null,
          };
        },
      };
    },
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === "shop_settle_order" && options.settleFails)
        return { error: new Error("Database unavailable") };
      if (name === "shop_claim_email" && options.emailFails)
        return { error: new Error("Email unavailable") };
      return { data: [], error: null };
    },
  };
  const service = load("lib/payments.ts", {
    "server-only": {},
    "./types": { money: String },
    "./server": {
      adminDb: () => db,
      HttpError,
      env: () => "test",
      paystack: async () => ({
        reference,
        amount: 1100000,
        currency: "NGN",
        status: "success",
        id: 1,
        customer: { email: order.email },
        ...overrides,
      }),
    },
  });
  return { service, calls, filters };
}
test("Verified success settles the stored order and scopes customer access", async () => {
  const { service, calls, filters } = fixture();
  const order = await service.verifyPayment(reference, "user-1");
  assert.equal(order.status, "paid");
  assert.ok(filters.some(([k, v]) => k === "user_id" && v === "user-1"));
  assert.equal(calls[0][0], "shop_settle_order");
  assert.equal(calls[0][1].p_transaction_id, "1");
});
for (const [name, values] of Object.entries({
  amount: { amount: 100 },
  currency: { currency: "USD" },
  reference: { reference: "other" },
  email: { customer: { email: "attacker@example.com" } },
})) {
  test(
    "Rejects mismatched " + name + " without settling or emailing",
    async () => {
      const { service, calls } = fixture(values);
      await assert.rejects(service.verifyPayment(reference), /do not match/);
      assert.equal(calls.length, 0);
    },
  );
}
test("Pending payment never settles or sends a receipt", async () => {
  const { service, calls } = fixture({ status: "pending" });
  assert.equal((await service.verifyPayment(reference)).status, "pending");
  assert.equal(calls.length, 0);
});
test("Email outage does not hide a verified successful payment", async () => {
  const { service } = fixture({}, { emailFails: true });
  assert.equal((await service.verifyPayment(reference)).status, "paid");
});
test("Database failure never reports a paid order", async () => {
  const { service } = fixture({}, { settleFails: true });
  await assert.rejects(
    service.verifyPayment(reference),
    /Database unavailable/,
  );
});
test("Invalid references are rejected before provider calls", async () => {
  const { service, calls } = fixture();
  await assert.rejects(
    service.verifyPayment("../invalid"),
    /Invalid payment reference/,
  );
  assert.equal(calls.length, 0);
});
test("Orders belonging to another user are not verified", async () => {
  const { service } = fixture({}, { notFound: true });
  await assert.rejects(
    service.verifyPayment(reference, "other-user"),
    /Order not found/,
  );
});
function webhook() {
  const calls = [];
  const route = load("app/api/payments/webhook/route.ts", {
    "@/lib/server": {
      env: () => "sk_test_example",
      failure: () => new Response("Failed", { status: 500 }),
    },
    "@/lib/payments": { verifyPayment: async (...args) => calls.push(args) },
  });
  return { route, calls };
}
test("Forged webhook signatures are rejected without processing", async () => {
  const { route, calls } = webhook();
  const result = await route.POST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: "{}",
      headers: { "x-paystack-signature": "a".repeat(128) },
    }),
  );
  assert.equal(result.status, 401);
  assert.equal(calls.length, 0);
});
test("Valid webhook verifies payment and leaves email to the durable outbox", async () => {
  const { route, calls } = webhook();
  const raw = JSON.stringify({ event: "charge.success", data: { reference } });
  const signature = crypto
    .createHmac("sha512", "sk_test_example")
    .update(raw)
    .digest("hex");
  const result = await route.POST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: raw,
      headers: { "x-paystack-signature": signature },
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], reference);
  assert.equal(calls[0][2], false);
});
test("Changing a signed payload invalidates the webhook", async () => {
  const { route, calls } = webhook();
  const signature = crypto
    .createHmac("sha512", "sk_test_example")
    .update("{}")
    .digest("hex");
  const result = await route.POST(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: '{"event":"charge.success"}',
      headers: { "x-paystack-signature": signature },
    }),
  );
  assert.equal(result.status, 401);
  assert.equal(calls.length, 0);
});
