import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, Filter, TrendingUp, BookOpen, FileText } from "lucide-react";
import { AppLayout, StatusBadge } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, monthStart, today, clsx } from "@/lib/utils";
import { METHOD_CONFIG } from "@/lib/constants";
import { format } from "date-fns";

type Tab = "summary" | "kra" | "audit";

export default function Reports() {
  const { tab: urlTab } = useParams<{ tab?: Tab }>();
  const navigate = useNavigate();
  const { business } = useAuth();
  const [tab, setTab]     = useState<Tab>((urlTab as Tab) || "summary");
  const [data, setData]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom]   = useState(monthStart());
  const [to, setTo]       = useState(today());

  useEffect(() => { if (urlTab && urlTab !== tab) setTab(urlTab as Tab); }, [urlTab]);
  useEffect(() => { if (business) load(); }, [business?.id, tab, from, to]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    if (tab === "audit") {
      const { data: logs } = await supabase.from("audit_logs").select("*")
        .eq("business_id", business.id).gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }).limit(300);
      setData(logs || []);
    } else {
      const { data: reqs } = await supabase.from("payment_requests")
        .select("*,supplier:suppliers(name,type,category)").eq("business_id", business.id)
        .gte("due_date", from).lte("due_date", to).order("due_date", { ascending: false });
      setData(reqs || []);
    }
    setLoading(false);
  };

  const completed = data.filter((r: any) => r.status === "completed");
  const totalPaid = completed.reduce((s: number, r: any) => s + r.amount, 0);
  const totalFees = completed.reduce((s: number, r: any) => s + (r.platform_fee || 0), 0);

  const exportCSV = () => {
    let rows: string[][];
    if (tab === "audit") {
      rows = [["Timestamp","User","Role","Action","Details"],
        ...data.map((l: any) => [format(new Date(l.created_at),"yyyy-MM-dd HH:mm:ss"), l.user_email||"System", l.user_role||"", l.action, JSON.stringify(l.details||{})])];
    } else {
      rows = [["Date","Supplier","Category","Title","Amount","Status","Method","Reference","Receipt/Ref"],
        ...data.map((r: any) => [r.due_date,(r.supplier as any)?.name||"",(r.supplier as any)?.category||"",r.title,String(r.amount),r.status,r.payment_method,r.reference||"",r.mpesa_receipt||r.bank_reference||""])];
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `shieldpay-${tab}-${from}-${to}.csv`; a.click();
  };

  const TABS = [
    { id: "summary" as Tab, label: "Payment Summary", icon: TrendingUp },
    { id: "kra"     as Tab, label: "KRA Report",      icon: BookOpen   },
    { id: "audit"   as Tab, label: "Audit Log",       icon: FileText   },
  ];

  return (
    <AppLayout title="Reports" subtitle="Financial reports and compliance documentation"
      actions={<button onClick={exportCSV} className="btn-secondary"><Download size={15} /> Export CSV</button>}>
      <div className="page-wrap">
        <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); navigate(`/reports/${t.id}`); }}
              className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                tab === t.id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="card p-4 flex flex-wrap gap-4 items-center">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <div className="flex items-center gap-2"><label className="label mb-0 text-slate-500">From</label><input type="date" className="input py-2 text-sm w-40" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="flex items-center gap-2"><label className="label mb-0 text-slate-500">To</label><input type="date" className="input py-2 text-sm w-40" value={to} onChange={e => setTo(e.target.value)} /></div>
          {tab !== "audit" && !loading && (
            <div className="ml-auto flex gap-6">
              <div className="text-center"><p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Paid</p><p className="text-2xl font-black mt-0.5">{completed.length}</p></div>
              <div className="text-center"><p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total</p><p className="text-2xl font-black text-primary mt-0.5">{fmtKES(totalPaid)}</p></div>
              <div className="text-center"><p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Fees</p><p className="text-2xl font-black mt-0.5">{fmtKES(totalFees)}</p></div>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="table-wrap">
            {tab === "summary" && (
              <table className="table min-w-[800px]">
                <thead className="thead"><tr>{["Date","Supplier","Title","Amount","Method","Status","Receipt"].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody className="tbody">
                  {loading ? null : data.length === 0 ? <tr><td colSpan={7} className="td text-center py-12 text-slate-400">No payments in this period</td></tr>
                  : data.map((r: any) => (
                    <tr key={r.id} className="tr">
                      <td className="td text-slate-500">{format(new Date(r.due_date),"dd MMM yyyy")}</td>
                      <td className="td font-medium">{(r.supplier as any)?.name||"—"}</td>
                      <td className="td truncate max-w-[160px]">{r.title}</td>
                      <td className="td font-bold">{fmtKES(r.amount)}</td>
                      <td className="td text-xs text-slate-500">{METHOD_CONFIG[r.payment_method as keyof typeof METHOD_CONFIG]?.label || r.payment_method}</td>
                      <td className="td"><StatusBadge status={r.status} /></td>
                      <td className="td font-mono text-xs text-emerald-700">{r.mpesa_receipt||r.bank_reference||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "kra" && (
              <table className="table min-w-[900px]">
                <thead className="thead"><tr>{["Date","Supplier","Category","Net Amount","VAT (16%)","Gross Total","Receipt"].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody className="tbody">
                  {loading ? null : data.filter((r: any) => r.status === "completed").map((r: any) => {
                    const vat = Math.round(r.amount * 0.16);
                    return (
                      <tr key={r.id} className="tr">
                        <td className="td">{format(new Date(r.due_date),"dd MMM yyyy")}</td>
                        <td className="td font-medium">{(r.supplier as any)?.name||"—"}</td>
                        <td className="td text-slate-500 text-xs">{(r.supplier as any)?.category||"—"}</td>
                        <td className="td font-bold">{fmtKES(r.amount)}</td>
                        <td className="td text-slate-500">{fmtKES(vat)}</td>
                        <td className="td font-bold text-primary">{fmtKES(r.amount + vat)}</td>
                        <td className="td font-mono text-xs text-emerald-700">{r.mpesa_receipt||r.bank_reference||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {!loading && (
                  <tfoot><tr className="tfoot-row">
                    <td colSpan={3} className="px-5 py-3.5">TOTAL — {completed.length} payments</td>
                    <td className="px-5 py-3.5">{fmtKES(totalPaid)}</td>
                    <td className="px-5 py-3.5">{fmtKES(Math.round(totalPaid * 0.16))}</td>
                    <td className="px-5 py-3.5 text-primary">{fmtKES(Math.round(totalPaid * 1.16))}</td>
                    <td />
                  </tr></tfoot>
                )}
              </table>
            )}

            {tab === "audit" && (
              <table className="table min-w-[700px]">
                <thead className="thead"><tr>{["Timestamp","User","Role","Action","Details"].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody className="tbody">
                  {loading ? null : data.length === 0 ? <tr><td colSpan={5} className="td text-center py-12 text-slate-400">No audit logs</td></tr>
                  : data.map((l: any) => (
                    <tr key={l.id} className="tr">
                      <td className="td font-mono text-xs text-slate-500 whitespace-nowrap">{format(new Date(l.created_at),"dd MMM yyyy HH:mm:ss")}</td>
                      <td className="td text-sm">{l.user_email||"System"}</td>
                      <td className="td">{l.user_role && <span className="badge badge-slate capitalize text-xs">{l.user_role}</span>}</td>
                      <td className="td"><span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{l.action}</span></td>
                      <td className="td text-xs text-slate-500 max-w-[200px] truncate">{l.details ? JSON.stringify(l.details) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
