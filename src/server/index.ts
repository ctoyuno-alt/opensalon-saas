import { createApp, createRoute, z } from "@clawnify/app";
import { sign, verify } from "hono/jwt";
import { query, get, run } from "./db.js";
import { findConflicts, describeConflicts, toMinutes, type Busy } from "./scheduling.js";
import { ensureSeeded } from "./seed.js";
import {
  getWhatsAppSettings,
  updateWhatsAppSettings,
  listWhatsAppLogs,
  sendWhatsAppMessage,
  sendAppointmentNotification,
  sendInvoiceReceiptNotification,
  createWaMeUrl,
} from "./whatsapp.js";

type Env = { 
  Bindings: { DB: D1Database };
  Variables: { user: { id: number; username: string; role: string; staff_id: number | null } };
};

const app = createApp<Env>({
  title: "OpenSalon",
  version: "1.0.0",
  description: "Appointment scheduling and business management for salons, spas, and other appointment-based businesses.",
});

// Seed sample data + the appointment counter rows on the first request an
// isolate serves. Registered after createApp's `initDB` middleware and before
// every route, so handlers always see the _meta rows.
app.use("*", async (_c, next) => {
  await ensureSeeded();
  await next();
});

const JWT_SECRET = "super-secret-key-for-opensalon-mvp"; // Use env var in production

// Auth Middleware
app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth/") || c.req.path.startsWith("/api/public/")) return next();
  
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) {
    console.error(`[AUTH 401] No token provided for ${c.req.method} ${c.req.path}. Header was: ${authHeader}`);
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  try {
    const decoded = await verify(token, JWT_SECRET, "HS256");
    c.set("user", decoded as Env["Variables"]["user"]);
    return next();
  } catch (err: any) {
    console.error(`[AUTH 401] Token verification failed for ${c.req.method} ${c.req.path}: ${err?.message || err}`);
    return c.json({ error: "Unauthorized", message: err?.message }, 401);
  }
});

// ── Shared Schemas ─────────────────────────────────────────────────

const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
const OkSchema = z.object({ ok: z.boolean() }).openapi("Ok");

const UserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  role: z.string(),
  staff_id: z.number().int().nullable(),
}).openapi("User");

const ConflictSchema = z.object({
  error: z.string(),
  conflicts: z.array(z.object({
    kind: z.enum(["appointment", "blocked"]),
    start_time: z.string(),
    end_time: z.string(),
    label: z.string(),
  })),
}).openapi("Conflict");

const ExpenseSchema = z.object({
  id: z.number().int(),
  category: z.string(),
  amount: z.number(),
  description: z.string().nullable(),
  expense_date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Expense");

const InvoiceItemSchema = z.object({
  id: z.number().int().optional(),
  invoice_id: z.number().int().optional(),
  item_type: z.string(),
  item_id: z.number().int().nullable(),
  name: z.string(),
  quantity: z.number().int(),
  price: z.number(),
  total: z.number(),
}).openapi("InvoiceItem");

const InvoiceSchema = z.object({
  id: z.number().int(),
  identifier: z.string(),
  appointment_id: z.number().int().nullable(),
  client_id: z.number().int(),
  subtotal: z.number(),
  discount: z.number(),
  tax: z.number(),
  total: z.number(),
  payment_method: z.string(),
  split_cash: z.number().optional().nullable(),
  split_upi: z.number().optional().nullable(),
  split_card: z.number().optional().nullable(),
  coupon_code: z.string().optional().nullable(),
  coupon_discount: z.number().optional().nullable(),
  loyalty_points_redeemed: z.number().int().optional().nullable(),
  loyalty_discount: z.number().optional().nullable(),
  membership_discount: z.number().optional().nullable(),
  membership_services_deducted: z.number().int().optional().nullable(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  items: z.array(InvoiceItemSchema).optional(),
  client_name: z.string().optional().nullable(),
  client_phone: z.string().optional().nullable(),
}).openapi("Invoice");

const ClientSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  notes: z.string(),
  appointment_count: z.number().int().optional(),
  loyalty_points: z.number().int().optional().nullable(),
  total_spent: z.number().optional().nullable(),
  total_visits: z.number().int().optional().nullable(),
  last_visit_date: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Client");

const StaffSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  title: z.string(),
  color: z.string(),
  base_salary: z.number().optional().nullable(),
  commission_percent: z.number().optional().nullable(),
  active: z.number().int(),
  appointment_count: z.number().int().optional(),
  created_at: z.string(),
}).openapi("Staff");

const MembershipSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().optional().nullable(),
  price: z.number(),
  duration_days: z.number().int(),
  service_discount_percent: z.number(),
  product_discount_percent: z.number(),
  included_services_count: z.number().int(),
  bonus_loyalty_points: z.number().int(),
  active: z.number().int(),
  created_at: z.string().optional(),
}).openapi("Membership");

const ClientMembershipSchema = z.object({
  id: z.number().int(),
  client_id: z.number().int(),
  membership_id: z.number().int(),
  membership_name: z.string().optional().nullable(),
  client_name: z.string().optional().nullable(),
  client_phone: z.string().optional().nullable(),
  start_date: z.string(),
  end_date: z.string(),
  services_total: z.number().int(),
  services_used: z.number().int(),
  status: z.string(),
  service_discount_percent: z.number().optional().nullable(),
  product_discount_percent: z.number().optional().nullable(),
  created_at: z.string().optional(),
}).openapi("ClientMembership");

const LoyaltyTransactionSchema = z.object({
  id: z.number().int(),
  client_id: z.number().int(),
  client_name: z.string().optional().nullable(),
  points: z.number().int(),
  transaction_type: z.string(),
  reference_id: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  created_at: z.string().optional(),
}).openapi("LoyaltyTransaction");

const CouponSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  description: z.string().optional().nullable(),
  discount_type: z.string(),
  discount_value: z.number(),
  min_order_amount: z.number().optional().default(0),
  valid_until: z.string().optional().nullable(),
  is_active: z.number().int().optional().default(1),
  usage_limit: z.number().int().optional().nullable(),
  times_used: z.number().int().optional().default(0),
  created_at: z.string().optional(),
}).openapi("Coupon");

const StaffCommissionSchema = z.object({
  id: z.number().int(),
  staff_id: z.number().int(),
  staff_name: z.string().optional().nullable(),
  invoice_id: z.number().int(),
  item_name: z.string(),
  item_type: z.string(),
  item_price: z.number(),
  commission_percent: z.number(),
  commission_amount: z.number(),
  created_at: z.string().optional(),
}).openapi("StaffCommission");

const InactiveClientAlertSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  phone: z.string(),
  days_since_last_visit: z.number().int(),
  last_visit_date: z.string(),
  total_spent: z.number(),
  total_visits: z.number().int(),
  suggested_discount: z.string(),
  suggested_message: z.string(),
  whatsapp_url: z.string(),
}).openapi("InactiveClientAlert");

const SlowHourOpportunitySchema = z.object({
  day_name: z.string(),
  slot_label: z.string(),
  historical_bookings: z.number().int(),
  recommended_deal: z.string(),
  promo_code: z.string(),
  estimated_lift: z.string(),
}).openapi("SlowHourOpportunity");

const StylistLeaderboardSchema = z.object({
  staff_id: z.number().int(),
  staff_name: z.string(),
  staff_title: z.string(),
  staff_color: z.string(),
  completed_appointments: z.number().int(),
  service_revenue: z.number(),
  product_revenue: z.number(),
  total_sales: z.number(),
  commission_earned: z.number(),
  rank: z.number().int(),
}).openapi("StylistLeaderboard");

const GrowthInsightsSchema = z.object({
  inactive_clients: z.array(InactiveClientAlertSchema),
  slow_hours: z.array(SlowHourOpportunitySchema),
  stylist_leaderboard: z.array(StylistLeaderboardSchema),
  total_members: z.number().int(),
  loyalty_points_in_circulation: z.number().int(),
  repeat_client_rate: z.number(),
  avg_ticket_size: z.number(),
}).openapi("GrowthInsights");


const ServiceSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  duration: z.number().int(),
  price: z.number(),
  color: z.string(),
  category: z.string(),
  active: z.number().int(),
  created_at: z.string(),
}).openapi("Service");

const AppointmentNoteSchema = z.object({
  id: z.number().int(),
  appointment_id: z.number().int(),
  content: z.string(),
  created_at: z.string(),
}).openapi("AppointmentNote");

const AppointmentServiceSchema = z.object({
  id: z.number().int(),
  appointment_id: z.number().int(),
  service_id: z.number().int(),
  service_name: z.string().optional(),
  price: z.number(),
  duration: z.number().int(),
}).openapi("AppointmentService");

