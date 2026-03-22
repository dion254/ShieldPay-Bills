import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Package, CreditCard, Users,
  BarChart3, Settings, LogOut, Shield, Bell, Menu, X,
  ChevronDown, CheckCircle2, Clock, XCircle, BookOpen,
  TrendingUp, History, ListChecks, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_CONFIG, STATUS_CONFIG } from "@/lib/constants";
import { fmtKES, trialDaysLeft, clsx } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types";
import { format } from "date-fns";

const NAV = [
  { label: "Dashboard",  path: "/dashboard", icon: LayoutDashboard },
  { label: "Bills",      path: "/bills",      icon: FileText },
  { label: "Who You Pay", path: "/suppliers",  icon: Package  },
  { label: "Payments",   path: "/payments",   icon: CreditCard,
    children: [
      { label: "Upcoming",         path: "/payments/upcoming", icon: Clock      },
      { label: "Pending Approval", path: "/payments/pending",  icon: ListChecks },
      { label: "History",          path: "/payments/history",  icon: History    },
    ],
  },
  { label: "Team",       path: "/team",       icon: Users    },
  { label: "Reports",    path: "/reports",    icon: BarChart3,
    children: [
      { label: "Cash Flow",       path: "/reports/cashflow", icon: TrendingUp },
      { label: "Payment Summary", path: "/reports/summary",  icon: TrendingUp },
      { label: "KRA Report",      path: "/reports/kra",      icon: BookOpen   },
      { label: "Audit Log",       path: "/reports/audit",    icon: History    },
    ],
  },
  { label: "KRA Filing", path: "/kra",        icon: BookOpen },
  { label: "Settings",   path: "/settings",   icon: Settings },
];

function NavItem({ item, close }: { item: any; close: () => void }) {
  const { pathname } = useLocation();
  const hasKids     = !!item.children;
  const isActive    = !hasKids && (pathname === item.path || pathname.startsWith(item.path + "/"));
  const childActive = hasKids && item.children.some((c: any) => pathname.startsWith(c.path));
  const [open, setOpen] = useState(childActive);
  useEffect(() => { if (childActive) setOpen(true); }, [pathname]);

  if (hasKids) return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
          childActive ? "text-primary font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
        <item.icon size={16} className="shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={13} className={clsx("text-slate-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-0.5 ml-5 pl-3 border-l-2 border-slate-100 space-y-0.5">
          {item.children.map((c: any) => {
            const active = pathname === c.path || pathname.startsWith(c.path + "/");
            return (
              <Link key={c.path} to={c.path} onClick={close}
                className={clsx("flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors",
                  active ? "text-primary bg-primary/8 font-semibold" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50")}>
                <c.icon size={13} className="shrink-0" /> {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Link to={item.path} onClick={close}
      className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        isActive ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
      <item.icon size={16} className="shrink-0" />
      {item.label}
    </Link>
  );
}

function NotifBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).eq("read", false)
      .order("created_at", { ascending: false }).limit(15)
      .then(({ data }) => setNotifs(data || []));
  }, [user?.id]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
    setNotifs([]);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="btn-icon relative">
        <Bell size={18} />
        {notifs.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {notifs.length > 9 ? "9+" : notifs.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-80 card shadow-panel z-50 overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="font-bold text-sm">Notifications</p>
            {notifs.length > 0 && <button onClick={markAllRead} className="text-xs text-primary hover:underline font-medium">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm"><CheckCircle2 size={24} className="mx-auto mb-2 opacity-30" /> All caught up!</div>
            ) : notifs.map(n => (
              <div key={n.id} className="px-4 py-3 hover:bg-slate-50 flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {n.type === "approval_required" ? <Clock size={13} className="text-amber-600" />
                    : n.type === "payment_failed" ? <XCircle size={13} className="text-red-500" />
                    : <CheckCircle2 size={13} className="text-green-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{n.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{format(new Date(n.created_at), "dd MMM, HH:mm")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as PaymentStatus];
  if (!cfg) return <span className="badge badge-slate capitalize">{status}</span>;
  return <span className={clsx("badge", cfg.badge)}>{cfg.label}</span>;
}

export function StatCard({ label, value, sub, icon: Icon, iconBg = "bg-primary/10 text-primary", onClick, trend }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg?: string;
  onClick?: () => void; trend?: { label: string; up: boolean };
}) {
  return (
    <div onClick={onClick} className={clsx("stat-card", onClick && "card-hover")}>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
          {sub && <p className="stat-sub mt-1">{sub}</p>}
          {trend && (
            <p className={clsx("text-xs font-semibold mt-1.5 flex items-center gap-1", trend.up ? "text-emerald-600" : "text-red-500")}>
              {trend.up ? "↑" : "↓"} {trend.label}
            </p>
          )}
        </div>
        <div className={clsx("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children, title, subtitle, actions }: {
  children: React.ReactNode; title?: string; subtitle?: string; actions?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { user, business, member, role, isSuperAdmin, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const close = () => setSidebarOpen(false);

  const roleConf = role ? ROLE_CONFIG[role] : null;
  const daysLeft = business?.status === "trial" ? trialDaysLeft(business.trial_ends_at) : null;
  const indLabel: Record<string, string> = { restaurant: "🍽️ Restaurant", logistics: "🚛 Logistics" };

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[15px] text-slate-900">ShieldPay</p>
            <p className="text-[10px] text-slate-400 font-medium">Bill Automation · Kenya</p>
          </div>
        </div>
        {business && (
          <div className="mt-3 bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
              {business.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{business.name}</p>
              <p className="text-[10px] text-slate-400">{indLabel[business.industry] ?? business.industry} · {business.plan}</p>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item: any) => <NavItem key={item.path} item={item} close={close} />)}
      </nav>

      {daysLeft !== null && daysLeft <= 14 && (
        <div className="mx-3 mb-2 shrink-0">
          <div className={clsx("rounded-xl px-3 py-2.5 border", daysLeft <= 3 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
            <p className={clsx("text-xs font-bold", daysLeft <= 3 ? "text-red-800" : "text-amber-900")}>
              Trial: {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
            </p>
            <Link to="/settings/billing" className="text-xs text-primary hover:underline font-medium">Activate now →</Link>
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 px-3 py-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-1.5 mb-1">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {(member?.full_name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">{member?.full_name || user?.email}</p>
            {roleConf && <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full", roleConf.badge)}>{roleConf.icon} {roleConf.label}</span>}
          </div>
        </div>
        <button onClick={async () => { await signOut(); navigate("/login"); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-100 fixed h-full z-20 flex-col shadow-sm">
        <SidebarContent />
      </aside>
      {sidebarOpen && (
        <>
          <div className="drawer-overlay lg:hidden" onClick={close} />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-deep lg:hidden">
            <button onClick={close} className="absolute top-4 right-4 btn-icon"><X size={18} /></button>
            <SidebarContent />
          </div>
        </>
      )}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 h-16 flex items-center px-4 lg:px-8 gap-3 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="btn-icon lg:hidden"><Menu size={18} /></button>
          <div className="flex-1 min-w-0">
            {title && <div><h1 className="text-lg font-bold text-slate-900 leading-tight truncate">{title}</h1>{subtitle && <p className="text-xs text-slate-500 hidden sm:block truncate">{subtitle}</p>}</div>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <NotifBell />
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-100 ml-1">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm">
                {(business?.name || "B")[0]}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
