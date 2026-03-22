// ─── ShieldPay Types — Restaurants & Logistics ───────────────

export type IndustryType   = "restaurant" | "logistics";
export type BusinessStatus = "trial" | "active" | "suspended";
export type MemberRole     = "owner" | "admin" | "finance_manager" | "approver" | "viewer";
export type MemberStatus   = "active" | "invited" | "suspended";
export type SupplierType   = "bank" | "paybill" | "till" | "mobile_money" | "other";
export type PaymentMethod  = "pesalink" | "kcb_paybill" | "kcb_till" | "kcb_mobile";
export type Frequency      = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "biannual" | "yearly";
export type PaymentStatus  = "draft" | "pending_approval" | "approved" | "rejected" | "scheduled" | "executing" | "completed" | "failed" | "cancelled";
export type PlanKey        = "starter" | "growth" | "enterprise";

export interface Business {
  id: string; name: string; industry: IndustryType;
  registration_no: string | null; kra_pin: string | null;
  address: string | null; county: string | null;
  phone: string | null; email: string | null;
  status: BusinessStatus; trial_ends_at: string; plan: PlanKey;
  owner_user_id: string; created_at: string; updated_at: string;
}

export interface BusinessMember {
  id: string; business_id: string; user_id: string; email: string;
  full_name: string | null; phone: string | null;
  role: MemberRole; status: MemberStatus;
  invited_at: string; joined_at: string | null;
}

export interface Supplier {
  id: string; business_id: string; name: string; type: SupplierType;
  paybill_number: string | null; account_number: string | null;
  till_number: string | null; phone_number: string | null;
  bank_name: string | null; bank_branch: string | null;
  bank_account: string | null; bank_swift: string | null; bank_code: string | null;
  kra_pin: string | null; contact_name: string | null;
  contact_phone: string | null; contact_email: string | null;
  default_method: PaymentMethod; category: string | null; notes: string | null;
  status: "active" | "archived"; created_by: string | null;
  created_at: string; updated_at: string;
}

export interface PaymentSchedule {
  id: string; business_id: string; supplier_id: string;
  title: string; description: string | null; amount: number;
  payment_method: PaymentMethod; account_override: string | null;
  reference: string | null; notes: string | null; frequency: Frequency;
  start_date: string; end_date: string | null;
  next_due_date: string; last_paid_date: string | null; last_paid_amount: number | null;
  requires_approval: boolean; auto_execute: boolean; reminder_days: number;
  budget_category: string | null;
  status: "active" | "paused" | "completed" | "cancelled";
  created_by: string | null; created_at: string;
  supplier?: Pick<Supplier, "name" | "type">;
}

export interface PaymentRequest {
  id: string; business_id: string; schedule_id: string | null;
  supplier_id: string; title: string; amount: number; platform_fee: number;
  total_debit: number; payment_method: PaymentMethod;
  account_ref: string | null; reference: string | null; notes: string | null;
  due_date: string; budget_category: string | null; status: PaymentStatus;
  requested_by: string; approved_by: string | null; rejected_by: string | null; executed_by: string | null;
  requested_at: string; approved_at: string | null; rejected_at: string | null;
  executed_at: string | null; completed_at: string | null;
  rejection_reason: string | null; mpesa_receipt: string | null;
  bank_reference: string | null; failure_reason: string | null;
  created_at: string; updated_at: string;
  supplier?: Pick<Supplier, "name" | "type" | "category">;
  requester?: Pick<BusinessMember, "full_name" | "email">;
}

export interface PaymentReceipt {
  id: string; business_id: string; payment_id: string;
  receipt_number: string; issued_at: string;
  business_name: string; business_kra_pin: string | null;
  supplier_name: string; supplier_type: string; payment_method: string;
  amount: number; platform_fee: number; total_debit: number;
  reference: string | null; mpesa_receipt: string | null; bank_reference: string | null;
  narration: string | null; paid_by_name: string | null; paid_by_email: string | null;
  budget_category: string | null;
  vat_applicable: boolean; vat_amount: number; net_amount: number;
  created_at: string;
}

export interface CashFlowSnapshot {
  id: string; business_id: string; month: string;
  total_paid: number; total_fees: number; payment_count: number;
  by_category: Record<string, number>;
  by_method: Record<string, number>;
  total_scheduled: number;
  created_at: string; updated_at: string;
}

export interface BudgetLine {
  id: string; business_id: string; category: string;
  monthly_budget: number; fiscal_year: number; notes: string | null;
  created_at: string; updated_at: string;
}

export interface AuditLog {
  id: string; business_id: string; user_id: string | null;
  user_email: string | null; user_role: string | null;
  action: string; entity_type: string | null; entity_id: string | null;
  details: Record<string, unknown> | null; created_at: string;
}

export interface AppNotification {
  id: string; business_id: string; user_id: string | null;
  type: string; title: string; message: string;
  entity_id: string | null; entity_type: string | null;
  read: boolean; action_url: string | null; created_at: string;
}
