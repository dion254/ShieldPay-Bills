import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Loader2, Edit2, Pause, Play, XCircle,
         Inbox, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, clsx } from "@/lib/utils";
import { METHOD_CONFIG, SUPPLIER_TYPE_CONFIG, FREQUENCY_LABELS } from "@/lib/constants";
import type { PaymentSchedule, Supplier, PaymentMethod, Frequency } from "@/lib/types";
import { format } from "date-fns";

function BillDrawer({ bill, businessId, plan, onClose, onSaved }: {
  bill?: PaymentSchedule; businessId: string; plan: string;
  onClose: () => void; onSaved: () => void;
}) {
  const { user, member } = useAuth();
  const isEdit = !!bill;
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [f, setF] = useState({
    supplier_id:       bill?.supplier_id       ?? "",
    title:             bill?.title             ?? "",
    amount:            bill?.amount?.toString() ?? "",
    payment_method:    bill?.payment_method    ?? "kcb_paybill" as PaymentMethod,
    account_override:  bill?.account_override  ?? "",
    reference:         bill?.reference         ?? "",
    notes:             bill?.notes             ?? "",
    frequency:         bill?.frequency         ?? "monthly" as Frequency,
    start_date:        bill?.start_date        ?? new Date().toISOString().split("T")[0],
    requires_approval: bill?.requires_approval ?? true,
  });
  const set = (k: string, v: any) => { setF(p => ({ ...p, [k]: v })); setError(""); };

  useEffect(() => {
    supabase.from("suppliers").select("*").eq("business_id", businessId).eq("status","active").order("name")
      .then(({ data }) => setSuppliers(data as Supplier[] || []));
  }, [businessId]);

  const selSup = suppliers.find(s => s.id === f.supplier_id);
  useEffect(() => {
    if (!selSup) return;
    set("payment_method", selSup.default_method);
    if (!f.title) set("title", selSup.name);
    const ref = selSup.paybill_number || selSup.till_number || selSup.phone_number || selSup.bank_account || "";
    set("account_override", ref);
  }, [f.supplier_id]);

  const fee = 0; // Subscription-only — no transaction fees

  const save = async () => {
    if (!f.supplier_id) { setError("Select a supplier"); return; }
    if (!f.title.trim()) { setError("Bill title is required"); return; }
    if (!f.amount || Number(f.amount) <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);

    const payload = {
      business_id: businessId, supplier_id: f.supplier_id, title: f.title.trim(),
      amount: Number(f.amount), payment_method: f.payment_method,
      account_override: f.account_override.trim() || null,
      reference: f.reference.trim() || null, notes: f.notes.trim() || null,
      frequency: f.frequency, start_date: f.start_date,
      next_due_date: f.start_date, requires_approval: f.requires_approval,
      status: "active", created_by: user?.id,
    };

    const { error: err } = isEdit
      ? await supabase.from("payment_schedules").update(payload).eq("id", bill!.id)
      : await supabase.from("payment_schedules").insert(payload);

    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("audit_logs").insert({
      business_id: businessId, user_id: user?.id, user_email: member?.email, user_role: member?.role,
      action: `bill.${isEdit ? "updated" : "created"}`, entity_type: "payment_schedule",
      details: { title: f.title, amount: Number(f.amount) },
    });
    onSaved(); setSaving(false);
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <div><h2 className="text-lg font-bold">{isEdit ? "Edit Bill" : "Schedule New Bill"}</h2><p className="text-sm text-slate-500 mt-0.5">Set up a recurring or one-time bill</p></div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label className="label">Supplier / Payee *</label>
            <select className="select" value={f.supplier_id} onChange={e => set("supplier_id", e.target.value)}>
              <option value="">Choose supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{SUPPLIER_TYPE_CONFIG[s.type].icon} {s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Bill title *</label>
            <input className="input" placeholder="e.g. KPLC February, Rent March 2026" value={f.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Amount (KES) *</label>
            <input className="input-lg text-xl font-bold" type="number" placeholder="0" min={1} value={f.amount} onChange={e => set("amount", e.target.value)} />
            {f.amount && Number(f.amount) > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-sm bg-slate-50 rounded-xl px-4 py-2.5">
                  <span className="text-slate-500">Bill amount</span><span className="font-bold">{fmtKES(Number(f.amount))}</span>
                </div>
                <div className="flex justify-between text-sm bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5">
                </div>
              </div>
            )}
          </div>
          <div className="field">
            <label className="label">Payment method</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(METHOD_CONFIG) as [PaymentMethod, any][]).map(([m, cfg]) => (
                <button key={m} type="button" onClick={() => set("payment_method", m)}
                  className={clsx("flex items-center gap-2 p-3 rounded-xl border-2 text-sm text-left transition-all",
                    f.payment_method === m ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300")}>
                  <span>{cfg.icon}</span>
                  <div><p className="font-semibold text-xs">{cfg.label}</p><p className="text-[10px] text-slate-400">{cfg.provider}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label">Account / reference number</label>
            <input className="input font-mono" placeholder="Auto-filled from supplier" value={f.account_override} onChange={e => set("account_override", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Start date *</label>
              <input className="input" type="date" value={f.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Frequency *</label>
              <select className="select" value={f.frequency} onChange={e => set("frequency", e.target.value)}>
                {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Invoice / reference (optional)</label>
            <input className="input" placeholder="INV-2026-001" value={f.reference} onChange={e => set("reference", e.target.value)} />
          </div>
          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-amber-900">Requires approval</p>
              <p className="text-xs text-amber-700/80 mt-0.5">An approver must review before funds move</p>
            </div>
            <button type="button" onClick={() => set("requires_approval", !f.requires_approval)}
              className={clsx("w-12 h-6 rounded-full transition-all relative", f.requires_approval ? "bg-amber-500" : "bg-slate-200")}>
              <span className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all", f.requires_approval ? "left-7" : "left-1")} />
            </button>
          </div>
          <div className="field">
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} placeholder="Notes for your team…" value={f.notes} onChange={e => set("notes", e.target.value)} />
          </div>
          {error && <div className="alert-danger"><XCircle size={14} className="text-red-500 shrink-0" />{error}</div>}
        </div>
        <div className="drawer-footer">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : isEdit ? "Save Changes" : "Schedule Bill"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Bills() {
  const { business, canWrite } = useAuth();
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [drawer, setDrawer]   = useState<PaymentSchedule | "new" | null>(null);

  useEffect(() => { if (business) load(); }, [business?.id]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data } = await supabase.from("payment_schedules")
      .select("*,supplier:suppliers(name,type)").eq("business_id", business.id)
      .neq("status","cancelled").order("next_due_date");
    setSchedules(data as PaymentSchedule[] || []);
    setLoading(false);
  };

  const toggle = async (s: PaymentSchedule) => {
    const ns = s.status === "active" ? "paused" : "active";
    await supabase.from("payment_schedules").update({ status: ns }).eq("id", s.id);
    setSchedules(p => p.map(x => x.id === s.id ? { ...x, status: ns } : x));
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this bill schedule?")) return;
    await supabase.from("payment_schedules").update({ status: "cancelled" }).eq("id", id);
    setSchedules(p => p.filter(x => x.id !== id));
  };

  const filtered = schedules.filter(s => {
    const q = search.toLowerCase();
    return !q || s.title.toLowerCase().includes(q) || (s.supplier as any)?.name?.toLowerCase().includes(q);
  });

  return (
    <AppLayout title="Bills" subtitle="Manage recurring and one-time bill schedules"
      actions={canWrite ? <button onClick={() => setDrawer("new")} className="btn-primary"><Plus size={15} /> Schedule Bill</button> : undefined}>
      <div className="page-wrap">
        <div className="card p-4 flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10 py-2" placeholder="Search bills…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <p className="text-sm text-slate-400 ml-auto">{filtered.length} schedule{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table min-w-[750px]">
              <thead className="thead"><tr>{["Bill","Supplier","Amount","Frequency","Next Due","Status",""].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="tbody">
                {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({length:7}).map((_,j) => <td key={j} className="td"><div className="skeleton h-4 w-full" /></td>)}</tr>)
                : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="td text-center py-16 text-slate-400"><div className="text-4xl mb-3">📋</div>{search ? "No bills match" : "No bills scheduled yet"}</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id} className="tr">
                    <td className="td">
                      <p className="font-semibold truncate max-w-[160px]">{s.title}</p>
                      {s.reference && <p className="text-xs text-slate-400 font-mono">{s.reference}</p>}
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span>{(SUPPLIER_TYPE_CONFIG as any)[(s.supplier as any)?.type]?.icon || "📋"}</span>
                        <span className="truncate max-w-[120px]">{(s.supplier as any)?.name || "—"}</span>
                      </div>
                    </td>
                    <td className="td font-bold">{fmtKES(s.amount)}</td>
                    <td className="td text-slate-500 text-xs capitalize">{FREQUENCY_LABELS[s.frequency]}</td>
                    <td className="td text-xs">{format(new Date(s.next_due_date), "dd MMM yyyy")}</td>
                    <td className="td">
                      <span className={clsx("badge", s.status === "active" ? "badge-green" : s.status === "paused" ? "badge-amber" : "badge-slate")}>
                        {s.status}
                      </span>
                    </td>
                    <td className="td">
                      {canWrite && (
                        <div className="flex gap-1">
                          <button onClick={() => setDrawer(s)} className="btn-icon p-2"><Edit2 size={13} /></button>
                          <button onClick={() => toggle(s)} className="btn-icon p-2 text-xs">{s.status === "active" ? <Pause size={13} /> : <Play size={13} />}</button>
                          <button onClick={() => cancel(s.id)} className="btn-icon p-2 hover:text-red-500 hover:bg-red-50"><XCircle size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawer !== null && business && (
        <BillDrawer
          bill={drawer === "new" ? undefined : drawer}
          businessId={business.id} plan={business.plan}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
        />
      )}
    </AppLayout>
  );
}
