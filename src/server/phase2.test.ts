import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { before, test } from "node:test";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
let bundle: string;
let scenario = 0;

before(async () => {
  const result = await build({
    entryPoints: [new URL("./index.ts", import.meta.url).pathname],
    bundle: true, platform: "node", format: "esm", write: false,
  });
  bundle = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`;
});

async function setup(t: { after: (fn: () => void) => void }) {
  const { default: app } = await import(`${bundle}#${scenario++}`);
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  db.exec(`
    INSERT OR IGNORE INTO clients (id, name, email, phone) VALUES (1, 'Jamie Rivera', 'jamie@example.com', '555-0101');
    INSERT OR IGNORE INTO staff (id, name, email, title, color, commission_percent) VALUES (1, 'Alex', 'alex@example.com', 'Senior Stylist', '#3b82f6', 10);
    INSERT OR IGNORE INTO services (id, name, description, duration, price, color, category) VALUES (1, 'Standard Session', 'Standard appointment', 60, 50, '#3b82f6', 'General');
  `);

  const env = { STORAGE: { async query(sql: string, params: any[] = []) {
    const stmt = db.prepare(sql);
    if (stmt.columns().length) return { rows: stmt.all(...params) };
    const result = stmt.run(...params);
    return { rows: [], meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
  } } };

  const token = await (await import("hono/jwt")).sign(
    { id: 1, username: "admin", role: "owner", staff_id: null },
    "super-secret-key-for-opensalon-mvp",
    "HS256"
  );

  const call = async (method: string, path: string, body?: object) => {
    const response = await app.request(path, {
      method, headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, env);
    return { status: response.status, body: await response.json() };
  };

  return { db, call };
}

test("Growth Insights API returns inactive clients, slow hours, and stylist leaderboard", async (t) => {
  const { call } = await setup(t);
  const res = await call("GET", "/api/growth/insights");
  assert.equal(res.status, 200);
  const body = res.body as any;
  assert.ok(Array.isArray(body.inactive_clients));
  assert.ok(Array.isArray(body.slow_hours));
  assert.ok(body.slow_hours.length > 0);
  assert.ok(Array.isArray(body.stylist_leaderboard));
  assert.equal(typeof body.repeat_client_rate, "number");
});

test("Memberships API supports plan creation and client enrollment with loyalty bonus", async (t) => {
  const { call } = await setup(t);

  // 1. Create a VIP plan
  const createPlanRes = await call("POST", "/api/memberships", {
    name: "DIAMOND ALL ACCESS",
    description: "Unlimited styling and retail perk",
    price: 9999,
    duration_days: 365,
    service_discount_percent: 20,
    product_discount_percent: 15,
    included_services_count: 24,
    bonus_loyalty_points: 1000,
    active: 1,
  });
  assert.equal(createPlanRes.status, 201);
  const plan = (createPlanRes.body as any).membership;
  assert.equal(plan.name, "DIAMOND ALL ACCESS");

  // 2. Enroll Client 1 in this plan
  const enrollRes = await call("POST", "/api/client-memberships", {
    client_id: 1,
    membership_id: plan.id,
  });
  assert.equal(enrollRes.status, 201);
  const enrollment = (enrollRes.body as any).client_membership;
  assert.equal(enrollment.client_id, 1);
  assert.equal(enrollment.services_total, 24);
  assert.equal(enrollment.services_used, 0);

  // 3. Verify loyalty transactions received membership bonus
  const loyaltyRes = await call("GET", "/api/loyalty/transactions");
  assert.equal(loyaltyRes.status, 200);
  const txs = (loyaltyRes.body as any).transactions;
  const bonusTx = txs.find((tx: any) => tx.client_id === 1 && tx.transaction_type === "membership_bonus");
  assert.ok(bonusTx);
  assert.equal(bonusTx.points, 1000);
});

test("Coupons API supports creation, validation, and usage limits", async (t) => {
  const { call } = await setup(t);

  // 1. Create a coupon
  const createRes = await call("POST", "/api/coupons", {
    code: "TEST150",
    description: "Flat 150 off",
    discount_type: "flat",
    discount_value: 150,
    min_order_amount: 500,
    valid_until: "2030-01-01",
    usage_limit: 50,
  });
  assert.equal(createRes.status, 201);

  // 2. Validate with order amount below min threshold
  const invalidRes = await call("POST", "/api/coupons/validate", {
    code: "TEST150",
    order_amount: 300,
  });
  assert.equal(invalidRes.status, 200);
  assert.equal((invalidRes.body as any).valid, false);

  // 3. Validate with qualifying order amount
  const validRes = await call("POST", "/api/coupons/validate", {
    code: "TEST150",
    order_amount: 1000,
  });
  assert.equal(validRes.status, 200);
  assert.equal((validRes.body as any).valid, true);
  assert.equal((validRes.body as any).discount, 150);
});

test("POS invoices handle split payments, coupon tracking, and staff commissions", async (t) => {
  const { call } = await setup(t);

  const invoiceRes = await call("POST", "/api/invoices", {
    client_id: 1,
    appointment_id: null,
    subtotal: 1000,
    discount: 150,
    tax: 153,
    total: 1003,
    payment_method: "split",
    split_cash: 500,
    split_upi: 503,
    split_card: 0,
    coupon_code: "COMEBACK200",
    coupon_discount: 150,
    loyalty_points_redeemed: 0,
    loyalty_discount: 0,
    status: "paid",
    items: [
      { item_type: "service", item_id: 1, name: "Haircut & Beard", quantity: 1, price: 600, total: 600 },
      { item_type: "product", item_id: 1, name: "Matte Clay", quantity: 1, price: 400, total: 400 },
    ],
  });

  assert.equal(invoiceRes.status, 200);
  const inv = (invoiceRes.body as any).invoice;
  assert.equal(inv.split_cash, 500);
  assert.equal(inv.split_upi, 503);
  assert.equal(inv.payment_method, "split");

  // Check commissions were logged
  const commRes = await call("GET", "/api/staff-commissions");
  assert.equal(commRes.status, 200);
  const comms = (commRes.body as any).commissions;
  assert.ok(comms.length >= 2);
});
