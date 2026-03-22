import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2,
  PlugZap, ChevronDown, ChevronUp, Trash2, Play, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { clsx } from "@/lib/utils";
import { format } from "date-fns";

const SYNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accounting-sync`;

const PROVIDERS = {
  quickbooks: {
    name: "QuickBooks Online",
    shortName: "QB",
    color: "#2CA01C",
    bgClass: "bg-green-50 border-green-200",
    badgeClass: "bg-green-100 text-green-700",
    desc: "Pull open bills & push reconciled payments to QuickBooks Online",
    sandboxNote: "Use Intuit Developer sandbox for testing",
  },
  zoho: {
    name: "Zoho Books",
    shortName: "ZB",
    color: "#E42527",
    bgClass: "bg-red-50 border-red-200",
    badgeClass: "bg-red-100 text-red-700",
    desc: "Pull open bills & push reconciled payments to Zoho Books (Kenya)",
    sandboxNote: "Use Zoho Books free trial org for testing",
  },
} as const;

type Provider = keyof typeof PROVIDERS;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    active:  { cls: "bg-green-100 text-green-700",  label: "Connected",    icon: <CheckCircle2 size={11}/> },
    paused:  { cls: "bg-amber-100 text-amber-700",  label: "Paused",       icon: <Clock size={11}/> },
    error:   { cls: "bg-red-100 text-red-700",      label: "Error",        icon: <AlertTriangle size={11}/> },
    revoked: { cls: "bg-slate-100 text-slate-600",  label: "Disconnected", icon: <XCircle size={11}/> },
  };
  const cfg = map[status] ?? map["error"];
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", cfg.cls)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function IntegrationCard({
  provider, integration, onConnect, onDisconnect, onTestSync,
}: {
  provider: Provider;
  integration?: any;
  onConnect:    (p: Provider) => Promise<void>;
  onDisconnect: (id: string)  => Promise<void>;
  onTestSync:   (id: string)  => Promise<void>;
}) {
  const { isAdmin } = useAuth();
  const prov = PROVIDERS[provider];
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [syncLog, setSyncLog]   = useState<any[]>([]);

  const isConnected = ["active", "paused"].includes(integration?.status ?? "");
  const hasError    = integration?.status === "error";

  const fetchLog = useCallback(async () => {
    if (!integration?.id) return;
    const { data } = await supabase.from("sync_events")
      .select("*").eq("integration_id", integration.id)
      .order("created_at", { ascending: false }).limit(15);
    if (data) setSyncLog(data);
  }, [integration?.id]);

  useEffect(() => { if (expanded) fetchLog(); }, [expanded, fetchLog]);

  const lastSyncLabel = integration?.last_sync_at
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(integration.last_sync_at).getTime()) / 60000);
        if (mins < 1)  return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      })()
    : "Never synced";

  return (
    <div className={clsx(
      "rounded-2xl border-2 transition-all",
      hasError    ? "border-red-200 bg-red-50/40" :
      isConnected ? "border-green-200 bg-green-50/20" : "border-slate-200 bg-white"
    )}>
      {/* Header row */}
      <div className="p-5 flex items-center gap-4">
        <div className={clsx(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm shadow-sm",
          provider === "quickbooks" ? "bg-[#2CA01C]" : "bg-[#E42527]"
        )}>
          {prov.shortName}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-800">{prov.name}</p>
            {integration && <StatusBadge status={integration.status} />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isConnected
              ? <>Last sync: <span className="font-medium text-slate-700">{lastSyncLabel}</span>
                  {integration.consecutive_errors > 0 && (
                    <span className="ml-2 text-red-500 font-semibold">
                      · {integration.consecutive_errors} error{integration.consecutive_errors > 1 ? "s" : ""}
                    </span>
                  )}
                </>
              : prov.desc
            }
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isConnected && isAdmin && (
            <>
              <button onClick={async () => { setLoading(true); await onTestSync(integration.id); setLoading(false); }}
                disabled={loading} title="Sync now"
                className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 text-slate-600 transition-all">
                {loading ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
              </button>
              <button onClick={async () => { setLoading(true); await onDisconnect(integration.id); setLoading(false); }}
                disabled={loading} title="Disconnect"
                className="p-2 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 text-red-500 transition-all">
                <Trash2 size={16}/>
              </button>
            </>
          )}
          {!integration && isAdmin && (
            <button onClick={async () => { setLoading(true); await onConnect(provider); setLoading(false); }}
              disabled={loading}
              className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
              {loading
                ? <><Loader2 size={14} className="animate-spin"/>Connecting…</>
                : <><PlugZap size={14}/>Connect</>}
            </button>
          )}
          {integration && (
            <button onClick={() => setExpanded(e => !e)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-all">
              {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {hasError && integration?.last_error && (
        <div className="mx-5 mb-4 p-3 rounded-xl bg-red-100 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5"/>
          <span>{integration.last_error}</span>
        </div>
      )}

      {/* Expanded panel */}
      {expanded && integration && (
        <div className="border-t border-slate-100">
          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: "Provider",     value: integration.provider },
              { label: "Last status",  value: integration.last_sync_status ?? "—" },
              { label: "Errors",       value: String(integration.consecutive_errors) },
            ].map(s => (
              <div key={s.label} className="px-5 py-3 text-center">
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Sync log */}
          <div className="p-5 pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sync Log</p>
              <button onClick={fetchLog} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                <RefreshCw size={11}/> Refresh
              </button>
            </div>
            {syncLog.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No sync events yet</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {syncLog.map(ev => (
                  <div key={ev.id} className={clsx(
                    "flex items-start gap-2 text-xs rounded-lg px-3 py-2",
                    ev.status === "ok"    ? "bg-green-50 text-green-800" :
                    ev.status === "error" ? "bg-red-50 text-red-800"    : "bg-amber-50 text-amber-800"
                  )}>
                    <span className={clsx("mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 mt-1",
                      ev.status==="ok"?"bg-green-500":ev.status==="error"?"bg-red-500":"bg-amber-500")}/>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium capitalize">
                        {ev.direction} {ev.event_type?.replace(/_/g," ")}
                      </span>
                      {ev.records_affected > 0 && (
                        <span className="ml-1 opacity-60">· {ev.records_affected} record{ev.records_affected!==1?"s":""}</span>
                      )}
                      {ev.error_detail && <p className="mt-0.5 opacity-70 truncate">{ev.error_detail}</p>}
                    </div>
                    <span className="shrink-0 opacity-50">
                      {new Date(ev.created_at).toLocaleTimeString("en-KE",{timeZone:"Africa/Nairobi",hour:"2-digit",minute:"2-digit"})}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────
export function IntegrationsTab() {
  const { business, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // Handle OAuth return
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      showToast(`${(PROVIDERS as any)[connected]?.name ?? connected} connected! 🎉`);
      navigate("/settings/integrations", { replace: true });
    }
  }, [searchParams, navigate]);

  const fetchIntegrations = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const { data } = await supabase
      .from("accounting_integrations")
      .select("*")
      .eq("business_id", business.id)
      .neq("status", "revoked");
    const map: Record<string, any> = {};
    for (const i of (data ?? [])) map[i.provider] = i;
    setIntegrations(map);
    setLoading(false);
  }, [business]);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const handleConnect = async (provider: Provider) => {
    if (!business) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`${SYNC_URL}/oauth/connect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider, businessId: business.id }),
    });
    const { url, error } = await res.json();
    if (error) { showToast(error, false); return; }
    window.location.href = url;
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm("Disconnect this integration? Sync will stop immediately.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`${SYNC_URL}/integration/${integrationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    showToast("Integration disconnected");
    fetchIntegrations();
  };

  const handleTestSync = async (integrationId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    showToast("Syncing…");
    const res = await fetch(`${SYNC_URL}/sync/pull`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ integrationId }),
    });
    const result = await res.json();
    if (result.ok) {
      showToast(`✅ Done — ${result.imported ?? 0} imported, ${result.skipped ?? 0} unchanged`);
    } else {
      showToast(`❌ ${result.error}`, false);
    }
    fetchIntegrations();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={clsx(
          "fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2 animate-in fade-in",
          toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.ok ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      <div>
        <h3 className="section-title mb-0.5">Accounting Integrations</h3>
        <p className="text-sm text-slate-500">
          Connect your accounting software for fully automatic bill sync and payment reconciliation.
          Zero manual entry after setup.
        </p>
      </div>
      <div className="divider"/>

      {/* How it works */}
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wide">How it works</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: "📥", step: "1. Pull",      desc: "Dion imports open bills from QB/Zoho every 10 min into your Bills → Feed inbox" },
            { icon: "✅", step: "2. Review",    desc: "You review & accept bills in one click — or auto-accept with matched payees" },
            { icon: "📤", step: "3. Reconcile", desc: "After payment, Dion pushes receipt back as a reconciled bill payment" },
          ].map(s => (
            <div key={s.step}>
              <div className="text-2xl mb-1">{s.icon}</div>
              <p className="text-xs font-bold text-blue-800">{s.step}</p>
              <p className="text-xs text-blue-600 leading-relaxed mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Provider cards */}
      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="card p-5"><div className="skeleton h-16 w-full rounded-xl"/></div>)}
        </div>
      ) : (
        <div className="space-y-4">
          {(["quickbooks","zoho"] as Provider[]).map(provider => (
            <IntegrationCard
              key={provider}
              provider={provider}
              integration={integrations[provider]}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onTestSync={handleTestSync}
            />
          ))}
        </div>
      )}

      {/* eTIMS / KRA note */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-xs font-bold text-amber-800 mb-1">🇰🇪 KRA / eTIMS Note</p>
        <p className="text-xs text-amber-700">
          Bills pulled from vendors without a KRA PIN will be flagged with ⚠️ in the Feed inbox.
          Ensure all payees have KRA PINs in your accounting software for full eTIMS compliance.
        </p>
      </div>
    </div>
  );
}

export default IntegrationsTab;
