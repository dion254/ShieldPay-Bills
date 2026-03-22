import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Landing    from "@/pages/Landing";
import Auth       from "@/pages/auth/Auth";
import Onboarding from "@/pages/auth/Onboarding";
import Dashboard  from "@/pages/app/Dashboard";
import Bills      from "@/pages/app/Bills";
import Suppliers  from "@/pages/app/Suppliers";
import Payments   from "@/pages/app/Payments";
import Team       from "@/pages/app/Team";
import Reports    from "@/pages/app/Reports";
import Settings   from "@/pages/app/Settings";
import KRA        from "@/pages/app/KRA";
import SuperAdmin from "@/pages/admin/SuperAdmin";

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-[3px] border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-slate-500 font-medium">Loading ShieldPay…</p>
      </div>
    </div>
  );
}

function Guard({ children, requireBusiness }: { children: React.ReactNode; requireBusiness?: boolean }) {
  const { user, business, loading } = useAuth();
  if (loading)                      return <Spinner />;
  if (!user)                        return <Navigate to="/login" replace />;
  if (requireBusiness && !business) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function SuperGuard({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin, loading } = useAuth();
  if (loading)                return <Spinner />;
  if (!user || !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Landing />} />
        <Route path="/login"      element={<Auth />} />
        <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />

        <Route path="/dashboard"     element={<Guard requireBusiness><Dashboard /></Guard>} />
        <Route path="/bills"         element={<Guard requireBusiness><Bills /></Guard>} />
        <Route path="/suppliers"     element={<Guard requireBusiness><Suppliers /></Guard>} />
        <Route path="/payments"      element={<Guard requireBusiness><Payments /></Guard>} />
        <Route path="/payments/:tab" element={<Guard requireBusiness><Payments /></Guard>} />
        <Route path="/team"          element={<Guard requireBusiness><Team /></Guard>} />
        <Route path="/reports"       element={<Guard requireBusiness><Reports /></Guard>} />
        <Route path="/reports/:tab"  element={<Guard requireBusiness><Reports /></Guard>} />
        <Route path="/kra"           element={<Guard requireBusiness><KRA /></Guard>} />
        <Route path="/settings"      element={<Guard requireBusiness><Settings /></Guard>} />
        <Route path="/settings/:tab" element={<Guard requireBusiness><Settings /></Guard>} />
        <Route path="/admin"         element={<SuperGuard><SuperAdmin /></SuperGuard>} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
