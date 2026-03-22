import React from "react";
import { Link } from "react-router-dom";
import {
  Shield, ArrowRight, CheckCircle2, CreditCard, Users,
  FileText, BarChart3, BookOpen, Clock, Lock, Globe,
  Banknote, Star, Receipt, TrendingUp, Zap, Bell,
} from "lucide-react";

const PAIN_POINTS = [
  { icon: "😩", pain: "Forgetting which bills are due this week", fix: "ShieldPay tracks every due date and alerts you 3 days before." },
  { icon: "📋", pain: "Writing down supplier details every payment", fix: "Add a supplier once. ShieldPay pays them every time, automatically." },
  { icon: "🗂️", pain: "Hunting for receipts when KRA comes calling", fix: "Every payment generates a receipt with full details, stored forever." },
  { icon: "📉", pain: "Not knowing where your money actually goes", fix: "Live cash flow by category — utilities, fuel, payroll, rent — always visible." },
  { icon: "😤", pain: "Chasing your finance team for approvals", fix: "Requests go straight to the approver. One click. Done. Audit trail kept." },
  { icon: "🏦", pain: "Manually initiating bank transfers one by one", fix: "ShieldPay executes bank-to-bank via PesaLink and M-Pesa automatically." },
];

const INDUSTRIES = [
  {
    id: "restaurant", emoji: "🍽️", name: "Restaurants",
    headline: "Run a restaurant?",
    sub: "KPLC, gas, food suppliers, rent, NHIF — ShieldPay handles all of it so you can focus on serving great food.",
    accent: "orange",
    bills: [
      { icon: "⚡", name: "KPLC Bill",        freq: "Monthly" },
      { icon: "🔥", name: "Gas / LPG",        freq: "Weekly"  },
      { icon: "🥩", name: "Food Supplier",    freq: "Weekly"  },
      { icon: "🏢", name: "Rent / Lease",     freq: "Monthly" },
      { icon: "🏥", name: "NHIF / NSSF",      freq: "Monthly" },
      { icon: "💧", name: "Water Bill",       freq: "Monthly" },
    ],
  },
  {
    id: "logistics", emoji: "🚛", name: "Logistics & Transport",
    headline: "Running a fleet?",
    sub: "Fuel, insurance, maintenance, driver payroll — zero missed payments, full approval trail for every shilling.",
    accent: "blue",
    bills: [
      { icon: "⛽", name: "Fuel / Petroleum", freq: "Weekly"  },
      { icon: "🛡️", name: "Vehicle Insurance",freq: "Monthly" },
      { icon: "🔧", name: "Maintenance / Tyres", freq: "Monthly" },
      { icon: "📋", name: "NTSA / Licensing", freq: "Yearly"  },
      { icon: "👷", name: "Driver NSSF",      freq: "Monthly" },
      { icon: "🛣️", name: "Toll / Road Fees", freq: "Weekly"  },
    ],
  },
];

