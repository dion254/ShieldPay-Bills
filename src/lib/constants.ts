import type { PlanKey, MemberRole, PaymentMethod, SupplierType, Frequency, PaymentStatus, IndustryType } from "./types";

export const PLANS: Record<PlanKey, { name: string; price: number | null; maxSchedules: number; execFee: { mpesa: number; bank: number }; badge: string }> = {
  starter:    { name: "Starter",    price: 1499, maxSchedules: 20,     execFee: { mpesa: 35, bank: 65 }, badge: "badge-slate"  },
  growth:     { name: "Growth",     price: 2999, maxSchedules: 50,     execFee: { mpesa: 25, bank: 50 }, badge: "badge-green"  },
  enterprise: { name: "Enterprise", price: null, maxSchedules: 999999, execFee: { mpesa: 0,  bank: 0  }, badge: "badge-purple" },
};

export const ROLE_CONFIG: Record<MemberRole, { label: string; badge: string; icon: string; desc: string; canApprove: boolean; canExecute: boolean; canWrite: boolean; isAdmin: boolean }> = {
  owner:           { label: "Owner",           badge: "badge-purple", icon: "👑", desc: "Full access — billing, settings, all operations.",              canApprove: true,  canExecute: true,  canWrite: true,  isAdmin: true  },
  admin:           { label: "Admin",           badge: "badge-blue",   icon: "🔑", desc: "Manage suppliers, schedule payments, manage team.",             canApprove: true,  canExecute: true,  canWrite: true,  isAdmin: true  },
  finance_manager: { label: "Finance Manager", badge: "badge-green",  icon: "💼", desc: "Execute approved payments, export reports.",                    canApprove: false, canExecute: true,  canWrite: true,  isAdmin: false },
  approver:        { label: "Approver",        badge: "badge-amber",  icon: "✅", desc: "Review and approve or reject payment requests.",                canApprove: true,  canExecute: false, canWrite: false, isAdmin: false },
  viewer:          { label: "Viewer",          badge: "badge-slate",  icon: "👁", desc: "Read-only dashboard and reports access.",                       canApprove: false, canExecute: false, canWrite: false, isAdmin: false },
};

export const STATUS_CONFIG: Record<PaymentStatus, { label: string; badge: string }> = {
  draft:            { label: "Draft",            badge: "badge-slate"  },
  pending_approval: { label: "Pending Approval", badge: "badge-amber"  },
  approved:         { label: "Approved",         badge: "badge-blue"   },
  rejected:         { label: "Rejected",         badge: "badge-red"    },
  scheduled:        { label: "Scheduled",        badge: "badge-indigo" },
  executing:        { label: "Processing",       badge: "badge-amber"  },
  completed:        { label: "Completed",        badge: "badge-green"  },
  failed:           { label: "Failed",           badge: "badge-red"    },
  cancelled:        { label: "Cancelled",        badge: "badge-slate"  },
};

export const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: string; provider: string; desc: string }> = {
  pesalink:    { label: "Bank Transfer (PesaLink)", icon: "🏦", provider: "Stanbic PesaLink", desc: "Bank-to-bank via PesaLink" },
  kcb_paybill: { label: "M-Pesa Paybill",          icon: "📱", provider: "KCB Buni",         desc: "Pay to any M-Pesa paybill" },
  kcb_till:    { label: "M-Pesa Till",             icon: "🏪", provider: "KCB Buni",         desc: "Pay to an M-Pesa till" },
  kcb_mobile:  { label: "M-Pesa Send Money",       icon: "📲", provider: "KCB Buni",         desc: "Send to a mobile number" },
};

export const SUPPLIER_TYPE_CONFIG: Record<SupplierType, { label: string; icon: string }> = {
  bank:         { label: "Bank Account",   icon: "🏦" },
  paybill:      { label: "M-Pesa Paybill", icon: "📱" },
  till:         { label: "M-Pesa Till",    icon: "🏪" },
  mobile_money: { label: "Mobile Money",   icon: "📲" },
  other:        { label: "Other",          icon: "📋" },
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once:      "One-time",
  daily:     "Daily",
  weekly:    "Weekly",
  biweekly:  "Every 2 weeks",
  monthly:   "Monthly",
  quarterly: "Every 3 months",
  biannual:  "Every 6 months",
  yearly:    "Annually",
};

export const INDUSTRY_CONFIG: Record<IndustryType, { label: string; icon: string; color: string; tagline: string }> = {
  restaurant: { label: "Restaurant",  icon: "🍽️", color: "orange", tagline: "KPLC, gas, food suppliers, rent, NHIF — all automated" },
  logistics:  { label: "Logistics",   icon: "🚛", color: "blue",   tagline: "Fuel, insurance, driver payroll, maintenance — zero missed payments" },
};

export const SUPPLIER_CATEGORIES_BY_INDUSTRY: Record<IndustryType, string[]> = {
  restaurant: [
    "Food Supplier / Produce", "Utilities (KPLC)", "Gas / LPG", "Rent / Lease",
    "Water Bill", "NHIF / NSSF", "KRA / Taxes", "Insurance",
    "Equipment / Machinery", "Cleaning & Supplies", "Marketing", "Loan Repayment", "Other",
  ],
  logistics: [
    "Fuel / Petroleum", "Vehicle Insurance", "Tyre & Maintenance", "NTSA / Licensing",
    "Driver NSSF / Payroll", "Toll / Road Fees", "Utilities (KPLC)", "KRA / Taxes",
    "Vehicle Loan Repayment", "Spare Parts", "Tracking / Tech", "Other",
  ],
};

export const BUDGET_CATEGORIES_BY_INDUSTRY: Record<IndustryType, string[]> = {
  restaurant: [
    "Food & Beverage", "Utilities", "Rent & Lease", "Staff Costs",
    "Insurance", "Taxes & Compliance", "Marketing", "Equipment", "Loan Repayment", "Other",
  ],
  logistics: [
    "Fuel", "Vehicle Insurance", "Maintenance & Repairs", "Driver Costs",
    "Licensing & Compliance", "Utilities", "Taxes", "Vehicle Finance", "Tracking & Tech", "Other",
  ],
};

export const KE_BANKS = [
  "KCB Bank", "Equity Bank", "Co-operative Bank", "Absa Kenya", "Standard Chartered",
  "Stanbic Bank", "DTB", "NCBA", "I&M Bank", "Sidian Bank", "Family Bank",
  "Gulf African Bank", "HF Group", "Bank of Baroda", "Faulu Bank", "Other",
];

export const KE_COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Nyeri", "Machakos",
  "Kisii", "Meru", "Kakamega", "Kitale", "Malindi", "Garissa", "Other",
];

export const SUPER_ADMIN_EMAIL = "diondickson3@gmail.com";
export const SUPABASE_REF      = "rnplqhlwvnqrghrjvylx";
export const CALLBACK_URL      = `https://${SUPABASE_REF}.supabase.co/functions/v1/callback`;
export const PAYMENTS_URL      = `https://${SUPABASE_REF}.supabase.co/functions/v1/payments`;
