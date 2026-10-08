import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type {
  User, Appointment, Client, Staff, Service, Product, BlockedSlot, Stats, PaginatedState,
  ClientLookup, StaffLookup, Invoice, Expense, WhatsAppSettings, WhatsAppLog, SendWhatsAppResult,
  SmsSettings, SmsLog, SendSmsResult,
} from "./types";

export interface AppContextValue {
  navigate: (to: string) => void;
  isAgent: boolean;
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  stats: Stats;

  // Appointments
  appointments: Appointment[];
  appointmentsPag: PaginatedState;
  setAppointmentsPage: (page: number) => void;
  appointmentsSearch: string;
  setAppointmentsSearch: (s: string) => void;
  appointmentsStatusFilter: string;
  setAppointmentsStatusFilter: (s: string) => void;
  addAppointment: (data: {
    client_id: number;
    staff_id?: number | null;
    scheduled_date: string;
    start_time?: string;
    notes?: string;
    is_recurring?: number;
    recurrence_interval?: string;
    service_ids?: number[];
    allow_conflict?: boolean;
  }) => Promise<void>;
  updateAppointment: (id: number, data: Partial<Appointment> & { allow_conflict?: boolean }) => Promise<void>;
  deleteAppointment: (id: number) => Promise<void>;

  // Appointment detail
  selectedAppointment: Appointment | null;
  selectAppointment: (id: number | null) => Promise<void>;
  addAppointmentNote: (aptId: number, content: string) => Promise<void>;
  deleteAppointmentNote: (noteId: number) => Promise<void>;

  // Calendar
  calendarAppointments: Appointment[];
  calendarBlocked: BlockedSlot[];
  calendarDate: string;
  setCalendarDate: (date: string) => void;
  addBlockedSlot: (data: { staff_id: number; blocked_date: string; start_time: string; end_time: string; reason?: string; allow_conflict?: boolean }) => Promise<void>;
  deleteBlockedSlot: (id: number) => Promise<void>;

  // Clients
  clients: Client[];
  clientsPag: PaginatedState;
  setClientsPage: (page: number) => void;
  clientsSearch: string;
  setClientsSearch: (s: string) => void;
  addClient: (data: Partial<Client>) => Promise<void>;
  updateClient: (id: number, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: number) => Promise<void>;
  selectedClient: Client | null;
  selectedClientAppointments: Appointment[];
  selectClient: (id: number | null) => Promise<void>;

  // Staff
  staffMembers: Staff[];
  addStaff: (data: Partial<Staff>) => Promise<void>;
  updateStaff: (id: number, data: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: number) => Promise<void>;

  // Services
  services: Service[];
  addService: (data: Partial<Service>) => Promise<void>;
  updateService: (id: number, data: Partial<Service>) => Promise<void>;
  deleteService: (id: number) => Promise<void>;

  // Products
  products: Product[];
  productsPag: PaginatedState;
  setProductsPage: (page: number) => void;
  productsSearch: string;
  setProductsSearch: (s: string) => void;
  addProduct: (data: Partial<Product>) => Promise<void>;
  updateProduct: (id: number, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;

  // Invoices
  invoices: Invoice[];
  invoicesPag: PaginatedState;
  setInvoicesPage: (page: number) => void;
  invoicesStatusFilter: string;
  setInvoicesStatusFilter: (s: string) => void;
  createInvoice: (data: Partial<Invoice>) => Promise<Invoice>;
  updateInvoiceStatus: (id: number, status: string, payment_method?: string) => Promise<void>;
  selectedInvoice: Invoice | null;
  selectInvoice: (id: number | null) => Promise<void>;

  // Expenses
  expenses: Expense[];
  expensesPag: PaginatedState;
  setExpensesPage: (page: number) => void;
  createExpense: (data: Partial<Expense>) => Promise<Expense>;
  deleteExpense: (id: number) => Promise<void>;

  // WhatsApp
  whatsappSettings: WhatsAppSettings | null;
  whatsappLogs: WhatsAppLog[];
  whatsappLogsPag: PaginatedState;
  setWhatsAppLogsPage: (page: number) => void;
  loadWhatsAppSettings: () => Promise<void>;
  updateWhatsAppSettings: (data: Partial<WhatsAppSettings>) => Promise<void>;
  loadWhatsAppLogs: (page?: number) => Promise<void>;
  sendTestWhatsApp: (phone: string, message: string) => Promise<SendWhatsAppResult>;
  sendAppointmentWhatsApp: (appointmentId: number, type: "booking_confirmation" | "reminder" | "reschedule" | "cancellation") => Promise<SendWhatsAppResult>;
  sendReceiptWhatsApp: (invoiceId: number) => Promise<SendWhatsAppResult>;

  // SMS Gateway
  smsSettings: SmsSettings | null;
  smsLogs: SmsLog[];
  smsLogsPag: PaginatedState;
  setSmsLogsPage: (page: number) => void;
  loadSmsSettings: () => Promise<void>;
  updateSmsSettings: (data: Partial<SmsSettings>) => Promise<void>;
  loadSmsLogs: (page?: number) => Promise<void>;
  sendTestSms: (phone: string, message: string) => Promise<SendSmsResult>;
  sendAppointmentSms: (appointmentId: number, type: "booking_confirmation" | "reminder" | "reschedule" | "cancellation") => Promise<SendSmsResult>;
  sendReceiptSms: (invoiceId: number) => Promise<SendSmsResult>;

  // Lookups
  clientLookup: ClientLookup[];
  staffLookup: StaffLookup[];

  loading: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
}

export const AppContext = createContext<AppContextValue>(null!);

export function useApp() {
  return useContext(AppContext);
}
