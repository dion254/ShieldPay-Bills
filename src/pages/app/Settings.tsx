import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, Loader2, Building2, CreditCard, Settings2, CheckCircle2, Plug } from "lucide-react";
import { IntegrationsTab } from "@/pages/app/IntegrationsTab";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, INDUSTRY_CONFIG } from "@/lib/constants";
import { fmtKES, trialDaysLeft, clsx } from "@/lib/utils";
import type { IndustryType } from "@/lib/types";
import { format } from "date-fns";

type Tab = "profile" | "billing" | "workflow" | "integrations";

function ProfileTab() {
  const { business, isAdmin, refetch } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [f, setF] = useState({
    name: business?.name || "", kra_pin: business?.kra_pin || "",
    registration_no: business?.registration_no || "", address: business?.address || "",
    phone: business?.phone || "", email: business?.email || "",
    industry: business?.industry || "other" as IndustryType,
  });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!business) return;
    setSaving(true);
    await supabase.from("businesses").update({ name: f.name.trim(), kra_pin: f.kra_pin.trim()||null, registration_no: f.registration_no.trim()||null, address: f.address.trim()||null, phone: f.phone.trim()||null, email: f.email.trim()||null, industry: f.industry, updated_at: new Date().toISOString() }).eq("id", business.id);
    refetch(); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="card p-6 max-w-2xl space-y-5">
      <div><h3 className="section-title mb-0.5">Business Profile</h3><p className="text-sm text-slate-500">Shown on receipts and reports</p></div>
      <div className="divider" />
      <div className="field"><label className="label">Business name *</label><input className="input" placeholder="Kamau Holdings Ltd" value={f.name} onChange={e => set("name", e.target.value)} disabled={!isAdmin} /></div>
      <div className="field">
        <label className="label">Industry</label>
        <select className="select" value={f.industry} onChange={e => set("industry", e.target.value)} disabled={!isAdmin}>
          {(Object.entries(INDUSTRY_CONFIG) as [IndustryType, any][]).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="field"><label className="label">KRA PIN</label><input className="input font-mono uppercase" placeholder="A012345678Z" maxLength={11} value={f.kra_pin} onChange={e => set("kra_pin", e.target.value.toUpperCase())} disabled={!isAdmin} /></div>
        <div className="field"><label className="label">Registration number</label><input className="input font-mono" placeholder="CPR/2020/001" value={f.registration_no} onChange={e => set("registration_no", e.target.value)} disabled={!isAdmin} /></div>
      </div>
      <div className="field"><label className="label">Physical address</label><input className="input" placeholder="Westlands, Nairobi" value={f.address} onChange={e => set("address", e.target.value)} disabled={!isAdmin} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="field"><label className="label">Phone</label><input className="input" placeholder="0712 345 678" value={f.phone} onChange={e => set("phone", e.target.value)} disabled={!isAdmin} /></div>
        <div className="field"><label className="label">Business email</label><input className="input" type="email" placeholder="finance@company.com" value={f.email} onChange={e => set("email", e.target.value)} disabled={!isAdmin} /></div>
      </div>
      {isAdmin && (
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : saved ? <><CheckCircle2 size={14} />Saved!</> : <><Save size={14} />Save Changes</>}
        </button>
      )}
    </div>
  );
}

