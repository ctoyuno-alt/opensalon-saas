export type View = "dashboard" | "calendar" | "appointments" | "clients" | "staff" | "services" | "products" | "pos" | "expenses" | "whatsapp" | "sms" | "growth" | "memberships";

export interface User {
  id: number;
  username: string;
  role: string;
  staff_id: number | null;
}

export type AppointmentStatus = "booked" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: number;
  identifier: string;
  client_id: number;
  staff_id: number | null;
  status: AppointmentStatus;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  notes: string;
  is_recurring: number;
  recurrence_interval: string;
  client_name?: string;
  client_phone?: string;
  staff_name?: string | null;
  staff_color?: string | null;
  service_names?: string | null;
  latest_note?: string | null;
  appointment_services?: AppointmentService[];
  appointment_notes?: AppointmentNote[];
  created_at: string;
  updated_at: string;
}

export interface AppointmentService {
  id: number;
  appointment_id: number;
  service_id: number;
  service_name?: string;
  price: number;
  duration: number;
}

export interface AppointmentNote {
  id: number;
  appointment_id: number;
  content: string;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
  appointment_count?: number;
  loyalty_points?: number;
  total_spent?: number;
  total_visits?: number;
  last_visit_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: number;
  name: string;
  email: string;
  phone: string;
  title: string;
  color: string;
  base_salary?: number;
  commission_percent?: number;
  active: number;
  appointment_count?: number;
  created_at: string;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  duration: number;
  price: number;
  color: string;
  category: string;
  active: number;
  created_at: string;
}

export interface BlockedSlot {
  id: number;
  staff_id: number;
  staff_name?: string;
  blocked_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  low_stock_alert: number;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  appointments: number;
  clients: number;
  staff: number;
  services: number;
  products: number;
  today_appointments: number;
  upcoming_appointments: number;
  completed_appointments: number;
  revenue: number;
  low_stock_products: number;
}

export interface PaginatedState {
  page: number;
  limit: number;
  total: number;
}

export interface ClientLookup {
  id: number;
  name: string;
}

export interface StaffLookup {
  id: number;
  name: string;
  color: string;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  item_type: "service" | "product";
  item_id: number | null;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: number;
  identifier: string;
  appointment_id: number | null;
  client_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  split_cash?: number;
  split_upi?: number;
  split_card?: number;
  coupon_code?: string;
  coupon_discount?: number;
  loyalty_points_redeemed?: number;
  loyalty_discount?: number;
  membership_discount?: number;
  membership_services_deducted?: number;
  status: "pending" | "paid" | "cancelled";
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  client_name?: string;
  client_phone?: string;
}


export interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSettings {
  id: number;
  provider: "meta" | "twilio" | "simulation";
  phone_number_id: string;
  access_token: string;
  business_account_id: string;
  sender_phone_number: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  twilio_content_sid?: string;
  salon_name: string;
  auto_send_booking_confirmation: number;
  auto_send_reschedule: number;
  auto_send_cancellation: number;
  auto_send_receipt: number;
  template_booking_confirmation: string;
  template_reminder: string;
  template_reschedule: string;
  template_cancellation: string;
  template_receipt: string;
  updated_at?: string;
}

export interface WhatsAppLog {
  id: number;
  recipient_phone: string;
  recipient_name: string;
  message_type: string;
  content: string;
  status: "sent" | "delivered" | "failed" | "simulated";
  provider: string;
  external_id: string;
  error_message: string;
  reference_id: number | null;
  created_at: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  status: "sent" | "simulated" | "failed";
  messageId?: string;
  error?: string;
  waMeUrl: string;
  content: string;
  recipientPhone: string;
}

export interface SmsSettings {
  id: number;
  provider: "simulation" | "twilio" | "fast2sms";
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  fast2sms_api_key: string;
  fast2sms_route: string;
  sender_id: string;
  salon_name: string;
  auto_send_booking_confirmation: number;
  auto_send_reschedule: number;
  auto_send_cancellation: number;
  auto_send_receipt: number;
  template_booking_confirmation: string;
  template_reminder: string;
  template_reschedule: string;
  template_cancellation: string;
  template_receipt: string;
  updated_at?: string;
}

