import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, User, Phone, Building2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clsx } from "@/lib/utils";
import type { IndustryType } from "@/lib/types";

type Mode = "login" | "register";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode]         = useState<Mode>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError]       = useState("");
  const [f, setF] = useState({
    email: "", password: "", full_name: "", phone: "",
    business_name: "", kra_pin: "", industry: "restaurant" as IndustryType,
  });
  const set = (k: string, v: string) => { setF(p => ({ ...p, [k]: v })); setError(""); };

  // FIX 1: If already logged in, skip this page entirely
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Already logged in — check if they have a business
        supabase.from("business_members")
          .select("id").eq("user_id", session.user.id).eq("status", "active")
          .maybeSingle()
          .then(({ data }) => {
            navigate(data ? "/dashboard" : "/onboarding", { replace: true });
          });
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 border-[3px] border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    if (!f.email || !f.password) { setError("Email and password are required"); return; }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: f.email.trim(), password: f.password,
    });
    if (err) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }
    // Check if they have a business
    const { data: mem } = await supabase.from("business_members")
      .select("id").eq("user_id", data.user.id).eq("status", "active").maybeSingle();
    navigate(mem ? "/dashboard" : "/onboarding", { replace: true });
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!f.full_name.trim())     { setError("Your full name is required"); return; }
    if (!f.business_name.trim()) { setError("Business name is required"); return; }
    if (!f.email.trim())         { setError("Work email is required"); return; }
    if (f.password.length < 8)   { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");

    // FIX 2: Sign up
    const { data: su, error: suErr } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { full_name: f.full_name.trim() } },
    });

    if (suErr) { setError(suErr.message); setLoading(false); return; }
    if (!su.user) { setError("Registration failed. Please try again."); setLoading(false); return; }

    // FIX 2: Always sign in immediately after signup to get a real session
    const { data: si, error: siErr } = await supabase.auth.signInWithPassword({
      email: f.email.trim(), password: f.password,
    });

    if (siErr || !si?.session) {
      // Email confirmation is ON — tell the user clearly instead of looping
      setError("");
      setLoading(false);
      setMode("login");
      // Show confirmation message
      alert("Account created! Please check your email to confirm your account, then sign in.");
      return;
    }

    // FIX 2: We have a real session — create business now
    const { data: biz, error: bizErr } = await supabase.from("businesses").insert({
      name: f.business_name.trim(),
      industry: f.industry,
      phone: f.phone.trim() || null,
      kra_pin: f.kra_pin.trim() || null,
      email: f.email.trim(),
      owner_user_id: su.user.id,
      plan: "starter",
      status: "trial",
      trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select().single();

    if (bizErr || !biz) {
      // Business insert failed — go to onboarding to complete setup
      navigate("/onboarding", { replace: true });
      setLoading(false);
      return;
    }

    // Create owner membership
    await supabase.from("business_members").insert({
      business_id: biz.id,
      user_id: su.user.id,
      email: f.email.trim(),
      full_name: f.full_name.trim(),
      phone: f.phone.trim() || null,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    navigate("/onboarding", { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-primary flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg">ShieldPay</span>
        </div>
        <div>
          <h2 className="text-4xl font-black text-white leading-tight mb-8">
            We handle your bills.<br />You handle your business.
          </h2>
          <div className="space-y-4">
            {[
              "Every recurring bill scheduled automatically",
              "Approval workflows before any money moves",
              "Rent collection with installment payments",
              "KRA-ready reports at any time",
              "Bank-to-bank via PesaLink · M-Pesa via KCB Buni",
            ].map(p => (
              <div key={p} className="flex items-center gap-3 text-white/80 text-sm">
                <CheckCircle2 size={16} className="text-green-400 shrink-0" /> {p}
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">Stanbic PesaLink · KCB Buni · 256-bit encrypted</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-slate-50 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Shield<span className="text-primary">Pay</span></span>
          </div>

          {/* Tabs */}
          <div className="flex bg-white rounded-2xl border border-slate-200 p-1 mb-7 shadow-sm">
            {(["login", "register"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                className={clsx("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  mode === m ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7">
            {mode === "register" && (
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">30-day free trial</p>
                  <p className="text-xs text-blue-700 mt-0.5">Full access. No credit card required.</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {mode === "register" && (
                <>
                  <div className="field">
                    <label className="label">Full name *</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-10" placeholder="Jane Mwangi" value={f.full_name} onChange={e => set("full_name", e.target.value)} />
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Business name *</label>
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="input pl-10" placeholder="Karura Bistro Ltd" value={f.business_name} onChange={e => set("business_name", e.target.value)} />
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Industry *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "restaurant", icon: "🍽️", label: "Restaurant" },
                        { value: "logistics",  icon: "🚛", label: "Logistics"  },
                        { value: "retail",     icon: "🏪", label: "Retail"     },
                        { value: "real_estate",icon: "🏢", label: "Real Estate"},
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => set("industry", opt.value)}
                          className={clsx("flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                            f.industry === opt.value ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-300")}>
                          <span>{opt.icon}</span> {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label">KRA PIN</label>
                      <input className="input font-mono uppercase" placeholder="A012345678Z" maxLength={11}
                        value={f.kra_pin} onChange={e => set("kra_pin", e.target.value.toUpperCase())} />
                    </div>
                    <div className="field">
                      <label className="label">Phone</label>
                      <div className="relative">
                        <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input className="input pl-10" type="tel" placeholder="0712 345 678" value={f.phone} onChange={e => set("phone", e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <hr className="border-slate-100" />
                </>
              )}

              <div className="field">
                <label className="label">Work email *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-10" type="email" placeholder="you@company.com"
                    value={f.email} onChange={e => set("email", e.target.value)} />
                </div>
              </div>

              <div className="field">
                <label className="label">Password *</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-10 pr-12" type={showPass ? "text" : "password"}
                    placeholder="••••••••" value={f.password} onChange={e => set("password", e.target.value)} />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mode === "register" && <p className="field-hint">Minimum 8 characters</p>}
              </div>

              {error && (
                <div className="alert-danger">
                  <span className="shrink-0 font-bold">✕</span> {error}
                </div>
              )}

              <button onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}
                className="btn-primary w-full py-3.5 text-base">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" />{mode === "login" ? "Signing in…" : "Creating account…"}</>
                  : mode === "login" ? "Sign In" : "Start Free Trial"}
              </button>
            </div>

            <p className="text-center text-sm text-slate-400 mt-5">
              {mode === "login"
                ? <>Don't have an account?{" "}<button onClick={() => { setMode("register"); setError(""); }} className="text-primary font-semibold hover:underline">Start free trial</button></>
                : <>Already have an account?{" "}<button onClick={() => { setMode("login"); setError(""); }} className="text-primary font-semibold hover:underline">Sign in</button></>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
