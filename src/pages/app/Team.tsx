import React, { useState, useEffect } from "react";
import { Plus, X, Loader2, Trash2, Mail, Crown, Shield, DollarSign, Eye, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { BusinessMember, MemberRole } from "@/lib/types";
import { ROLE_CONFIG } from "@/lib/constants";
import { clsx } from "@/lib/utils";
import { format } from "date-fns";

const ROLE_ICONS: Record<MemberRole, React.ElementType> = {
  owner: Crown, admin: Shield, finance_manager: DollarSign, approver: CheckCircle2, viewer: Eye,
};

function InviteModal({ businessId, onClose, onDone }: { businessId: string; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [role, setRole]   = useState<MemberRole>("viewer");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const send = async () => {
    if (!email.trim()) { setError("Email is required"); return; }
    setSaving(true);
    const { data: existing } = await supabase.from("business_members").select("id").eq("business_id", businessId).eq("email", email.trim()).maybeSingle();
    if (existing) { setError("This person is already a member."); setSaving(false); return; }
    const { error: err } = await supabase.from("business_members").insert({
      business_id: businessId, user_id: "00000000-0000-0000-0000-000000000000",
      email: email.trim(), full_name: name.trim() || null, role, status: "invited",
    });
    if (err) { setError(err.message); setSaving(false); return; }
    await supabase.from("audit_logs").insert({ business_id: businessId, user_id: user?.id, action: "member.invited", details: { email: email.trim(), role } });
    onDone(); setSaving(false); onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-lg">Invite Team Member</h2>
          <button onClick={onClose} className="btn-icon"><X size={17} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="field">
            <label className="label">Work email *</label>
            <div className="relative"><Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-10" type="email" placeholder="colleague@company.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} /></div>
          </div>
          <div className="field"><label className="label">Full name (optional)</label><input className="input" placeholder="Jane Mwangi" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field">
            <label className="label">Role *</label>
            <div className="space-y-2">
              {(Object.entries(ROLE_CONFIG) as [MemberRole, any][]).filter(([r]) => r !== "owner").map(([r, cfg]) => {
                const Icon = ROLE_ICONS[r];
                return (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={clsx("w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
                      role === r ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300")}>
                    <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", cfg.badge)}><Icon size={14} /></div>
                    <div><p className="font-semibold text-sm">{cfg.label}</p><p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p></div>
                  </button>
                );
              })}
            </div>
          </div>
          {error && <div className="alert-danger"><span>✕</span>{error}</div>}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={send} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 size={14} className="animate-spin" />Sending…</> : "Send Invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const { business, member: myMember, isAdmin } = useAuth();
  const [members, setMembers]   = useState<BusinessMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => { if (business) load(); }, [business?.id]);

  const load = async () => {
    if (!business) return;
    setLoading(true);
    const { data } = await supabase.from("business_members").select("*").eq("business_id", business.id).neq("status","suspended").order("joined_at");
    setMembers(data as BusinessMember[] || []);
    setLoading(false);
  };

  const changeRole = async (id: string, newRole: MemberRole) => {
    await supabase.from("business_members").update({ role: newRole }).eq("id", id);
    setMembers(p => p.map(m => m.id === id ? { ...m, role: newRole } : m));
  };

  const remove = async (m: BusinessMember) => {
    if (m.role === "owner") return;
    if (!confirm(`Remove ${m.full_name || m.email}?`)) return;
    await supabase.from("business_members").update({ status: "suspended" }).eq("id", m.id);
    setMembers(p => p.filter(x => x.id !== m.id));
  };

  return (
    <AppLayout title="Team" subtitle="Manage access and roles"
      actions={isAdmin ? <button onClick={() => setShowInvite(true)} className="btn-primary"><Plus size={15} /> Invite Member</button> : undefined}>
      <div className="page-wrap">
        {/* Role overview */}
        <div className="card p-5">
          <p className="section-title mb-4">Access levels</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(ROLE_CONFIG) as [MemberRole, any][]).map(([r, cfg]) => {
              const Icon = ROLE_ICONS[r];
              return (
                <div key={r} className="text-center p-3 bg-slate-50 rounded-2xl">
                  <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", cfg.badge)}><Icon size={16} /></div>
                  <p className="text-xs font-bold">{cfg.label}</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">{cfg.desc.split(".")[0]}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead className="thead"><tr>{["Member","Role","Status","Joined",""].map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="tbody">
                {loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}>{Array.from({length:5}).map((_,j) => <td key={j} className="td"><div className="skeleton h-4 w-full" /></td>)}</tr>)
                : members.map(m => {
                  const cfg  = ROLE_CONFIG[m.role];
                  const Icon = ROLE_ICONS[m.role];
                  const isMe = m.id === myMember?.id;
                  return (
                    <tr key={m.id} className="tr">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-sm shrink-0">{(m.full_name || m.email)[0].toUpperCase()}</div>
                          <div>
                            <p className="font-semibold">{m.full_name || m.email}</p>
                            {m.full_name && <p className="text-xs text-slate-400">{m.email}</p>}
                            {isMe && <span className="badge badge-blue text-[10px] px-1.5 py-0.5">You</span>}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        {isAdmin && m.role !== "owner" && !isMe ? (
                          <select value={m.role} onChange={e => changeRole(m.id, e.target.value as MemberRole)}
                            className={clsx("text-xs font-bold px-2.5 py-1.5 rounded-xl border-0 outline-none cursor-pointer", cfg.badge)}>
                            {(Object.keys(ROLE_CONFIG) as MemberRole[]).filter(r => r !== "owner").map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
                          </select>
                        ) : <span className={clsx("badge", cfg.badge)}><Icon size={10} /> {cfg.label}</span>}
                      </td>
                      <td className="td"><span className={clsx("badge", m.status === "active" ? "badge-green" : m.status === "invited" ? "badge-amber" : "badge-red")}>{m.status}</span></td>
                      <td className="td text-xs text-slate-500">{m.joined_at ? format(new Date(m.joined_at), "dd MMM yyyy") : "Pending"}</td>
                      <td className="td">{isAdmin && m.role !== "owner" && !isMe && <button onClick={() => remove(m)} className="btn-icon p-2 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showInvite && <InviteModal businessId={business!.id} onClose={() => setShowInvite(false)} onDone={load} />}
    </AppLayout>
  );
}
