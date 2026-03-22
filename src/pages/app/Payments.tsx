import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Search, Eye, X, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { AppLayout, StatusBadge } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentRequest, Supplier, PaymentMethod, Frequency } from "@/lib/types";
import { fmtKES, daysUntil, today, clsx } from "@/lib/utils";
import { SUPPLIER_TYPE_CONFIG, METHOD_CONFIG, FREQUENCY_LABELS, PAYMENTS_URL } from "@/lib/constants";
import { format } from "date-fns";

type Tab = "upcoming" | "pending" | "history";

function NewPaymentDrawer({ businessId, plan, onClose, onSaved }: {
  businessId: string; plan: string; onClose: () => void; onSaved: () => void;
}) {
  const { user, member } = useAuth();
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [f, setF] = useState({
    supplier_id: "", title: "", amount: "",
    payment_method: "kcb_paybill" as PaymentMethod,
    account_ref: "", reference: "", notes: "",
    due_date: today(), frequency: "once" as Frequency, requires_approval: true,
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
    set("account_ref", ref);
  }, [f.supplier_id]);

  const fee = 0; // Subscription-only — no transaction fees

  const submit = async (asDraft = false) => {
    if (!f.supplier_id) { setError("Select a supplier"); return; }
    if (!f.title.trim()) { setError("Title is required"); return; }
    if (!f.amount || Number(f.amount) <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    const status = asDraft ? "draft" : f.requires_approval ? "pending_approval" : "approved";
    const { data, error: err } = await supabase.from("payment_requests").insert({
      business_id: businessId, supplier_id: f.supplier_id, title: f.title.trim(),
      amount: Number(f.amount), platform_fee: fee, payment_method: f.payment_method,
      account_ref: f.account_ref.trim() || null, reference: f.reference.trim() || null,
      notes: f.notes.trim() || null, due_date: f.due_date, status,
      requested_by: user!.id, requested_at: new Date().toISOString(),
    }).select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("audit_logs").insert({
      business_id: businessId, user_id: user?.id, user_email: member?.email, user_role: member?.role,
      action: "payment.created", entity_type: "payment_request", entity_id: data.id,
      details: { title: f.title, amount: Number(f.amount), status },
    });
    if (status === "pending_approval") {
      const { data: approvers } = await supabase.from("business_members").select("user_id")
        .eq("business_id", businessId).in("role", ["owner","admin","approver"]).eq("status","active");
      await Promise.all((approvers || []).map(a =>
        supabase.from("notifications").insert({
          business_id: businessId, user_id: a.user_id, type: "approval_required",
          title: "Payment needs approval", message: `${f.title} — ${fmtKES(Number(f.amount))}`, entity_id: data.id,
        })
      ));
    }
    onSaved(); setSaving(false);
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <div><h2 className="text-lg font-bold">New Payment Request</h2><p className="text-sm text-slate-500 mt-0.5">Submit for approval or schedule directly</p></div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="field"><label className="label">Supplier *</label>
            <select className="select" value={f.supplier_id} onChange={e => set("supplier_id", e.target.value)}>
              <option value="">Choose supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{SUPPLIER_TYPE_CONFIG[s.type].icon} {s.name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Payment title *</label><input className="input" placeholder="e.g. KPLC March, Rent April" value={f.title} onChange={e => set("title", e.target.value)} /></div>
          <div className="field">
            <label className="label">Amount (KES) *</label>
            <input className="input-lg text-xl font-bold" type="number" placeholder="0" min={1} value={f.amount} onChange={e => set("amount", e.target.value)} />
            {f.amount && Number(f.amount) > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-sm bg-slate-50 rounded-xl px-4 py-2.5"><span className="text-slate-500">Amount</span><span className="font-bold">{fmtKES(Number(f.amount))}</span></div>
                <div className="flex justify-between text-sm bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5"><span className="text-primary font-medium">Platform fee</span><span className="font-bold text-primary">KES {fee}</span></div>
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
                  <span>{cfg.icon}</span><div><p className="font-semibold text-xs">{cfg.label}</p><p className="text-[10px] text-slate-400">{cfg.provider}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Account / ref number</label><input className="input font-mono" value={f.account_ref} onChange={e => set("account_ref", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">Due date *</label><input className="input" type="date" value={f.due_date} min={today()} onChange={e => set("due_date", e.target.value)} /></div>
            <div className="field"><label className="label">Reference</label><input className="input" placeholder="INV-001" value={f.reference} onChange={e => set("reference", e.target.value)} /></div>
          </div>
          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
            <div><p className="text-sm font-semibold text-amber-900">Requires approval</p><p className="text-xs text-amber-700/80 mt-0.5">Approver must review before funds move</p></div>
            <button type="button" onClick={() => set("requires_approval", !f.requires_approval)}
              className={clsx("w-12 h-6 rounded-full transition-all relative", f.requires_approval ? "bg-amber-500" : "bg-slate-200")}>
              <span className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all", f.requires_approval ? "left-7" : "left-1")} />
            </button>
          </div>
          <div className="field"><label className="label">Notes</label><textarea className="textarea" rows={2} placeholder="Notes for approver…" value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
          {error && <div className="alert-danger"><XCircle size={14} className="text-red-500 shrink-0" />{error}</div>}
        </div>
        <div className="drawer-footer flex-col gap-2">
          <button onClick={() => submit(false)} disabled={saving} className="btn-primary w-full py-3">
            {saving ? <><Loader2 size={14} className="animate-spin" />Submitting…</> : f.requires_approval ? "Submit for Approval" : "Schedule Payment"}
          </button>
          <div className="flex gap-2">
            <button onClick={() => submit(true)} disabled={saving} className="btn-secondary flex-1 text-sm">Save as Draft</button>
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailModal({ req, onClose, onAction }: {
  req: PaymentRequest; onClose: () => void; onAction: () => void;
}) {
  const { user, member, canApprove, canExecute } = useAuth();
  const [acting, setActing]         = useState(false);
  const [reason, setReason]         = useState("");
  const [showReject, setShowReject] = useState(false);

  const approve = async () => {
    setActing(true);
    await supabase.from("payment_requests").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", req.id);
    await supabase.from("audit_logs").insert({ business_id: req.business_id, user_id: user?.id, user_email: member?.email, user_role: member?.role, action: "payment.approved", entity_type: "payment_request", entity_id: req.id, details: { title: req.title, amount: req.amount } });
    onAction(); setActing(false); onClose();
  };

  const reject = async () => {
    if (!reason.trim()) return;
    setActing(true);
    await supabase.from("payment_requests").update({ status: "rejected", rejected_by: user?.id, rejected_at: new Date().toISOString(), rejection_reason: reason }).eq("id", req.id);
    await supabase.from("audit_logs").insert({ business_id: req.business_id, user_id: user?.id, user_email: member?.email, user_role: member?.role, action: "payment.rejected", entity_type: "payment_request", entity_id: req.id, details: { title: req.title, reason } });
    onAction(); setActing(false); onClose();
  };

  const execute = async () => {
    if (!confirm(`Execute ${fmtKES(req.amount)} to ${(req.supplier as any)?.name}? This will initiate the real transfer.`)) return;
    setActing(true);
    await supabase.from("payment_requests").update({ status: "executing", executed_by: user?.id, executed_at: new Date().toISOString() }).eq("id", req.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(PAYMENTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "execute", payment_request_id: req.id }),
      });
      const result = await res.json();
      if (!result.success) {
        await supabase.from("payment_requests").update({ status: "failed", failure_reason: result.error }).eq("id", req.id);
        alert("Execution failed: " + result.error);
      }
    } catch (e) {
      await supabase.from("payment_requests").update({ status: "failed", failure_reason: String(e) }).eq("id", req.id);
    }
    onAction(); setActing(false); onClose();
  };

  const details = [
    ["Supplier",       (req.supplier as any)?.name || "—"],
    ["Method",         METHOD_CONFIG[req.payment_method]?.label || req.payment_method],
    ["Account / ref",  req.account_ref || "—"],
    ["Invoice ref",    req.reference   || "—"],
    ["Due date",       format(new Date(req.due_date), "dd MMMM yyyy")],
    ["Requested",      format(new Date(req.requested_at), "dd MMM yyyy, HH:mm")],
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-lg">{req.title}</h2>
            <div className="flex items-center gap-2 mt-1"><StatusBadge status={req.status} />{req.reference && <span className="text-xs text-slate-400 font-mono">{req.reference}</span>}</div>
          </div>
          <button onClick={onClose} className="btn-icon ml-4"><X size={17} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-primary/60 mb-1">Payment Amount</p>
            <p className="text-5xl font-black text-primary">{fmtKES(req.amount)}</p>
            <p className="text-sm text-slate-400 mt-1">+ KES {req.platform_fee} platform fee</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {details.map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-sm font-semibold mt-0.5 capitalize">{value}</p></div>
            ))}
          </div>
          {req.approved_at  && <div className="alert-success"><CheckCircle2 size={14} className="text-emerald-600 shrink-0" />Approved {format(new Date(req.approved_at), "dd MMM yyyy, HH:mm")}</div>}
          {req.rejected_at  && <div className="alert-danger"><XCircle size={14} className="text-red-500 shrink-0" /><div><p>Rejected {format(new Date(req.rejected_at), "dd MMM yyyy, HH:mm")}</p>{req.rejection_reason && <p className="text-xs mt-0.5">{req.rejection_reason}</p>}</div></div>}
          {req.completed_at && <div className="alert-success"><CheckCircle2 size={14} className="text-emerald-600 shrink-0" /><div><p className="font-semibold">Completed {format(new Date(req.completed_at), "dd MMM yyyy, HH:mm")}</p>{req.mpesa_receipt && <p className="font-mono text-xs mt-0.5">M-Pesa: {req.mpesa_receipt}</p>}{req.bank_reference && <p className="font-mono text-xs mt-0.5">Ref: {req.bank_reference}</p>}</div></div>}
          {req.failure_reason && <div className="alert-danger"><AlertTriangle size={14} className="text-red-500 shrink-0" /><div><p className="font-semibold">Failed</p><p className="text-xs mt-0.5">{req.failure_reason}</p></div></div>}
          {req.notes && <div className="bg-slate-50 rounded-xl px-4 py-3"><p className="text-xs text-slate-400 mb-1">Notes</p><p className="text-sm">{req.notes}</p></div>}
          {showReject && (
            <div className="space-y-2">
              <textarea className="textarea" rows={3} placeholder="Reason for rejection (required)…" value={reason} onChange={e => setReason(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setShowReject(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={reject} disabled={!reason.trim() || acting} className="btn-danger flex-1">{acting ? "Rejecting…" : "Confirm Rejection"}</button>
              </div>
            </div>
          )}
        </div>
        {!showReject && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
            {canApprove && req.status === "pending_approval" && <>
              <button onClick={() => setShowReject(true)} className="flex-1 border-2 border-red-200 text-red-600 rounded-xl py-3 font-semibold text-sm hover:bg-red-50 transition-all">Reject</button>
              <button onClick={approve} disabled={acting} className="btn-success flex-1 py-3">{acting ? <><Loader2 size={14} className="animate-spin" />Approving…</> : "✓ Approve"}</button>
            </>}
            {canExecute && ["approved","scheduled"].includes(req.status) && (
              <button onClick={execute} disabled={acting} className="btn-primary flex-1 py-3">{acting ? <><Loader2 size={14} className="animate-spin" />Processing…</> : `Execute — ${fmtKES(req.amount)}`}</button>
            )}
            {canExecute && req.status === "failed" && (
              <button onClick={execute} disabled={acting} className="flex-1 bg-amber-500 text-white rounded-xl py-3 font-semibold text-sm hover:bg-amber-600 disabled:opacity-50">{acting ? "Retrying…" : "Retry Payment"}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Payments() {
  const { tab: urlTab } = useParams<{ tab?: Tab }>();
  const navigate        = useNavigate();
  const { business, canWrite } = useAuth();
  const [tab, setTab]   = useState<Tab>((urlTab as Tab) || "upcoming");
  const [reqs, setReqs] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail]   = useState<PaymentRequest | null>(null);

  useEffect(() => { if (urlTab && urlTab !== tab) setTab(urlTab as Tab); }, [urlTab]);
  useEffect(() => { if (business) load(); }, [business?.id, tab]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const tod = today();
    let q = supabase.from("payment_requests").select("*,supplier:suppliers(name,type)").eq("business_id", business.id);
    if (tab === "upcoming") q = q.in("status", ["draft","pending_approval","approved","scheduled"]).gte("due_date", tod).order("due_date");
    else if (tab === "pending") q = q.eq("status", "pending_approval").order("requested_at");
    else q = q.in("status", ["completed","failed","rejected","cancelled","executing"]).order("updated_at", { ascending: false }).limit(200);
    const { data } = await q;
    setReqs(data as PaymentRequest[] || []);
    setLoading(false);
  };

  const filtered = reqs.filter(r => {
    const q = search.toLowerCase();
    return !q || r.title.toLowerCase().includes(q) || ((r.supplier as any)?.name || "").toLowerCase().includes(q) || (r.reference || "").toLowerCase().includes(q);
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: "upcoming", label: "Upcoming" },
    { id: "pending",  label: "Pending Approval" },
    { id: "history",  label: "History" },
  ];

  return (
    <AppLayout title="Payments" subtitle="Review, approve and track all payments"
      actions={canWrite ? <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={15} /> New Payment</button> : undefined}>
      <div className="page-wrap">
        <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); navigate(`/payments/${t.id}`); }}
              className={clsx("px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                tab === t.id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10 py-2" placeholder="Search payments…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={load} className="btn-icon p-2.5"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
          <p className="text-sm text-slate-400">{filtered.length}</p>
        </div>

        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table min-w-[700px]">
              <thead className="thead"><tr>{["Payment","Supplier","Amount","Due","Status",""].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="tbody">
                {loading ? Array.from({ length: 6 }).map((_, i) => <tr key={i}>{Array.from({length:6}).map((_,j) => <td key={j} className="td"><div className="skeleton h-4 w-full" /></td>)}</tr>)
                : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="td text-center py-16 text-slate-400"><div className="text-4xl mb-3">💳</div>{tab === "pending" ? "No payments pending approval" : tab === "upcoming" ? "No upcoming payments" : "No payment history"}</td></tr>
                ) : filtered.map(req => {
                  const days = daysUntil(req.due_date);
                  return (
                    <tr key={req.id} className="tr-click" onClick={() => setDetail(req)}>
                      <td className="td"><p className="font-semibold truncate max-w-[180px]">{req.title}</p>{req.reference && <p className="text-xs text-slate-400 font-mono">{req.reference}</p>}</td>
                      <td className="td"><div className="flex items-center gap-2"><span>{(req.supplier as any)?.type === "bank" ? "🏦" : "📱"}</span><span className="truncate max-w-[130px]">{(req.supplier as any)?.name || "—"}</span></div></td>
                      <td className="td font-bold">{fmtKES(req.amount)}</td>
                      <td className="td">
                        <p className="text-sm">{format(new Date(req.due_date), "dd MMM yyyy")}</p>
                        {tab === "upcoming" && <p className={clsx("text-xs font-semibold", days < 0 ? "text-red-500" : days <= 3 ? "text-amber-500" : "text-slate-400")}>{days < 0 ? "Overdue" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}</p>}
                      </td>
                      <td className="td"><StatusBadge status={req.status} /></td>
                      <td className="td"><button className="btn-icon p-2"><Eye size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showNew && business && <NewPaymentDrawer businessId={business.id} plan={business.plan} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {detail && <DetailModal req={detail} onClose={() => setDetail(null)} onAction={load} />}
    </AppLayout>
  );
}
