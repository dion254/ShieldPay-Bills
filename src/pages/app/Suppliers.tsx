import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Archive, X, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Supplier, SupplierType, PaymentMethod } from "@/lib/types";
import { SUPPLIER_TYPE_CONFIG, METHOD_CONFIG, KE_BANKS, SUPPLIER_CATEGORIES_BY_INDUSTRY } from "@/lib/constants";
import { clsx } from "@/lib/utils";
import { format } from "date-fns";

const SUPPLIER_CATEGORIES = Object.values(SUPPLIER_CATEGORIES_BY_INDUSTRY).flat().filter((v,i,a)=>a.indexOf(v)===i).sort();

function SupplierDrawer({ supplier, businessId, onClose, onSaved }: {
  supplier?: Supplier; businessId: string; onClose: () => void; onSaved: (s: Supplier) => void;
}) {
  const { user, member } = useAuth();
  const isEdit = !!supplier;
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [f, setF] = useState({
    name:           supplier?.name           ?? "",
    type:           supplier?.type           ?? "paybill" as SupplierType,
    default_method: supplier?.default_method ?? "kcb_paybill" as PaymentMethod,
    category:       supplier?.category       ?? "",
    paybill_number: supplier?.paybill_number ?? "",
    account_number: supplier?.account_number ?? "",
    till_number:    supplier?.till_number    ?? "",
    phone_number:   supplier?.phone_number   ?? "",
    bank_name:      supplier?.bank_name      ?? "",
    bank_branch:    supplier?.bank_branch    ?? "",
    bank_account:   supplier?.bank_account   ?? "",
    bank_swift:     supplier?.bank_swift     ?? "",
    bank_code:      supplier?.bank_code      ?? "",
    contact_name:   supplier?.contact_name   ?? "",
    contact_phone:  supplier?.contact_phone  ?? "",
    contact_email:  supplier?.contact_email  ?? "",
    notes:          supplier?.notes          ?? "",
  });
  const set = (k: string, v: string) => { setF(p => ({ ...p, [k]: v })); setError(""); };

  const setType = (type: SupplierType) => {
    const m: Record<SupplierType, PaymentMethod> = { bank: "pesalink", paybill: "kcb_paybill", till: "kcb_till", mobile_money: "kcb_mobile", other: "kcb_paybill" };
    setF(p => ({ ...p, type, default_method: m[type] }));
  };

  const save = async () => {
    if (!f.name.trim()) { setError("Supplier name is required"); return; }
    if (f.type === "paybill"      && !f.paybill_number.trim()) { setError("Paybill number is required"); return; }
    if (f.type === "till"         && !f.till_number.trim())    { setError("Till number is required"); return; }
    if (f.type === "mobile_money" && !f.phone_number.trim())   { setError("Phone number is required"); return; }
    if (f.type === "bank"         && !f.bank_account.trim())   { setError("Bank account number is required"); return; }
    setSaving(true);

    const payload = {
      business_id: businessId, name: f.name.trim(), type: f.type,
      default_method: f.default_method, category: f.category || null,
      paybill_number: f.paybill_number.trim() || null, account_number: f.account_number.trim() || null,
      till_number: f.till_number.trim() || null, phone_number: f.phone_number.trim() || null,
      bank_name: f.bank_name.trim() || null, bank_branch: f.bank_branch.trim() || null,
      bank_account: f.bank_account.trim() || null, bank_swift: f.bank_swift.trim() || null,
      bank_code: f.bank_code.trim() || null, contact_name: f.contact_name.trim() || null,
      contact_phone: f.contact_phone.trim() || null, contact_email: f.contact_email.trim() || null,
      notes: f.notes.trim() || null, created_by: user?.id,
    };

    const { data, error: err } = isEdit
      ? await supabase.from("suppliers").update(payload).eq("id", supplier!.id).select().single()
      : await supabase.from("suppliers").insert(payload).select().single();

    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("audit_logs").insert({
      business_id: businessId, user_id: user?.id, user_email: member?.email, user_role: member?.role,
      action: `supplier.${isEdit ? "updated" : "created"}`, entity_type: "supplier", entity_id: data.id,
      details: { name: f.name },
    });
    onSaved(data as Supplier); setSaving(false);
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <div><h2 className="text-lg font-bold">{isEdit ? "Edit Supplier" : "Add Supplier"}</h2><p className="text-sm text-slate-500 mt-0.5">Payment details for this payee</p></div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="field"><label className="label">Supplier / company name *</label><input className="input" placeholder="e.g. Kenya Power, Landlord Name" value={f.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="field">
            <label className="label">Category</label>
            <select className="select" value={f.category} onChange={e => set("category", e.target.value)}>
              <option value="">Select category…</option>
              {SUPPLIER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Payment type *</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(SUPPLIER_TYPE_CONFIG) as [SupplierType, any][]).map(([type, cfg]) => (
                <button key={type} type="button" onClick={() => setType(type)}
                  className={clsx("flex items-center gap-2.5 px-3.5 py-3 rounded-xl border-2 text-sm font-medium text-left transition-all",
                    f.type === type ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-300")}>
                  <span className="text-base">{cfg.icon}</span> {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {f.type === "paybill" && (
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <p className="label-xs">M-Pesa Paybill</p>
              <div className="field"><label className="label">Paybill number *</label><input className="input font-mono" placeholder="888880 (KPLC)" value={f.paybill_number} onChange={e => set("paybill_number", e.target.value)} /></div>
              <div className="field"><label className="label">Default account number</label><input className="input" placeholder="Meter no., customer ID…" value={f.account_number} onChange={e => set("account_number", e.target.value)} /><p className="field-hint">Can be overridden per payment</p></div>
            </div>
          )}
          {f.type === "till" && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="label-xs mb-3">M-Pesa Till</p>
              <div className="field"><label className="label">Till number *</label><input className="input font-mono" placeholder="123456" value={f.till_number} onChange={e => set("till_number", e.target.value)} /></div>
            </div>
          )}
          {f.type === "mobile_money" && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="label-xs mb-3">M-Pesa Send Money</p>
              <div className="field"><label className="label">Phone number *</label><input className="input font-mono" placeholder="0712 345 678" value={f.phone_number} onChange={e => set("phone_number", e.target.value)} /></div>
            </div>
          )}
          {f.type === "bank" && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3">
              <p className="label-xs text-blue-700">Bank Account — PesaLink Transfer</p>
              <div className="field"><label className="label">Bank *</label>
                <select className="select" value={f.bank_name} onChange={e => set("bank_name", e.target.value)}>
                  <option value="">Select bank…</option>{KE_BANKS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field"><label className="label">Branch</label><input className="input" placeholder="Westlands" value={f.bank_branch} onChange={e => set("bank_branch", e.target.value)} /></div>
                <div className="field"><label className="label">PesaLink bank code</label><input className="input font-mono" placeholder="01" value={f.bank_code} onChange={e => set("bank_code", e.target.value)} /></div>
              </div>
              <div className="field"><label className="label">Account number *</label><input className="input font-mono" placeholder="0123456789012" value={f.bank_account} onChange={e => set("bank_account", e.target.value)} /></div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <p className="label-xs">Contact Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">Contact name</label><input className="input" placeholder="Account manager" value={f.contact_name} onChange={e => set("contact_name", e.target.value)} /></div>
              <div className="field"><label className="label">Contact phone</label><input className="input" placeholder="0712 345 678" value={f.contact_phone} onChange={e => set("contact_phone", e.target.value)} /></div>
            </div>
            <div className="field"><label className="label">Contact email</label><input className="input" type="email" placeholder="billing@supplier.com" value={f.contact_email} onChange={e => set("contact_email", e.target.value)} /></div>
          </div>
          <div className="field"><label className="label">Internal notes</label><textarea className="textarea" rows={2} placeholder="Notes for your team…" value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
          {error && <div className="alert-danger"><span className="shrink-0">✕</span>{error}</div>}
        </div>
        <div className="drawer-footer">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : isEdit ? "Save Changes" : "Add Supplier"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Suppliers() {
  const { business, isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [typeF, setTypeF]     = useState("all");
  const [drawer, setDrawer]   = useState<Supplier | "new" | null>(null);

  useEffect(() => { if (business) load(); }, [business?.id]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data } = await supabase.from("suppliers").select("*").eq("business_id", business.id).eq("status","active").order("name");
    setSuppliers(data as Supplier[] || []);
    setLoading(false);
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this supplier?")) return;
    await supabase.from("suppliers").update({ status: "archived" }).eq("id", id);
    setSuppliers(p => p.filter(s => s.id !== id));
  };

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return (typeF === "all" || s.type === typeF) && (!q || s.name.toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q) || (s.paybill_number || "").includes(q) || (s.bank_account || "").includes(q));
  });

  return (
    <AppLayout title="Suppliers" subtitle="Manage your payment recipients"
      actions={isAdmin ? <button onClick={() => setDrawer("new")} className="btn-primary"><Plus size={15} /> Add Supplier</button> : undefined}>
      <div className="page-wrap">
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10 py-2" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["all","bank","paybill","till","mobile_money","other"].map(t => (
              <button key={t} onClick={() => setTypeF(t)}
                className={clsx("px-3.5 py-2 rounded-xl text-xs font-semibold transition-all capitalize",
                  typeF === t ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                {t === "all" ? "All" : SUPPLIER_TYPE_CONFIG[t as SupplierType]?.label || t}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-400">{filtered.length}</p>
        </div>

        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table min-w-[700px]">
              <thead className="thead"><tr>{["Supplier","Type","Payment details","Category","Contact","Added",""].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="tbody">
                {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({length:7}).map((_,j) => <td key={j} className="td"><div className="skeleton h-4 w-full" /></td>)}</tr>)
                : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="td text-center py-16 text-slate-400"><div className="text-4xl mb-3">🏢</div>{search ? "No suppliers match" : "No suppliers yet"}</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="tr">
                    <td className="td"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-base shrink-0">{SUPPLIER_TYPE_CONFIG[s.type].icon}</div><div><p className="font-semibold">{s.name}</p>{s.notes && <p className="text-xs text-slate-400 truncate max-w-[130px]">{s.notes}</p>}</div></div></td>
                    <td className="td"><span className="badge badge-slate">{SUPPLIER_TYPE_CONFIG[s.type].label}</span></td>
                    <td className="td font-mono text-xs">
                      {s.type === "paybill"      && <div><p className="font-bold">{s.paybill_number}</p>{s.account_number && <p className="text-slate-400">Acc: {s.account_number}</p>}</div>}
                      {s.type === "till"         && <p className="font-bold">{s.till_number}</p>}
                      {s.type === "mobile_money" && <p className="font-bold">{s.phone_number}</p>}
                      {s.type === "bank"         && <div><p>{s.bank_name}</p><p className="text-slate-400">{s.bank_account}</p></div>}
                    </td>
                    <td className="td text-xs text-slate-500">{s.category || "—"}</td>
                    <td className="td text-xs">{s.contact_name ? <><p className="font-medium">{s.contact_name}</p>{s.contact_phone && <p className="text-slate-400">{s.contact_phone}</p>}</> : "—"}</td>
                    <td className="td text-xs text-slate-400">{format(new Date(s.created_at), "dd MMM yyyy")}</td>
                    <td className="td">
                      {isAdmin && <div className="flex gap-1"><button onClick={() => setDrawer(s)} className="btn-icon p-2"><Edit2 size={13} /></button><button onClick={() => archive(s.id)} className="btn-icon p-2 hover:text-red-500 hover:bg-red-50"><Archive size={13} /></button></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawer !== null && (
        <SupplierDrawer
          supplier={drawer === "new" ? undefined : drawer}
          businessId={business!.id}
          onClose={() => setDrawer(null)}
          onSaved={saved => { if (drawer === "new") setSuppliers(p => [saved, ...p].sort((a,b) => a.name.localeCompare(b.name))); else setSuppliers(p => p.map(s => s.id === saved.id ? saved : s)); setDrawer(null); }}
        />
      )}
    </AppLayout>
  );
}
