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
  payment_method TEXT DEFAULT 'cash', -- 'cash', 'card', 'upi'
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
