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
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
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
    INSERT OR IGNORE INTO clients (id, name, email, phone) VALUES (1, 'Jamie Rivera', 'jamie@example.com', '9876543210');
    INSERT OR IGNORE INTO staff (id, name, email, title, color, commission_percent, base_salary, active) 
      VALUES 
        (1, 'Alex', 'alex@example.com', 'Senior Stylist', '#3b82f6', 15, 30000, 1),
        (2, 'Jordan', 'jordan@example.com', 'Junior Stylist', '#10b981', 10, 20000, 1);
    INSERT OR IGNORE INTO services (id, name, description, duration, price, color, category) VALUES (1, 'Standard Session', 'Standard appointment', 60, 100, '#3b82f6', 'General');
  `);

  const env = {
    STORAGE: {
      async query(sql: string, params: any[] = []) {
        const stmt = db.prepare(sql);
        if (stmt.columns().length) return { rows: stmt.all(...params) };
        const result = stmt.run(...params);
        return { rows: [], meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
      },
    },
  };

  const token = await (await import("hono/jwt")).sign(
    { id: 1, username: "admin", role: "owner", staff_id: null },
    "super-secret-key-for-opensalon-mvp",
    "HS256"
  );

  const call = async (method: string, path: string, body?: object) => {
    const response = await app.request(
      path,
      {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      env
    );
    return { status: response.status, body: await response.json() };
  };

  return { db, call };
}

test("Staff Attendance API: get day summary and clock in/out workflow", async (t) => {
  const { call } = await setup(t);
  const testDate = "2026-10-15";

  // 1. Initial day attendance summary - none marked yet
  const getRes = await call("GET", `/api/staff-attendance?date=${testDate}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.summary.total_staff, 2);
  assert.equal(getRes.body.summary.not_marked_count, 2);

  // 2. Staff #1 clocks in at 09:00 (on time -> status: 'present')
  const inRes1 = await call("POST", "/api/staff-attendance/clock-in", {
    staff_id: 1,
    date: testDate,
    time: "09:00",
  });
  assert.equal(inRes1.status, 200);
  assert.equal(inRes1.body.record.status, "present");
  assert.equal(inRes1.body.record.clock_in, "09:00");

  // 3. Staff #2 clocks in at 10:15 (late arrival -> status: 'late')
  const inRes2 = await call("POST", "/api/staff-attendance/clock-in", {
    staff_id: 2,
    date: testDate,
    time: "10:15",
  });
  assert.equal(inRes2.status, 200);
  assert.equal(inRes2.body.record.status, "late");
  assert.equal(inRes2.body.record.clock_in, "10:15");

  // 4. Staff #1 clocks out at 17:30 (8.5 hours)
  const outRes = await call("POST", "/api/staff-attendance/clock-out", {
    staff_id: 1,
    date: testDate,
    time: "17:30",
  });
  assert.equal(outRes.status, 200);
  assert.equal(outRes.body.record.clock_out, "17:30");
  assert.equal(outRes.body.record.total_hours, 8.5);

  // 5. Verify updated day summary counts
  const summaryRes = await call("GET", `/api/staff-attendance?date=${testDate}`);
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryRes.body.summary.present_count, 1);
  assert.equal(summaryRes.body.summary.late_count, 1);
  assert.equal(summaryRes.body.summary.not_marked_count, 0);
});

test("Staff Attendance API: manager override and bulk mark", async (t) => {
  const { call } = await setup(t);
  const testDate = "2026-10-16";

  // Bulk mark all present
  const bulkRes = await call("POST", "/api/staff-attendance/bulk", {
    work_date: testDate,
    status: "present",
  });
  assert.equal(bulkRes.status, 200);
  assert.equal(bulkRes.body.summary.present_count, 2);

  // Manager updates staff #2 to on_leave
  const updateRes = await call("PUT", "/api/staff-attendance", {
    staff_id: 2,
    work_date: testDate,
    status: "on_leave",
    notes: "Sick leave approved by manager",
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.record.status, "on_leave");
  assert.equal(updateRes.body.record.notes, "Sick leave approved by manager");
});

test("Staff Portal API: provides schedule, attendance, and commission breakdown", async (t) => {
  const { call, db } = await setup(t);
  const testDate = "2026-10-15";

  // Add an appointment for Staff #1
  db.exec(`
    INSERT INTO appointments (identifier, client_id, staff_id, scheduled_date, start_time, end_time, total_price, status)
    VALUES ('APT-501', 1, 1, '${testDate}', '11:00', '12:00', 100, 'confirmed');
  `);

  // Add an invoice and commission record for Staff #1
  db.exec(`
    INSERT INTO invoices (identifier, client_id, subtotal, discount, tax, total, payment_method, status)
    VALUES ('INV-501', 1, 100, 0, 0, 100, 'cash', 'paid');
    INSERT INTO staff_commissions (staff_id, invoice_id, item_name, item_type, item_price, commission_percent, commission_amount, created_at)
    VALUES (1, 1, 'Standard Session', 'service', 100, 15, 15, '${testDate} 12:30:00');
  `);

  const portalRes = await call("GET", `/api/staff/1/portal?date=${testDate}`);
  assert.equal(portalRes.status, 200);
  assert.equal(portalRes.body.portal.staff.name, "Alex");
  assert.equal(portalRes.body.portal.todayAppointments.length, 1);
  assert.equal(portalRes.body.portal.todayAppointments[0].identifier, "APT-501");
  assert.equal(portalRes.body.portal.monthCommissions.total_commission, 15);
  assert.equal(portalRes.body.portal.commissionsList.length, 1);
});
