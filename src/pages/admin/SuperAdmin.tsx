import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, Building2, Users, CheckCircle2, XCircle, RefreshCw,
  LogOut, Activity, CreditCard, Search, Plug, Settings, Plus,
  Trash2, MessageSquare, Phone, Mail, Send, Bell, TrendingUp,
  AlertTriangle, Zap, DollarSign, BarChart3, ChevronRight,
  UserPlus, Filter, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PLANS, INDUSTRY_CONFIG, ROLE_CONFIG } from "@/lib/constants";
import { fmtKES, clsx } from "@/lib/utils";
import { format } from "date-fns";

const COMMS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comms`;

type AdminTab = "dashboard" | "businesses" | "subscriptions" | "payments" | "comms" | "admins" | "log";

// ─── Helpers ──────────────────────────────────────────────────
async function callComms(path: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${COMMS_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={clsx(
      "fixed top-5 right-5 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-2.5 animate-in fade-in",
      ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
    )}>
      {ok ? <CheckCircle2 size={16}/> : <XCircle size={16}/>}
      {msg}
    </div>
  );
}

// ─── Business Detail Panel ────────────────────────────────────
function BusinessPanel({ b, onClose, onRefresh }: {
  b: any; onClose: () => void; onRefresh: () => void;
}) {
  const [tab, setTab]           = useState<"overview"|"members"|"payments"|"comms">(b._openTab ?? "overview");
  const [members, setMembers]   = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<{msg:string;ok:boolean}|null>(null);
  const [msgForm, setMsgForm]   = useState({ channel: "sms", message: "", template: "custom" });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const load = async () => {
      const [mRes, pRes] = await Promise.all([
        supabase.from("business_members").select("*").eq("business_id", b.id).order("joined_at"),
        supabase.from("payment_requests").select("*,supplier:suppliers(name)")
          .eq("business_id", b.id).order("created_at", { ascending: false }).limit(15),
      ]);
      setMembers(mRes.data ?? []);
      setPayments(pRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [b.id]);

  const handleAddMember = async () => {
    const email = prompt("Email to invite as admin:");
    if (!email) return;
    const { error } = await supabase.from("business_members").upsert({
      business_id: b.id, user_id: "00000000-0000-0000-0000-000000000000",
      email: email.trim(), role: "admin", status: "invited",
    }, { onConflict: "business_id,email" });
    if (error) { showToast(error.message, false); return; }
    setMembers(p => [...p, { email: email.trim(), role: "admin", status: "invited" }]);
    showToast(`✅ ${email} invited`);
    const u = await supabase.auth.getUser();
    await supabase.from("admin_actions").insert({
      admin_user_id: u.data.user?.id, admin_email: u.data.user?.email,
      action: "force_add_member", target_type: "business", target_id: b.id,
      details: { email: email.trim() },
    });
  };

  const handleActivateSub = async () => {
    const ref = prompt("Payment reference (M-Pesa/Bank ref):");
    if (!ref) return;
    const planKey = prompt("Plan (starter/growth/enterprise):", "growth");
    if (!planKey) return;
    const price = { starter: 1499, growth: 2999, enterprise: 0 }[planKey] ?? 1499;
    const res = await callComms("/subscribe", {
      businessId: b.id, plan: planKey,
      paymentRef: ref, amount: price, months: 1,
    });
    if (res.ok) {
      showToast(`✅ Subscription activated! SMS + Email sent.`);
      onRefresh();
    } else {
      showToast(res.error ?? "Failed", false);
    }
  };

  const forcePaymentStatus = async (payId: string, status: string) => {
    if (!confirm(`Force → "${status}"?`)) return;
    await supabase.from("payment_requests").update({ status }).eq("id", payId);
    setPayments(p => p.map(x => x.id === payId ? { ...x, status } : x));
    const u = await supabase.auth.getUser();
    await supabase.from("admin_actions").insert({
      admin_user_id: u.data.user?.id, admin_email: u.data.user?.email,
      action: "force_payment_status", target_type: "payment_request",
      target_id: payId, details: { new_status: status, business_id: b.id },
    });
    showToast(`Payment status → ${status}`);
  };

  const sendMessage = async () => {
    if (!msgForm.message.trim()) return;
    const recipient = msgForm.channel === "email" ? b.email : b.phone;
    if (!recipient) { showToast("No phone/email on file for this business", false); return; }
    const res = await callComms("/send", {
      businessId: b.id, recipient, channel: msgForm.channel,
      message: msgForm.message,
    });
    if (res.ok) { showToast(`Message sent via ${msgForm.channel}`); setMsgForm(f => ({ ...f, message: "" })); }
    else showToast(res.error ?? "Send failed", false);
  };

  const toggleStatus = async () => {
    const ns = b.status === "suspended" ? "active" : "suspended";
    if (!confirm(`${ns === "suspended" ? "Suspend" : "Activate"} ${b.name}?`)) return;
    await supabase.from("businesses").update({ status: ns }).eq("id", b.id);
    b.status = ns;
    showToast(`Business ${ns}`);
    onRefresh();
  };

  const SUBTABS = ["overview","members","payments","comms"] as const;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-700 flex flex-col h-full">
        {toast && <Toast {...toast}/>}

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-black text-lg shrink-0">
            {b.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{b.name}</p>
            <p className="text-xs text-slate-400">{b.email} · {b.phone ?? "No phone"}</p>
          </div>
          <span className={clsx("text-xs px-2.5 py-1 rounded-full font-bold shrink-0",
            b.status==="active"?"bg-green-900/40 text-green-400":
            b.status==="trial"?"bg-amber-900/40 text-amber-400":"bg-red-900/40 text-red-400")}>
            {b.status}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5">
            <XCircle size={18}/>
          </button>
        </div>

        {/* Quick actions bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex gap-2 flex-wrap bg-slate-900/50">
          <button onClick={handleActivateSub}
            className="text-xs bg-green-900/40 text-green-400 border border-green-800 px-3 py-1.5 rounded-xl hover:bg-green-900/60 flex items-center gap-1.5 font-semibold">
            <CreditCard size={11}/> Activate Sub
          </button>
          <button onClick={handleAddMember}
            className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800 px-3 py-1.5 rounded-xl hover:bg-blue-900/60 flex items-center gap-1.5 font-semibold">
            <UserPlus size={11}/> Add Member
          </button>
          <select onChange={async e => {
            if (!e.target.value) return;
            await supabase.from("businesses").update({ plan: e.target.value }).eq("id", b.id);
            b.plan = e.target.value; showToast(`Plan → ${e.target.value}`); onRefresh();
            e.target.value = "";
          }} className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-xl cursor-pointer">
            <option value="">Change Plan…</option>
            <option value="starter">Starter — KES 1,499</option>
            <option value="growth">Growth — KES 2,999</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button onClick={toggleStatus}
            className="text-xs bg-red-900/30 text-red-400 border border-red-800 px-3 py-1.5 rounded-xl hover:bg-red-900/50 flex items-center gap-1.5 font-semibold">
            {b.status==="suspended"?<><CheckCircle2 size={11}/> Activate</>:<><XCircle size={11}/> Suspend</>}
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800 px-2">
          {SUBTABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("px-4 py-3 text-sm font-medium border-b-2 transition-all capitalize",
                tab===t?"border-primary text-primary":"border-transparent text-slate-500 hover:text-slate-300")}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? Array.from({length:3}).map((_,i) => (
            <div key={i} className="h-12 bg-slate-800 animate-pulse rounded-xl"/>
          )) : (
            <>
              {/* OVERVIEW */}
              {tab==="overview" && (
                <div className="space-y-3">
                  {[
                    { label:"Industry",   value:(INDUSTRY_CONFIG as any)[b.industry]?.label ?? b.industry },
                    { label:"Plan",       value:b.plan },
                    { label:"KRA PIN",    value:b.kra_pin || "Not set" },
                    { label:"County",     value:b.county || "Not set" },
                    { label:"Registered", value:b.registration_no || "Not set" },
                    { label:"Created",    value:format(new Date(b.created_at),"dd MMM yyyy") },
                    { label:"Trial ends", value:b.trial_ends_at ? format(new Date(b.trial_ends_at),"dd MMM yyyy") : "—" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                      <span className="text-xs text-slate-400 font-medium">{row.label}</span>
                      <span className="text-sm text-white font-semibold">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* MEMBERS */}
              {tab==="members" && (
                <>
                  {members.length===0 && <p className="text-slate-500 text-sm text-center py-8">No members yet</p>}
                  {members.map((m, idx) => (
                    <div key={m.id??idx} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {(m.full_name||m.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.full_name||m.email}</p>
                        {m.full_name && <p className="text-xs text-slate-400 truncate">{m.email}</p>}
                      </div>
                      <select value={m.role} onChange={async e => {
                        await supabase.from("business_members").update({role:e.target.value}).eq("id",m.id);
                        setMembers(p => p.map(x => x.id===m.id?{...x,role:e.target.value}:x));
                      }} className="text-xs bg-slate-700 text-slate-200 border border-slate-600 px-2 py-1.5 rounded-lg">
                        {Object.keys(ROLE_CONFIG).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium",
                        m.status==="active"?"bg-green-900/40 text-green-400":
                        m.status==="invited"?"bg-amber-900/40 text-amber-400":"bg-red-900/40 text-red-400")}>
                        {m.status}
                      </span>
                      {m.role!=="owner" && (
                        <button onClick={async () => {
                          if (!confirm(`Remove ${m.email}?`)) return;
                          await supabase.from("business_members").update({status:"suspended"}).eq("id",m.id);
                          setMembers(p => p.filter(x => x.id!==m.id));
                        }} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* PAYMENTS */}
              {tab==="payments" && (
                <>
                  {payments.length===0 && <p className="text-slate-500 text-sm text-center py-8">No payments yet</p>}
                  {payments.map(p => (
                    <div key={p.id} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                        <p className="text-xs text-slate-400">{(p.supplier as any)?.name} · {format(new Date(p.created_at),"dd MMM yy")}</p>
                      </div>
                      <p className="text-sm font-bold text-white shrink-0">{fmtKES(p.amount)}</p>
                      <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium shrink-0",
                        p.status==="completed"?"bg-green-900/40 text-green-400":
                        p.status==="failed"?"bg-red-900/40 text-red-400":
                        p.status==="pending_approval"?"bg-amber-900/40 text-amber-400":"bg-slate-700 text-slate-300")}>
                        {p.status}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {p.status==="pending_approval" && (
                          <button onClick={() => forcePaymentStatus(p.id,"approved")}
                            className="text-[10px] bg-green-900/40 text-green-400 border border-green-800 px-2 py-1 rounded-lg">
                            Approve
                          </button>
                        )}
                        {p.status==="failed" && (
                          <button onClick={() => forcePaymentStatus(p.id,"approved")}
                            className="text-[10px] bg-blue-900/40 text-blue-400 border border-blue-800 px-2 py-1 rounded-lg">
                            Retry
                          </button>
                        )}
                        {!["completed","cancelled"].includes(p.status) && (
                          <button onClick={() => forcePaymentStatus(p.id,"cancelled")}
                            className="text-[10px] bg-red-900/30 text-red-400 border border-red-800 px-1.5 py-1 rounded-lg">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* COMMS */}
              {tab==="comms" && (
                <div className="space-y-4">
                  <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-bold text-white">Send message to {b.name}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["sms","whatsapp","email"] as const).map(ch => (
                        <button key={ch} onClick={() => setMsgForm(f=>({...f,channel:ch}))}
                          className={clsx("py-2 rounded-xl text-xs font-bold transition-all",
                            msgForm.channel===ch?"bg-primary text-white":"bg-slate-700 text-slate-300 hover:bg-slate-600")}>
                          {ch==="sms"?<><Phone size={11} className="inline mr-1"/>SMS</>:
                           ch==="whatsapp"?<><MessageSquare size={11} className="inline mr-1"/>WhatsApp</>:
                           <><Mail size={11} className="inline mr-1"/>Email</>}
                        </button>
                      ))}
                    </div>
                    <select
                      value={msgForm.template}
                      onChange={e => {
                        const t = e.target.value;
                        const templates: Record<string,string> = {
                          trial_expiring: `Hi ${b.name}, your ShieldPay trial expires soon. Subscribe for KES 1,499/month to keep automations running. Visit shieldpay.ke`,
                          trial_expired:  `Hi ${b.name}, your ShieldPay trial has expired. Subscribe to reactivate your bill automations. Visit shieldpay.ke`,
                          custom: "",
                        };
                        setMsgForm(f => ({ ...f, template: t, message: templates[t] ?? "" }));
                      }}
                      className="w-full bg-slate-700 text-slate-200 border border-slate-600 rounded-xl px-3 py-2 text-sm">
                      <option value="custom">Custom message</option>
                      <option value="trial_expiring">Trial expiring reminder</option>
                      <option value="trial_expired">Trial expired notice</option>
                    </select>
                    <textarea
                      value={msgForm.message}
                      onChange={e => setMsgForm(f=>({...f,message:e.target.value}))}
                      placeholder="Type your message…"
                      rows={4}
                      className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-primary"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        {msgForm.channel==="sms"||msgForm.channel==="whatsapp"
                          ? `To: ${b.phone ?? "No phone on file"}`
                          : `To: ${b.email ?? "No email on file"}`}
                      </p>
                      <button onClick={sendMessage}
                        disabled={!msgForm.message.trim()}
                        className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5 disabled:opacity-50">
                        <Send size={13}/> Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Portal ────────────────────────────────────────
export default function SuperAdmin() {
  const { user, signOut } = useAuth();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [allIntegs,   setAllIntegs]   = useState<any[]>([]);
  const [adminLogs,   setAdminLogs]   = useState<any[]>([]);
  const [adminAdmins, setAdminAdmins] = useState<any[]>([]);
  const [commsLog,    setCommsLog]    = useState<any[]>([]);
  const [subHealth,   setSubHealth]   = useState<any[]>([]);
  const [stats, setStats]     = useState({ total:0, active:0, trial:0, suspended:0, mrr:0, integrations:0, comms:0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<AdminTab>("dashboard");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<any|null>(null);
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null);
  const [bulkForm, setBulkForm] = useState({ channel:"sms", filter:"trial_expiring", template:"trial_expiring", message:"" });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [bizRes, payRes, integRes, logsRes, adminsRes, commsRes] = await Promise.all([
      supabase.from("businesses").select("*").order("created_at",{ascending:false}),
      supabase.from("payment_requests").select("id,business_id,status,amount,title,created_at")
        .order("created_at",{ascending:false}).limit(100),
      supabase.from("accounting_integrations").select("*").order("created_at",{ascending:false}),
      supabase.from("admin_actions").select("*").order("created_at",{ascending:false}).limit(50),
      supabase.from("admin_admins").select("*").order("created_at",{ascending:false}),
      supabase.from("comms_log").select("*").order("created_at",{ascending:false}).limit(50),
    ]);

    const biz  = bizRes.data  ?? [];
    const pays = payRes.data  ?? [];
    const ints = integRes.data ?? [];

    const counts = await Promise.all(biz.map(b =>
      supabase.from("business_members").select("id",{count:"exact",head:true})
        .eq("business_id",b.id).eq("status","active")
        .then(({count}) => ({ id:b.id, count:count||0 }))
    ));
    const cMap = Object.fromEntries(counts.map(x=>[x.id,x.count]));
    setBusinesses(biz.map(b => ({...b, member_count:cMap[b.id]||0})));
    setAllPayments(pays);
    setAllIntegs(ints);
    setAdminLogs(logsRes.data ?? []);
    setAdminAdmins(adminsRes.data ?? []);
    setCommsLog(commsRes.data ?? []);

    const active = biz.filter(b => b.status==="active");
    const mrr    = active.reduce((s:number,b:any) => s+(PLANS[b.plan as keyof typeof PLANS]?.price||0),0);
    setStats({
      total:biz.length, active:active.length,
      trial:biz.filter(b=>b.status==="trial").length,
      suspended:biz.filter(b=>b.status==="suspended").length,
      mrr, integrations:ints.filter(i=>i.status==="active").length,
      comms:(commsRes.data??[]).length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch subscription health
  useEffect(() => {
    if (tab !== "subscriptions") return;
    const fetchSubs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${COMMS_URL}/subscriptions?filter=all`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.ok) setSubHealth(data.businesses ?? []);
    };
    fetchSubs();
  }, [tab]);

  const sendBulk = async () => {
    const res = await callComms("/bulk", bulkForm);
    if (res.ok) {
      showToast(`✅ Sent: ${res.sent} · Failed: ${res.failed}`);
      load();
    } else {
      showToast(res.error ?? "Bulk send failed", false);
    }
  };

  const addAdmin = async () => {
    const email = prompt("Admin email:");
    if (!email) return;
    const name  = prompt("Full name:");
    const role  = prompt("Role (superadmin/admin/support):", "admin") || "admin";
    // First check if user exists
    const { data: existing } = await supabase.from("admin_admins")
      .select("id").eq("email", email.trim()).maybeSingle();
    if (existing) { showToast("Already an admin", false); return; }
    const { error } = await supabase.from("admin_admins").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      email: email.trim(), full_name: name ?? null, role, is_active: true,
      added_by: user?.id,
    });
    if (error) { showToast(error.message, false); return; }
    showToast(`✅ ${email} added as ${role}`);
    load();
  };

  const filteredBiz = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.email??"").toLowerCase().includes(search.toLowerCase()) ||
    (b.kra_pin??"").toLowerCase().includes(search.toLowerCase()) ||
    (b.phone??"").includes(search)
  );

  const TABS: { id:AdminTab; label:string; icon:React.ElementType; badge?:number }[] = [
    { id:"dashboard",     label:"Dashboard",    icon:BarChart3   },
    { id:"businesses",    label:"Businesses",   icon:Building2,  badge:stats.total },
    { id:"subscriptions", label:"Subscriptions",icon:CreditCard  },
    { id:"payments",      label:"Payments",     icon:Zap         },
    { id:"comms",         label:"Comms",        icon:MessageSquare },
    { id:"admins",        label:"Admins",       icon:Shield      },
    { id:"log",           label:"Audit Log",    icon:Activity    },
  ];

  const STAT_CARDS = [
    { label:"Businesses", value:stats.total,        color:"text-blue-400",   bg:"bg-blue-900/20",   icon:Building2   },
    { label:"Active",     value:stats.active,       color:"text-green-400",  bg:"bg-green-900/20",  icon:CheckCircle2 },
    { label:"Trial",      value:stats.trial,        color:"text-amber-400",  bg:"bg-amber-900/20",  icon:AlertTriangle },
    { label:"Suspended",  value:stats.suspended,    color:"text-red-400",    bg:"bg-red-900/20",    icon:XCircle     },
    { label:"MRR",        value:fmtKES(stats.mrr),  color:"text-primary",    bg:"bg-primary/20",    icon:TrendingUp  },
    { label:"Synced",     value:stats.integrations, color:"text-purple-400", bg:"bg-purple-900/20", icon:Plug        },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {toast && <Toast {...toast}/>}

      {/* ── SIDEBAR ── */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col sticky top-0 h-screen shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield size={15} className="text-white"/>
            </div>
            <div>
              <p className="font-black text-white text-sm">ShieldPay</p>
              <p className="text-[9px] text-primary font-bold uppercase tracking-widest">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                tab===t.id ? "bg-primary text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}>
              <t.icon size={15} className="shrink-0"/>
              <span className="flex-1">{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="bg-slate-700 text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom user */}
        <div className="px-4 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 truncate mb-2">{user?.email}</p>
          <div className="flex gap-2">
            <button onClick={load} className="flex-1 text-xs bg-slate-800 text-slate-300 py-2 rounded-xl hover:bg-slate-700 flex items-center justify-center gap-1">
              <RefreshCw size={11} className={loading?"animate-spin":""}/> Refresh
            </button>
            <button onClick={signOut} className="flex-1 text-xs bg-red-900/30 text-red-400 py-2 rounded-xl hover:bg-red-900/50 flex items-center justify-center gap-1">
              <LogOut size={11}/> Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">

          {/* ── DASHBOARD ── */}
          {tab==="dashboard" && (
            <>
              <div>
                <h1 className="text-2xl font-black text-white">Good {new Date().getHours()<12?"morning":"afternoon"}, {user?.email?.split("@")[0]} 👋</h1>
                <p className="text-slate-400 text-sm mt-1">{format(new Date(),"EEEE, d MMMM yyyy")} · Kenya EAT</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {STAT_CARDS.map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={clsx("rounded-2xl p-4 border border-slate-800", s.bg)}>
                      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center mb-3", s.bg)}>
                        <Icon size={15} className={s.color}/>
                      </div>
                      <p className={clsx("text-2xl font-black", s.color)}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Quick actions */}
              <div className="grid md:grid-cols-3 gap-4">
                <button onClick={() => setTab("comms")}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left hover:border-primary transition-all group">
                  <MessageSquare size={20} className="text-primary mb-3"/>
                  <p className="font-bold text-white">Send bulk message</p>
                  <p className="text-xs text-slate-400 mt-1">SMS/WhatsApp all trial-expiring businesses</p>
                  <ChevronRight size={14} className="text-slate-600 mt-2 group-hover:text-primary transition-colors"/>
                </button>
                <button onClick={() => setTab("subscriptions")}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left hover:border-primary transition-all group">
                  <CreditCard size={20} className="text-green-400 mb-3"/>
                  <p className="font-bold text-white">Activate subscription</p>
                  <p className="text-xs text-slate-400 mt-1">{stats.trial} businesses on trial · Record payment and activate</p>
                  <ChevronRight size={14} className="text-slate-600 mt-2 group-hover:text-primary transition-colors"/>
                </button>
                <button onClick={() => setTab("businesses")}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left hover:border-primary transition-all group">
                  <Building2 size={20} className="text-blue-400 mb-3"/>
                  <p className="font-bold text-white">Manage businesses</p>
                  <p className="text-xs text-slate-400 mt-1">{stats.total} total · {stats.active} active · {stats.suspended} suspended</p>
                  <ChevronRight size={14} className="text-slate-600 mt-2 group-hover:text-primary transition-colors"/>
                </button>
              </div>

              {/* Recent businesses */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-bold text-white mb-4">Recent signups</h3>
                <div className="space-y-2">
                  {businesses.slice(0,5).map(b => (
                    <button key={b.id} onClick={() => setSelected(b)}
                      className="w-full flex items-center gap-3 hover:bg-slate-800 rounded-xl px-3 py-2.5 transition-all text-left">
                      <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold shrink-0">
                        {b.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{b.name}</p>
                        <p className="text-xs text-slate-400">{b.email} · {b.industry}</p>
                      </div>
                      <span className={clsx("text-xs px-2.5 py-1 rounded-full font-bold shrink-0",
                        b.status==="active"?"bg-green-900/40 text-green-400":
                        b.status==="trial"?"bg-amber-900/40 text-amber-400":"bg-red-900/40 text-red-400")}>
                        {b.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── BUSINESSES ── */}
          {tab==="businesses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-black text-white">All Businesses</h2>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input
                    className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 w-72"
                    placeholder="Search name, email, phone, KRA…"
                    value={search} onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
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
                          {Array.from({length:7}).map((_,j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-800 animate-pulse rounded"/></td>)}
                        </tr>
                      )) : filteredBiz.map(b => (
                        <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                            onClick={() => setSelected(b)}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold shrink-0 text-xs">
                                {b.name[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-white text-sm">{b.name}</p>
                                <p className="text-xs text-slate-500">{b.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-400 text-xs capitalize">{b.industry}</td>
                          <td className="px-5 py-4">
                            <span className={clsx("inline-flex text-xs font-bold px-2.5 py-1 rounded-full capitalize",
                              b.plan==="growth"?"bg-primary/20 text-primary":b.plan==="enterprise"?"bg-amber-900/50 text-amber-400":"bg-slate-700 text-slate-300")}>
                              {b.plan}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-300 text-sm">{b.member_count}</td>
                          <td className="px-5 py-4">
                            <span className={clsx("inline-flex text-xs font-bold px-2.5 py-1 rounded-full",
                              b.status==="active"?"bg-green-900/40 text-green-400":b.status==="trial"?"bg-amber-900/40 text-amber-400":"bg-red-900/40 text-red-400")}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-500">{format(new Date(b.created_at),"dd MMM yy")}</td>
                          <td className="px-5 py-4">
                            <button onClick={e=>{e.stopPropagation();setSelected(b);}}
                              className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-700 flex items-center gap-1">
                              <Settings size={10}/> Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SUBSCRIPTIONS ── */}
          {tab==="subscriptions" && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white">Subscription Management</h2>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { label:"Healthy",        color:"text-green-400", filter:"healthy" },
                  { label:"Trial Expiring", color:"text-amber-400", filter:"trial_expiring" },
                  { label:"Trial Expired",  color:"text-red-400",   filter:"trial_expired" },
                  { label:"Renewal Due",    color:"text-orange-400",filter:"renewal_due" },
                ].map(s => {
                  const count = subHealth.filter(b => b.health_status===s.filter).length;
                  return (
                    <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <p className={clsx("text-3xl font-black", s.color)}>{count}</p>
                      <p className="text-xs text-slate-400 mt-1 font-medium">{s.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-white">All Businesses</h3>
                  <p className="text-xs text-slate-500">Click a business to activate subscription</p>
                </div>
                <div className="divide-y divide-slate-800">
                  {subHealth.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-slate-500 text-sm">Loading subscription data…</p>
                    </div>
                  ) : subHealth.map(b => (
                    <button key={b.business_id} onClick={() => {
                      const biz = businesses.find(x => x.id === b.business_id);
                      if (biz) setSelected(biz);
                    }} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-800/50 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{b.name}</p>
                        <p className="text-xs text-slate-400">{b.email} · {b.plan}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={clsx("text-xs px-2.5 py-1 rounded-full font-bold",
                          b.health_status==="healthy"?"bg-green-900/40 text-green-400":
                          b.health_status==="trial_expiring"?"bg-amber-900/40 text-amber-400":
                          b.health_status==="trial_expired"?"bg-red-900/40 text-red-400":
                          "bg-orange-900/40 text-orange-400")}>
                          {b.health_status?.replace(/_/g," ")}
                        </span>
                        {b.trial_days_left !== null && (
                          <p className="text-xs text-slate-500 mt-1">
                            {b.trial_days_left > 0 ? `${b.trial_days_left}d trial left` : "Trial expired"}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-slate-600 shrink-0"/>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab==="payments" && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white">All Payments</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
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
                        const biz = businesses.find(b => b.id===p.business_id);
                        return (
                          <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="px-5 py-3 font-medium text-white max-w-[180px] truncate">{p.title}</td>
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
                                  <button onClick={async() => {
                                    await supabase.from("payment_requests").update({status:"approved"}).eq("id",p.id);
                                    setAllPayments(prev => prev.map(x => x.id===p.id?{...x,status:"approved"}:x));
                                  }} className="text-[10px] bg-green-900/30 text-green-400 border border-green-800 px-2 py-1 rounded-lg">Approve</button>
                                )}
                                {p.status==="failed" && (
                                  <button onClick={async() => {
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
            </div>
          )}

          {/* ── COMMS ── */}
          {tab==="comms" && (
            <div className="space-y-5">
              <h2 className="text-xl font-black text-white">Communications Center</h2>

              {/* Bulk messaging */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Send size={16} className="text-primary"/> Bulk Message
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">Channel</label>
                    <div className="flex gap-2">
                      {["sms","whatsapp","email"].map(ch => (
                        <button key={ch} onClick={() => setBulkForm(f=>({...f,channel:ch}))}
                          className={clsx("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                            bulkForm.channel===ch?"bg-primary text-white":"bg-slate-800 text-slate-400 hover:bg-slate-700")}>
                          {ch.charAt(0).toUpperCase()+ch.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase">Audience</label>
                    <select value={bulkForm.filter} onChange={e=>setBulkForm(f=>({...f,filter:e.target.value}))}
                      className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-2.5 text-sm">
                      <option value="all">All businesses</option>
                      <option value="trial_expiring">Trial expiring (≤3 days)</option>
                      <option value="trial_expired">Trial expired</option>
                      <option value="active">Active subscribers</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase">Template</label>
                  <select value={bulkForm.template} onChange={e=>{
                    const t = e.target.value;
                    const tpls: Record<string,string> = {
                      trial_expiring: "Hi {{name}}, your ShieldPay trial expires in {{days}} days. Subscribe for KES {{price}}/month. Visit shieldpay.ke",
                      trial_expired: "Hi {{name}}, your ShieldPay trial has expired. Subscribe to reactivate your bill automations. Visit shieldpay.ke",
                      custom: bulkForm.message,
                    };
                    setBulkForm(f => ({...f, template:t, message: tpls[t] ?? ""}));
                  }} className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-2.5 text-sm">
                    <option value="trial_expiring">Trial expiring reminder</option>
                    <option value="trial_expired">Trial expired notice</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase">Message Preview</label>
                  <textarea value={bulkForm.message} onChange={e=>setBulkForm(f=>({...f,message:e.target.value}))}
                    rows={3} placeholder="Message text…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-primary"/>
                  <p className="text-xs text-slate-500">Use {"{{name}}"}, {"{{days}}"}, {"{{price}}"} as placeholders</p>
                </div>
                <button onClick={sendBulk} className="btn-primary py-3 px-6 flex items-center gap-2">
                  <Send size={15}/> Send to {bulkForm.filter==="all"?"all":bulkForm.filter.replace("_"," ")} businesses
                </button>
              </div>

              {/* Comms log */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h3 className="font-bold text-white">Communications Log</h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {commsLog.length===0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">No messages sent yet</p>
                  ) : commsLog.map(l => (
                    <div key={l.id} className="px-6 py-4 flex items-start gap-3">
                      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        l.channel==="sms"?"bg-blue-900/40":l.channel==="whatsapp"?"bg-green-900/40":"bg-purple-900/40")}>
                        {l.channel==="sms"?<Phone size={13} className="text-blue-400"/>:
                         l.channel==="whatsapp"?<MessageSquare size={13} className="text-green-400"/>:
                         <Mail size={13} className="text-purple-400"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{l.message}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{l.recipient} · {l.channel} · {l.provider}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium",
                          l.status==="sent"||l.status==="delivered"?"bg-green-900/40 text-green-400":"bg-red-900/40 text-red-400")}>
                          {l.status}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">{format(new Date(l.created_at),"dd MMM HH:mm")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ADMINS ── */}
          {tab==="admins" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white">Admin Users</h2>
                <button onClick={addAdmin} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
                  <Plus size={14}/> Add Admin
                </button>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="divide-y divide-slate-800">
                  {/* Current user always shown */}
                  <div className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold shrink-0">
                      {user?.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">{user?.email}</p>
                      <p className="text-xs text-slate-400">Super Admin · You</p>
                    </div>
                    <span className="text-xs bg-primary/20 text-primary px-2.5 py-1 rounded-full font-bold">superadmin</span>
                  </div>
                  {adminAdmins.filter(a => a.email !== user?.email).map(a => (
                    <div key={a.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 font-bold shrink-0 text-sm">
                        {(a.full_name||a.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">{a.full_name ?? a.email}</p>
                        {a.full_name && <p className="text-xs text-slate-400">{a.email}</p>}
                      </div>
                      <span className={clsx("text-xs px-2.5 py-1 rounded-full font-bold",
                        a.role==="superadmin"?"bg-primary/20 text-primary":
                        a.role==="admin"?"bg-blue-900/40 text-blue-400":"bg-slate-700 text-slate-300")}>
                        {a.role}
                      </span>
                      <span className={clsx("text-xs px-2 py-1 rounded-lg font-medium",
                        a.is_active?"bg-green-900/40 text-green-400":"bg-red-900/40 text-red-400")}>
                        {a.is_active?"Active":"Disabled"}
                      </span>
                      <button onClick={async () => {
                        if (!confirm(`Disable ${a.email}?`)) return;
                        await supabase.from("admin_admins").update({is_active:false}).eq("id",a.id);
                        setAdminAdmins(p => p.map(x => x.id===a.id?{...x,is_active:false}:x));
                      }} className="text-red-400 hover:text-red-300 p-1.5">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                  {adminAdmins.length===0 && (
                    <div className="px-6 py-8 text-center">
                      <p className="text-slate-500 text-sm">No additional admins added yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {tab==="log" && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-white">Audit Log</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="divide-y divide-slate-800">
                  {adminLogs.length===0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">No admin actions yet</p>
                  ) : adminLogs.map(l => (
                    <div key={l.id} className="px-6 py-4 flex items-start gap-4">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                        <Activity size={13} className="text-primary"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{l.action.replace(/_/g," ")}</p>
                        <p className="text-xs text-slate-400">{l.admin_email} · {l.target_type} · {String(l.target_id??"").slice(0,8)}</p>
                        {l.details && <p className="text-xs text-slate-500 mt-1 font-mono truncate">{JSON.stringify(l.details).slice(0,100)}</p>}
                      </div>
                      <p className="text-xs text-slate-500 shrink-0">{format(new Date(l.created_at),"dd MMM HH:mm")}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Business Detail Panel */}
      {selected && (
        <BusinessPanel
          b={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
