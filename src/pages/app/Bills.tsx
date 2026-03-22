import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, X, Loader2, CheckCircle2, AlertTriangle,
  Pause, Play, Trash2, Bell, BellOff, RefreshCw,
  Phone, Hash, Building2, CreditCard, Repeat, Calendar,
  ChevronRight, Inbox,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, clsx, today } from "@/lib/utils";
import { FREQUENCY_LABELS, SUPPLIER_CATEGORIES_BY_INDUSTRY } from "@/lib/constants";
import type { PaymentSchedule, Supplier, PaymentMethod, Frequency, IndustryType } from "@/lib/types";
import { format } from "date-fns";

const BILL_FEED_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bill-feed`;

// ─── Payment method auto-detection from supplier type ─────────
function getMethodFromType(type: string): PaymentMethod {
  if (type === "bank")         return "pesalink";
  if (type === "till")         return "kcb_till";
  if (type === "mobile_money") return "kcb_mobile";
  return "kcb_paybill";
}

// ─── Smart account field — shows ONLY what's relevant ─────────
function AccountField({
  supplierType, value, onChange,
}: {
  supplierType: string; value: string; onChange: (v: string) => void;
}) {
  const configs: Record<string, { label: string; placeholder: string; icon: React.ElementType; hint: string }> = {
    paybill:      { label: "Paybill Number + Account",  placeholder: "e.g. 888880  |  account: 0712345678", icon: Hash,      hint: "Enter paybill number. Account number is optional." },
    till:         { label: "Till Number",               placeholder: "e.g. 123456",                         icon: Hash,      hint: "M-Pesa Till number only — no account needed." },
    mobile_money: { label: "Phone Number",              placeholder: "e.g. 0712 345 678",                   icon: Phone,     hint: "Safaricom number to send money to." },
    bank:         { label: "Bank Account Number",       placeholder: "e.g. 1234567890",                     icon: Building2, hint: "Full bank account number for PesaLink transfer." },
    other:        { label: "Payment Reference",         placeholder: "Reference or account number",         icon: CreditCard, hint: "Any reference the supplier needs." },
  };
  const cfg = configs[supplierType] ?? configs.other;
  const Icon = cfg.icon;

  return (
    <div className="field">
      <label className="label">{cfg.label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder={cfg.placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">{cfg.hint}</p>
    </div>
  );
}

// ─── Bill Creation Drawer — completely rebuilt ─────────────────
function NewBillDrawer({
  businessId, plan, industry, onClose, onSaved,
}: {
  businessId: string; plan: string; industry: string;
  onClose: () => void; onSaved: () => void;
}) {
  const { user, member } = useAuth();
  const [step, setStep]   = useState<1|2|3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [f, setF] = useState({
    supplier_id:       "",
    title:             "",
    amount:            "",
    account_override:  "",
    frequency:         "monthly" as Frequency,
    start_date:        today(),
    requires_approval: true,
    auto_execute:      false,
    notes:             "",
    budget_category:   "",
  });
  const set = (k: string, v: any) => { setF(p => ({ ...p, [k]: v })); setError(""); };

  useEffect(() => {
    supabase.from("suppliers").select("*")
      .eq("business_id", businessId).eq("status", "active").order("name")
      .then(({ data }) => setSuppliers((data as Supplier[]) || []));
  }, [businessId]);

  const selSup = suppliers.find(s => s.id === f.supplier_id);

  // Auto-fill account when supplier selected
  useEffect(() => {
    if (!selSup) return;
    if (!f.title) set("title", selSup.name);
    const account =
      selSup.paybill_number
        ? selSup.account_number
          ? `${selSup.paybill_number} | ${selSup.account_number}`
          : selSup.paybill_number
        : selSup.till_number ||
          selSup.phone_number ||
          selSup.bank_account || "";
    set("account_override", account);
  }, [f.supplier_id]);

  const cats = SUPPLIER_CATEGORIES_BY_INDUSTRY[industry as IndustryType] ?? [];

  const canProceed1 = f.supplier_id && f.title.trim() && Number(f.amount) > 0;
  const canProceed2 = f.account_override.trim() && f.start_date;

  const save = async () => {
    setSaving(true);
    const method = selSup ? getMethodFromType(selSup.type) : "kcb_paybill";
    const payload = {
      business_id:      businessId,
      supplier_id:      f.supplier_id,
      title:            f.title.trim(),
      amount:           Number(f.amount),
      platform_fee:     0,
      payment_method:   method,
      account_override: f.account_override.trim() || null,
      notes:            f.notes.trim() || null,
      budget_category:  f.budget_category || null,
      frequency:        f.frequency,
      start_date:       f.start_date,
      next_due_date:    f.start_date,
      requires_approval: f.requires_approval,
      auto_execute:     f.auto_execute,
      reminder_days:    3,
      status:           "active",
      created_by:       user?.id,
    };
    const { error: err } = await supabase.from("payment_schedules").insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("audit_logs").insert({
      business_id: businessId, user_id: user?.id,
      user_email: member?.email, user_role: member?.role,
      action: "bill.created", entity_type: "payment_schedule",
      details: { title: f.title, amount: Number(f.amount), frequency: f.frequency },
    });
    // Notify admin
    await supabase.from("notifications").insert({
      business_id: businessId, type: "bill_created",
      title: "New bill scheduled",
      message: `${f.title} — ${fmtKES(Number(f.amount))} ${FREQUENCY_LABELS[f.frequency]}`,
    });
    onSaved();
    setSaving(false);
  };

  const STEPS = [
    { n: 1, label: "What & Who" },
    { n: 2, label: "When & How" },
    { n: 3, label: "Confirm" },
  ];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <div>
            <h2 className="text-lg font-bold">Schedule a Bill</h2>
            <p className="text-xs text-slate-400 mt-0.5">3 simple steps</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        {/* Step progress */}
        <div className="flex px-6 py-3 gap-2 border-b border-slate-100">
          {STEPS.map(s => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all",
                step > s.n  ? "bg-green-500 text-white" :
                step === s.n ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
              )}>
                {step > s.n ? <CheckCircle2 size={12} /> : s.n}
              </div>
              <span className={clsx("text-xs font-semibold truncate",
                step === s.n ? "text-slate-800" : "text-slate-400")}>
                {s.label}
              </span>
              {s.n < 3 && <div className="flex-1 h-px bg-slate-100" />}
            </div>
          ))}
        </div>

        <div className="drawer-body">
          {/* ── STEP 1: What & Who ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="field">
                <label className="label">Who are you paying? *</label>
                <select className="select" value={f.supplier_id}
                  onChange={e => set("supplier_id", e.target.value)}>
                  <option value="">Pick a supplier…</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.type === "paybill"      ? " · M-Pesa Paybill" :
                       s.type === "till"         ? " · M-Pesa Till" :
                       s.type === "mobile_money" ? " · Mobile Money" :
                       s.type === "bank"         ? " · Bank Transfer" : ""}
                    </option>
                  ))}
                </select>
                {!suppliers.length && (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} /> No suppliers yet — <a href="/suppliers" className="underline font-semibold">add them first</a>
                  </p>
                )}
              </div>

              {selSup && (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-100">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold shrink-0">
                    {selSup.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{selSup.name}</p>
                    <p className="text-xs text-slate-500">
                      {selSup.type === "paybill"      ? `Paybill ${selSup.paybill_number}` :
                       selSup.type === "till"         ? `Till ${selSup.till_number}` :
                       selSup.type === "mobile_money" ? `📲 ${selSup.phone_number}` :
                       selSup.type === "bank"         ? `🏦 ${selSup.bank_name} ${selSup.bank_account}` :
                       selSup.category ?? "Supplier"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    {selSup.type === "bank" ? "PesaLink" :
                     selSup.type === "till" ? "M-Pesa Till" :
                     selSup.type === "mobile_money" ? "M-Pesa Send" : "M-Pesa Paybill"}
                  </span>
                </div>
              )}

              <div className="field">
                <label className="label">What is this bill for? *</label>
                <input className="input" placeholder="e.g. KPLC February, Monthly Rent, Gas Refill"
                  value={f.title} onChange={e => set("title", e.target.value)} />
              </div>

              <div className="field">
                <label className="label">How much? (KES) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">KES</span>
                  <input
                    className="input pl-14 text-xl font-bold"
                    type="number" placeholder="0" min={1}
                    value={f.amount} onChange={e => set("amount", e.target.value)}
                  />
                </div>
                {f.amount && Number(f.amount) > 0 && (
                  <p className="text-sm font-bold text-primary mt-1.5 text-right">
                    {fmtKES(Number(f.amount))}
                  </p>
                )}
              </div>

              <div className="field">
                <label className="label">Category (optional)</label>
                <select className="select" value={f.budget_category}
                  onChange={e => set("budget_category", e.target.value)}>
                  <option value="">No category</option>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ── STEP 2: When & How ── */}
          {step === 2 && selSup && (
            <div className="space-y-4">
              {/* Auto-filled account — confirm or override */}
              <AccountField
                supplierType={selSup.type}
                value={f.account_override}
                onChange={v => set("account_override", v)}
              />

              <div className="field">
                <label className="label">How often? *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["once","weekly","monthly","quarterly","yearly","daily"] as Frequency[]).map(freq => (
                    <button key={freq} type="button" onClick={() => set("frequency", freq)}
                      className={clsx(
                        "py-2.5 rounded-xl text-xs font-bold border-2 transition-all",
                        f.frequency === freq
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}>
                      {FREQUENCY_LABELS[freq]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label">
                  {f.frequency === "once" ? "Payment date *" : "First payment date *"}
                </label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="date" className="input pl-10" value={f.start_date}
                    min={today()} onChange={e => set("start_date", e.target.value)} />
                </div>
                {f.start_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    {f.frequency === "once"
                      ? `Pays on ${format(new Date(f.start_date), "EEEE, d MMMM yyyy")}`
                      : `Starts ${format(new Date(f.start_date), "d MMM yyyy")} — repeats ${FREQUENCY_LABELS[f.frequency].toLowerCase()}`}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-3 cursor-pointer bg-slate-50 rounded-xl p-3.5 border border-slate-100 hover:border-slate-200 transition-all">
                  <input type="checkbox" checked={f.requires_approval}
                    onChange={e => set("requires_approval", e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary" />
                  <div>
                    <p className="text-sm font-semibold">Require approval before paying</p>
                    <p className="text-xs text-slate-400 mt-0.5">An approver must sign off before the payment executes</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer bg-slate-50 rounded-xl p-3.5 border border-slate-100 hover:border-slate-200 transition-all">
                  <input type="checkbox" checked={f.auto_execute}
                    onChange={e => set("auto_execute", e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-primary" />
                  <div>
                    <p className="text-sm font-semibold">Auto-execute on due date</p>
                    <p className="text-xs text-slate-400 mt-0.5">Payment fires automatically without any manual trigger</p>
                  </div>
                </label>
              </div>

              <div className="field">
                <label className="label">Notes (optional)</label>
                <textarea className="input min-h-[68px] resize-none" placeholder="Any additional info…"
                  value={f.notes} onChange={e => set("notes", e.target.value)} />
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step === 3 && selSup && (
            <div className="space-y-3">
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Confirm Bill Schedule</p>
                {[
                  { label: "Paying",       value: selSup.name },
                  { label: "For",          value: f.title },
                  { label: "Amount",       value: fmtKES(Number(f.amount)), bold: true },
                  { label: "Method",       value:
                    selSup.type === "bank" ? "🏦 PesaLink Bank Transfer" :
                    selSup.type === "till" ? "🏪 M-Pesa Till" :
                    selSup.type === "mobile_money" ? "📲 M-Pesa Send Money" :
                    "📱 M-Pesa Paybill"
                  },
                  { label: "To",           value: f.account_override || "—" },
                  { label: "Frequency",    value: FREQUENCY_LABELS[f.frequency] },
                  { label: "First date",   value: format(new Date(f.start_date), "d MMMM yyyy") },
                  { label: "Approval",     value: f.requires_approval ? "Required ✓" : "Not required" },
                  { label: "Auto-execute", value: f.auto_execute ? "Yes — fires automatically" : "No — manual trigger" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={clsx("font-semibold text-right", row.bold && "text-xl font-black text-primary")}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-700">
                <Bell size={14} className="shrink-0" />
                <span>You'll get a reminder 3 days before every payment is due</span>
              </div>

              {error && (
                <div className="alert-danger">
                  <AlertTriangle size={14} className="shrink-0" />{error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {step > 1 && (
            <button onClick={() => setStep(s => (s - 1) as 1|2|3)} className="btn-secondary flex-1">
              ← Back
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => {
                if (step === 1 && !canProceed1) { setError("Fill in supplier, title and amount"); return; }
                if (step === 2 && !canProceed2) { setError("Fill in account details and date"); return; }
                setStep(s => (s + 1) as 1|2|3);
              }}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              Continue <ChevronRight size={15} />
            </button>
          )}
          {step === 3 && (
            <button onClick={save} disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Scheduling…</>
                : <><CheckCircle2 size={14} /> Schedule Bill</>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Bill Status Badge ────────────────────────────────────────
function BillBadge({ status }: { status: string }) {
  const map: Record<string,string> = {
    active:    "badge-green",
    paused:    "badge-amber",
    completed: "badge-blue",
    cancelled: "badge-red",
  };
  return <span className={clsx("badge capitalize", map[status] ?? "badge-slate")}>{status}</span>;
}

// ─── Bill Card (mobile-friendly card view) ────────────────────
function BillCard({
  bill, onEdit, onTogglePause, onDelete, canWrite,
}: {
  bill: PaymentSchedule & { supplier?: any };
  onEdit:        () => void;
  onTogglePause: () => void;
  onDelete:      () => void;
  canWrite:      boolean;
}) {
  const sup    = bill.supplier as any;
  const days   = Math.ceil((new Date(bill.next_due_date).getTime() - Date.now()) / 86400000);
  const urgent = days <= 3 && days >= 0;
  const overdue = days < 0;

  return (
    <div className={clsx(
      "card p-5 transition-all hover:shadow-md",
      overdue ? "border-l-4 border-red-400" :
      urgent  ? "border-l-4 border-amber-400" : ""
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-slate-800 truncate">{bill.title}</p>
            <BillBadge status={bill.status} />
          </div>
          <p className="text-sm text-slate-500 truncate">
            {sup?.name ?? "—"}
            {bill.payment_method === "pesalink"    ? " · 🏦 PesaLink" :
             bill.payment_method === "kcb_till"    ? " · 🏪 M-Pesa Till" :
             bill.payment_method === "kcb_mobile"  ? " · 📲 M-Pesa Send" :
             " · 📱 M-Pesa Paybill"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-lg text-slate-900">{fmtKES(bill.amount)}</p>
          <p className="text-xs text-slate-400">{FREQUENCY_LABELS[bill.frequency]}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
        <div>
          <p className={clsx("text-sm font-semibold",
            overdue ? "text-red-600" : urgent ? "text-amber-600" : "text-slate-600")}>
            {overdue
              ? `⚠️ Overdue by ${Math.abs(days)}d`
              : days === 0
                ? "📅 Due today!"
                : `📅 Due in ${days} day${days !== 1 ? "s" : ""}`}
          </p>
          <p className="text-xs text-slate-400">
            {format(new Date(bill.next_due_date), "EEE d MMM yyyy")}
          </p>
        </div>

        {canWrite && bill.status !== "completed" && (
          <div className="flex items-center gap-1">
            <button onClick={onEdit}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-medium transition-all">
              Edit
            </button>
            <button onClick={onTogglePause}
              title={bill.status === "paused" ? "Resume" : "Pause"}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all">
              {bill.status === "paused" ? <Play size={14} /> : <Pause size={14} />}
            </button>
            <button onClick={onDelete}
              title="Delete bill"
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feed Bill Card ───────────────────────────────────────────
function FeedCard({ bill, suppliers, onAccept, onSkip }: {
  bill: any; suppliers: Supplier[];
  onAccept: (id: string, supplierId?: string) => Promise<void>;
  onSkip:   (id: string) => Promise<void>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [loading, setLoading]       = useState(false);
  const overdue = new Date(bill.due_date) < new Date();

  return (
    <div className={clsx(
      "card p-4 border-l-4",
      overdue ? "border-red-400" : "border-amber-400"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-bold text-slate-800 truncate">{bill.vendor_name}</p>
            {bill.doc_number && <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{bill.doc_number}</span>}
            <span className={clsx("badge text-xs",
              bill.provider==="quickbooks"?"badge-blue":bill.provider==="zoho"?"badge-red":"badge-slate")}>
              {bill.provider==="quickbooks"?"QuickBooks":bill.provider==="zoho"?"Zoho":"Manual"}
            </span>
            {bill.kra_pin_missing && (
              <span className="badge badge-amber text-xs"><AlertTriangle size={9}/> No KRA PIN</span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Due: <span className={clsx("font-semibold", overdue?"text-red-600":"text-slate-700")}>
              {format(new Date(bill.due_date), "d MMM yyyy")}
            </span>
            {bill.description && ` · ${bill.description.slice(0,50)}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-lg">{fmtKES(bill.total_amount)}</p>
          {bill.tax_amount > 0 && <p className="text-xs text-slate-400">VAT: {fmtKES(bill.tax_amount)}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
          className="select text-sm flex-1 py-2">
          <option value="">Auto-match supplier…</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button
          onClick={async () => { setLoading(true); await onAccept(bill.id, supplierId||undefined); setLoading(false); }}
          disabled={loading}
          className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 shrink-0">
          {loading ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>}
          Accept
        </button>
        <button onClick={async () => { setLoading(true); await onSkip(bill.id); setLoading(false); }}
          disabled={loading}
          className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all" title="Dismiss">
          <X size={14}/>
        </button>
      </div>
    </div>
  );
}