export interface SmsLog {
  id: number;
  recipient_phone: string;
  recipient_name: string;
  message_type: string;
  content: string;
  status: "sent" | "delivered" | "failed" | "simulated";
  provider: string;
  external_id: string;
  error_message: string;
  reference_id: number | null;
  created_at: string;
}

export interface SendSmsResult {
  success: boolean;
  status: "sent" | "simulated" | "failed";
  messageId?: string;
  error?: string;
  content: string;
  recipientPhone: string;
  segments?: number;
}

export interface Membership {
  id: number;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  service_discount_percent: number;
  product_discount_percent: number;
  included_services_count: number;
  bonus_loyalty_points: number;
  active: number;
  created_at?: string;
}

export interface ClientMembership {
  id: number;
  client_id: number;
  membership_id: number;
  membership_name?: string;
  client_name?: string;
  client_phone?: string;
  start_date: string;
  end_date: string;
  services_total: number;
  services_used: number;
  status: "active" | "expired" | "cancelled";
  price?: number;
  service_discount_percent?: number;
  product_discount_percent?: number;
  created_at?: string;
}

export interface LoyaltyTransaction {
  id: number;
  client_id: number;
  client_name?: string;
  points: number;
  transaction_type: "earned_invoice" | "redeemed_pos" | "membership_bonus" | "birthday_reward" | "adjustment";
  reference_id: number | null;
  notes: string;
  created_at?: string;
}

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  min_order_amount: number;
  valid_until: string;
  is_active: number;
  usage_limit: number;
  times_used: number;
  created_at?: string;
}

export interface StaffCommission {
  id: number;
  staff_id: number;
  staff_name?: string;
  invoice_id: number;
  item_name: string;
  item_type: "service" | "product";
  item_price: number;
  commission_percent: number;
  commission_amount: number;
  created_at?: string;
}

export type AttendanceStatus = "present" | "late" | "half_day" | "absent" | "on_leave" | "not_marked";

export interface StaffAttendanceRecord {
  id?: number;
  staff_id: number;
  staff_name: string;
  staff_title?: string;
  staff_color?: string;
  work_date: string;
  status: AttendanceStatus;
  clock_in: string;
  clock_out: string;
  total_hours: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayAttendanceSummary {
  date: string;
  total_staff: number;
  present_count: number;
  late_count: number;
  half_day_count: number;
  absent_count: number;
  on_leave_count: number;
  not_marked_count: number;
  records: StaffAttendanceRecord[];
}

export interface StaffPortalData {
  staff: Staff;
  todayAttendance: StaffAttendanceRecord | null;
  todayAppointments: Appointment[];
  monthCommissions: {
    total_commission: number;
    total_service_sales: number;
    total_product_sales: number;
    total_items: number;
  };
  commissionsList: StaffCommission[];
  monthAttendanceSummary: {
    days_present: number;
    total_hours: number;
  };
}

export interface InactiveClientAlert {
  id: number;
  name: string;
  phone: string;
  days_since_last_visit: number;
  last_visit_date: string;
  total_spent: number;
  total_visits: number;
  suggested_discount: string;
  suggested_message: string;
  whatsapp_url: string;
}

export interface SlowHourOpportunity {
  day_name: string;
  slot_label: string;
  historical_bookings: number;
  recommended_deal: string;
  promo_code: string;
  estimated_lift: string;
}

export interface StylistLeaderboard {
  staff_id: number;
  staff_name: string;
  staff_title: string;
  staff_color: string;
  completed_appointments: number;
  service_revenue: number;
  product_revenue: number;
  total_sales: number;
  commission_earned: number;
  rank: number;
}

export interface GrowthInsights {
  inactive_clients: InactiveClientAlert[];
  slow_hours: SlowHourOpportunity[];
  stylist_leaderboard: StylistLeaderboard[];
  total_members: number;
  loyalty_points_in_circulation: number;
  repeat_client_rate: number;
  avg_ticket_size: number;
}

