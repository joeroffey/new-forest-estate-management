export type UserRole = "admin" | "customer";
export type BookingStatus = "confirmed" | "cancelled";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type WhatsAppProvider = "greenapi" | "whapi";

export interface Settings {
  id: number;
  business_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_number: string | null;
  vat_number: string | null;
  vat_registered: boolean;
  vat_rate: number;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  invoice_prefix: string;
  invoice_next_number: number;
  payment_terms_days: number;
  invoice_notes: string | null;
  notify_emails: string[];
  late_change_hours: number;
  whatsapp_enabled: boolean;
  whatsapp_provider: WhatsAppProvider;
  whatsapp_chat_id: string | null;
  whatsapp_chat_name: string | null;
  notion_enabled: boolean;
  notion_database_id: string | null;
  notion_title_prop: string | null;
  /** When cleaning teams set off ("09:00:00"). */
  clean_day_start: string;
  /** When the cleaning day should be finished by ("17:00:00"). */
  clean_day_end: string;
  /** Post each morning's cleaning plan to the WhatsApp group. */
  cleaning_plan_whatsapp: boolean;
  updated_at: string;
}

export interface CleaningTeam {
  id: string;
  name: string;
  home_postcode: string | null;
  lat: number | null;
  lng: number | null;
  located_from: string | null;
  works_by_default: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** One changeover clean in the day's plan. */
export interface CleaningJob {
  booking_id: string;
  day: string;
  team_id: string | null;
  run_order: number | null;
  run_count: number | null;
  starts_at: string | null;
  ends_at: string | null;
  drive_minutes: number | null;
  drive_from: string | null;
  route_url: string | null;
  late_minutes: number;
  warning: string | null;
  next_booking_id: string | null;
  pinned_team_id: string | null;
  pinned_day: string | null;
  signature: string | null;
  planned_at: string;
}

export interface CleaningDay {
  day: string;
  team_ids: string[] | null;
  whatsapp_sent_at: string | null;
  updated_at: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  phone_secondary: string | null;
  address_line1: string | null;
  address_line2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  notes: string | null;
  archived: boolean;
  user_id: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  receives_invoices: boolean;
  receives_bookings: boolean;
  created_at: string;
}

export interface Property {
  id: string;
  customer_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  town: string | null;
  postcode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sleeps: number | null;
  standard_setup: string | null;
  access_notes: string | null;
  cleaner_notes: string | null;
  /** How long a changeover clean takes (admins set this; null means estimate from the rooms). */
  clean_minutes: number | null;
  lat: number | null;
  lng: number | null;
  located_from: string | null;
  default_checkout_time: string;
  default_arrival_time: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  reference: string;
  customer_id: string;
  property_id: string;
  arrival_date: string;
  departure_date: string;
  nights: number;
  checkout_time: string;
  arrival_time: string | null;
  adults: number;
  children: number;
  infants: number;
  dogs: number;
  setup: "standard" | "custom";
  setup_notes: string | null;
  reset_after: boolean;
  extras: string[];
  guest_name: string | null;
  source: string | null;
  notes: string | null;
  status: BookingStatus;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  notion_page_id: string | null;
  notion_synced_at: string | null;
  notion_error: string | null;
  whatsapp_sent_at: string | null;
  whatsapp_error: string | null;
  created_at: string;
  updated_at: string;
}

export type BookingWithRelations = Booking & {
  property: Pick<Property, "id" | "name" | "town" | "address_line1" | "postcode"> | null;
  customer: Pick<Customer, "id" | "full_name" | "company_name"> | null;
};

export interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  notes: string | null;
  sent_at: string | null;
  sent_to: string[] | null;
  last_reminder_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  copied_from: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  booking_id: string | null;
  property_id: string | null;
}

export type InvoiceWithCustomer = Invoice & {
  customer: Pick<Customer, "id" | "full_name" | "company_name" | "email"> | null;
};

export interface Activity {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  customer_id: string | null;
  booking_id: string | null;
  invoice_id: string | null;
  kind: string;
  message: string;
  meta: Record<string, unknown> | null;
}

/** Result returned by server actions to client forms. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Optional data for the caller (ids etc). */
  data?: Record<string, unknown>;
}
