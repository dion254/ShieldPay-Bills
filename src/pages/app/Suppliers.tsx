import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, X, Loader2, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Supplier, SupplierType, PaymentMethod } from "@/lib/types";
import { KE_BANKS } from "@/lib/constants";
import { clsx } from "@/lib/utils";
import { format } from "date-fns";

// ─── Bill type presets — what the user actually thinks in ──────
// Each preset auto-fills payment type, category and a friendly name hint
const BILL_PRESETS = [
  { id:"electricity",  label:"Electricity (KPLC)",   emoji:"⚡", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Utilities (KPLC)",       hint:"Paybill 888880, account = meter number" },
  { id:"water",        label:"Water Bill",            emoji:"💧", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Water Bill",              hint:"County water paybill number" },
  { id:"gas",          label:"Gas / LPG",             emoji:"🔥", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Gas / LPG",              hint:"Gas supplier paybill or till" },
  { id:"rent",         label:"Rent / Lease",          emoji:"🏢", type:"bank"         as SupplierType, method:"pesalink"    as PaymentMethod, category:"Rent / Lease",            hint:"Landlord bank account for PesaLink" },
  { id:"food",         label:"Food Supplier",         emoji:"🥩", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Food Supplier / Produce", hint:"Paybill, till or mobile money" },
  { id:"fuel",         label:"Fuel / Petroleum",      emoji:"⛽", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Fuel / Petroleum",        hint:"Fuel depot paybill or till number" },
  { id:"insurance",    label:"Insurance",             emoji:"🛡️", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Vehicle Insurance",       hint:"Insurance company paybill" },
  { id:"nhif",         label:"NHIF",                  emoji:"🏥", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"NHIF / NSSF",            hint:"Paybill 200222, account = ID number" },
  { id:"nssf",         label:"NSSF",                  emoji:"👷", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"NHIF / NSSF",            hint:"Paybill 333400, account = member no." },
  { id:"kra",          label:"KRA / Tax",             emoji:"📋", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"KRA / Taxes",            hint:"KRA paybill 572572" },
  { id:"maintenance",  label:"Maintenance / Repairs", emoji:"🔧", type:"till"         as SupplierType, method:"kcb_till"    as PaymentMethod, category:"Tyre & Maintenance",      hint:"Mechanic or supplier till number" },
  { id:"staff",        label:"Staff / Payroll",       emoji:"👥", type:"mobile_money" as SupplierType, method:"kcb_mobile"  as PaymentMethod, category:"Driver NSSF / Payroll",   hint:"Phone number to send salary" },
  { id:"loan",         label:"Loan Repayment",        emoji:"💰", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Loan Repayment",          hint:"Bank paybill number for loan" },
  { id:"internet",     label:"Internet / WiFi",       emoji:"📶", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Other",                   hint:"ISP paybill number" },
  { id:"other",        label:"Other",                 emoji:"📄", type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, category:"Other",                   hint:"Any other recurring payment" },
];

// ─── Payment type details ─────────────────────────────────────
const PAYMENT_TYPES = [
  { type:"paybill"      as SupplierType, method:"kcb_paybill" as PaymentMethod, label:"M-Pesa Paybill", icon:"📱", desc:"Pay to a paybill number (most common)" },
  { type:"till"         as SupplierType, method:"kcb_till"    as PaymentMethod, label:"M-Pesa Till",    icon:"🏪", desc:"Pay to a till number" },
  { type:"mobile_money" as SupplierType, method:"kcb_mobile"  as PaymentMethod, label:"Send to Phone",  icon:"📲", desc:"Send money to a phone number" },
  { type:"bank"         as SupplierType, method:"pesalink"    as PaymentMethod, label:"Bank Transfer",  icon:"🏦", desc:"PesaLink bank-to-bank transfer" },
];

// ─── Add Payee Drawer ─────────────────────────────────────────
function AddPayeeDrawer({ payee, businessId, onClose, onSaved }: {
  payee?: Supplier; businessId: string;
  onClose: () => void; onSaved: (s: Supplier) => void;
}) {
  const { user, member } = useAuth();
  const isEdit = !!payee;

  // Step 1 = pick bill type, Step 2 = fill details
  const [step, setStep] = useState<1|2>(isEdit ? 2 : 1);
  const [preset, setPreset] = useState<typeof BILL_PRESETS[0] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const [f, setF] = useState({
    name:           payee?.name           ?? "",
    type:           payee?.type           ?? "paybill" as SupplierType,
    default_method: payee?.default_method ?? "kcb_paybill" as PaymentMethod,
    category:       payee?.category       ?? "",
    paybill_number: payee?.paybill_number ?? "",
    account_number: payee?.account_number ?? "",
    till_number:    payee?.till_number    ?? "",
    phone_number:   payee?.phone_number   ?? "",
    bank_name:      payee?.bank_name      ?? "",
    bank_branch:    payee?.bank_branch    ?? "",
    bank_account:   payee?.bank_account   ?? "",
    bank_code:      payee?.bank_code      ?? "",
    contact_name:   payee?.contact_name   ?? "",
    contact_phone:  payee?.contact_phone  ?? "",
    notes:          payee?.notes          ?? "",
  });
  const set = (k: string, v: string) => { setF(p => ({...p, [k]: v})); setError(""); };

  const selectPreset = (p: typeof BILL_PRESETS[0]) => {
    setPreset(p);
    setF(prev => ({
      ...prev,
      type:           p.type,
      default_method: p.method,
      category:       p.category,
      name:           prev.name || p.label,
    }));
    setStep(2);
  };

  const selectPaymentType = (pt: typeof PAYMENT_TYPES[0]) => {
    setF(prev => ({ ...prev, type: pt.type, default_method: pt.method }));
  };

  const save = async () => {
    if (!f.name.trim()) { setError("Give this payee a name"); return; }
    if (f.type==="paybill"      && !f.paybill_number.trim()) { setError("Paybill number is required"); return; }
    if (f.type==="till"         && !f.till_number.trim())    { setError("Till number is required"); return; }
    if (f.type==="mobile_money" && !f.phone_number.trim())   { setError("Phone number is required"); return; }
    if (f.type==="bank"         && !f.bank_account.trim())   { setError("Bank account number is required"); return; }
    setSaving(true);

    const payload = {
      business_id: businessId, name: f.name.trim(), type: f.type,
      default_method: f.default_method, category: f.category || null,
      paybill_number: f.paybill_number.trim() || null,
      account_number: f.account_number.trim() || null,
      till_number:    f.till_number.trim()    || null,
      phone_number:   f.phone_number.trim()   || null,
      bank_name:      f.bank_name.trim()      || null,
      bank_branch:    f.bank_branch.trim()    || null,
      bank_account:   f.bank_account.trim()   || null,
      bank_code:      f.bank_code.trim()      || null,
      contact_name:   f.contact_name.trim()   || null,
      contact_phone:  f.contact_phone.trim()  || null,
      notes:          f.notes.trim()          || null,
      created_by:     user?.id,
    };

    const { data, error: err } = isEdit
      ? await supabase.from("suppliers").update(payload).eq("id", payee!.id).select().single()
      : await supabase.from("suppliers").insert(payload).select().single();

    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("audit_logs").insert({
      business_id: businessId, user_id: user?.id,
      user_email: member?.email, user_role: member?.role,
      action: `payee.${isEdit?"updated":"created"}`,
      entity_type: "supplier", entity_id: data.id,
      details: { name: f.name, type: f.type },
    });
    onSaved(data as Supplier);
    setSaving(false);
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <div>
            <h2 className="text-lg font-bold">
              {isEdit ? "Edit Payment Details" : step===1 ? "What type of bill?" : "Payment Details"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step===1 ? "Pick the type — we'll fill in the right fields" : preset?.hint ?? "Fill in the payment details"}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={18}/></button>
        </div>

        <div className="drawer-body">

          {/* ── STEP 1: Bill type picker ── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2.5">
              {BILL_PRESETS.map(p => (
                <button key={p.id} onClick={() => selectPreset(p)}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-slate-200 hover:border-primary hover:bg-primary/3 transition-all text-left group">
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-primary leading-tight">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── STEP 2: Fill details ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Preset badge */}
              {preset && (
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                  <span className="text-xl">{preset.emoji}</span>
                  <span className="text-sm font-semibold text-primary">{preset.label}</span>
                  {!isEdit && (
                    <button onClick={() => setStep(1)} className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline">
                      Change
                    </button>
                  )}
                </div>
              )}

              {/* Name */}
              <div className="field">
                <label className="label">Name *</label>
                <input className="input" placeholder="e.g. Kenya Power, Westlands Landlord, Shell Parklands"
                  value={f.name} onChange={e => set("name", e.target.value)}/>
              </div>

              {/* Payment type — only show if not locked by preset */}
              <div className="field">
                <label className="label">How do you pay them?</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_TYPES.map(pt => (
                    <button key={pt.type} type="button" onClick={() => selectPaymentType(pt)}
                      className={clsx(
                        "flex items-center gap-2.5 px-3.5 py-3 rounded-xl border-2 text-sm text-left transition-all",
                        f.type===pt.type ? "border-primary bg-primary/5 text-primary font-semibold" : "border-slate-200 hover:border-slate-300"
                      )}>
                      <span className="text-base">{pt.icon}</span>
                      <div>
                        <p className="font-semibold text-xs">{pt.label}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">{pt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic fields based on payment type */}
              {f.type === "paybill" && (
                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">📱 M-Pesa Paybill Details</p>
                  <div className="field">
                    <label className="label">Paybill number *</label>
                    <input className="input font-mono text-lg tracking-widest" placeholder="e.g. 888880"
                      value={f.paybill_number} onChange={e => set("paybill_number", e.target.value)}/>
                    {f.paybill_number === "888880" && <p className="text-xs text-blue-600 mt-1">✓ That's KPLC</p>}
                    {f.paybill_number === "200222" && <p className="text-xs text-blue-600 mt-1">✓ That's NHIF</p>}
                    {f.paybill_number === "333400" && <p className="text-xs text-blue-600 mt-1">✓ That's NSSF</p>}
                    {f.paybill_number === "572572" && <p className="text-xs text-blue-600 mt-1">✓ That's KRA</p>}
                  </div>
                  <div className="field">
                    <label className="label">Account number <span className="text-slate-400 font-normal">(optional — can set per payment)</span></label>
                    <input className="input" placeholder="Meter no., customer ID, staff ID…"
                      value={f.account_number} onChange={e => set("account_number", e.target.value)}/>
                  </div>
                </div>
              )}

              {f.type === "till" && (
                <div className="bg-green-50/60 border border-green-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">🏪 M-Pesa Till Details</p>
                  <div className="field">
                    <label className="label">Till number *</label>
                    <input className="input font-mono text-lg tracking-widest" placeholder="e.g. 123456"
                      value={f.till_number} onChange={e => set("till_number", e.target.value)}/>
                  </div>
                </div>
              )}

              {f.type === "mobile_money" && (
                <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-3">📲 Phone Number Details</p>
                  <div className="field">
                    <label className="label">Safaricom number *</label>
                    <input className="input font-mono text-lg" placeholder="e.g. 0712 345 678"
                      value={f.phone_number} onChange={e => set("phone_number", e.target.value)}/>
                    <p className="text-xs text-slate-400 mt-1">Money will be sent directly to this number</p>
                  </div>
                </div>
              )}

              {f.type === "bank" && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">🏦 Bank Account (PesaLink)</p>
                  <div className="field">
                    <label className="label">Bank *</label>
                    <select className="select" value={f.bank_name} onChange={e => set("bank_name", e.target.value)}>
                      <option value="">Select bank…</option>
                      {KE_BANKS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label">Branch</label>
                      <input className="input" placeholder="Westlands" value={f.bank_branch} onChange={e => set("bank_branch", e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="label">Bank code</label>
                      <input className="input font-mono" placeholder="01" value={f.bank_code} onChange={e => set("bank_code", e.target.value)}/>
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Account number *</label>
                    <input className="input font-mono text-lg" placeholder="e.g. 1234567890"
                      value={f.bank_account} onChange={e => set("bank_account", e.target.value)}/>
                  </div>
                </div>
              )}

              {/* Optional contact */}
              <details className="group">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 list-none flex items-center gap-1.5 font-medium">
                  <span className="text-slate-300 group-open:rotate-90 transition-transform">▶</span>
                  Add contact details (optional)
                </summary>
                <div className="mt-3 space-y-3 pl-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label">Contact name</label>
                      <input className="input" placeholder="Account manager" value={f.contact_name} onChange={e => set("contact_name", e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="label">Contact phone</label>
                      <input className="input" placeholder="0712 345 678" value={f.contact_phone} onChange={e => set("contact_phone", e.target.value)}/>
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Notes</label>
                    <textarea className="textarea" rows={2} placeholder="Any notes for your team…"
                      value={f.notes} onChange={e => set("notes", e.target.value)}/>
                  </div>
                </div>
              </details>

              {error && (
                <div className="alert-danger"><span className="shrink-0">✕</span>{error}</div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {step === 2 && !isEdit && (
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
          )}
          {step === 1 && (
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          )}
          {step === 2 && (
            <button onClick={save} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={14} className="animate-spin"/>Saving…</>
                : <><CheckCircle2 size={14}/>{isEdit ? "Save Changes" : "Save Payee"}</>}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Payee Card ───────────────────────────────────────────────
function PayeeCard({ s, onEdit, onDelete, isAdmin }: {
  s: Supplier; onEdit: () => void; onDelete: () => void; isAdmin: boolean;
}) {
  const typeIcon =
    s.type === "bank"         ? "🏦" :
    s.type === "till"         ? "🏪" :
    s.type === "mobile_money" ? "📲" : "📱";

  const typeLabel =
    s.type === "bank"         ? "Bank Transfer" :
    s.type === "till"         ? "M-Pesa Till" :
    s.type === "mobile_money" ? "Send to Phone" : "M-Pesa Paybill";

  const accountDetail =
    s.type === "paybill"      ? s.paybill_number + (s.account_number ? ` · ${s.account_number}` : "") :
    s.type === "till"         ? s.till_number :
    s.type === "mobile_money" ? s.phone_number :
    s.type === "bank"         ? `${s.bank_name ?? ""} ${s.bank_account ?? ""}`.trim() :
    "—";

  return (
    <div className="card p-4 flex items-center gap-4 hover:shadow-md transition-all">
      <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center text-xl shrink-0">
        {typeIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800">{s.name}</p>
        <p className="text-sm text-slate-500 truncate">
          {typeLabel}
          {accountDetail ? ` · ${accountDetail}` : ""}
        </p>
        {s.category && (
          <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
            {s.category}
          </span>
        )}
      </div>
      {isAdmin && (
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="btn-icon p-2" title="Edit"><Edit2 size={14}/></button>
          <button onClick={onDelete} className="btn-icon p-2 hover:text-red-500 hover:bg-red-50" title="Remove"><Trash2 size={14}/></button>
        </div>
      )}
    </div>
  );
}

// ─── Main Payees Page ─────────────────────────────────────────
export default function Suppliers() {
  const { business, isAdmin } = useAuth();
  const [payees, setPayees]   = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [drawer, setDrawer]   = useState<Supplier | "new" | null>(null);

  useEffect(() => { if (business) load(); }, [business?.id]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data } = await supabase
      .from("suppliers").select("*")
      .eq("business_id", business.id).eq("status","active").order("name");
    setPayees((data as Supplier[]) || []);
    setLoading(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this payee? You can always add them back later.")) return;
    await supabase.from("suppliers").update({ status: "archived" }).eq("id", id);
    setPayees(p => p.filter(s => s.id !== id));
  };

  const filtered = payees.filter(s => {
    const q = search.toLowerCase();
    return !q ||
      s.name.toLowerCase().includes(q) ||
      (s.category ?? "").toLowerCase().includes(q) ||
      (s.paybill_number ?? "").includes(q) ||
      (s.till_number ?? "").includes(q) ||
      (s.phone_number ?? "").includes(q) ||
      (s.bank_account ?? "").includes(q);
  });

  // Group by category for cleaner display
  const grouped: Record<string, Supplier[]> = {};
  filtered.forEach(s => {
    const key = s.category || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  return (
    <AppLayout
      title="Who You Pay"
      subtitle="All the people and companies you pay regularly"
      actions={isAdmin ? (
        <button onClick={() => setDrawer("new")} className="btn-primary flex items-center gap-2">
          <Plus size={15}/> Add Payee
        </button>
      ) : undefined}
    >
      <div className="page-wrap">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input className="input pl-10 py-2" placeholder="Search payees…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="card p-4"><div className="skeleton h-12 rounded-xl"/></div>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">🏢</div>
            <p className="font-bold text-slate-700 text-lg">
              {search ? "No results found" : "No payees added yet"}
            </p>
            <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
              {search
                ? "Try a different search"
                : "Add everyone you pay — KPLC, your landlord, fuel depot, food suppliers. Each one takes 30 seconds."}
            </p>
            {!search && isAdmin && (
              <button onClick={() => setDrawer("new")} className="btn-primary mt-6 mx-auto">
                <Plus size={15}/> Add your first payee
              </button>
            )}
          </div>
        ) : (
          // Grouped by category
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">{cat}</p>
              {items.map(s => (
                <PayeeCard
                  key={s.id} s={s}
                  isAdmin={isAdmin}
                  onEdit={() => setDrawer(s)}
                  onDelete={() => remove(s.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {drawer !== null && (
        <AddPayeeDrawer
          payee={drawer === "new" ? undefined : drawer}
          businessId={business!.id}
          onClose={() => setDrawer(null)}
          onSaved={saved => {
            if (drawer === "new") setPayees(p => [saved,...p].sort((a,b)=>a.name.localeCompare(b.name)));
            else setPayees(p => p.map(s => s.id===saved.id ? saved : s));
            setDrawer(null);
          }}
        />
      )}
    </AppLayout>
  );
}