const AppointmentSchema = z.object({
  id: z.number().int(),
  identifier: z.string(),
  client_id: z.number().int(),
  staff_id: z.number().int().nullable(),
  status: z.string(),
  scheduled_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  total_price: z.number(),
  notes: z.string(),
  is_recurring: z.number().int(),
  recurrence_interval: z.string(),
  client_name: z.string().optional(),
  client_phone: z.string().optional(),
  staff_name: z.string().nullable().optional(),
  staff_color: z.string().nullable().optional(),
  service_names: z.string().nullable().optional(),
  latest_note: z.string().nullable().optional(),
  appointment_services: z.array(AppointmentServiceSchema).optional(),
  appointment_notes: z.array(AppointmentNoteSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Appointment");

const BlockedSlotSchema = z.object({
  id: z.number().int(),
  staff_id: z.number().int(),
  staff_name: z.string().optional(),
  blocked_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  reason: z.string(),
  created_at: z.string(),
}).openapi("BlockedSlot");

const ProductSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  sku: z.string(),
  price: z.number(),
  cost: z.number(),
  stock: z.number().int(),
  low_stock_alert: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Product");

const WhatsAppSettingsSchema = z.object({
  id: z.number().int(),
  provider: z.enum(["meta", "twilio", "simulation"]),
  phone_number_id: z.string().optional().default(""),
  access_token: z.string().optional().default(""),
  business_account_id: z.string().optional().default(""),
  sender_phone_number: z.string().optional().default(""),
  twilio_account_sid: z.string().optional().default(""),
  twilio_auth_token: z.string().optional().default(""),
  twilio_phone_number: z.string().optional().default("+14155238886"),
  twilio_content_sid: z.string().optional().default(""),
  salon_name: z.string(),
  auto_send_booking_confirmation: z.number().int(),
  auto_send_reschedule: z.number().int(),
  auto_send_cancellation: z.number().int(),
  auto_send_receipt: z.number().int(),
  template_booking_confirmation: z.string(),
  template_reminder: z.string(),
  template_reschedule: z.string(),
  template_cancellation: z.string(),
  template_receipt: z.string(),
  updated_at: z.string().optional(),
}).openapi("WhatsAppSettings");

const UpdateWhatsAppSettingsSchema = z.object({
  provider: z.enum(["meta", "twilio", "simulation"]).optional(),
  phone_number_id: z.string().optional(),
  access_token: z.string().optional(),
  business_account_id: z.string().optional(),
  sender_phone_number: z.string().optional(),
  twilio_account_sid: z.string().optional(),
  twilio_auth_token: z.string().optional(),
  twilio_phone_number: z.string().optional(),
  twilio_content_sid: z.string().optional(),
  salon_name: z.string().optional(),
  auto_send_booking_confirmation: z.number().int().optional(),
  auto_send_reschedule: z.number().int().optional(),
  auto_send_cancellation: z.number().int().optional(),
  auto_send_receipt: z.number().int().optional(),
  template_booking_confirmation: z.string().optional(),
  template_reminder: z.string().optional(),
  template_reschedule: z.string().optional(),
  template_cancellation: z.string().optional(),
  template_receipt: z.string().optional(),
}).openapi("UpdateWhatsAppSettings");

const WhatsAppLogSchema = z.object({
  id: z.number().int(),
  recipient_phone: z.string(),
  recipient_name: z.string(),
  message_type: z.string(),
  content: z.string(),
  status: z.enum(["sent", "delivered", "failed", "simulated"]),
  provider: z.string(),
  external_id: z.string(),
  error_message: z.string(),
  reference_id: z.number().int().nullable(),
  created_at: z.string(),
}).openapi("WhatsAppLog");

const WhatsAppSendResultSchema = z.object({
  success: z.boolean(),
  status: z.enum(["sent", "simulated", "failed"]),
  messageId: z.string().optional(),
  error: z.string().optional(),
  waMeUrl: z.string(),
  content: z.string(),
  recipientPhone: z.string(),
}).openapi("WhatsAppSendResult");

const IdParam = z.object({ id: z.string().openapi({ description: "Resource ID" }) });

// ── Helpers ────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function nextIdentifier(): Promise<string> {
  const prefix = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'appointment_prefix'");
  const counter = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'appointment_counter'");
  const next = parseInt(counter?.value || "0", 10) + 1;
  // Upsert, not UPDATE: a plain UPDATE matches zero rows if the counter row is
  // missing, which would hand out the same identifier forever.
  await run(
    "INSERT INTO _meta (key, value) VALUES ('appointment_counter', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(next)],
  );
  return `${prefix?.value || "APT"}-${next}`;
}

async function nextInvoiceIdentifier(): Promise<string> {
  const prefix = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'invoice_prefix'");
  const counter = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'invoice_counter'");
  const next = parseInt(counter?.value || "0", 10) + 1;
  await run(
    "INSERT INTO _meta (key, value) VALUES ('invoice_counter', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(next)],
  );
  return `${prefix?.value || "INV"}-${next}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * What already occupies `staffId` on `date`: their other appointments, plus any
 * time blocked off for lunch, holiday and the like.
 *
 * Cancelled appointments free the chair, and are the one status left out. That
 * matches what `/api/calendar` draws, so the rule an owner sees is simply
 * "if it is on the calendar, it is taken".
 */
async function busyFor(staffId: number, date: string, excludeAppointmentId?: number): Promise<Busy[]> {
  const appts = await query<{ start_time: string; end_time: string; client_name: string | null }>(
    `SELECT a.start_time, a.end_time, cl.name as client_name
     FROM appointments a
     LEFT JOIN clients cl ON cl.id = a.client_id
     WHERE a.staff_id = ? AND a.scheduled_date = ? AND a.status != 'cancelled'
       ${excludeAppointmentId ? "AND a.id != ?" : ""}`,
    excludeAppointmentId ? [staffId, date, excludeAppointmentId] : [staffId, date],
  );
  const blocks = await query<{ start_time: string; end_time: string; reason: string | null }>(
    "SELECT start_time, end_time, reason FROM blocked_slots WHERE staff_id = ? AND blocked_date = ?",
    [staffId, date],
  );
  return [
    ...appts.map((a): Busy => ({
      kind: "appointment", start_time: a.start_time, end_time: a.end_time,
      label: a.client_name || "another booking",
    })),
    ...blocks.map((b): Busy => ({
      kind: "blocked", start_time: b.start_time, end_time: b.end_time,
      label: b.reason || "blocked",
    })),
  ];
}

/** The staff member's name, for the conflict message. */
async function staffName(staffId: number): Promise<string> {
  const s = await get<{ name: string }>("SELECT name FROM staff WHERE id = ?", [staffId]);
  return s?.name || "";
}

// ── Auth ───────────────────────────────────────────────────────────

const login = createRoute({
  method: "post",
  path: "/api/auth/login",
  request: {
    body: { content: { "application/json": { schema: z.object({ username: z.string(), password: z.string() }) } } },
  },
  responses: {
    200: { description: "Logged in", content: { "application/json": { schema: z.object({ user: UserSchema, token: z.string() }) } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(login, async (c) => {
  const { username, password } = c.req.valid("json");
  const hashed = await hashPassword(password);
  const user = await get<{ id: number; username: string; role: string; staff_id: number | null; password_hash: string }>(
    "SELECT * FROM users WHERE username = ?", [username]
  );
  if (!user || user.password_hash !== hashed) {
    return c.json({ error: "Invalid username or password" }, 401);
  }
  
  const payload = { 
    id: user.id, 
    username: user.username, 
    role: user.role, 
    staff_id: user.staff_id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
  };
  const token = await sign(payload, JWT_SECRET);
  
  return c.json({ user: payload, token }, 200);
});

const getMe = createRoute({
  method: "get",
  path: "/api/auth/me",
  responses: {
    200: { description: "Current user", content: { "application/json": { schema: z.object({ user: UserSchema }) } } },
    401: { description: "Not logged in", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getMe, async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) {
    console.log("No auth_token provided in getMe");
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const decoded = await verify(token, JWT_SECRET, "HS256");
    return c.json({ user: decoded }, 200);
  } catch (err) {
    console.log("JWT Verify error:", err);
    return c.json({ error: "Unauthorized", details: err instanceof Error ? err.message : String(err) }, 401);
  }
});

const logout = createRoute({
  method: "post",
  path: "/api/auth/logout",
  responses: { 200: { description: "Logged out", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(logout, async (c) => {
  // Stateless JWT, client handles deletion
  return c.json({ ok: true }, 200);
});

// ── Expenses ───────────────────────────────────────────────────────

const listExpenses = createRoute({
  method: "get",
  path: "/api/expenses",
  responses: {
    200: {
      description: "List expenses",
      content: { "application/json": { schema: z.object({ expenses: z.array(ExpenseSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listExpenses, async (c) => {
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = (page - 1) * limit;

  let q = "SELECT * FROM expenses";
  let countQ = "SELECT COUNT(*) as total FROM expenses";
  let params: any[] = [];

  q += " ORDER BY expense_date DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const [expenses, total] = await Promise.all([
    query<any>(q, params),
    get<{total: number}>(countQ, [])
  ]);

  return c.json({ expenses, total: total?.total || 0 }, 200);
});

const createExpense = createRoute({
  method: "post",
  path: "/api/expenses",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ExpenseSchema.omit({ id: true, created_at: true, updated_at: true }),
        },
      },
    },
  },
  responses: {
    200: { description: "Created expense", content: { "application/json": { schema: z.object({ expense: ExpenseSchema }) } } },
    400: { description: "Bad Request" },
  },
});

app.openapi(createExpense, async (c) => {
  const body = await c.req.valid("json");
  await run(
    "INSERT INTO expenses (category, amount, description, expense_date) VALUES (?, ?, ?, ?)",
    [body.category, body.amount, body.description, body.expense_date]
  );
  
  const newExpense = await get<any>("SELECT * FROM expenses ORDER BY id DESC LIMIT 1");
  return c.json({ expense: newExpense }, 200);
});

const deleteExpense = createRoute({
  method: "delete",
  path: "/api/expenses/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Deleted" },
    404: { description: "Not Found" },
  },
});

app.openapi(deleteExpense, async (c) => {
  const { id } = c.req.valid("param");
  const row = await get<any>("SELECT id FROM expenses WHERE id = ?", [id]);
  if (!row) return c.text("Not Found", 404);
  await run("DELETE FROM expenses WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Invoices ───────────────────────────────────────────────────────

const listInvoices = createRoute({
  method: "get",
  path: "/api/invoices",
  responses: {
    200: {
      description: "List invoices",
      content: { "application/json": { schema: z.object({ invoices: z.array(InvoiceSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listInvoices, async (c) => {
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = (page - 1) * limit;
  const status = c.req.query("status");
  
  let q = "SELECT i.*, c.name as client_name, c.phone as client_phone FROM invoices i LEFT JOIN clients c ON i.client_id = c.id";
  let countQ = "SELECT COUNT(*) as total FROM invoices";
  const params: string[] = [];
  
  if (status) {
    q += " WHERE i.status = ?";
    countQ += " WHERE status = ?";
    params.push(status);
  }
  
  q += " ORDER BY i.created_at DESC LIMIT ? OFFSET ?";
  
  const [invoices, total] = await Promise.all([
    query<any>(q, [...params, String(limit), String(offset)]),
    get<{ total: number }>(countQ, params),
  ]);
  
  return c.json({ invoices, total: total?.total || 0 }, 200);
});

const getInvoice = createRoute({
  method: "get",
  path: "/api/invoices/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Invoice details", content: { "application/json": { schema: z.object({ invoice: InvoiceSchema }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getInvoice, async (c) => {
  const id = c.req.valid("param").id;
  const invoice = await get<any>("SELECT i.*, c.name as client_name, c.phone as client_phone FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ?", [id]);
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  
  const items = await query<any>("SELECT * FROM invoice_items WHERE invoice_id = ?", [id]);
  return c.json({ invoice: { ...invoice, items } }, 200);
});

const createInvoice = createRoute({
  method: "post",
  path: "/api/invoices",
  request: {
    body: {
      content: {
        "application/json": {
          schema: InvoiceSchema.omit({ id: true, identifier: true, created_at: true, updated_at: true }),
        },
      },
    },
  },
  responses: {
    200: { description: "Created invoice", content: { "application/json": { schema: z.object({ invoice: InvoiceSchema }) } } },
  },
});

app.openapi(createInvoice, async (c) => {
  const data = c.req.valid("json");
  const identifier = await nextInvoiceIdentifier();
  
  const result = await run(
    `INSERT INTO invoices (
      identifier, appointment_id, client_id, subtotal, discount, tax, total, payment_method,
      split_cash, split_upi, split_card, coupon_code, coupon_discount,
      loyalty_points_redeemed, loyalty_discount, membership_discount, membership_services_deducted, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      identifier,
      data.appointment_id ? String(data.appointment_id) : null,
      String(data.client_id),
      String(data.subtotal),
      String(data.discount),
      String(data.tax),
      String(data.total),
      data.payment_method,
      String(data.split_cash || 0),
      String(data.split_upi || 0),
      String(data.split_card || 0),
      data.coupon_code || "",
      String(data.coupon_discount || 0),
      String(data.loyalty_points_redeemed || 0),
      String(data.loyalty_discount || 0),
      String(data.membership_discount || 0),
      String(data.membership_services_deducted || 0),
      data.status,
    ]
  );
  
  const invoiceId = result.lastInsertRowid!;
  
  if (data.items && data.items.length > 0) {
    const placeholders = data.items.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const itemParams = data.items.flatMap(item => [
      String(invoiceId),
      item.item_type,
      item.item_id ? String(item.item_id) : null,
      item.name,
      String(item.quantity),
      String(item.price),
      String(item.total),
    ]);
    
    await run(
      `INSERT INTO invoice_items (invoice_id, item_type, item_id, name, quantity, price, total) VALUES ${placeholders}`,
      itemParams
    );
  }

  // 1. Update coupon usage if applicable
  if (data.coupon_code) {
    await run("UPDATE coupons SET times_used = times_used + 1 WHERE code = ?", [data.coupon_code]);
  }

  // 2. Loyalty accrual and redemption
  const loyaltyRedeemed = data.loyalty_points_redeemed || 0;
  const loyaltyEarned = data.status === "paid" ? Math.floor(data.total / 10) : 0;

  if (loyaltyRedeemed > 0) {
    await run(
      "INSERT INTO loyalty_transactions (client_id, points, transaction_type, reference_id, notes) VALUES (?, ?, 'redeemed_pos', ?, ?)",
      [String(data.client_id), String(-loyaltyRedeemed), String(invoiceId), `Redeemed on Invoice #${identifier}`]
    );
  }

  if (loyaltyEarned > 0) {
    await run(
      "INSERT INTO loyalty_transactions (client_id, points, transaction_type, reference_id, notes) VALUES (?, ?, 'earned_invoice', ?, ?)",
      [String(data.client_id), String(loyaltyEarned), String(invoiceId), `Earned from Invoice #${identifier}`]
    );
  }

  if (data.status === "paid") {
    await run(
      `UPDATE clients SET 
         loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ? + ?),
         total_spent = COALESCE(total_spent, 0) + ?,
         total_visits = COALESCE(total_visits, 0) + 1,
         last_visit_date = date('now'),
         updated_at = datetime('now')
       WHERE id = ?`,
      [String(loyaltyRedeemed), String(loyaltyEarned), String(data.total), String(data.client_id)]
    );
  } else if (loyaltyRedeemed > 0) {
    await run(
      "UPDATE clients SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) - ?), updated_at = datetime('now') WHERE id = ?",
      [String(loyaltyRedeemed), String(data.client_id)]
    );
  }

  // 3. Staff Commission Calculation
  let staffId: number | null = null;
  if (data.appointment_id) {
    const apt = await get<{ staff_id: number | null }>("SELECT staff_id FROM appointments WHERE id = ?", [String(data.appointment_id)]);
    staffId = apt?.staff_id || null;
  }
  if (!staffId) {
    const defaultStaff = await get<{ id: number }>("SELECT id FROM staff WHERE active = 1 ORDER BY id ASC LIMIT 1");
    staffId = defaultStaff?.id || null;
  }

  if (staffId && data.items && data.items.length > 0) {
    const staffRow = await get<{ id: number; commission_percent: number }>("SELECT id, commission_percent FROM staff WHERE id = ?", [String(staffId)]);
    if (staffRow) {
      const commRate = staffRow.commission_percent ?? 10;
      for (const item of data.items) {
        const commEarned = Math.round(((item.total * commRate) / 100) * 100) / 100;
        await run(
          `INSERT INTO staff_commissions (staff_id, invoice_id, item_name, item_type, item_price, commission_percent, commission_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [String(staffId), String(invoiceId), item.name, item.item_type, String(item.total), String(commRate), String(commEarned)]
        );
      }
    }
  }

  // 4. Membership quota deduction if client has active plan and quota services were applied
  const activePlan = await get<{ id: number; services_total: number; services_used: number }>(
    "SELECT id, services_total, services_used FROM client_memberships WHERE client_id = ? AND status = 'active' AND end_date >= date('now') ORDER BY end_date ASC LIMIT 1",
    [String(data.client_id)]
  );
  if (activePlan) {
    const servicesToDeduct = data.membership_services_deducted !== undefined
      ? data.membership_services_deducted
      : 0;
    if (servicesToDeduct > 0) {
      await run(
        "UPDATE client_memberships SET services_used = MIN(services_total, services_used + ?) WHERE id = ?",
        [String(servicesToDeduct), String(activePlan.id)]
      );
    }
  }
  
  const newInvoice = await get<any>("SELECT i.*, c.name as client_name, c.phone as client_phone FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ?", [String(invoiceId)]);
  const newItems = await query<any>("SELECT * FROM invoice_items WHERE invoice_id = ?", [String(invoiceId)]);

  try {
    const waSettings = await getWhatsAppSettings();
    if (data.status === "paid" && waSettings.auto_send_receipt) {
      await sendInvoiceReceiptNotification(Number(invoiceId));
    }
  } catch (err) {
    console.error("Auto WhatsApp receipt error:", err);
  }

  return c.json({ invoice: { ...newInvoice, items: newItems } }, 200);
});

const updateInvoiceStatus = createRoute({
  method: "put",
  path: "/api/invoices/{id}/status",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({ status: z.string(), payment_method: z.string().optional() }) } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
  },
});

app.openapi(updateInvoiceStatus, async (c) => {
  const id = c.req.valid("param").id;
  const { status, payment_method } = c.req.valid("json");
  
  const existing = await get<any>("SELECT * FROM invoices WHERE id = ?", [id]);
  if (!existing) return c.json({ ok: false }, 404);

  if (payment_method) {
    await run("UPDATE invoices SET status = ?, payment_method = ?, updated_at = datetime('now') WHERE id = ?", [status, payment_method, id]);
  } else {
    await run("UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
  }

  if (existing.status !== "paid" && status === "paid") {
    const loyaltyEarned = Math.floor(existing.total / 10);
    if (loyaltyEarned > 0) {
      await run(
        "INSERT INTO loyalty_transactions (client_id, points, transaction_type, reference_id, notes) VALUES (?, ?, 'earned_invoice', ?, ?)",
        [String(existing.client_id), String(loyaltyEarned), String(id), `Earned from Invoice #${existing.identifier}`]
      );
    }
    await run(
      `UPDATE clients SET 
         loyalty_points = COALESCE(loyalty_points, 0) + ?,
         total_spent = COALESCE(total_spent, 0) + ?,
         total_visits = COALESCE(total_visits, 0) + 1,
         last_visit_date = date('now'),
         updated_at = datetime('now')
       WHERE id = ?`,
      [String(loyaltyEarned), String(existing.total), String(existing.client_id)]
    );
  }

  try {
    const waSettings = await getWhatsAppSettings();
    if (status === "paid" && waSettings.auto_send_receipt) {
      await sendInvoiceReceiptNotification(Number(id));
    }
  } catch (err) {
    console.error("Auto WhatsApp receipt error on status update:", err);
  }

  return c.json({ ok: true }, 200);
});


// ── Stats ──────────────────────────────────────────────────────────

const getStats = createRoute({
  method: "get",
  path: "/api/stats",
  responses: {
    200: {
      description: "Dashboard stats",
      content: { "application/json": { schema: z.object({
        appointments: z.number().int(),
        clients: z.number().int(),
        staff: z.number().int(),
        services: z.number().int(),
        products: z.number().int(),
        today_appointments: z.number().int(),
        upcoming_appointments: z.number().int(),
        completed_appointments: z.number().int(),
        revenue: z.number(),
        low_stock_products: z.number().int(),
      }) } },
    },
  },
});

app.openapi(getStats, async (c) => {
  const today = new Date().toISOString().split("T")[0];
  const appointments = await get<{ count: number }>("SELECT COUNT(*) as count FROM appointments");
  const clients = await get<{ count: number }>("SELECT COUNT(*) as count FROM clients");
  const staff = await get<{ count: number }>("SELECT COUNT(*) as count FROM staff WHERE active = 1");
  const services = await get<{ count: number }>("SELECT COUNT(*) as count FROM services WHERE active = 1");
  const products = await get<{ count: number }>("SELECT COUNT(*) as count FROM products");
  const todayAppointments = await get<{ count: number }>("SELECT COUNT(*) as count FROM appointments WHERE scheduled_date = ?", [today]);
  const upcomingAppointments = await get<{ count: number }>("SELECT COUNT(*) as count FROM appointments WHERE status IN ('booked', 'confirmed') AND scheduled_date >= ?", [today]);
  const completedAppointments = await get<{ count: number }>("SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'");
  const revenue = await get<{ total: number }>("SELECT COALESCE(SUM(total_price), 0) as total FROM appointments WHERE status = 'completed'");
  const lowStock = await get<{ count: number }>("SELECT COUNT(*) as count FROM products WHERE stock <= low_stock_alert");
  return c.json({
    appointments: appointments?.count || 0,
    clients: clients?.count || 0,
    staff: staff?.count || 0,
    services: services?.count || 0,
    products: products?.count || 0,
    today_appointments: todayAppointments?.count || 0,
    upcoming_appointments: upcomingAppointments?.count || 0,
    completed_appointments: completedAppointments?.count || 0,
    revenue: revenue?.total || 0,
    low_stock_products: lowStock?.count || 0,
  }, 200);
});

// ── Appointments ───────────────────────────────────────────────────

const listAppointments = createRoute({
  method: "get",
  path: "/api/appointments",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      status: z.string().optional(),
      date: z.string().optional(),
      staff_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated appointment list",
      content: { "application/json": { schema: z.object({ appointments: z.array(AppointmentSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listAppointments, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (q.search) {
    where += " AND (a.identifier LIKE ? OR cl.name LIKE ?)";
    const s = `%${q.search}%`;
    params.push(s, s);
  }
  if (q.status) { where += " AND a.status = ?"; params.push(q.status); }
  if (q.date) { where += " AND a.scheduled_date = ?"; params.push(q.date); }
  if (q.staff_id) { where += " AND a.staff_id = ?"; params.push(q.staff_id); }

  const total = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM appointments a LEFT JOIN clients cl ON cl.id = a.client_id ${where}`,
    params,
  );

  const appointments = await query<Record<string, unknown>>(
    `SELECT a.*, cl.name as client_name, cl.phone as client_phone,
            s.name as staff_name, s.color as staff_color
     FROM appointments a
     LEFT JOIN clients cl ON cl.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     ${where}
     ORDER BY a.scheduled_date DESC, a.start_time ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return c.json({ appointments, total: total?.count || 0 }, 200);
});

// Calendar view - appointments for a date range
const getCalendar = createRoute({
  method: "get",
  path: "/api/calendar",
  request: {
    query: z.object({ start: z.string(), end: z.string() }),
  },
  responses: {
    200: {
      description: "Calendar appointments and blocked slots",
      content: { "application/json": { schema: z.object({
        appointments: z.array(AppointmentSchema),
        blocked_slots: z.array(BlockedSlotSchema),
      }) } },
    },
  },
});

app.openapi(getCalendar, async (c) => {
  const { start, end } = c.req.valid("query");
  const appointments = await query<Record<string, unknown>>(
    `SELECT a.*, cl.name as client_name, cl.phone as client_phone,
            s.name as staff_name, s.color as staff_color
     FROM appointments a
     LEFT JOIN clients cl ON cl.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     WHERE a.scheduled_date >= ? AND a.scheduled_date <= ? AND a.status != 'cancelled'
     ORDER BY a.start_time ASC`,
    [start, end],
  );

  // Attach services to each appointment
  for (const apt of appointments) {
    const svcs = await query<Record<string, unknown>>(
      `SELECT aps.*, sv.name as service_name FROM appointment_services aps
       LEFT JOIN services sv ON sv.id = aps.service_id
       WHERE aps.appointment_id = ?`,
      [apt.id],
    );
    (apt as Record<string, unknown>).appointment_services = svcs;
  }

  const blocked = await query<Record<string, unknown>>(
    `SELECT b.*, s.name as staff_name FROM blocked_slots b
     LEFT JOIN staff s ON s.id = b.staff_id
     WHERE b.blocked_date >= ? AND b.blocked_date <= ?
     ORDER BY b.start_time ASC`,
    [start, end],
  );

  return c.json({ appointments, blocked_slots: blocked }, 200);
});

// Get single appointment
const getAppointment = createRoute({
  method: "get",
  path: "/api/appointments/{id}",
  request: { params: IdParam },
  responses: {
    200: {
      description: "Appointment detail",
      content: { "application/json": { schema: z.object({ appointment: AppointmentSchema }) } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getAppointment, async (c) => {
  const { id } = c.req.valid("param");
  const apt = await get<Record<string, unknown>>(
    `SELECT a.*, cl.name as client_name, cl.phone as client_phone,
            s.name as staff_name, s.color as staff_color
     FROM appointments a
     LEFT JOIN clients cl ON cl.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     WHERE a.id = ?`,
    [id],
  );
  if (!apt) return c.json({ error: "Not found" }, 404);

  const svcs = await query<Record<string, unknown>>(
    `SELECT aps.*, sv.name as service_name FROM appointment_services aps
     LEFT JOIN services sv ON sv.id = aps.service_id
     WHERE aps.appointment_id = ?`,
    [id],
  );
  apt.appointment_services = svcs;

  const notes = await query<Record<string, unknown>>(
    "SELECT * FROM appointment_notes WHERE appointment_id = ? ORDER BY created_at DESC",
    [id],
  );
  apt.appointment_notes = notes;

  return c.json({ appointment: apt }, 200);
});

// Create appointment
const createAppointment = createRoute({
  method: "post",
  path: "/api/appointments",
  request: {
    body: { content: { "application/json": { schema: z.object({
      client_id: z.number().int(),
      staff_id: z.number().int().nullable().optional(),
      scheduled_date: z.string(),
      start_time: z.string().optional(),
      notes: z.string().optional(),
      is_recurring: z.number().int().optional(),
      recurrence_interval: z.string().optional(),
      service_ids: z.array(z.number().int()).optional(),
      allow_conflict: z.boolean().optional().openapi({
        description: "Book even though the staff member is already busy then. Salons do deliberately overlap (a colour processes while the next client is cut), so this is allowed, but never by accident.",
      }),
    }) } } },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: z.object({ appointment: AppointmentSchema }) } } },
    400: { description: "Invalid times", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Staff member is already busy", content: { "application/json": { schema: ConflictSchema } } },
  },
});

app.openapi(createAppointment, async (c) => {
  const body = c.req.valid("json");
  const identifier = await nextIdentifier();
  const startTime = body.start_time ?? "09:00";

  // Calculate total duration and price from services
  let totalDuration = 60;
  let totalPrice = 0;
  const serviceIds = body.service_ids || [];

  if (serviceIds.length > 0) {
    const svcs = await query<{ duration: number; price: number }>(
      `SELECT duration, price FROM services WHERE id IN (${serviceIds.map(() => "?").join(",")})`,
      serviceIds,
    );
    totalDuration = svcs.reduce((sum, s) => sum + s.duration, 0);
    totalPrice = svcs.reduce((sum, s) => sum + s.price, 0);
  }

  const start = toMinutes(startTime);
  if (start === null) return c.json({ error: "Times must be HH:MM" }, 400);
  if (totalDuration <= 0) return c.json({ error: "The appointment must have a positive duration" }, 400);
  if (start + totalDuration >= 24 * 60) {
    return c.json({ error: "Appointments must start and end on the same day" }, 400);
  }
  const endTime = addMinutes(startTime, totalDuration);

  // Nothing to contend for when the booking is unassigned.
  if (body.staff_id && !body.allow_conflict) {
    const conflicts = findConflicts(startTime, endTime, await busyFor(body.staff_id, body.scheduled_date));
    if (conflicts.length > 0) {
      return c.json({ error: describeConflicts(await staffName(body.staff_id), conflicts), conflicts }, 409);
    }
  }

  const result = await run(
    `INSERT INTO appointments (identifier, client_id, staff_id, scheduled_date, start_time, end_time, total_price, notes, is_recurring, recurrence_interval)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [identifier, body.client_id, body.staff_id ?? null, body.scheduled_date,
    startTime, endTime, totalPrice,
    body.notes || "", body.is_recurring || 0, body.recurrence_interval || ""],
  );

  const aptId = result.lastInsertRowid;

  // Insert appointment services
  for (const svcId of serviceIds) {
    const svc = await get<{ duration: number; price: number }>("SELECT duration, price FROM services WHERE id = ?", [svcId]);
    if (svc) {
      await run(
        "INSERT INTO appointment_services (appointment_id, service_id, price, duration) VALUES (?, ?, ?, ?)",
        [aptId, svcId, svc.price, svc.duration],
      );
    }
  }

  const apt = await get<Record<string, unknown>>(
    `SELECT a.*, cl.name as client_name, cl.phone as client_phone,
            s.name as staff_name, s.color as staff_color
     FROM appointments a
     LEFT JOIN clients cl ON cl.id = a.client_id
     LEFT JOIN staff s ON s.id = a.staff_id
     WHERE a.id = ?`,
    [aptId],
  );

  try {
    const waSettings = await getWhatsAppSettings();
    if (waSettings.auto_send_booking_confirmation) {
      await sendAppointmentNotification(aptId, "booking_confirmation");
    }
  } catch (err) {
    console.error("Auto WhatsApp confirmation error:", err);
  }

  return c.json({ appointment: apt }, 201);
});

// Update appointment
const updateAppointment = createRoute({
  method: "put",
  path: "/api/appointments/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      client_id: z.number().int().optional(),
      staff_id: z.number().int().nullable().optional(),
      status: z.string().optional(),
      scheduled_date: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      total_price: z.number().optional(),
      notes: z.string().optional(),
      allow_conflict: z.boolean().optional().openapi({
        description: "Move the appointment even though the staff member is already busy then.",
      }),
    }) } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
    400: { description: "Invalid times", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Staff member is already busy", content: { "application/json": { schema: ConflictSchema } } },
  },
});

app.openapi(updateAppointment, async (c) => {
  const { id } = c.req.valid("param");
  const { allow_conflict, ...body } = c.req.valid("json");

  const existing = await get<{
    staff_id: number | null; scheduled_date: string; start_time: string; end_time: string; status: string;
  }>("SELECT staff_id, scheduled_date, start_time, end_time, status FROM appointments WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Where the appointment lands once this patch is applied.
  const staffId = body.staff_id !== undefined ? body.staff_id : existing.staff_id;
  const date = body.scheduled_date ?? existing.scheduled_date;
  const startTime = body.start_time ?? existing.start_time;

  // Moving an appointment keeps its length. Without this, patching start_time
  // alone left the old end_time behind and silently resized the booking.
  let endTime = body.end_time ?? existing.end_time;
  if (body.start_time !== undefined && body.start_time !== existing.start_time && body.end_time === undefined) {
    const was = toMinutes(existing.start_time);
    const wasEnd = toMinutes(existing.end_time);
    const duration = was !== null && wasEnd !== null ? Math.max(wasEnd - was, 0) : 0;
    endTime = addMinutes(startTime, duration);
    body.end_time = endTime;
  }

  const moved = staffId !== existing.staff_id || date !== existing.scheduled_date
    || startTime !== existing.start_time || endTime !== existing.end_time;
  const status = body.status ?? existing.status;
  const restored = existing.status === "cancelled" && status !== "cancelled";

  // An existing deliberate overlap must not block notes, check-in, completion,
  // or cancellation. Restoring a cancelled booking occupies its slot again.
  if (moved || restored) {
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    if (start === null || end === null) return c.json({ error: "Times must be HH:MM" }, 400);
    if (end <= start) return c.json({ error: "The appointment must end after it starts on the same day" }, 400);

    if (status !== "cancelled" && staffId && !allow_conflict) {
      const conflicts = findConflicts(startTime, endTime, await busyFor(staffId, date, Number(id)));
      if (conflicts.length > 0) {
        return c.json({ error: describeConflicts(await staffName(staffId), conflicts), conflicts }, 409);
      }
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
  }
  sets.push("updated_at = datetime('now')");
  await run(`UPDATE appointments SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);

  try {
    const waSettings = await getWhatsAppSettings();
    if (body.status === "cancelled" && existing.status !== "cancelled" && waSettings.auto_send_cancellation) {
      await sendAppointmentNotification(Number(id), "cancellation");
    } else if (moved && status !== "cancelled" && waSettings.auto_send_reschedule) {
      await sendAppointmentNotification(Number(id), "reschedule");
    }
  } catch (err) {
    console.error("Auto WhatsApp update error:", err);
  }

  return c.json({ ok: true }, 200);
});

// Delete appointment
const deleteAppointment = createRoute({
  method: "delete",
  path: "/api/appointments/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteAppointment, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM appointments WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// Appointment notes
const addAppointmentNote = createRoute({
  method: "post",
  path: "/api/appointments/{id}/notes",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({ content: z.string() }) } } },
  },
  responses: { 201: { description: "Note added", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(addAppointmentNote, async (c) => {
  const { id } = c.req.valid("param");
  const { content } = c.req.valid("json");
  await run("INSERT INTO appointment_notes (appointment_id, content) VALUES (?, ?)", [id, content]);
  return c.json({ ok: true }, 201);
});

const deleteNote = createRoute({
  method: "delete",
  path: "/api/notes/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteNote, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM appointment_notes WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Clients ───────────────────────────────────────────────────────

const listClients = createRoute({
  method: "get",
  path: "/api/clients",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated client list",
      content: { "application/json": { schema: z.object({ clients: z.array(ClientSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listClients, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (q.search) {
    where += " AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)";
    const s = `%${q.search}%`;
    params.push(s, s, s);
  }

  const total = await get<{ count: number }>(`SELECT COUNT(*) as count FROM clients c ${where}`, params);
  const clients = await query<Record<string, unknown>>(
    `SELECT c.*, (SELECT COUNT(*) FROM appointments WHERE client_id = c.id) as appointment_count
     FROM clients c ${where} ORDER BY c.name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return c.json({ clients, total: total?.count || 0 }, 200);
});

const getAllClients = createRoute({
  method: "get",
  path: "/api/clients/all",
  responses: {
    200: {
      description: "All clients for lookup",
      content: { "application/json": { schema: z.object({ clients: z.array(z.object({ id: z.number().int(), name: z.string() })) }) } },
    },
  },
});

app.openapi(getAllClients, async (c) => {
  const clients = await query<{ id: number; name: string }>("SELECT id, name FROM clients ORDER BY name ASC");
  return c.json({ clients }, 200);
});

const getClient = createRoute({
  method: "get",
  path: "/api/clients/{id}",
  request: { params: IdParam },
  responses: {
    200: {
      description: "Client detail with appointments",
      content: { "application/json": { schema: z.object({ client: ClientSchema, appointments: z.array(AppointmentSchema) }) } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getClient, async (c) => {
  const { id } = c.req.valid("param");
  const client = await get<Record<string, unknown>>("SELECT * FROM clients WHERE id = ?", [id]);
  if (!client) return c.json({ error: "Not found" }, 404);
  const appointments = await query<Record<string, unknown>>(
    `SELECT a.*, s.name as staff_name, s.color as staff_color,
            (SELECT GROUP_CONCAT(name, ', ')
             FROM (
               SELECT sv.name
               FROM appointment_services aps
               JOIN services sv ON sv.id = aps.service_id
               WHERE aps.appointment_id = a.id
               ORDER BY aps.id
             )) as service_names,
            (SELECT an.content
             FROM appointment_notes an
             WHERE an.appointment_id = a.id
             ORDER BY an.created_at DESC, an.id DESC
             LIMIT 1) as latest_note
     FROM appointments a LEFT JOIN staff s ON s.id = a.staff_id
     WHERE a.client_id = ? ORDER BY a.scheduled_date DESC LIMIT 50`,
    [id],
  );
  return c.json({ client, appointments }, 200);
});

const createClient = createRoute({
  method: "post",
  path: "/api/clients",
  request: {
    body: { content: { "application/json": { schema: z.object({
      name: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    }) } } },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ client: ClientSchema }) } } } },
});

app.openapi(createClient, async (c) => {
  const body = c.req.valid("json");
  const result = await run(
    "INSERT INTO clients (name, email, phone, notes) VALUES (?, ?, ?, ?)",
    [body.name, body.email || "", body.phone || "", body.notes || ""],
  );
  const client = await get<Record<string, unknown>>("SELECT * FROM clients WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ client }, 201);
});

const updateClient = createRoute({
  method: "put",
  path: "/api/clients/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    }) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(updateClient, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    await run(`UPDATE clients SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteClient = createRoute({
  method: "delete",
  path: "/api/clients/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteClient, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM clients WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Staff ─────────────────────────────────────────────────────────

const listStaff = createRoute({
  method: "get",
  path: "/api/staff",
  responses: {
    200: {
      description: "All staff members",
      content: { "application/json": { schema: z.object({ staff: z.array(StaffSchema) }) } },
    },
  },
});

app.openapi(listStaff, async (c) => {
  const staff = await query<Record<string, unknown>>(
    `SELECT s.*, (SELECT COUNT(*) FROM appointments WHERE staff_id = s.id) as appointment_count
     FROM staff s ORDER BY s.name ASC`,
  );
  return c.json({ staff }, 200);
});

const getAllStaff = createRoute({
  method: "get",
  path: "/api/staff/all",
  responses: {
    200: {
      description: "All staff for lookup",
      content: { "application/json": { schema: z.object({ staff: z.array(z.object({ id: z.number().int(), name: z.string(), color: z.string() })) }) } },
    },
  },
});

app.openapi(getAllStaff, async (c) => {
  const staff = await query<{ id: number; name: string; color: string }>("SELECT id, name, color FROM staff WHERE active = 1 ORDER BY name ASC");
  return c.json({ staff }, 200);
});

const createStaff = createRoute({
  method: "post",
  path: "/api/staff",
  request: {
    body: { content: { "application/json": { schema: z.object({
      name: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
      color: z.string().optional(),
    }) } } },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ staff: StaffSchema }) } } } },
});

app.openapi(createStaff, async (c) => {
  const body = c.req.valid("json");
  const result = await run(
    "INSERT INTO staff (name, email, phone, title, color) VALUES (?, ?, ?, ?, ?)",
    [body.name, body.email || "", body.phone || "", body.title || "", body.color || "#7c3aed"],
  );
  const staff = await get<Record<string, unknown>>("SELECT * FROM staff WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ staff }, 201);
});

const updateStaff = createRoute({
  method: "put",
  path: "/api/staff/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
      color: z.string().optional(),
      active: z.number().int().optional(),
    }) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(updateStaff, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
  }
  if (sets.length > 0) {
    await run(`UPDATE staff SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteStaff = createRoute({
  method: "delete",
  path: "/api/staff/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteStaff, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM staff WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Services ──────────────────────────────────────────────────────

const listServices = createRoute({
  method: "get",
  path: "/api/services",
  responses: {
    200: {
      description: "All services",
      content: { "application/json": { schema: z.object({ services: z.array(ServiceSchema) }) } },
    },
  },
});

app.openapi(listServices, async (c) => {
  const services = await query<Record<string, unknown>>("SELECT * FROM services ORDER BY category ASC, name ASC");
  return c.json({ services }, 200);
});

const createService = createRoute({
  method: "post",
  path: "/api/services",
  request: {
    body: { content: { "application/json": { schema: z.object({
      name: z.string(),
      description: z.string().optional(),
      duration: z.number().int().optional(),
      price: z.number().optional(),
      color: z.string().optional(),
      category: z.string().optional(),
    }) } } },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ service: ServiceSchema }) } } } },
});

app.openapi(createService, async (c) => {
  const body = c.req.valid("json");
  const result = await run(
    "INSERT INTO services (name, description, duration, price, color, category) VALUES (?, ?, ?, ?, ?, ?)",
    [body.name, body.description || "", body.duration || 60, body.price || 0, body.color || "#6b7280", body.category || ""],
  );
  const service = await get<Record<string, unknown>>("SELECT * FROM services WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ service }, 201);
});

const updateService = createRoute({
  method: "put",
  path: "/api/services/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      duration: z.number().int().optional(),
      price: z.number().optional(),
      color: z.string().optional(),
      category: z.string().optional(),
      active: z.number().int().optional(),
    }) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(updateService, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
  }
  if (sets.length > 0) {
    await run(`UPDATE services SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteService = createRoute({
  method: "delete",
  path: "/api/services/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteService, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM services WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Blocked Slots ─────────────────────────────────────────────────

const createBlockedSlot = createRoute({
  method: "post",
  path: "/api/blocked-slots",
  request: {
    body: { content: { "application/json": { schema: z.object({
      staff_id: z.number().int(),
      blocked_date: z.string(),
      start_time: z.string(),
      end_time: z.string(),
      reason: z.string().optional(),
      allow_conflict: z.boolean().optional().openapi({
        description: "Block the time even though it overlaps an appointment or another blocked slot.",
      }),
    }) } } },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: OkSchema } } },
    400: { description: "Invalid times", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Staff member already has an appointment or blocked time", content: { "application/json": { schema: ConflictSchema } } },
  },
});

app.openapi(createBlockedSlot, async (c) => {
  const { allow_conflict, ...body } = c.req.valid("json");
  const start = toMinutes(body.start_time);
  const end = toMinutes(body.end_time);
  if (start === null || end === null) return c.json({ error: "Times must be HH:MM" }, 400);
  if (end <= start) return c.json({ error: "Blocked time must end after it starts on the same day" }, 400);

  if (!allow_conflict) {
    const conflicts = findConflicts(
      body.start_time,
      body.end_time,
      await busyFor(body.staff_id, body.blocked_date),
    );
    if (conflicts.length > 0) {
      return c.json({ error: describeConflicts(await staffName(body.staff_id), conflicts, "block"), conflicts }, 409);
    }
  }

  await run(
    "INSERT INTO blocked_slots (staff_id, blocked_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)",
    [body.staff_id, body.blocked_date, body.start_time, body.end_time, body.reason || ""],
  );
  return c.json({ ok: true }, 201);
});

const deleteBlockedSlot = createRoute({
  method: "delete",
  path: "/api/blocked-slots/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteBlockedSlot, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM blocked_slots WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Products ──────────────────────────────────────────────────────

const listProducts = createRoute({
  method: "get",
  path: "/api/products",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      category: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated product list",
      content: { "application/json": { schema: z.object({ products: z.array(ProductSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listProducts, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (q.search) {
    where += " AND (p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)";
    const s = `%${q.search}%`;
    params.push(s, s, s);
  }
  if (q.category) { where += " AND p.category = ?"; params.push(q.category); }

  const total = await get<{ count: number }>(`SELECT COUNT(*) as count FROM products p ${where}`, params);
  const products = await query<Record<string, unknown>>(
    `SELECT * FROM products p ${where} ORDER BY p.name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return c.json({ products, total: total?.count || 0 }, 200);
});

const createProduct = createRoute({
  method: "post",
  path: "/api/products",
  request: {
    body: { content: { "application/json": { schema: z.object({
      name: z.string(),
      brand: z.string().optional(),
      category: z.string().optional(),
      sku: z.string().optional(),
      price: z.number().min(0).optional(),
      cost: z.number().min(0).optional(),
      stock: z.number().int().min(0).optional(),
      low_stock_alert: z.number().int().min(0).optional(),
    }) } } },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ product: ProductSchema }) } } } },
});

app.openapi(createProduct, async (c) => {
  const body = c.req.valid("json");
  const result = await run(
    "INSERT INTO products (name, brand, category, sku, price, cost, stock, low_stock_alert) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [body.name, body.brand || "", body.category || "", body.sku || "",
    body.price ?? 0, body.cost ?? 0, body.stock ?? 0, body.low_stock_alert ?? 5],
  );
  const product = await get<Record<string, unknown>>("SELECT * FROM products WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ product }, 201);
});

const updateProduct = createRoute({
  method: "put",
  path: "/api/products/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      name: z.string().optional(),
      brand: z.string().optional(),
      category: z.string().optional(),
      sku: z.string().optional(),
      price: z.number().min(0).optional(),
      cost: z.number().min(0).optional(),
      stock: z.number().int().min(0).optional(),
      low_stock_alert: z.number().int().min(0).optional(),
    }) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(updateProduct, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) { sets.push(`${key} = ?`); params.push(val); }
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    await run(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteProduct = createRoute({
  method: "delete",
  path: "/api/products/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteProduct, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM products WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Public Booking ──────────────────────────────────────────────────

const publicServices = createRoute({
  method: "get",
  path: "/api/public/services",
  responses: {
    200: { description: "Public Services", content: { "application/json": { schema: z.object({ services: z.array(ServiceSchema) }) } } },
  },
});

app.openapi(publicServices, async (c) => {
  const services = await query<any>("SELECT * FROM services ORDER BY category, name");
  return c.json({ services }, 200);
});

const publicAvailability = createRoute({
  method: "get",
  path: "/api/public/availability",
  request: {
    query: z.object({ date: z.string(), service_id: z.string(), staff_id: z.string().optional() })
  },
  responses: {
    200: { description: "Available Slots", content: { "application/json": { schema: z.object({ slots: z.array(z.string()) }) } } },
  },
});

app.openapi(publicAvailability, async (c) => {
  const { date, service_id, staff_id } = c.req.valid("query");
  const service = await get<any>("SELECT duration FROM services WHERE id = ?", [service_id]);
  if (!service) return c.json({ slots: [] }, 200);
  
  const duration = service.duration;
  let appointmentsQuery = `SELECT a.start_time, a.end_time, 'Appointment' as label FROM appointments a WHERE a.scheduled_date = ? AND a.status != 'cancelled'`;
  let blockedQuery = `SELECT start_time, end_time, reason as label FROM blocked_slots WHERE blocked_date = ?`;
  let params: any[] = [date];
  
  if (staff_id) {
    appointmentsQuery += ` AND a.staff_id = ?`;
    blockedQuery += ` AND staff_id = ?`;
    params.push(staff_id);
  }
  
  // Combine all busy blocks
  const [apts, blocks] = await Promise.all([
    query<any>(appointmentsQuery, params),
    query<any>(blockedQuery, params)
  ]);
  
  const busy: Busy[] = [
    ...apts.map((a: any) => ({ kind: "appointment", start_time: a.start_time, end_time: a.end_time, label: a.label })),
    ...blocks.map((b: any) => ({ kind: "blocked", start_time: b.start_time, end_time: b.end_time, label: b.label }))
  ];
  
  const slots: string[] = [];
  // Standard hours: 09:00 to 18:00
  for (let h = 9; h < 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      const startMinutes = h * 60 + m;
      const endMinutes = startMinutes + duration;
      if (endMinutes > 18 * 60) continue; // Don't extend past closing
      
      const start_time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const eh = Math.floor(endMinutes / 60);
      const em = endMinutes % 60;
      const end_time = `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
      
      const conflicts = findConflicts(start_time, end_time, busy);
      if (conflicts.length === 0) {
        slots.push(start_time);
      }
    }
  }
  
  return c.json({ slots }, 200);
});

const publicBook = createRoute({
  method: "post",
  path: "/api/public/book",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            email: z.string().email(),
            phone: z.string(),
            service_id: z.number().int(),
            date: z.string(),
            time: z.string(),
          })
        }
      }
    }
  },
  responses: {
    200: { description: "Booked", content: { "application/json": { schema: z.object({ ok: z.boolean(), appointment_id: z.number().int().optional() }) } } },
    400: { description: "Conflict" }
  },
});

app.openapi(publicBook, async (c) => {
  const body = await c.req.valid("json");
  
  // 1. Get or Create Client
  let client = await get<any>("SELECT id FROM clients WHERE email = ? OR phone = ?", [body.email, body.phone]);
  let client_id = client?.id;
  if (!client_id) {
    await run("INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)", [body.name, body.email, body.phone]);
    client = await get<any>("SELECT id FROM clients ORDER BY id DESC LIMIT 1");
    client_id = client.id;
  }
  
  // 2. Validate availability again just to be safe
  const service = await get<any>("SELECT duration, price, name FROM services WHERE id = ?", [body.service_id]);
  if (!service) return c.json({ ok: false }, 400);
  
  const startMinutes = toMinutes(body.time);
  if (startMinutes === null) return c.json({ ok: false }, 400);
  
  const endMinutes = startMinutes + service.duration;
  const eh = Math.floor(endMinutes / 60);
  const em = endMinutes % 60;
  const end_time = `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
  
  // Get any staff member (for simplicity in MVP, we just assign staff_id = 1, or leave it null if unassigned)
  const staff = await get<any>("SELECT id FROM staff LIMIT 1");
  const staff_id = staff?.id || null;
  
  const identifier = await nextIdentifier();
  
  await run(
    "INSERT INTO appointments (identifier, client_id, staff_id, scheduled_date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [identifier, client_id, staff_id, body.date, body.time, end_time, "booked"]
  );
  
  const apt = await get<any>("SELECT id FROM appointments ORDER BY id DESC LIMIT 1");
  
  await run(
    "INSERT INTO appointment_services (appointment_id, service_id, price, duration) VALUES (?, ?, ?, ?)",
    [apt.id, body.service_id, service.price, service.duration]
  );

  try {
    const waSettings = await getWhatsAppSettings();
    if (waSettings.auto_send_booking_confirmation) {
      await sendAppointmentNotification(apt.id, "booking_confirmation");
    }
  } catch (err) {
    console.error("Auto WhatsApp public booking confirmation error:", err);
  }
  
  return c.json({ ok: true, appointment_id: apt.id }, 200);
});

// ── WhatsApp Endpoints ─────────────────────────────────────────────

const getWhatsAppSettingsEndpoint = createRoute({
  method: "get",
  path: "/api/whatsapp/settings",
  responses: {
    200: {
      description: "WhatsApp settings",
      content: { "application/json": { schema: z.object({ settings: WhatsAppSettingsSchema }) } },
    },
  },
});

app.openapi(getWhatsAppSettingsEndpoint, async (c) => {
  const settings = await getWhatsAppSettings();
  return c.json({ settings }, 200);
});

const updateWhatsAppSettingsEndpoint = createRoute({
  method: "put",
  path: "/api/whatsapp/settings",
  request: {
    body: { content: { "application/json": { schema: UpdateWhatsAppSettingsSchema } } },
  },
  responses: {
    200: {
      description: "Updated WhatsApp settings",
      content: { "application/json": { schema: z.object({ settings: WhatsAppSettingsSchema }) } },
    },
  },
});

app.openapi(updateWhatsAppSettingsEndpoint, async (c) => {
  const body = c.req.valid("json");
  const settings = await updateWhatsAppSettings(body);
  return c.json({ settings }, 200);
});

const getWhatsAppLogsEndpoint = createRoute({
  method: "get",
  path: "/api/whatsapp/logs",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "WhatsApp message logs",
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(WhatsAppLogSchema),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
        },
      },
    },
  },
});

app.openapi(getWhatsAppLogsEndpoint, async (c) => {
  const { page, limit } = c.req.valid("query");
  const p = Math.max(1, parseInt(page || "1", 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit || "20", 10) || 20));
  const res = await listWhatsAppLogs(p, l);
  return c.json(res, 200);
});

const sendTestWhatsAppEndpoint = createRoute({
  method: "post",
  path: "/api/whatsapp/send-test",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            phone: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Test message result",
      content: { "application/json": { schema: z.object({ result: WhatsAppSendResultSchema }) } },
    },
  },
});

app.openapi(sendTestWhatsAppEndpoint, async (c) => {
  const { phone, message } = c.req.valid("json");
  const result = await sendWhatsAppMessage({
    recipientPhone: phone,
    recipientName: "Test Recipient",
    messageType: "test",
    content: message,
  });
  return c.json({ result }, 200);
});

const sendAppointmentWhatsAppEndpoint = createRoute({
  method: "post",
  path: "/api/whatsapp/send-appointment",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            appointment_id: z.number().int(),
            type: z.enum(["booking_confirmation", "reminder", "reschedule", "cancellation"]),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Appointment message result",
      content: { "application/json": { schema: z.object({ result: WhatsAppSendResultSchema.nullable() }) } },
    },
    404: {
      description: "Appointment not found or client has no phone number",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

app.openapi(sendAppointmentWhatsAppEndpoint, async (c) => {
  const { appointment_id, type } = c.req.valid("json");
  const result = await sendAppointmentNotification(appointment_id, type);
  if (!result) {
    return c.json({ error: "Appointment not found or client has no phone number" }, 404);
  }
  return c.json({ result }, 200);
});

const sendReceiptWhatsAppEndpoint = createRoute({
  method: "post",
  path: "/api/whatsapp/send-receipt",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            invoice_id: z.number().int(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Receipt message result",
      content: { "application/json": { schema: z.object({ result: WhatsAppSendResultSchema.nullable() }) } },
    },
    404: {
      description: "Invoice not found or client has no phone number",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

app.openapi(sendReceiptWhatsAppEndpoint, async (c) => {
  const { invoice_id } = c.req.valid("json");
  const result = await sendInvoiceReceiptNotification(invoice_id);
  if (!result) {
    return c.json({ error: "Invoice not found or client has no phone number" }, 404);
  }
  return c.json({ result }, 200);
});

// ── Growth Insights & Capacity Optimization ──────────────────────────

const getGrowthInsightsEndpoint = createRoute({
  method: "get",
  path: "/api/growth/insights",
  responses: {
    200: {
      description: "Growth insights, inactive client recovery, slow hours, and stylist leaderboard",
      content: { "application/json": { schema: GrowthInsightsSchema } },
    },
  },
});

app.openapi(getGrowthInsightsEndpoint, async (c) => {
  const allClients = await query<any>(
    "SELECT id, name, phone, email, loyalty_points, total_spent, total_visits, last_visit_date, created_at FROM clients ORDER BY COALESCE(last_visit_date, created_at) ASC"
  );
  
  const now = new Date();
  const inactive_clients = allClients
    .filter((client) => {
      const lastDate = client.last_visit_date ? new Date(client.last_visit_date) : new Date(client.created_at);
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 45 || client.total_visits === 0;
    })
    .slice(0, 15)
    .map((client) => {
      const lastDate = client.last_visit_date ? new Date(client.last_visit_date) : new Date(client.created_at);
      const days = Math.max(1, Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
      const discount = "₹200 OFF on your next hair & spa service";
      const message = `Hi ${client.name}! We miss you at OpenSalon. It has been ${days} days since your last visit. Treat yourself to ₹200 OFF your next service with code COMEBACK200! Reply to book or reserve online.`;
      return {
        id: client.id,
        name: client.name,
        phone: client.phone || "",
        days_since_last_visit: days,
        last_visit_date: client.last_visit_date || client.created_at?.split("T")[0] || "N/A",
        total_spent: client.total_spent || 0,
        total_visits: client.total_visits || 0,
        suggested_discount: discount,
        suggested_message: message,
        whatsapp_url: createWaMeUrl(client.phone || "", message),
      };
    });

  const slow_hours = [
    {
      day_name: "Monday",
      slot_label: "Monday 1:00 PM - 5:00 PM",
      historical_bookings: 2,
      recommended_deal: "50% OFF Hair Wash & Styling",
      promo_code: "MONDAY50",
      estimated_lift: "+4 to 6 bookings/day",
    },
    {
      day_name: "Tuesday",
      slot_label: "Tuesday 10:00 AM - 2:00 PM",
      historical_bookings: 3,
      recommended_deal: "Free Express Manicure with Color",
      promo_code: "TUESDEAL",
      estimated_lift: "+3 to 5 bookings/day",
    },
    {
      day_name: "Wednesday",
      slot_label: "Wednesday 2:00 PM - 6:00 PM",
      historical_bookings: 4,
      recommended_deal: "Flat ₹150 OFF on orders > ₹500",
      promo_code: "MIDWEEK",
      estimated_lift: "+4 bookings/day",
    },
    {
      day_name: "Thursday",
      slot_label: "Thursday 11:00 AM - 3:00 PM",
      historical_bookings: 5,
      recommended_deal: "20% OFF Facial & Glow Treatments",
      promo_code: "GLOW20",
      estimated_lift: "+3 bookings/day",
    },
  ];

  const stylistRows = await query<any>(`
    SELECT 
      s.id as staff_id, s.name as staff_name, s.title as staff_title, s.color as staff_color,
      COUNT(DISTINCT a.id) as completed_appointments,
      COALESCE(SUM(CASE WHEN sc.item_type = 'service' THEN sc.item_price ELSE 0 END), 0) as service_revenue,
      COALESCE(SUM(CASE WHEN sc.item_type = 'product' THEN sc.item_price ELSE 0 END), 0) as product_revenue,
      COALESCE(SUM(sc.item_price), 0) as total_sales,
      COALESCE(SUM(sc.commission_amount), 0) as commission_earned
    FROM staff s
    LEFT JOIN appointments a ON a.staff_id = s.id AND a.status = 'completed'
    LEFT JOIN staff_commissions sc ON sc.staff_id = s.id
    WHERE s.active = 1
    GROUP BY s.id
    ORDER BY total_sales DESC, completed_appointments DESC
  `);

  const stylist_leaderboard = stylistRows.map((s, idx) => ({
    staff_id: s.staff_id,
    staff_name: s.staff_name,
    staff_title: s.staff_title || "Stylist",
    staff_color: s.staff_color || "#7c3aed",
    completed_appointments: s.completed_appointments || 0,
    service_revenue: s.service_revenue || 0,
    product_revenue: s.product_revenue || 0,
    total_sales: s.total_sales || 0,
    commission_earned: s.commission_earned || 0,
    rank: idx + 1,
  }));

  const membersCount = await get<{ count: number }>("SELECT COUNT(*) as count FROM client_memberships WHERE status = 'active'");
  const loyaltySum = await get<{ total: number }>("SELECT COALESCE(SUM(loyalty_points), 0) as total FROM clients");
  const repeatStats = await get<{ total: number; repeats: number }>(
    "SELECT COUNT(*) as total, SUM(CASE WHEN total_visits > 1 THEN 1 ELSE 0 END) as repeats FROM clients"
  );
  const invoiceAvg = await get<{ avg_ticket: number }>("SELECT COALESCE(AVG(total), 0) as avg_ticket FROM invoices WHERE status = 'paid'");

  const totalClients = repeatStats?.total || 1;
  const repeatClients = repeatStats?.repeats || 0;
  const repeat_client_rate = Math.round((repeatClients / totalClients) * 100);

  return c.json({
    inactive_clients,
    slow_hours,
    stylist_leaderboard,
    total_members: membersCount?.count || 0,
    loyalty_points_in_circulation: loyaltySum?.total || 0,
    repeat_client_rate,
    avg_ticket_size: Math.round(invoiceAvg?.avg_ticket || 0),
  }, 200);
});

// ── Memberships & Packages ───────────────────────────────────────────

const listMemberships = createRoute({
  method: "get",
  path: "/api/memberships",
  responses: {
    200: {
      description: "List all membership packages",
      content: { "application/json": { schema: z.object({ memberships: z.array(MembershipSchema) }) } },
    },
  },
});

app.openapi(listMemberships, async (c) => {
  const rows = await query<any>("SELECT * FROM memberships ORDER BY id ASC");
  return c.json({ memberships: rows }, 200);
});

const createMembership = createRoute({
  method: "post",
  path: "/api/memberships",
  request: {
    body: {
      content: {
        "application/json": {
          schema: MembershipSchema.omit({ id: true, created_at: true }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created membership",
      content: { "application/json": { schema: z.object({ membership: MembershipSchema }) } },
    },
  },
});

app.openapi(createMembership, async (c) => {
  const data = c.req.valid("json");
  const result = await run(
    `INSERT INTO memberships (
      name, description, price, duration_days, service_discount_percent,
      product_discount_percent, included_services_count, bonus_loyalty_points, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description || "",
      String(data.price),
      String(data.duration_days),
      String(data.service_discount_percent),
      String(data.product_discount_percent),
      String(data.included_services_count),
      String(data.bonus_loyalty_points),
      String(data.active),
    ]
  );
  const membership = await get<any>("SELECT * FROM memberships WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ membership }, 201);
});

const updateMembership = createRoute({
  method: "put",
  path: "/api/memberships/{id}",
  request: {
    params: IdParam,
    body: {
      content: {
        "application/json": {
          schema: MembershipSchema.omit({ id: true, created_at: true }).partial(),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateMembership, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      params.push(String(val));
    }
  }
  if (sets.length > 0) {
    await run(`UPDATE memberships SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteMembership = createRoute({
  method: "delete",
  path: "/api/memberships/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteMembership, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM memberships WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

const listClientMemberships = createRoute({
  method: "get",
  path: "/api/client-memberships",
  responses: {
    200: {
      description: "List enrolled client memberships",
      content: { "application/json": { schema: z.object({ client_memberships: z.array(ClientMembershipSchema) }) } },
    },
  },
});

app.openapi(listClientMemberships, async (c) => {
  const rows = await query<any>(`
    SELECT cm.*, c.name as client_name, c.phone as client_phone, 
           m.name as membership_name, m.service_discount_percent, m.product_discount_percent
    FROM client_memberships cm
    JOIN clients c ON cm.client_id = c.id
    JOIN memberships m ON cm.membership_id = m.id
    ORDER BY cm.created_at DESC
  `);
  return c.json({ client_memberships: rows }, 200);
});

const createClientMembership = createRoute({
  method: "post",
  path: "/api/client-memberships",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            client_id: z.number().int(),
            membership_id: z.number().int(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Client membership assigned",
      content: { "application/json": { schema: z.object({ client_membership: ClientMembershipSchema }) } },
    },
  },
});

app.openapi(createClientMembership, async (c) => {
  const { client_id, membership_id } = c.req.valid("json");
  const membership = await get<any>("SELECT * FROM memberships WHERE id = ?", [String(membership_id)]);
  if (!membership) return c.json({ error: "Membership package not found" } as any, 404);

  const startDate = new Date().toISOString().split("T")[0];
  const endDateObj = new Date();
  endDateObj.setDate(endDateObj.getDate() + (membership.duration_days || 365));
  const endDate = endDateObj.toISOString().split("T")[0];

  const result = await run(
    `INSERT INTO client_memberships (client_id, membership_id, start_date, end_date, services_total, services_used, status)
     VALUES (?, ?, ?, ?, ?, 0, 'active')`,
    [
      String(client_id),
      String(membership_id),
      startDate,
      endDate,
      String(membership.included_services_count || 12),
    ]
  );
  const cmId = result.lastInsertRowid;

  // Award bonus loyalty points if plan includes them
  if (membership.bonus_loyalty_points > 0) {
    await run(
      "INSERT INTO loyalty_transactions (client_id, points, transaction_type, reference_id, notes) VALUES (?, ?, 'membership_bonus', ?, ?)",
      [String(client_id), String(membership.bonus_loyalty_points), String(cmId), `Bonus points for purchasing ${membership.name}`]
    );
    await run(
      "UPDATE clients SET loyalty_points = COALESCE(loyalty_points, 0) + ? WHERE id = ?",
      [String(membership.bonus_loyalty_points), String(client_id)]
    );
  }

  const clientMembership = await get<any>(`
    SELECT cm.*, c.name as client_name, c.phone as client_phone, 
           m.name as membership_name, m.service_discount_percent, m.product_discount_percent
    FROM client_memberships cm
    JOIN clients c ON cm.client_id = c.id
    JOIN memberships m ON cm.membership_id = m.id
    WHERE cm.id = ?
  `, [cmId]);

  return c.json({ client_membership: clientMembership }, 201);
});

// ── Loyalty Program ──────────────────────────────────────────────────

const listLoyaltyTransactions = createRoute({
  method: "get",
  path: "/api/loyalty/transactions",
  responses: {
    200: {
      description: "List recent loyalty transactions",
      content: { "application/json": { schema: z.object({ transactions: z.array(LoyaltyTransactionSchema) }) } },
    },
  },
});

app.openapi(listLoyaltyTransactions, async (c) => {
  const rows = await query<any>(`
    SELECT lt.*, c.name as client_name
    FROM loyalty_transactions lt
    JOIN clients c ON lt.client_id = c.id
    ORDER BY lt.created_at DESC
    LIMIT 100
  `);
  return c.json({ transactions: rows }, 200);
});

const adjustLoyaltyPoints = createRoute({
  method: "post",
  path: "/api/loyalty/adjust",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            client_id: z.number().int(),
            points: z.number().int(),
            notes: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Points adjusted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(adjustLoyaltyPoints, async (c) => {
  const { client_id, points, notes } = c.req.valid("json");
  await run(
    "INSERT INTO loyalty_transactions (client_id, points, transaction_type, notes) VALUES (?, ?, 'adjustment', ?)",
    [String(client_id), String(points), notes || "Manual points adjustment"]
  );
  await run(
    "UPDATE clients SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) + ?) WHERE id = ?",
    [String(points), String(client_id)]
  );
  return c.json({ ok: true }, 200);
});

// ── Coupons & Offers ─────────────────────────────────────────────────

const listCoupons = createRoute({
  method: "get",
  path: "/api/coupons",
  responses: {
    200: {
      description: "List coupons",
      content: { "application/json": { schema: z.object({ coupons: z.array(CouponSchema) }) } },
    },
  },
});

app.openapi(listCoupons, async (c) => {
  const rows = await query<any>("SELECT * FROM coupons ORDER BY created_at DESC");
  return c.json({ coupons: rows }, 200);
});

const createCoupon = createRoute({
  method: "post",
  path: "/api/coupons",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CouponSchema.omit({ id: true, created_at: true, times_used: true }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Coupon created",
      content: { "application/json": { schema: z.object({ coupon: CouponSchema }) } },
    },
  },
});

app.openapi(createCoupon, async (c) => {
  const data = c.req.valid("json");
  const result = await run(
    `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, valid_until, is_active, usage_limit, times_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      data.code.toUpperCase().trim(),
      data.description || "",
      data.discount_type,
      String(data.discount_value),
      String(data.min_order_amount || 0),
      data.valid_until || "",
      String(data.is_active ?? 1),
      String(data.usage_limit ?? 100),
    ]
  );
  const coupon = await get<any>("SELECT * FROM coupons WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ coupon }, 201);
});

const updateCoupon = createRoute({
  method: "put",
  path: "/api/coupons/{id}",
  request: {
    params: IdParam,
    body: {
      content: {
        "application/json": {
          schema: CouponSchema.omit({ id: true, created_at: true }).partial(),
        },
      },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateCoupon, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      params.push(key === "code" ? String(val).toUpperCase().trim() : String(val));
    }
  }
  if (sets.length > 0) {
    await run(`UPDATE coupons SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteCoupon = createRoute({
  method: "delete",
  path: "/api/coupons/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteCoupon, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM coupons WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

const validateCoupon = createRoute({
  method: "post",
  path: "/api/coupons/validate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.string(),
            order_amount: z.number(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Validation result",
      content: {
        "application/json": {
          schema: z.object({
            valid: z.boolean(),
            discount: z.number().optional(),
            message: z.string().optional(),
            coupon: CouponSchema.optional(),
          }),
        },
      },
    },
  },
});

app.openapi(validateCoupon, async (c) => {
  const { code, order_amount } = c.req.valid("json");
  const coupon = await get<any>("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE", [code.trim()]);
  
  if (!coupon) {
    return c.json({ valid: false, message: "Invalid coupon code" }, 200);
  }
  if (coupon.is_active === 0) {
    return c.json({ valid: false, message: "This coupon is currently inactive" }, 200);
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    return c.json({ valid: false, message: "This coupon has expired" }, 200);
  }
  if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
    return c.json({ valid: false, message: "Coupon usage limit reached" }, 200);
  }
  if (coupon.min_order_amount && order_amount < coupon.min_order_amount) {
    return c.json({ valid: false, message: `Minimum order amount of ₹${coupon.min_order_amount} required` }, 200);
  }

  let discount = 0;
  if (coupon.discount_type === "percent") {
    discount = Math.round(((order_amount * coupon.discount_value) / 100) * 100) / 100;
  } else {
    discount = Math.min(order_amount, coupon.discount_value);
  }

  return c.json({ valid: true, discount, coupon }, 200);
});

// ── Staff Commissions ────────────────────────────────────────────────

const listStaffCommissions = createRoute({
  method: "get",
  path: "/api/staff-commissions",
  request: {
    query: z.object({
      staff_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List staff commissions",
      content: { "application/json": { schema: z.object({ commissions: z.array(StaffCommissionSchema) }) } },
    },
  },
});

app.openapi(listStaffCommissions, async (c) => {
  const { staff_id } = c.req.valid("query");
  let q = `
    SELECT sc.*, s.name as staff_name
    FROM staff_commissions sc
    JOIN staff s ON sc.staff_id = s.id
  `;
  const params: unknown[] = [];
  if (staff_id) {
    q += " WHERE sc.staff_id = ?";
    params.push(staff_id);
  }
  q += " ORDER BY sc.created_at DESC LIMIT 100";
  const rows = await query<any>(q, params);
  return c.json({ commissions: rows }, 200);
});

export default app;


