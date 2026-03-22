import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, Building2, Users, CheckCircle2, XCircle, RefreshCw,
  LogOut, Activity, CreditCard, Search, Eye, Plug, Settings,
  Plus, Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, INDUSTRY_CONFIG, ROLE_CONFIG } from "@/lib/constants";
import { fmtKES, clsx } from "@/lib/utils";
import { format } from "date-fns";

type AdminTab = "businesses" | "payments" | "integrations" | "actions";

// ─── Business Detail Side Panel ───────────────────────────────
function BusinessPanel({ b, onClose }: { b: any; onClose: () => void }) {
  const [members, setMembers]   = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [integs, setIntegs]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"members" | "payments" | "integrations">("members");

  useEffect(() => {
    const load = async () => {
      const [mRes, pRes, iRes] = await Promise.all([
        supabase.from("business_members").select("*").eq("business_id", b.id).order("joined_at"),
        supabase.from("payment_requests").select("*,supplier:suppliers(name)")
          .eq("business_id", b.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("accounting_integrations").select("*").eq("business_id", b.id),
      ]);
      setMembers(mRes.data ?? []);
      setPayments(pRes.data ?? []);
      setIntegs(iRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [b.id]);

  const forceAddMember = async () => {
    const email = prompt("Email to add as admin:");
    if (!email) return;
    const { error } = await supabase.from("business_members").upsert({
      business_id: b.id,
      user_id: "00000000-0000-0000-0000-000000000000",
      email: email.trim(), role: "admin", status: "invited",
    }, { onConflict: "business_id,email" });
    if (error) { alert(error.message); return; }
    setMembers(p => [...p, { email: email.trim(), role: "admin", status: "invited" }]);
    const u = await supabase.auth.getUser();
    await supabase.from("admin_actions").insert({
      admin_user_id: u.data.user?.id, admin_email: u.data.user?.email,
      action: "force_add_member", target_type: "business", target_id: b.id,
      details: { email: email.trim(), role: "admin" },
    });
    alert(`✅ ${email} invited as admin`);
  };

  const removeMember = async (m: any) => {
    if (m.role === "owner") return;
    if (!confirm(`Remove ${m.email}?`)) return;
    await supabase.from("business_members").update({ status: "suspended" }).eq("id", m.id);
    setMembers(p => p.filter(x => x.id !== m.id));
  };

  const changeMemberRole = async (id: string, role: string) => {
    await supabase.from("business_members").update({ role }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, role } : m));
  };

  const forcePaymentStatus = async (payId: string, status: string) => {
    if (!confirm(`Force status → "${status}"?`)) return;
    await supabase.from("payment_requests").update({ status }).eq("id", payId);
    setPayments(p => p.map(x => x.id === payId ? { ...x, status } : x));
    const u = await supabase.auth.getUser();
    await supabase.from("admin_actions").insert({
      admin_user_id: u.data.user?.id, admin_email: u.data.user?.email,
      action: "force_payment_status", target_type: "payment_request", target_id: payId,
      details: { new_status: status, business_id: b.id },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-black text-lg">
              {b.name[0].toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white text-lg">{b.name}</p>
              <p className="text-xs text-slate-400">{b.email} · {b.industry}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><XCircle size={18} /></button>
        </div>

        {/* Quick info strip */}
        <div className="grid grid-cols-4 border-b border-slate-800">
          {[
            { label: "Plan",    value: b.plan },
            { label: "Status",  value: b.status },
            { label: "KRA PIN", value: b.kra_pin || "—" },
            { label: "Since",   value: format(new Date(b.created_at), "MMM yyyy") },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 text-center border-r border-slate-800 last:border-0">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Admin quick actions */}
        <div className="px-5 py-3 border-b border-slate-800 flex gap-2 flex-wrap">
          <button onClick={forceAddMember}
            className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800 px-3 py-1.5 rounded-xl hover:bg-blue-900/60 flex items-center gap-1.5">
            <Plus size={11} /> Add Member
          </button>
          <select onChange={async e => {
            const plan = e.target.value; if (!plan) return;
            await supabase.from("businesses").update({ plan }).eq("id", b.id);
            b.plan = plan; alert(`Plan updated to ${plan}`);
          }} className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer">
            <option value="">Change Plan…</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={async () => {
            const ns = b.status === "suspended" ? "active" : "suspended";
            if (!confirm(`${ns === "suspended" ? "Suspend" : "Activate"} ${b.name}?`)) return;
            await supabase.from("businesses").update({ status: ns }).eq("id", b.id);
            b.status = ns; alert(`Status set to ${ns}`);
          }} className="text-xs bg-red-900/30 text-red-300 border border-red-800 px-3 py-1.5 rounded-xl hover:bg-red-900/50 flex items-center gap-1.5">
            {b.status === "suspended" ? <><CheckCircle2 size={11} /> Activate</> : <><XCircle size={11} /> Suspend</>}
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800 px-4">
          {(["members","payments","integrations"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-3 text-sm font-medium border-b-2 transition-all capitalize",
                tab === t ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-300")}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading ? Array.from({length:4}).map((_,i) => (
            <div key={i} className="h-12 bg-slate-800 animate-pulse rounded-xl" />
          )) : (
            <>
              {tab === "members" && (
                <>
                  {members.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No members</p>}
                  {members.map((m, idx) => (
                    <div key={m.id ?? idx} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {(m.full_name || m.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.full_name || m.email}</p>
                        {m.full_name && <p className="text-xs text-slate-400 truncate">{m.email}</p>}
                      </div>
                      <select value={m.role} onChange={e => changeMemberRole(m.id, e.target.value)}
                        className="text-xs bg-slate-700 text-slate-200 border border-slate-600 px-2 py-1.5 rounded-lg">
                        {Object.keys(ROLE_CONFIG).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium",
                        m.status === "active" ? "bg-green-900/40 text-green-400" :
                        m.status === "invited" ? "bg-amber-900/40 text-amber-400" : "bg-red-900/40 text-red-400")}>
                        {m.status}
                      </span>
                      {m.role !== "owner" && (
                        <button onClick={() => removeMember(m)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}

              {tab === "payments" && (
                <>
                  {payments.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No payments</p>}
                  {payments.map(p => (
                    <div key={p.id} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                        <p className="text-xs text-slate-400">{(p.supplier as any)?.name} · {format(new Date(p.created_at),"dd MMM yy")}</p>
                      </div>
                      <p className="text-sm font-bold text-white shrink-0">{fmtKES(p.amount)}</p>
                      <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium shrink-0",
                        p.status === "completed" ? "bg-green-900/40 text-green-400" :
                        p.status === "failed"    ? "bg-red-900/40 text-red-400" :
                        p.status === "pending_approval" ? "bg-amber-900/40 text-amber-400" : "bg-slate-700 text-slate-300")}>
                        {p.status}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {p.status === "pending_approval" && (
                          <button onClick={() => forcePaymentStatus(p.id, "approved")}
                            className="text-[10px] bg-green-900/40 text-green-400 border border-green-800 px-2 py-1 rounded-lg">
                            Approve
                          </button>
                        )}
                        {p.status === "failed" && (
                          <button onClick={() => forcePaymentStatus(p.id, "approved")}
                            className="text-[10px] bg-blue-900/40 text-blue-400 border border-blue-800 px-2 py-1 rounded-lg">
                            Retry
                          </button>
                        )}
                        {!["completed","cancelled"].includes(p.status) && (
                          <button onClick={() => forcePaymentStatus(p.id, "cancelled")}
                            className="text-[10px] bg-red-900/30 text-red-400 border border-red-800 px-2 py-1 rounded-lg">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {tab === "integrations" && (
                <>
                  {integs.length === 0 ? (
                    <div className="text-center py-8">
                      <Plug size={24} className="text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No integrations connected</p>
                    </div>
                  ) : integs.map(i => (
                    <div key={i.id} className="bg-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white capitalize">{i.provider}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {i.realm_id || i.organization_id} ·
                            Last sync: {i.last_sync_at ? format(new Date(i.last_sync_at),"dd MMM HH:mm") : "Never"} ·
                            Errors: {i.consecutive_errors}
                          </p>
                        </div>
                        <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium",
                          i.status === "active" ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400")}>
                          {i.status}
                        </span>
                      </div>
                      {i.last_error && (
                        <p className="mt-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{i.last_error}</p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main SuperAdmin ──────────────────────────────────────────
export default function SuperAdmin() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allIntegs, setAllIntegs]     = useState<any[]>([]);
  const [adminLogs, setAdminLogs]     = useState<any[]>([]);
  const [stats, setStats]   = useState({ total:0, active:0, trial:0, suspended:0, mrr:0, integrations:0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<AdminTab>("businesses");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [bizRes, payRes, integRes, logsRes] = await Promise.all([
      supabase.from("businesses").select("*").order("created_at", { ascending: false }),
      supabase.from("payment_requests").select("id,business_id,status,amount,title,created_at")
        .order("created_at",{ascending:false}).limit(100),
      supabase.from("accounting_integrations").select("*").order("created_at",{ascending:false}),
      supabase.from("admin_actions").select("*").order("created_at",{ascending:false}).limit(50),
    ]);
    const biz  = bizRes.data  ?? [];
    const pays = payRes.data  ?? [];
    const ints = integRes.data ?? [];

    // Enrich with member counts
    const counts = await Promise.all(biz.map(b =>
      supabase.from("business_members").select("id",{count:"exact",head:true})
        .eq("business_id",b.id).eq("status","active").then(({count}) => ({ id:b.id, count:count||0 }))
    ));
    const cMap = Object.fromEntries(counts.map(x => [x.id, x.count]));
    setBusinesses(biz.map(b => ({ ...b, member_count: cMap[b.id]||0 })));
    setAllPayments(pays);
    setAllIntegs(ints);
    setAdminLogs(logsRes.data ?? []);
    const active = biz.filter(b => b.status === "active");
    setStats({
      total:        biz.length,
      active:       active.length,
      trial:        biz.filter(b => b.status === "trial").length,
      suspended:    biz.filter(b => b.status === "suspended").length,
      mrr:          active.reduce((s:number,b:any) => s+(PLANS[b.plan as keyof typeof PLANS]?.price||0),0),
      integrations: ints.filter(i => i.status === "active").length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredBiz = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (b.kra_pin ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const STAT_CARDS = [
    { label:"Total",        value:stats.total,        color:"text-blue-400",   bg:"bg-blue-900/30"   },
    { label:"Active",       value:stats.active,       color:"text-green-400",  bg:"bg-green-900/30"  },
    { label:"Trial",        value:stats.trial,        color:"text-amber-400",  bg:"bg-amber-900/30"  },
    { label:"Suspended",    value:stats.suspended,    color:"text-red-400",    bg:"bg-red-900/30"    },
    { label:"MRR",          value:fmtKES(stats.mrr),  color:"text-primary",    bg:"bg-primary/20"    },
    { label:"Integrations", value:stats.integrations, color:"text-purple-400", bg:"bg-purple-900/30" },
  ];

  const TABS = [
    { id:"businesses"   as AdminTab, label:"Businesses",   icon:Building2 },
    { id:"payments"     as AdminTab, label:"All Payments", icon:CreditCard },
    { id:"integrations" as AdminTab, label:"Integrations", icon:Plug },
    { id:"actions"      as AdminTab, label:"Admin Log",    icon:Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 h-16 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white">ShieldPay</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Super Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => navigate("/dashboard")}
            className="text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-2 rounded-xl">
            ← App
          </button>
          <button onClick={signOut}
            className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-xl flex items-center gap-1.5">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {STAT_CARDS.map(s => (
            <div key={s.label} className={clsx("rounded-2xl p-4 border border-slate-800", s.bg)}>
              <p className={clsx("text-2xl font-black", s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-2xl w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                tab === t.id ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800")}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {/* ── BUSINESSES ── */}
        {tab === "businesses" && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
                <h2 className="font-bold text-white">All Businesses</h2>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 w-64"
                    placeholder="Search name, email, KRA…"
                    value={search} onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-800">
                    {["Business","Industry","Plan","Members","Status","Since",""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {loading ? Array.from({length:5}).map((_,i) => (
                      <tr key={i} className="border-b border-slate-800/50">
                        {Array.from({length:7}).map((_,j) => (
                          <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 animate-pulse rounded"/></td>
                        ))}
                      </tr>
                    )) : filteredBiz.map(b => (
                      <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                          onClick={() => setSelected(b)}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold shrink-0">
                              {b.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{b.name}</p>
                              {b.kra_pin && <p className="text-xs text-slate-500 font-mono">{b.kra_pin}</p>}
                              <p className="text-xs text-slate-600">{b.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-xs">{(INDUSTRY_CONFIG as any)[b.industry]?.label || b.industry}</td>
                        <td className="px-5 py-4">
                          <span className={clsx("inline-flex text-xs font-bold px-2.5 py-1 rounded-full capitalize",
                            b.plan==="growth"?"bg-primary/20 text-primary":b.plan==="enterprise"?"bg-amber-900/50 text-amber-400":"bg-slate-700 text-slate-300")}>
                            {b.plan}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          <div className="flex items-center gap-1.5"><Users size={12} className="text-slate-500"/>{b.member_count}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={clsx("inline-flex text-xs font-bold px-2.5 py-1 rounded-full",
                            b.status==="active"?"bg-green-900/40 text-green-400":b.status==="trial"?"bg-amber-900/40 text-amber-400":"bg-red-900/40 text-red-400")}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">{format(new Date(b.created_at),"dd MMM yyyy")}</td>
                        <td className="px-5 py-4">
                          <button onClick={e => { e.stopPropagation(); setSelected(b); }}
                            className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-700 flex items-center gap-1">
                            <Settings size={11}/> Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revenue breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-bold text-white mb-4">Revenue by Plan</h2>
              <div className="grid grid-cols-3 gap-4">
                {(["starter","growth","enterprise"] as const).map(p => {
                  const count   = businesses.filter(b => b.status==="active" && b.plan===p).length;
                  const revenue = count * (PLANS[p].price || 0);
                  return (
                    <div key={p} className="bg-slate-800 rounded-2xl p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{PLANS[p].name}</p>
                      <p className="text-2xl font-black text-white">{count}</p>
                      <p className="text-xs text-slate-500 mt-0.5">active businesses</p>
                      <p className="text-lg font-bold text-primary mt-2">{fmtKES(revenue)}</p>
                      <p className="text-xs text-slate-500">/month</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── ALL PAYMENTS ── */}
        {tab === "payments" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="font-bold text-white">All Payment Requests</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest 100 across all businesses</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800">
                  {["Title","Amount","Status","Business","Date","Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {loading ? Array.from({length:8}).map((_,i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {Array.from({length:6}).map((_,j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 animate-pulse rounded"/></td>)}
                    </tr>
                  )) : allPayments.map(p => {
                    const biz = businesses.find(b => b.id === p.business_id);
                    return (
                      <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                        <td className="px-5 py-3 font-medium text-white max-w-[200px] truncate">{p.title}</td>
                        <td className="px-5 py-3 font-bold text-white">{fmtKES(p.amount)}</td>
                        <td className="px-5 py-3">
                          <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium",
                            p.status==="completed"?"bg-green-900/40 text-green-400":
                            p.status==="failed"?"bg-red-900/40 text-red-400":
                            p.status==="pending_approval"?"bg-amber-900/40 text-amber-400":"bg-slate-700 text-slate-300")}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">{biz?.name ?? p.business_id.slice(0,8)}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{format(new Date(p.created_at),"dd MMM yy HH:mm")}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            {p.status==="pending_approval" && (
                              <button onClick={async () => {
                                await supabase.from("payment_requests").update({status:"approved"}).eq("id",p.id);
                                setAllPayments(prev => prev.map(x => x.id===p.id?{...x,status:"approved"}:x));
                              }} className="text-[10px] bg-green-900/30 text-green-400 border border-green-800 px-2 py-1 rounded-lg">Approve</button>
                            )}
                            {p.status==="failed" && (
                              <button onClick={async () => {
                                await supabase.from("payment_requests").update({status:"approved"}).eq("id",p.id);
                                setAllPayments(prev => prev.map(x => x.id===p.id?{...x,status:"approved"}:x));
                              }} className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800 px-2 py-1 rounded-lg">Retry</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── INTEGRATIONS ── */}
        {tab === "integrations" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="font-bold text-white">All Accounting Integrations</h2>
              <p className="text-xs text-slate-500 mt-0.5">{allIntegs.filter(i=>i.status==="active").length} active · {allIntegs.length} total</p>
            </div>
            <div className="p-5 space-y-3">
              {loading ? Array.from({length:3}).map((_,i)=><div key={i} className="h-16 bg-slate-800 animate-pulse rounded-xl"/>)
              : allIntegs.length === 0 ? (
                <div className="text-center py-8">
                  <Plug size={28} className="text-slate-600 mx-auto mb-2"/>
                  <p className="text-slate-500 text-sm">No integrations yet across any business</p>
                </div>
              ) : allIntegs.map(integ => {
                const biz = businesses.find(b => b.id === integ.business_id);
                return (
                  <div key={integ.id} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                      integ.provider==="quickbooks"?"bg-green-900/40 text-green-400":"bg-red-900/40 text-red-400")}>
                      {integ.provider==="quickbooks"?"QB":"ZB"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{biz?.name ?? integ.business_id.slice(0,12)}</p>
                      <p className="text-xs text-slate-400">
                        {integ.realm_id || integ.organization_id} ·
                        Last sync: {integ.last_sync_at ? format(new Date(integ.last_sync_at),"dd MMM HH:mm"):"Never"} ·
                        Errors: {integ.consecutive_errors}
                      </p>
                    </div>
                    <span className={clsx("text-xs px-2.5 py-1 rounded-lg font-medium shrink-0",
                      integ.status==="active"?"bg-green-900/40 text-green-400":
                      integ.status==="error"?"bg-red-900/40 text-red-400":"bg-slate-700 text-slate-300")}>
                      {integ.status}
                    </span>
                    {integ.last_error && (
                      <p className="text-xs text-red-400 max-w-xs truncate">{integ.last_error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ADMIN LOG ── */}
        {tab === "actions" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="font-bold text-white">Admin Actions Log</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {adminLogs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No admin actions yet</p>
              ) : adminLogs.map(l => (
                <div key={l.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                    <Activity size={14} className="text-primary"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{l.action}</p>
                    <p className="text-xs text-slate-400">{l.admin_email} · {l.target_type} {String(l.target_id ?? "").slice(0,8)}</p>
                    {l.details && (
                      <p className="text-xs text-slate-500 mt-1 font-mono">{JSON.stringify(l.details).slice(0,120)}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 shrink-0">{format(new Date(l.created_at),"dd MMM HH:mm")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Business Detail Panel */}
      {selected && <BusinessPanel b={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