const FEATURES = [
  { icon: FileText,   title: "Bill Scheduling",      desc: "Every recurring bill gets a schedule — amount, supplier, due date, frequency. ShieldPay does the rest.",    color: "bg-primary/10 text-primary"     },
  { icon: Receipt,    title: "Auto Receipts",         desc: "The moment a payment completes, a receipt is auto-generated with full details: supplier, method, reference.", color: "bg-green-100 text-green-600"    },
  { icon: TrendingUp, title: "Cash Flow Reports",     desc: "See exactly where every shilling went this month, broken down by category, supplier and payment method.",    color: "bg-indigo-100 text-indigo-600"  },
  { icon: CheckCircle2,"title": "Approval Workflows", desc: "Every payment request goes to your approver before execution. Full chain-of-custody for every transaction.",  color: "bg-amber-100 text-amber-600"    },
  { icon: Globe,      title: "PesaLink Bank Transfer", desc: "Direct bank-to-bank via Stanbic PesaLink. Real-time settlement across all Kenyan commercial banks.",        color: "bg-blue-100 text-blue-600"      },
  { icon: CreditCard, title: "KCB Buni M-Pesa",       desc: "Pay any paybill, till or phone number via KCB Buni. Full M-Pesa integration, zero manual STK pushes.",      color: "bg-teal-100 text-teal-600"      },
  { icon: BookOpen,   title: "KRA Filing Ready",       desc: "Export KRA-compliant payment reports with VAT breakdowns for any date range in seconds.",                    color: "bg-rose-100 text-rose-600"      },
  { icon: Lock,       title: "Immutable Audit Trail",  desc: "Every action on every payment is logged with timestamp, user and role. Nothing can be deleted or altered.",  color: "bg-slate-100 text-slate-600"    },
  { icon: Bell,       title: "Smart Alerts",           desc: "Get notified 3 days before a bill is due. Approvers get instant alerts when a request is waiting.",         color: "bg-orange-100 text-orange-600"  },
  { icon: Users,      title: "5-Role Team Control",    desc: "Owner, Admin, Finance Manager, Approver, Viewer. Everyone sees exactly what they need — nothing more.",     color: "bg-purple-100 text-purple-600"  },
  { icon: BarChart3,  title: "Spend Analytics",        desc: "Monthly spending by category. Year-on-year comparison. Which suppliers cost most. Visual. Instant.",        color: "bg-cyan-100 text-cyan-600"      },
  { icon: Zap,        title: "Automated Execution",    desc: "Enable auto-execute on a schedule and ShieldPay initiates the payment on the due date. Completely hands-free.", color: "bg-yellow-100 text-yellow-600" },
];

const HOW = [
  { n: "01", emoji: "🏗️", title: "Add your suppliers",         desc: "Add any payee — KPLC, your fuel station, food supplier, insurer — with their bank account, paybill or till. Stored once, used every time." },
  { n: "02", emoji: "📅", title: "Schedule your bills",         desc: "Create a schedule for every recurring bill. Set the amount, due date, frequency and who needs to approve it." },
  { n: "03", emoji: "✅", title: "Approve in one click",        desc: "On the due date ShieldPay notifies your approver. One click approves it. The payment executes via M-Pesa or PesaLink instantly." },
  { n: "04", emoji: "📄", title: "Receipt generated. Done.",    desc: "The moment money moves, a receipt is created with receipt number, supplier, amount, method and reference. No more chasing paper." },
];

const PLANS = [
  {
    key: "starter", name: "Starter", price: "KES 1,499", period: "/month",
    desc: "Perfect for a single restaurant or small logistics company",
    features: ["Up to 20 bill schedules","PesaLink + KCB Buni M-Pesa","Auto-generated receipts","Cash flow reports","Approval workflows","KRA compliance reports","Team management","KES 35 per M-Pesa · KES 65 per bank"],
    highlight: false, cta: "Start free trial",
  },
  {
    key: "growth", name: "Growth", price: "KES 2,999", period: "/month",
    desc: "For multi-branch restaurants or growing fleets",
    features: ["Up to 50 bill schedules","Everything in Starter","Reduced execution fees","Advanced cash flow analytics","Auto-execute on due date","Priority processing","KES 25 per M-Pesa · KES 50 per bank","Priority support"],
    highlight: true, cta: "Start free trial",
  },
  {
    key: "enterprise", name: "Enterprise", price: "Custom", period: "",
    desc: "For large chains, hotel groups or national logistics fleets",
    features: ["Unlimited schedules","Everything in Growth","Zero execution fees","Dedicated account manager","Custom integrations & API","SLA guarantee","On-site training & onboarding"],
    highlight: false, cta: "Contact us",
  },
];

const TESTIMONIALS = [
  { name: "James Kariuki",  role: "Owner · Karura Bistro, Nairobi",           stars: 5, quote: "Our KPLC, gas and food supplier bills used to take my manager half a day every month. ShieldPay runs all of it. The receipts alone save me hours of admin." },
  { name: "Grace Achieng",  role: "Finance Director · Mombasa Fast Freight",   stars: 5, quote: "Managing fuel payments for 40 vehicles was chaos. ShieldPay gives me an approval trail for every payment and auto-receipts I can give auditors directly." },
  { name: "Peter Mwangi",   role: "CEO · Eastlands Catering Group",            stars: 5, quote: "We used to miss NHIF deadlines. Never again. ShieldPay schedules it, reminds my finance manager, she approves, it pays. That's it." },
];

