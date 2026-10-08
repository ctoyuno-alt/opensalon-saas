import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { before, test } from "node:test";
import {
  cleanPhone,
  formatToE164,
  formatTo10Digits,
  calculateSmsSegments,
  interpolateTemplate,
} from "./sms-helpers.ts";

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
    INSERT OR IGNORE INTO staff (id, name, email, title, color, commission_percent) VALUES (1, 'Alex', 'alex@example.com', 'Senior Stylist', '#3b82f6', 10);
    INSERT OR IGNORE INTO services (id, name, description, duration, price, color, category) VALUES (1, 'Standard Session', 'Standard appointment', 60, 50, '#3b82f6', 'General');
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

// 1. Helper unit tests
test("cleanPhone strips non-digits", () => {
  assert.equal(cleanPhone("+1 (555) 010-1234"), "15550101234");
  assert.equal(cleanPhone("+91 98765-43210"), "919876543210");
  assert.equal(cleanPhone("09876543210"), "9876543210");
});

test("formatToE164 formats international phone numbers", () => {
  assert.equal(formatToE164("+15550101234"), "+15550101234");
  assert.equal(formatToE164("9876543210", "91"), "+919876543210");
  assert.equal(formatToE164("+91 98765 43210"), "+919876543210");
});

test("formatTo10Digits formats standard 10-digit Indian numbers", () => {
  assert.equal(formatTo10Digits("+919876543210"), "9876543210");
  assert.equal(formatTo10Digits("09876543210"), "9876543210");
  assert.equal(formatTo10Digits("9876543210"), "9876543210");
});

test("calculateSmsSegments handles GSM-7 and Unicode messages", () => {
  // Plain GSM text under 160
  const shortAscii = "Hello from OpenSalon! Your booking is confirmed.";
  const seg1 = calculateSmsSegments(shortAscii);
  assert.equal(seg1.isUnicode, false);
  assert.equal(seg1.segments, 1);
  assert.equal(seg1.maxPerSegment, 160);

  // Unicode text (emoji)
  const unicodeText = "Hello from OpenSalon! ✨ Your booking is confirmed.";
  const seg2 = calculateSmsSegments(unicodeText);
  assert.equal(seg2.isUnicode, true);
  assert.equal(seg2.segments, 1);
  assert.equal(seg2.maxPerSegment, 70);

  // Long GSM text over 160 (e.g. 170 chars -> 2 segments of 153 chars)
  const longAscii = "A".repeat(170);
  const seg3 = calculateSmsSegments(longAscii);
  assert.equal(seg3.isUnicode, false);
  assert.equal(seg3.segments, 2);
  assert.equal(seg3.maxPerSegment, 153);
});

test("interpolateTemplate replaces tags with variables", () => {
  const tpl = "Hello {{client_name}}, your appointment at {{salon_name}} is booked for {{date}} at {{time}}.";
  const result = interpolateTemplate(tpl, {
    client_name: "John Doe",
    salon_name: "Luxe Salon",
    date: "2026-10-15",
    time: "14:00",
  });
  assert.equal(result, "Hello John Doe, your appointment at Luxe Salon is booked for 2026-10-15 at 14:00.");
});

// 2. SMS API tests
test("SMS settings GET and PUT workflow", async (t) => {
  const { call } = await setup(t);

  // GET default settings
  const getRes = await call("GET", "/api/sms/settings");
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.settings.provider, "simulation");
  assert.equal(getRes.body.settings.auto_send_booking_confirmation, 1);

  // Update settings
  const putRes = await call("PUT", "/api/sms/settings", {
    provider: "twilio",
    twilio_account_sid: "ACtest123",
    twilio_auth_token: "secret456",
    twilio_phone_number: "+15550101",
    auto_send_booking_confirmation: 1,
    auto_send_receipt: 1,
  });
  assert.equal(putRes.status, 200);
  assert.equal(putRes.body.settings.provider, "twilio");

  // Verify updated
  const getRes2 = await call("GET", "/api/sms/settings");
  assert.equal(getRes2.status, 200);
  assert.equal(getRes2.body.settings.provider, "twilio");
  assert.equal(getRes2.body.settings.twilio_account_sid, "ACtest123");
});

test("SMS Test Dispatcher in simulation mode writes to logs", async (t) => {
  const { call } = await setup(t);

  // Switch to simulation mode
  await call("PUT", "/api/sms/settings", { provider: "simulation" });

  // Send a test SMS
  const testRes = await call("POST", "/api/sms/send-test", {
    phone: "+919876543210",
    message: "Test SMS notification from OpenSalon!",
  });
  assert.equal(testRes.status, 200);
  assert.equal(testRes.body.result.success, true);
  assert.equal(testRes.body.result.status, "simulated");

  // Verify delivery logs
  const logsRes = await call("GET", "/api/sms/logs?page=1&limit=10");
  assert.equal(logsRes.status, 200);
  assert.equal(logsRes.body.total >= 1, true);
  const log = logsRes.body.logs[0];
  assert.equal(log.recipient_phone, "919876543210");
  assert.equal(log.message_type, "test");
  assert.equal(log.status, "simulated");
  assert.equal(log.provider, "simulation");
});

test("Creating an appointment automatically triggers simulation SMS confirmation", async (t) => {
  const { call, db } = await setup(t);

  await call("PUT", "/api/sms/settings", {
    provider: "simulation",
    auto_send_booking_confirmation: 1,
  });

  // Create appointment
  const aptRes = await call("POST", "/api/appointments", {
    client_id: 1,
    staff_id: 1,
    services: [{ service_id: 1, price: 50 }],
    scheduled_date: "2026-10-15",
    start_time: "10:00",
    end_time: "11:00",
  });
  assert.equal(aptRes.status, 201);

  // Check if an SMS log was created for booking confirmation
  const logs = db.prepare("SELECT * FROM sms_logs WHERE message_type = 'booking_confirmation'").all() as any[];
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, "simulated");
  assert.match(logs[0].content, /Jamie Rivera/);
  assert.match(logs[0].content, /confirmed/i);
});

test("Creating an invoice automatically triggers simulation SMS receipt", async (t) => {
  const { call, db } = await setup(t);

  await call("PUT", "/api/sms/settings", {
    provider: "simulation",
    auto_send_receipt: 1,
  });

  // Create paid invoice
  const invRes = await call("POST", "/api/invoices", {
    client_id: 1,
    appointment_id: null,
    items: [{ item_type: "service", item_id: 1, name: "Haircut", price: 50, quantity: 1, total: 50 }],
    subtotal: 50,
    discount: 0,
    tax: 0,
    total: 50,
    payment_method: "cash",
    status: "paid",
  });
  assert.equal(invRes.status, 200);

  // Check if an SMS receipt log was created
  const logs = db.prepare("SELECT * FROM sms_logs WHERE message_type = 'receipt'").all() as any[];
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, "simulated");
  assert.match(logs[0].content, /receipt/i);
  assert.match(logs[0].content, /50/);
});
