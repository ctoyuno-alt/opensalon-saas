-- Users (Auth & Roles)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Clients (customers who book appointments)
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  total_spent REAL NOT NULL DEFAULT 0,
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_visit_date TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Staff members (stylists, therapists, technicians, etc.)
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  title TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#7c3aed',
  base_salary REAL NOT NULL DEFAULT 0,
  commission_percent REAL NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Services offered (haircut, massage, manicure, etc.)
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration INTEGER NOT NULL DEFAULT 60,
  price REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6b7280',
  category TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Appointments (bookings)
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  scheduled_date TEXT NOT NULL DEFAULT (date('now')),
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '10:00',
  total_price REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_interval TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Services included in an appointment (many-to-many)
CREATE TABLE IF NOT EXISTS appointment_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price REAL NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 60
);

-- Appointment notes / activity log
CREATE TABLE IF NOT EXISTS appointment_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Blocked time slots (breaks, days off, lunch, etc.)
CREATE TABLE IF NOT EXISTS blocked_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  blocked_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Products (inventory: shampoo, creams, tools, etc.)
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT DEFAULT '',
  category TEXT DEFAULT '',
  sku TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 5,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoices / POS Billing
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash', -- 'cash', 'card', 'upi', 'split'
  split_cash REAL NOT NULL DEFAULT 0,
  split_upi REAL NOT NULL DEFAULT 0,
  split_card REAL NOT NULL DEFAULT 0,
  coupon_code TEXT DEFAULT '',
  coupon_discount REAL NOT NULL DEFAULT 0,
  loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0,
  loyalty_discount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoice Line Items (services + products)
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'service' or 'product'
  item_id INTEGER, -- service_id or product_id
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

-- Auto-incrementing identifier counter
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Seed rows (the _meta counter rows and the example staff / services /
-- clients / products) moved into the app: see src/server/seed.ts. Clawnify
-- applies this file as DDL only, so any INSERT here fails the whole deploy.

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointment_services_apt ON appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_notes_apt ON appointment_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_staff ON blocked_slots(staff_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_date ON blocked_slots(blocked_date);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  expense_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- WhatsApp Settings & Configuration
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'meta', -- 'meta', 'twilio', 'simulation'
  phone_number_id TEXT DEFAULT '',
  access_token TEXT DEFAULT '',
  business_account_id TEXT DEFAULT '',
  sender_phone_number TEXT DEFAULT '',
  twilio_account_sid TEXT DEFAULT '',
  twilio_auth_token TEXT DEFAULT '',
  twilio_phone_number TEXT DEFAULT '+14155238886',
  twilio_content_sid TEXT DEFAULT '',
  salon_name TEXT DEFAULT 'OpenSalon',
  auto_send_booking_confirmation INTEGER NOT NULL DEFAULT 1,
  auto_send_reschedule INTEGER NOT NULL DEFAULT 1,
  auto_send_cancellation INTEGER NOT NULL DEFAULT 1,
  auto_send_receipt INTEGER NOT NULL DEFAULT 1,
  template_booking_confirmation TEXT DEFAULT 'Hi {{client_name}}, your appointment at {{salon_name}} for {{service_name}} on {{date}} at {{time}} with {{staff_name}} is confirmed! Total: ${{total}}. See you soon!',
  template_reminder TEXT DEFAULT 'Friendly reminder from {{salon_name}}: You have an upcoming appointment for {{service_name}} on {{date}} at {{time}} with {{staff_name}}. Reply YES to confirm.',
  template_reschedule TEXT DEFAULT 'Hi {{client_name}}, your appointment at {{salon_name}} has been rescheduled to {{date}} at {{time}} with {{staff_name}}.',
  template_cancellation TEXT DEFAULT 'Hi {{client_name}}, your appointment at {{salon_name}} for {{date}} at {{time}} has been cancelled. Please reach out to reschedule!',
  template_receipt TEXT DEFAULT 'Thank you for visiting {{salon_name}}, {{client_name}}! Here is your receipt for Invoice #{{invoice_id}}: Total paid ${{total}} via {{payment_method}}.',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- WhatsApp Message Logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT DEFAULT '',
  message_type TEXT NOT NULL, -- 'booking_confirmation', 'reminder', 'reschedule', 'cancellation', 'receipt', 'test', 'custom'
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'simulated'
  provider TEXT NOT NULL DEFAULT 'meta',
  external_id TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  reference_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created ON whatsapp_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_recipient ON whatsapp_logs(recipient_phone);

-- ── Memberships & Packages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 365,
  service_discount_percent REAL NOT NULL DEFAULT 10,
  product_discount_percent REAL NOT NULL DEFAULT 15,
  included_services_count INTEGER NOT NULL DEFAULT 12,
  bonus_loyalty_points INTEGER NOT NULL DEFAULT 500,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  membership_id INTEGER NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  services_total INTEGER NOT NULL DEFAULT 12,
  services_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_client_memberships_client ON client_memberships(client_id);

-- ── Loyalty Program ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earned_invoice', 'redeemed_pos', 'membership_bonus', 'birthday_reward', 'adjustment'
  reference_id INTEGER,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_client ON loyalty_transactions(client_id);

-- ── Coupons & Offers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'flat', -- 'flat', 'percent'
  discount_value REAL NOT NULL,
  min_order_amount REAL NOT NULL DEFAULT 0,
  valid_until TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  usage_limit INTEGER DEFAULT 100,
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Staff Commissions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'service', -- 'service' or 'product'
  item_price REAL NOT NULL,
  commission_percent REAL NOT NULL,
  commission_amount REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_staff_commissions_staff ON staff_commissions(staff_id);