export default function Landing() {
  const accentBorder: Record<string,string>  = { orange:"border-orange-300", blue:"border-blue-300" };
  const accentBg: Record<string,string>      = { orange:"bg-orange-50",      blue:"bg-blue-50"      };
  const accentBadge: Record<string,string>   = { orange:"bg-orange-100 text-orange-700", blue:"bg-blue-100 text-blue-700" };
  const accentCheck: Record<string,string>   = { orange:"text-orange-500",   blue:"text-blue-500"   };
  const accentBtn: Record<string,string>     = { orange:"bg-orange-500 hover:bg-orange-600 text-white", blue:"bg-blue-600 hover:bg-blue-700 text-white" };
  const accentDot: Record<string,string>     = { orange:"bg-orange-400",     blue:"bg-blue-400"     };

  return (
    <div className="min-h-screen bg-white">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-black text-slate-900 text-lg">Shield<span className="text-primary">Pay</span></span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#problem"      className="hover:text-primary transition-colors">Why ShieldPay</a>
            <a href="#industries"   className="hover:text-primary transition-colors">Industries</a>
            <a href="#features"     className="hover:text-primary transition-colors">Features</a>
            <a href="#pricing"      className="hover:text-primary transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-slate-900">Sign in</Link>
            <Link to="/login" className="bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-primary/90 shadow-sm shadow-primary/30">
              Start free — 30 days
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-28 pb-20 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-4 py-2 rounded-full mb-8">
            <Zap size={12} /> Auto-receipts · Auto-reminders · Auto-execution · Kenya
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight mb-6">
            You don't have to<br />
            <span className="text-primary">remember a single bill.</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-6 leading-relaxed">
            ShieldPay automates every business bill for{" "}
            <strong className="text-orange-600">restaurants</strong> and{" "}
            <strong className="text-blue-600">logistics companies</strong> in Kenya.
            Schedule it once. We follow up, remind your team, execute the payment and generate the receipt.
            <strong className="text-slate-700"> Completely hands-free.</strong>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {["No missed due dates","Auto receipts per payment","Bank-to-bank transfers","M-Pesa paybill & till","KRA-ready reports"].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={13} className="text-green-500" /> {t}
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/login" className="bg-primary text-white font-bold px-8 py-4 rounded-2xl text-base hover:bg-primary/90 flex items-center gap-2 shadow-xl shadow-primary/20">
              Get started free <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className="border-2 border-slate-200 text-slate-700 font-semibold px-8 py-4 rounded-2xl text-base hover:border-slate-300 hover:bg-slate-50">
              See how it works
            </a>
          </div>
          <p className="text-sm text-slate-400 mt-5">30-day free trial · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section id="problem" className="py-20 px-4 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Sound familiar?</p>
            <h2 className="text-4xl font-black text-white">Bill management is killing your time.</h2>
            <p className="text-slate-400 mt-3 text-lg">ShieldPay removes every one of these headaches.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAIN_POINTS.map(p => (
              <div key={p.pain} className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <p className="text-3xl mb-4">{p.icon}</p>
                <p className="text-slate-300 text-sm font-medium mb-3 line-through opacity-70">{p.pain}</p>
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-400 shrink-0 mt-0.5" />
                  <p className="text-green-300 text-sm font-semibold">{p.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section id="industries" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Two industries. One platform.</p>
            <h2 className="text-4xl font-black text-slate-900">Built for your business</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {INDUSTRIES.map((ind: any) => (
              <div key={ind.id}
                className={`rounded-3xl p-8 border-2 ${accentBorder[ind.accent]} ${accentBg[ind.accent]} hover:shadow-xl transition-all`}>
                <div className="text-5xl mb-4">{ind.emoji}</div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${accentBadge[ind.accent]}`}>{ind.name}</span>
                <h3 className="text-2xl font-black text-slate-900 mt-4 mb-2">{ind.headline}</h3>
                <p className="text-slate-600 mb-7 leading-relaxed">{ind.sub}</p>
                <div className="mb-7">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Bills we automate for you</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ind.bills.map((b: any) => (
                      <div key={b.name} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-white/80 shadow-sm">
                        <span className="text-base">{b.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{b.name}</p>
                          <p className="text-[10px] text-slate-400">{b.freq}</p>
                        </div>
                        <div className={`ml-auto w-2 h-2 rounded-full ${accentDot[ind.accent]}`} />
                      </div>
                    ))}
                  </div>
                </div>
                <Link to="/login"
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${accentBtn[ind.accent]}`}>
                  Start automating <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Simple setup</p>
            <h2 className="text-4xl font-black text-slate-900">Running in under 10 minutes.</h2>
            <p className="text-slate-500 mt-3 text-lg">After that, ShieldPay works in the background. You focus on the business.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {HOW.map(step => (
              <div key={step.n} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 flex gap-5">
                <span className="text-4xl shrink-0 mt-1">{step.emoji}</span>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black text-primary/30 tabular-nums">{step.n}</span>
                    <h3 className="font-bold text-slate-900 text-base">{step.title}</h3>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-primary rounded-2xl p-8 text-center">
            <p className="text-white font-black text-2xl mb-2">That's it. Really.</p>
            <p className="text-white/70 text-base mb-6">No manual bank visits. No chasing receipts. No missed payments.</p>
            <Link to="/login" className="inline-flex items-center gap-2 bg-white text-primary font-bold px-6 py-3 rounded-xl hover:bg-white/90">
              Start now — free for 30 days <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Everything included</p>
            <h2 className="text-4xl font-black text-slate-900">Engineering-grade bill automation.</h2>
            <p className="text-slate-500 mt-3 text-lg">Every feature built for Kenyan businesses.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Transparent pricing</p>
            <h2 className="text-4xl font-black text-slate-900">One price. Everything included.</h2>
            <p className="text-slate-500 mt-3 text-lg">30-day free trial on every plan. No credit card.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map(plan => (
              <div key={plan.key}
                className={`rounded-3xl p-8 border-2 ${
                  plan.highlight ? "border-primary bg-primary text-white shadow-2xl shadow-primary/20 scale-105" : "border-slate-200 bg-white"
                }`}>
                <p className={`font-bold text-lg mb-1 ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.name}</p>
                <p className={`text-sm mb-6 ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>{plan.desc}</p>
                <div className="mb-8">
                  <span className={`text-4xl font-black ${plan.highlight ? "text-white" : "text-slate-900"}`}>{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? "text-white/60" : "text-slate-400"}`}>{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? "text-white/90" : "text-slate-600"}`}>
                      <CheckCircle2 size={14} className={`mt-0.5 shrink-0 ${plan.highlight ? "text-white" : "text-primary"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/login"
                  className={`block w-full py-3.5 rounded-xl font-bold text-sm text-center transition-colors ${
                    plan.highlight ? "bg-white text-primary hover:bg-white/90" : "bg-primary text-white hover:bg-primary/90"
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Trusted in Kenya</p>
            <h2 className="text-4xl font-black text-slate-900">They stopped worrying about bills.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-slate-50 rounded-2xl p-7 border border-slate-100">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" className="text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                <p className="text-xs text-slate-400">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-4 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 text-primary text-xs font-bold px-4 py-2 rounded-full mb-8">
            <Shield size={12} /> ShieldPay · Bill Automation for Kenya
          </div>
          <h2 className="text-5xl font-black text-white mb-4">
            Your bills. Sorted.<br /><span className="text-primary">Forever.</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Set it up in 10 minutes. After that, ShieldPay handles your bills, generates receipts, manages approvals and shows you exactly where your money went. You never have to think about bills again.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-2 bg-primary text-white font-bold px-10 py-5 rounded-2xl text-lg hover:bg-primary/90 shadow-2xl shadow-primary/20">
            Start free — 30 days, no card <ArrowRight size={20} />
          </Link>
          <p className="text-slate-500 mt-5 text-sm">Restaurants · Logistics · KCB Buni · Stanbic PesaLink · Kenya</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-600 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Shield size={13} className="text-white" />
            </div>
            <span className="font-bold text-white">ShieldPay</span>
          </div>
          <p>Bill automation for Kenyan businesses · Restaurants · Logistics</p>
          <p>© {new Date().getFullYear()} ShieldPay Kenya</p>
        </div>
      </footer>

    </div>
  );
}
