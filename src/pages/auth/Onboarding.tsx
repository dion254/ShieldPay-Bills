import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { INDUSTRY_CONFIG } from "@/lib/constants";
import { clsx } from "@/lib/utils";
import type { IndustryType } from "@/lib/types";

const STEPS = [
  {
    id: "welcome",
    emoji: "🎉",
    title: "Welcome to ShieldPay!",
    desc: "Your 30-day free trial is active. Let\'s spend 90 seconds setting up so you never miss a bill payment again.",
    cta: "Let\'s go →",
  },
  {
    id: "industry",
    emoji: "🏢",
    title: "What type of business do you run?",
    desc: "We\'ll personalise your experience for your industry.",
    cta: "Continue →",
  },
  {
    id: "supplier",
    emoji: "📋",
    title: "Add your first supplier",
    desc: "Start with your most important one — KPLC, fuel depot, food supplier. Takes 30 seconds.",
    cta: "Add first supplier →",
    action: "/suppliers",
  },
  {
    id: "done",
    emoji: "🚀",
    title: "You\'re all set!",
    desc: "Your account is ready. Head to your dashboard to schedule your first bill payment.",
    cta: "Go to dashboard →",
    action: "/dashboard",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { business, loading, refetch } = useAuth();
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<IndustryType>("restaurant");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && business) {
      // Already has business — allow stepping through or skip
    }
  }, [loading, business]);

  const cur = STEPS[step];

  const handleNext = async () => {
    if (cur.id === "industry" && business) {
      setSaving(true);
      await supabase.from("businesses").update({ industry }).eq("id", business.id);
      refetch();
      setSaving(false);
      setStep(s => s + 1);
      return;
    }
    if (cur.action) {
      navigate(cur.action);
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-primary flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="font-black text-white text-lg">ShieldPay</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="flex h-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={clsx(
                "flex-1 transition-all duration-500",
                i <= step ? "bg-primary" : "bg-slate-100"
              )} />
            ))}
          </div>

          <div className="p-8 text-center">
            <div className="text-6xl mb-5">{cur.emoji}</div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">{cur.title}</h2>
            <p className="text-slate-500 leading-relaxed mb-8 max-w-sm mx-auto text-sm">{cur.desc}</p>

            {/* Industry selector */}
            {cur.id === "industry" && (
              <div className="grid grid-cols-2 gap-3 mb-8">
                {(Object.entries(INDUSTRY_CONFIG) as [IndustryType, any][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setIndustry(key)}
                    className={clsx(
                      "flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all",
                      industry === key
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <span className="text-3xl">{cfg.icon}</span>
                    <span className="font-bold text-sm text-slate-700">{cfg.label}</span>
                    <span className="text-xs text-slate-400 leading-tight">{cfg.tagline.split("—")[0]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Trial reminder */}
            {cur.id === "welcome" && (
              <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-700">
                <CheckCircle2 size={15} />
                <span className="font-semibold">30-day free trial active</span>
                <span className="text-green-500">· No card required</span>
              </div>
            )}

            <button
              onClick={handleNext}
              disabled={saving}
              className="btn-primary w-full py-4 text-base rounded-2xl flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : cur.cta}
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="w-full text-sm text-slate-400 hover:text-slate-600 py-3 transition-colors mt-2"
            >
              Skip to dashboard
            </button>
          </div>

          <p className="text-center text-xs text-slate-300 pb-5">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
      </div>
    </div>
  );
}