function BillingTab() {
  const { business, isOwner } = useAuth();
  if (!business) return null;
  const current = PLANS[business.plan];
  const daysLeft = business.status === "trial" ? trialDaysLeft(business.trial_ends_at) : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-6">
        <div className="flex items-start justify-between mb-5">
          <div><h3 className="section-title">Current Plan</h3><p className="text-sm text-slate-500 mt-0.5">{business.status === "trial" ? `Free trial — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` : "Active subscription"}</p></div>
          <span className={clsx("badge capitalize", current.badge)}>{current.name}</span>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Monthly</span><span className="font-bold">{current.price ? fmtKES(current.price) : "Custom"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Schedules</span><span className="font-bold">{current.maxSchedules >= 999999 ? "Unlimited" : `Up to ${current.maxSchedules}`}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">M-Pesa fee</span><span className="font-bold">KES {current.execFee.mpesa || "Free"}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">PesaLink fee</span><span className="font-bold">KES {current.execFee.bank || "Free"}</span></div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="section-title mb-4">Available Plans</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {(["starter","growth"] as const).map(key => {
            const plan = PLANS[key]; const isCur = business.plan === key;
            return (
              <div key={key} className={clsx("rounded-2xl border-2 p-5 transition-all", isCur ? "border-primary bg-primary/5" : "border-slate-200")}>
                <div className="flex items-center justify-between mb-3"><p className="font-bold">{plan.name}</p>{isCur && <span className="badge badge-green text-xs">Current</span>}</div>
                <p className="text-3xl font-black mb-1">{fmtKES(plan.price!)}</p>
                <p className="text-xs text-slate-400 mb-4">/month</p>
                <div className="space-y-1.5 text-sm text-slate-600">
                  <p>✓ {plan.maxSchedules} payment schedules</p>
                  <p>✓ KES {plan.execFee.mpesa} per M-Pesa</p>
                  <p>✓ KES {plan.execFee.bank} per PesaLink</p>
                  <p>✓ Full approval workflows</p>
                  <p>✓ KRA compliance reports</p>
                </div>
                {isOwner && !isCur && <button onClick={() => alert("Contact risewithdion@gmail.com to upgrade")} className="btn-primary w-full mt-5 py-3">Upgrade to {plan.name}</button>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 bg-slate-900 rounded-2xl p-5 flex items-center justify-between">
          <div><p className="font-bold text-white">Enterprise</p><p className="text-sm text-slate-400 mt-1">Unlimited · Zero fees · Dedicated support</p></div>
          <a href="mailto:risewithdion@gmail.com" className="btn-secondary text-sm bg-white">Contact Sales</a>
        </div>
      </div>

      {daysLeft !== null && (
        <div className={clsx("card p-5 border-2", daysLeft <= 7 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
          <p className={clsx("font-bold text-base", daysLeft <= 7 ? "text-red-900" : "text-amber-900")}>Trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
          <p className={clsx("text-sm mt-1", daysLeft <= 7 ? "text-red-700" : "text-amber-700")}>Your automations will pause after the trial. Contact us to activate.</p>
          <a href="mailto:risewithdion@gmail.com" className="btn-primary mt-3 text-sm px-4 py-2.5 inline-flex">Activate subscription →</a>
        </div>
      )}
    </div>
  );
}

function WorkflowTab() {
  return (
    <div className="card p-6 max-w-2xl space-y-5">
      <div><h3 className="section-title mb-0.5">Approval Workflow</h3><p className="text-sm text-slate-500">How payment requests flow through your team</p></div>
      <div className="divider" />
      {[["New payment requests","Require approval before scheduling"],["Amount threshold","All amounts — no auto-approval"],["Auto-execute on due date","Yes — executes when approved and due"],["Failed payment","Notify owner and finance manager"]].map(([l,v]) => (
        <div key={l} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3.5">
          <p className="text-sm font-semibold text-slate-700">{l}</p>
          <p className="text-sm text-primary font-bold">{v}</p>
        </div>
      ))}
      <div className="alert-info">
        <Settings2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
        <div><p className="font-semibold">Custom workflow rules</p><p className="text-blue-700/80 text-xs mt-0.5">Custom approval thresholds and multi-level chains are available on Enterprise.</p></div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { tab: urlTab } = useParams<{ tab?: Tab }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>((urlTab as Tab) || "profile");
  useEffect(() => { if (urlTab && urlTab !== tab) setTab(urlTab as Tab); }, [urlTab]);

  const TABS = [
    { id: "profile"      as Tab, label: "Business Profile", icon: Building2  },
    { id: "billing"      as Tab, label: "Billing & Plans",  icon: CreditCard },
    { id: "workflow"     as Tab, label: "Workflow Rules",   icon: Settings2  },
    { id: "integrations" as Tab, label: "Integrations",     icon: Plug       },
  ];

  return (
    <AppLayout title="Settings" subtitle="Business configuration and billing">
      <div className="page-wrap">
        <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 p-1 w-fit shadow-sm">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); navigate(`/settings/${t.id}`); }}
              className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                tab === t.id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50")}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        {tab === "profile"  && <ProfileTab />}
        {tab === "billing"  && <BillingTab />}
        {tab === "workflow"     && <WorkflowTab />}
        {tab === "integrations" && <IntegrationsTab />}
      </div>
    </AppLayout>
  );
}
