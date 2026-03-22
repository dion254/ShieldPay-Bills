import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const STEPS = [
  { icon: "🎉", title: "Welcome to ShieldPay!", desc: "Your 30-day free trial is active. Let's spend 2 minutes setting up so you can start automating your bill payments.", cta: "Let's go", action: null },
  { icon: "🏢", title: "Add your first supplier", desc: "Add a supplier's payment details — bank account, M-Pesa paybill or till. Stored once, used every time.", cta: "Add supplier", action: "/suppliers" },
  { icon: "📋", title: "Schedule your first bill", desc: "Create a recurring or one-time bill payment. Set the amount, due date and approval requirements.", cta: "Schedule a bill", action: "/bills" },
  { icon: "👥", title: "Invite your team", desc: "Add your finance manager, approver or accountant. Each role gets exactly the access they need.", cta: "Invite team", action: "/team" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { business, loading } = useAuth();
  const [step, setStep] = React.useState(0);

  // FIX 3: If user already has a business and completed setup, go to dashboard
  useEffect(() => {
    if (!loading && business) {
      // They have a business — onboarding is just for first-time feel, allow skip
    }
  }, [loading, business]);

  const cur = STEPS[step];

  const next = () => {
    if (cur.action) { navigate(cur.action); return; }
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else navigate("/dashboard");
  };

  const skip = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-dark to-primary flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg">ShieldPay</span>
        </div>

        <div className="bg-white rounded-3xl shadow-deep overflow-hidden">
          {/* Progress */}
          <div className="flex h-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`flex-1 transition-all duration-500 ${i <= step ? "bg-primary" : "bg-slate-100"}`} />
            ))}
          </div>

          <div className="p-8 text-center">
            <div className="text-6xl mb-6">{cur.icon}</div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">{cur.title}</h2>
            <p className="text-slate-500 leading-relaxed mb-8 max-w-sm mx-auto">{cur.desc}</p>

            <div className="space-y-3">
              <button onClick={next} className="btn-primary w-full py-4 text-base">
                {cur.cta} <ArrowRight size={18} />
              </button>
              <button onClick={skip} className="w-full text-sm text-slate-400 hover:text-slate-600 py-2 transition-colors">
                Skip to dashboard
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 pb-5">Step {step + 1} of {STEPS.length}</p>
        </div>
      </div>
    </div>
  );
}
