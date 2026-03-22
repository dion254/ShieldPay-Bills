import React, { useState, useEffect } from "react";
import { Download, BookOpen, FileText, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, monthStart, today } from "@/lib/utils";
import { format } from "date-fns";

export default function KRA() {
  const { business } = useAuth();
  const [data, setData]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear]   = useState(new Date().getFullYear());
  const [quarter, setQ]   = useState(Math.ceil((new Date().getMonth() + 1) / 3));

  useEffect(() => { if (business) load(); }, [business?.id, year, quarter]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const qStart = new Date(year, (quarter - 1) * 3, 1).toISOString().split("T")[0];
    const qEnd   = new Date(year, quarter * 3, 0).toISOString().split("T")[0];
    const { data: reqs } = await supabase.from("payment_requests")
      .select("*,supplier:suppliers(name,type,category,kra_pin)").eq("business_id", business.id)
      .eq("status","completed").gte("completed_at", qStart + "T00:00:00").lte("completed_at", qEnd + "T23:59:59")
      .order("completed_at");
    setData(reqs || []);
    setLoading(false);
  };

  const totalNet  = data.reduce((s, r) => s + r.amount, 0);
  const totalVAT  = Math.round(totalNet * 0.16);
  const totalGross= totalNet + totalVAT;
  const totalFees = data.reduce((s, r) => s + (r.platform_fee || 0), 0);

  const exportCSV = () => {
    const rows = [
      ["KRA Payment Report", `${business?.name}`, `KRA PIN: ${business?.kra_pin || "—"}`, `Q${quarter} ${year}`, "", "", "", ""],
      ["Date Paid","Payee","Payee KRA PIN","Category","Description","Net Amount (KES)","VAT 16% (KES)","Gross Total (KES)","Receipt / Ref"],
      ...data.map(r => [
        r.completed_at ? format(new Date(r.completed_at),"yyyy-MM-dd") : r.due_date,
        (r.supplier as any)?.name||"",
        (r.supplier as any)?.kra_pin||"",
        (r.supplier as any)?.category||"",
        r.title, String(r.amount),
        String(Math.round(r.amount * 0.16)),
        String(Math.round(r.amount * 1.16)),
        r.mpesa_receipt||r.bank_reference||"",
      ]),
      ["","","","","TOTALS",String(totalNet),String(totalVAT),String(totalGross),""],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `KRA-Q${quarter}-${year}-${business?.name?.replace(/\s/g,"_")}.csv`; a.click();
  };

  return (
    <AppLayout title="KRA Filing" subtitle="Export KRA-compliant payment reports for filing"
      actions={<button onClick={exportCSV} className="btn-primary"><Download size={15} /> Export KRA CSV</button>}>
      <div className="page-wrap">
        {/* Filters */}
        <div className="card p-5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="label mb-0 text-slate-500">Year</label>
            <select className="select w-28 py-2" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="label mb-0 text-slate-500">Quarter</label>
            <select className="select w-40 py-2" value={quarter} onChange={e => setQ(Number(e.target.value))}>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Apr–Jun)</option>
              <option value={3}>Q3 (Jul–Sep)</option>
              <option value={4}>Q4 (Oct–Dec)</option>
            </select>
          </div>
          {business?.kra_pin && (
            <div className="ml-auto flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">KRA PIN: {business.kra_pin}</span>
            </div>
          )}
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Transactions", value: data.length, sub: `Q${quarter} ${year}` },
              { label: "Net Payments", value: fmtKES(totalNet), sub: "Before VAT" },
              { label: "VAT (16%)", value: fmtKES(totalVAT), sub: "Input VAT" },
              { label: "Gross Total", value: fmtKES(totalGross), sub: "Inc. VAT" },
            ].map(c => (
              <div key={c.label} className="card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{c.label}</p>
                <p className="text-2xl font-black mt-1">{c.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* KRA table */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-primary/10 rounded-xl flex items-center justify-center"><BookOpen size={13} className="text-primary" /></div>
              <h3 className="section-title">Q{quarter} {year} Payment Register</h3>
            </div>
            <p className="text-sm text-slate-500">{data.length} completed payments</p>
          </div>
          <div className="table-wrap">
            <table className="table min-w-[950px]">
              <thead className="thead"><tr>{["Date Paid","Payee","Category","Description","Net (KES)","VAT 16% (KES)","Gross (KES)","Receipt / Ref"].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="tbody">
                {loading ? Array.from({length:6}).map((_,i) => <tr key={i}>{Array.from({length:8}).map((_,j) => <td key={j} className="td"><div className="skeleton h-4 w-full" /></td>)}</tr>)
                : data.length === 0 ? <tr><td colSpan={8} className="td text-center py-16 text-slate-400"><div className="text-4xl mb-3">📄</div>No completed payments in Q{quarter} {year}</td></tr>
                : data.map(r => {
                  const vat = Math.round(r.amount * 0.16);
                  return (
                    <tr key={r.id} className="tr">
                      <td className="td text-xs text-slate-500 whitespace-nowrap">{r.completed_at ? format(new Date(r.completed_at),"dd MMM yyyy") : format(new Date(r.due_date),"dd MMM yyyy")}</td>
                      <td className="td font-medium">{(r.supplier as any)?.name||"—"}</td>
                      <td className="td text-xs text-slate-500">{(r.supplier as any)?.category||"—"}</td>
                      <td className="td truncate max-w-[150px]">{r.title}</td>
                      <td className="td font-bold">{fmtKES(r.amount)}</td>
                      <td className="td text-slate-500">{fmtKES(vat)}</td>
                      <td className="td font-bold text-primary">{fmtKES(r.amount + vat)}</td>
                      <td className="td font-mono text-xs text-emerald-700">{r.mpesa_receipt||r.bank_reference||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {!loading && data.length > 0 && (
                <tfoot><tr className="tfoot-row">
                  <td colSpan={4} className="px-5 py-3.5">QUARTERLY TOTAL — {data.length} payments</td>
                  <td className="px-5 py-3.5">{fmtKES(totalNet)}</td>
                  <td className="px-5 py-3.5">{fmtKES(totalVAT)}</td>
                  <td className="px-5 py-3.5 text-primary">{fmtKES(totalGross)}</td>
                  <td />
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="alert-info">
          <FileText size={15} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Using this report for KRA filing</p>
            <p className="text-blue-700/80 text-xs mt-0.5">Export the CSV and use the Gross Total column for your VAT return. All payment receipts (M-Pesa codes and bank references) are included as supporting documentation.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
