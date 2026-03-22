import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, XCircle, Clock, Plus, ArrowRight, Package, Users, TrendingUp, CreditCard, AlertTriangle, FileText } from "lucide-react";
import { AppLayout, StatCard, StatusBadge } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fmtKES, daysUntil, trialDaysLeft, clsx } from "@/lib/utils";
import { format } from "date-fns";

export default function Dashboard() {
  const navigate = useNavigate();
  const { business, canWrite, canApprove, member } = useAuth();
  const [stats, setStats]     = useState({ upcoming: 0, upcomingAmt: 0, paidCount: 0, paidAmt: 0, pendingApproval: 0, failed: 0, suppliers: 0, team: 0 });
  const [recent, setRecent]   = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { if (business) load(); }, [business?.id]);

  const load = async () => {
    if (!business) return;
    const bid = business.id;
    const tod = new Date().toISOString().split("T")[0];
    const mo0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

    const [allReqs, supCnt, teamCnt, recentQ, pendQ, upQ] = await Promise.all([
      supabase.from("payment_requests").select("status,amount,completed_at,due_date").eq("business_id", bid),
      supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("status", "active"),
      supabase.from("business_members").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("status", "active"),
      supabase.from("payment_requests").select("*,supplier:suppliers(name,type)").eq("business_id", bid).order("created_at", { ascending: false }).limit(8),
      supabase.from("payment_requests").select("*,supplier:suppliers(name,type)").eq("business_id", bid).eq("status", "pending_approval").order("requested_at").limit(6),
      supabase.from("payment_requests").select("*,supplier:suppliers(name,type)").eq("business_id", bid).in("status", ["approved","scheduled"]).gte("due_date", tod).order("due_date").limit(6),
    ]);

    const reqs = allReqs.data || [];
    const up_  = reqs.filter(r => ["approved","scheduled"].includes(r.status) && r.due_date >= tod);
    const paid = reqs.filter(r => r.status === "completed" && (r.completed_at || "") >= mo0);

    setStats({
      upcoming:        up_.length,
      upcomingAmt:     up_.reduce((s, r) => s + r.amount, 0),
      paidCount:       paid.length,
      paidAmt:         paid.reduce((s, r) => s + r.amount, 0),
      pendingApproval: reqs.filter(r => r.status === "pending_approval").length,
      failed:          reqs.filter(r => r.status === "failed").length,
      suppliers:       (supCnt as any).count || 0,
      team:            (teamCnt as any).count || 0,
    });
    setRecent(recentQ.data || []);
    setPending(pendQ.data || []);
    setUpcoming(upQ.data || []);
    setLoading(false);
  };

  const daysLeft = business?.status === "trial" ? trialDaysLeft(business.trial_ends_at) : null;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppLayout
      title={`${greeting}, ${member?.full_name?.split(" ")[0] || "there"}`}
      subtitle={`${format(new Date(), "EEEE, d MMMM yyyy")} · ${business?.name}`}
      actions={canWrite ? (
        <button onClick={() => navigate("/bills")} className="btn-primary"><Plus size={15} /> New Bill</button>
      ) : undefined}>

      <div className="page-wrap">
        {/* Trial warning */}
        {daysLeft !== null && daysLeft <= 7 && (
          <div className="alert-warn">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
              <p className="text-amber-700/80 text-xs mt-0.5">
                Subscribe now to keep automations running. No per-transaction fees — flat monthly rate only.
              </p>
            </div>
            <button onClick={() => navigate("/settings/billing")} className="btn-primary text-xs px-4 py-2 shrink-0">
              Subscribe — KES 1,499/mo
            </button>
          </div>
        )}

        {/* Stats row 1 */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="stat-card"><div className="skeleton h-3 w-24 mb-3" /><div className="skeleton h-8 w-16" /></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Upcoming payments" value={stats.upcoming} sub={fmtKES(stats.upcomingAmt)} icon={Calendar} iconBg="bg-blue-100 text-blue-600" onClick={() => navigate("/payments/upcoming")} />
            <StatCard label="Paid this month" value={stats.paidCount} sub={fmtKES(stats.paidAmt)} icon={CheckCircle2} iconBg="bg-emerald-100 text-emerald-600" onClick={() => navigate("/payments/history")} />
            <StatCard label="Pending approval" value={stats.pendingApproval} icon={Clock} iconBg={stats.pendingApproval > 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"} onClick={() => navigate("/payments/pending")} />
            <StatCard label="Failed payments" value={stats.failed} icon={XCircle} iconBg={stats.failed > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"} onClick={() => navigate("/payments/history")} />
          </div>
        )}

        {/* Stats row 2 + quick actions */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active suppliers" value={stats.suppliers} icon={Package} iconBg="bg-purple-100 text-purple-600" onClick={() => navigate("/suppliers")} />
            <StatCard label="Team members" value={stats.team} icon={Users} iconBg="bg-indigo-100 text-indigo-600" onClick={() => navigate("/team")} />
            <div className="col-span-2 bg-primary rounded-2xl p-5 flex flex-col justify-between">
              <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-3">Quick Actions</p>
              <div className="flex flex-wrap gap-2">
                {canWrite && <button onClick={() => navigate("/suppliers")} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"><Package size={12} /> Add Supplier</button>}
                {canWrite && <button onClick={() => navigate("/bills")} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"><Plus size={12} /> Schedule Bill</button>}
                {canApprove && stats.pendingApproval > 0 && (
                  <button onClick={() => navigate("/payments/pending")} className="flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-bold px-3 py-2 rounded-xl transition-all">
                    <CheckCircle2 size={12} /> Approve {stats.pendingApproval}
                  </button>
                )}
                <button onClick={() => navigate("/reports")} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"><TrendingUp size={12} /> Reports</button>
                <button onClick={() => navigate("/kra")} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all"><FileText size={12} /> KRA Report</button>
              </div>
            </div>
          </div>
        )}

        {/* Two column — pending + upcoming */}
        <div className="grid lg:grid-cols-2 gap-5">
          {canApprove && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-amber-100 rounded-xl flex items-center justify-center"><Clock size={13} className="text-amber-600" /></div>
                  <h3 className="section-title">Pending Approval</h3>
                  {pending.length > 0 && <span className="badge badge-amber">{pending.length}</span>}
                </div>
                <button onClick={() => navigate("/payments/pending")} className="btn-ghost text-xs px-2.5 py-1.5">View all <ArrowRight size={11} /></button>
              </div>
              <div className="divide-y divide-slate-50">
                {pending.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm"><CheckCircle2 size={28} className="mx-auto mb-2 opacity-30" />No pending approvals</div>
                ) : pending.map(req => (
                  <div key={req.id} onClick={() => navigate("/payments/pending")} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-base shrink-0">{req.supplier?.type === "bank" ? "🏦" : "📱"}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{req.title}</p>
                        <p className="text-xs text-slate-400">{req.supplier?.name} · {format(new Date(req.due_date), "dd MMM")}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold">{fmtKES(req.amount)}</p>
                      <p className="text-[10px] text-amber-600 font-semibold">Needs review</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-blue-100 rounded-xl flex items-center justify-center"><Calendar size={13} className="text-blue-600" /></div>
                <h3 className="section-title">Upcoming Bills</h3>
              </div>
              <button onClick={() => navigate("/payments/upcoming")} className="btn-ghost text-xs px-2.5 py-1.5">View all <ArrowRight size={11} /></button>
            </div>
            <div className="divide-y divide-slate-50">
              {upcoming.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm"><Calendar size={28} className="mx-auto mb-2 opacity-30" />No upcoming bills</div>
              ) : upcoming.map(req => {
                const days = daysUntil(req.due_date);
                return (
                  <div key={req.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-base shrink-0">{req.supplier?.type === "bank" ? "🏦" : "📱"}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{req.title}</p>
                        <p className="text-xs text-slate-400">{req.supplier?.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold">{fmtKES(req.amount)}</p>
                      <p className={clsx("text-[10px] font-semibold", days <= 0 ? "text-red-500" : days <= 3 ? "text-amber-500" : "text-slate-400")}>
                        {days <= 0 ? "Overdue" : days === 1 ? "Tomorrow" : `${days} days`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent payments table */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-primary/10 rounded-xl flex items-center justify-center"><CreditCard size={13} className="text-primary" /></div>
              <h3 className="section-title">Recent Payments</h3>
            </div>
            <button onClick={() => navigate("/payments/history")} className="btn-ghost text-xs px-2.5 py-1.5">View all <ArrowRight size={11} /></button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead className="thead"><tr>{["Payment","Supplier","Amount","Due","Status"].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="tbody">
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="td"><div className="skeleton h-4 w-full" /></td>)}</tr>
                )) : recent.length === 0 ? (
                  <tr><td colSpan={5} className="td text-center py-10 text-slate-400">No payments yet</td></tr>
                ) : recent.map(req => (
                  <tr key={req.id} className="tr-click" onClick={() => navigate("/payments/history")}>
                    <td className="td"><p className="font-semibold truncate max-w-[180px]">{req.title}</p></td>
                    <td className="td"><div className="flex items-center gap-2"><span>{req.supplier?.type === "bank" ? "🏦" : "📱"}</span><span className="truncate max-w-[120px]">{req.supplier?.name || "—"}</span></div></td>
                    <td className="td font-bold">{fmtKES(req.amount)}</td>
                    <td className="td text-slate-500 text-xs">{format(new Date(req.due_date), "dd MMM yyyy")}</td>
                    <td className="td"><StatusBadge status={req.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