// ─── Feed Tab ─────────────────────────────────────────────────
function FeedTab({ businessId }: { businessId: string }) {
  const [bills, setBills]         = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [integrations, setInteg]  = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [toast, setToast]         = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, sRes, iRes] = await Promise.all([
      supabase.from("external_bills").select("*").eq("business_id",businessId).eq("status","pending").order("due_date"),
      supabase.from("suppliers").select("*").eq("business_id",businessId).eq("status","active").order("name"),
      supabase.from("accounting_integrations").select("id,provider,status,last_sync_at").eq("business_id",businessId).eq("status","active"),
    ]);
    setBills(bRes.data ?? []);
    setSuppliers((sRes.data as Supplier[]) ?? []);
    setInteg(iRes.data ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const pull = async (integId: string) => {
    setSyncing(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${BILL_FEED_URL}/pull`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: integId, businessId }),
      });
      const result = await res.json();
      if (result.ok) { showToast(`✅ ${result.inserted} new bill${result.inserted!==1?"s":""} pulled`); load(); }
      else showToast(`❌ ${result.error}`);
    } catch (e: any) { showToast(`❌ ${e.message}`); }
    setSyncing(false);
  };

  const handleAccept = async (billId: string, supplierId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${BILL_FEED_URL}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ billId, supplierId }),
    });
    const result = await res.json();
    if (result.ok) { showToast("✅ Bill accepted — schedule created!"); setBills(p => p.filter(b => b.id !== billId)); }
    else showToast(`❌ ${result.error}`);
  };

  const handleSkip = async (billId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${BILL_FEED_URL}/skip`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ billId }),
    });
    setBills(p => p.filter(b => b.id !== billId));
    showToast("Bill dismissed");
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}

      {integrations.length > 0 && (
        <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-sm">Pull latest bills</p>
            <p className="text-xs text-slate-400">Fetch open bills from your accounting software</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {integrations.map(i => (
              <button key={i.id} onClick={() => pull(i.id)} disabled={syncing}
                className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5">
                {syncing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                {i.provider === "quickbooks" ? "QuickBooks" : "Zoho Books"}
              </button>
            ))}
          </div>
        </div>
      )}

      {integrations.length === 0 && (
        <div className="card p-6 text-center bg-blue-50 border-blue-200">
          <Inbox size={28} className="text-blue-400 mx-auto mb-2"/>
          <p className="font-semibold text-blue-800">No accounting tool connected</p>
          <p className="text-xs text-blue-600 mt-1">
            Connect QuickBooks or Zoho in <a href="/settings/integrations" className="underline font-semibold">Settings → Integrations</a>
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card p-4"><div className="skeleton h-20 rounded-xl"/></div>)}</div>
      ) : bills.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2"/>
          <p className="font-semibold text-slate-700">All caught up!</p>
          <p className="text-sm text-slate-400 mt-1">No pending bills in the feed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {bills.length} bill{bills.length!==1?"s":""} waiting
          </p>
          {bills.map(bill => (
            <FeedCard key={bill.id} bill={bill} suppliers={suppliers}
              onAccept={handleAccept} onSkip={handleSkip}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Bills Page ──────────────────────────────────────────
export default function Bills() {
  const { business, canWrite, member } = useAuth();
  const [tab, setTab]       = useState<"bills"|"feed">("bills");
  const [bills, setBills]   = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<PaymentSchedule|null>(null);
  const [feedCount, setFeedCount] = useState(0);
  const [filter, setFilter]       = useState<"all"|"active"|"paused">("all");
  const [toast, setToast]         = useState<{msg:string;ok:boolean}|null>(null);

  const showToast = (msg: string, ok = true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const { data } = await supabase
      .from("payment_schedules")
      .select("*, supplier:suppliers(name,type,category)")
      .eq("business_id", business.id)
      .not("status","eq","cancelled")
      .order("next_due_date");
    setBills((data as PaymentSchedule[]) || []);
    setLoading(false);
  }, [business?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!business) return;
    supabase.from("external_bills").select("id",{count:"exact",head:true})
      .eq("business_id",business.id).eq("status","pending")
      .then(({count}) => setFeedCount(count ?? 0));
  }, [business?.id]);

  const togglePause = async (b: PaymentSchedule) => {
    const ns = b.status === "paused" ? "active" : "paused";
    await supabase.from("payment_schedules").update({status:ns}).eq("id",b.id);
    setBills(p => p.map(x => x.id===b.id ? {...x,status:ns} : x));
    showToast(`Bill ${ns}`);
    // Notify admin
    await supabase.from("notifications").insert({
      business_id: business!.id, type: "bill_status_change",
      title: `Bill ${ns === "paused" ? "paused" : "resumed"}`,
      message: `${b.title} was ${ns === "paused" ? "paused" : "resumed"} by ${member?.full_name ?? member?.email}`,
    });
  };

  const deleteBill = async (b: PaymentSchedule) => {
    if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
    await supabase.from("payment_schedules").update({status:"cancelled"}).eq("id",b.id);
    setBills(p => p.filter(x => x.id !== b.id));
    showToast("Bill deleted");
    await supabase.from("notifications").insert({
      business_id: business!.id, type: "bill_deleted",
      title: "Bill deleted",
      message: `${b.title} (${fmtKES(b.amount)}) was deleted by ${member?.full_name ?? member?.email}`,
    });
  };

  if (!business) return null;

  const filtered = bills.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.supplier as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || b.status === filter;
    return matchSearch && matchFilter;
  });

  const upcoming = bills.filter(b => b.status==="active" &&
    Math.ceil((new Date(b.next_due_date).getTime()-Date.now())/86400000) <= 7);

  return (
    <AppLayout title="Bills" subtitle="Manage your payment schedules"
      actions={canWrite ? (
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15}/> Schedule Bill
        </button>
      ) : undefined}>
      <div className="page-wrap">
        {toast && (
          <div className={clsx(
            "fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2",
            toast.ok?"bg-green-600 text-white":"bg-red-600 text-white"
          )}>
            {toast.ok?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>}
            {toast.msg}
          </div>
        )}

        {/* Upcoming alert banner */}
        {upcoming.length > 0 && (
          <div className="alert-warn">
            <Bell size={16} className="text-amber-600 shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold">
                {upcoming.length} bill{upcoming.length!==1?"s":""} due within 7 days
              </p>
              <p className="text-xs text-amber-700/80 mt-0.5">
                {upcoming.map(b => `${b.title} (${format(new Date(b.next_due_date),"d MMM")})`).join(" · ")}
              </p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setTab("bills")}
              className={clsx("px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                tab==="bills"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700")}>
              My Bills
            </button>
            <button onClick={() => setTab("feed")}
              className={clsx("px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5",
                tab==="feed"?"bg-white text-slate-900 shadow-sm":"text-slate-500 hover:text-slate-700")}>
              {feedCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                  {feedCount > 9 ? "9+" : feedCount}
                </span>
              )}
              Feed Inbox
            </button>
          </div>

          {tab === "bills" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input className="input pl-9 py-2 w-48 text-sm" placeholder="Search bills…"
                  value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value as any)}
                className="select py-2 text-sm w-32">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          )}
        </div>

        {/* Bills list */}
        {tab === "bills" && (
          <>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card p-5"><div className="skeleton h-20 rounded-xl"/></div>)}</div>
            ) : filtered.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4">📋</div>
                <p className="font-bold text-slate-700">No bills scheduled yet</p>
                <p className="text-sm text-slate-400 mt-1.5 max-w-sm mx-auto">
                  Schedule your first bill payment — KPLC, rent, fuel, anything you pay regularly.
                </p>
                {canWrite && (
                  <button onClick={() => setShowNew(true)} className="btn-primary mt-5 mx-auto">
                    <Plus size={15}/> Schedule your first bill
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(b => (
                  <BillCard key={b.id} bill={b as any}
                    onEdit={() => setEditing(b)}
                    onTogglePause={() => togglePause(b)}
                    onDelete={() => deleteBill(b)}
                    canWrite={canWrite}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "feed" && <FeedTab businessId={business.id}/>}
      </div>

      {/* New bill drawer */}
      {showNew && (
        <NewBillDrawer
          businessId={business.id} plan={business.plan}
          industry={business.industry}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); showToast("✅ Bill scheduled!"); }}
        />
      )}

      {/* Edit bill drawer */}
      {editing && (
        <NewBillDrawer
          businessId={business.id} plan={business.plan}
          industry={business.industry}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); showToast("✅ Bill updated!"); }}
        />
      )}
    </AppLayout>
  );
}
