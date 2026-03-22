import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, ArrowRight, CheckCircle2, Play, Star,
  Zap, Lock, BarChart3, Users, Bell, Globe,
  ChevronDown, Menu, X, TrendingUp, Clock,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Features",     href: "#features" },
  { label: "Pricing",      href: "#pricing" },
  { label: "Industries",   href: "#industries" },
];

const STATS = [
  { value: "0%",    label: "Bill miss rate",       sub: "across all customers"    },
  { value: "6hrs",  label: "Saved per week",        sub: "per business on average" },
  { value: "KES 0", label: "Per-transaction fees",  sub: "subscription only"       },
  { value: "30",    label: "Day free trial",        sub: "no card required"        },
];

const HOW_STEPS = [
  {
    n: "01", emoji: "🏗️",
    title: "Add your suppliers",
    desc: "Add any payee — KPLC, your fuel station, food supplier, insurer. Bank account, paybill or till. Stored once, used every time, forever.",
  },
  {
    n: "02", emoji: "📅",
    title: "Schedule every bill",
    desc: "Set the amount, due date and frequency. One-time or recurring. ShieldPay tracks every due date and alerts your team 3 days before.",
  },
  {
    n: "03", emoji: "✅",
    title: "One-click approval",
    desc: "Your approver gets notified. One click approves it. ShieldPay executes via M-Pesa or PesaLink instantly. Full audit trail kept.",
  },
  {
    n: "04", emoji: "📄",
    title: "Receipt generated. Done.",
    desc: "The moment money moves a receipt is created with receipt number, supplier, amount and reference. KRA-ready. Stored forever.",
  },
];

const FEATURES = [
  { icon: Zap,          title: "Zero missed payments",   desc: "Schedule every bill once. ShieldPay executes on the due date, every time, without fail.", color: "bg-primary/10 text-primary" },
  { icon: CheckCircle2, title: "Approval workflows",     desc: "Every payment needs sign-off. Your approver gets an instant notification. One click. Audit trail kept.", color: "bg-green-100 text-green-600" },
  { icon: Globe,        title: "M-Pesa + PesaLink",      desc: "Pay any paybill, till, phone number or bank account. Full integration. Zero manual STK pushes.", color: "bg-blue-100 text-blue-600" },
  { icon: BarChart3,    title: "Live cash flow",          desc: "See exactly where every shilling goes. By category, supplier and month. Visual, instant, always current.", color: "bg-indigo-100 text-indigo-600" },
  { icon: Lock,         title: "Immutable audit trail",  desc: "Every action on every payment is logged with timestamp, user and role. Nothing can be deleted or altered.", color: "bg-slate-100 text-slate-600" },
  { icon: Users,        title: "5-role team access",     desc: "Owner, Admin, Finance Manager, Approver, Viewer. Everyone sees exactly what they need — nothing more.", color: "bg-purple-100 text-purple-600" },
  { icon: TrendingUp,   title: "Accounting sync",        desc: "Connect QuickBooks or Zoho Books. Bills auto-import, payments auto-reconcile. Zero manual entry.", color: "bg-amber-100 text-amber-600" },
  { icon: Bell,         title: "Smart alerts",           desc: "Get notified 3 days before every due date. Never let a bill surprise you again.", color: "bg-orange-100 text-orange-600" },
];

const INDUSTRIES = [
  {
    id: "restaurant", emoji: "🍽️", name: "Restaurants & Food Businesses",
    headline: "Your kitchen never stops. Your bills shouldn't either.",
    sub: "KPLC, gas, food suppliers, rent, NHIF, water — ShieldPay handles all of it on autopilot.",
    color: "orange",
    bills: [
      { icon: "⚡", name: "KPLC Bill",      freq: "Monthly" },
      { icon: "🔥", name: "Gas / LPG",      freq: "Weekly"  },
      { icon: "🥩", name: "Food Supplier",  freq: "Weekly"  },
      { icon: "🏢", name: "Rent / Lease",   freq: "Monthly" },
      { icon: "🏥", name: "NHIF / NSSF",    freq: "Monthly" },
      { icon: "💧", name: "Water Bill",     freq: "Monthly" },
    ],
  },
  {
    id: "logistics", emoji: "🚛", name: "Logistics & Transport",
    headline: "A missed fuel payment grounds your whole fleet.",
    sub: "Fuel, insurance, driver payroll, maintenance, NTSA — automated with full approval trail for every shilling.",
    color: "blue",
    bills: [
      { icon: "⛽", name: "Fuel / Petroleum",  freq: "Weekly"  },
      { icon: "🛡️", name: "Vehicle Insurance", freq: "Monthly" },
      { icon: "🔧", name: "Maintenance",       freq: "Monthly" },
      { icon: "📋", name: "NTSA / Licensing",  freq: "Yearly"  },
      { icon: "👷", name: "Driver NSSF",       freq: "Monthly" },
      { icon: "🛣️", name: "Toll / Road Fees",  freq: "Weekly"  },
    ],
  },
];

const PLANS = [
  {
    key: "starter", name: "Starter", price: "KES 1,499", period: "/month",
    desc: "For a single restaurant or small logistics company",
    features: [
      "Up to 20 bill schedules",
      "M-Pesa + PesaLink payments",
      "Auto-generated receipts",
      "Cash flow reports",
      "Approval workflows",
      "KRA compliance reports",
      "Up to 5 team members",
    ],
    highlight: false, cta: "Start 30-day free trial",
  },
  {
    key: "growth", name: "Growth", price: "KES 2,999", period: "/month",
    desc: "For multi-location or growing operations",
    features: [
      "Up to 100 bill schedules",
      "Everything in Starter",
      "Auto-execute on due date",
      "QuickBooks + Zoho sync",
      "Advanced analytics",
      "Up to 15 team members",
      "Priority support",
    ],
    highlight: true, cta: "Start 30-day free trial",
  },
  {
    key: "enterprise", name: "Enterprise", price: "Custom", period: "",
    desc: "For large chains, hotel groups or national fleets",
    features: [
      "Unlimited bill schedules",
      "Everything in Growth",
      "Unlimited team members",
      "Dedicated account manager",
      "Custom integrations + API",
      "SLA guarantee",
      "On-site training",
    ],
    highlight: false, cta: "Talk to us",
  },
];

const TESTIMONIALS = [
  {
    name: "James Kariuki", role: "Owner · Karura Bistro, Nairobi", stars: 5,
    quote: "Our KPLC, gas and food supplier bills used to take my manager half a day every month. ShieldPay runs all of it. We haven't missed a single payment in 8 months.",
  },
  {
    name: "Grace Achieng", role: "Finance Director · Mombasa Fast Freight", stars: 5,
    quote: "Managing fuel payments for 40 vehicles was chaos. ShieldPay gives me a full approval trail for every payment and auto-receipts I can hand to auditors directly.",
  },
  {
    name: "Peter Mwangi", role: "CEO · Eastlands Catering Group", stars: 5,
    quote: "We used to miss NHIF deadlines and pay penalties. Never again. ShieldPay schedules it, reminds my finance manager, she approves, it pays. That's it.",
  },
];

const FAQ = [
  {
    q: "Is there a free trial?",
    a: "Yes — 30 days completely free. No credit card required. Full access to all features on your chosen plan.",
  },
  {
    q: "Are there any transaction fees?",
    a: "No. ShieldPay is subscription-only. You pay your monthly plan and that's it. Zero per-transaction charges, ever.",
  },
  {
    q: "Which payment methods are supported?",
    a: "M-Pesa (paybill, till, send money) via KCB Buni and bank-to-bank transfers via Stanbic PesaLink. All major Kenyan banks covered.",
  },
  {
    q: "Can I connect my accounting software?",
    a: "Yes. Growth and Enterprise plans include QuickBooks Online and Zoho Books sync. Bills import automatically, payments reconcile automatically.",
  },
  {
    q: "What if my business has multiple branches?",
    a: "Each branch can have its own account with separate suppliers, schedules and team members. Contact us for multi-location pricing.",
  },
  {
    q: "Is my financial data safe?",
    a: "All data is encrypted at rest and in transit. We use Supabase with row-level security, meaning each business only ever sees their own data.",
  },
];

// ─── Components ───────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800 pr-4">{q}</span>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-black text-slate-900 text-lg tracking-tight">ShieldPay</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2">
              Sign in
            </Link>
            <Link to="/login" className="btn-primary py-2 px-5 text-sm">
              Start free trial <ArrowRight size={14} />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMobileOpen(o => !o)} className="md:hidden p-2 rounded-xl hover:bg-slate-100">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 px-5 py-4 space-y-3 bg-white">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-slate-600 py-2">{l.label}</a>
            ))}
            <div className="pt-2 space-y-2">
              <Link to="/login" className="block btn-secondary w-full text-center py-2.5">Sign in</Link>
              <Link to="/login" className="block btn-primary w-full text-center py-2.5">Start free trial</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pt-20 pb-24 px-5">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-bold px-4 py-2 rounded-full mb-8 border border-primary/20">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Built for Kenyan restaurants & logistics businesses
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight mb-6">
            Your bills.<br />
            <span className="text-primary">Paid automatically.</span><br />
            Every time.
          </h1>

          {/* Sub */}
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
            ShieldPay automates every recurring bill — KPLC, gas, fuel, insurance, suppliers.
            Schedule once, approve in one click, payment executes via M-Pesa or PesaLink.
            <span className="font-semibold text-slate-700"> Zero missed payments. Zero manual work.</span>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link to="/login"
              className="btn-primary text-lg px-8 py-4 rounded-2xl w-full sm:w-auto shadow-lg shadow-primary/20">
              Start free for 30 days <ArrowRight size={18} />
            </Link>
            <a href="#how"
              className="flex items-center gap-2 text-slate-600 font-semibold hover:text-slate-900 transition-colors w-full sm:w-auto justify-center">
              <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center shadow-sm">
                <Play size={14} className="text-primary ml-0.5" />
              </div>
              See how it works
            </a>
          </div>

          <p className="text-sm text-slate-400">
            No credit card required · 30-day free trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto px-5 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(s => (
              <div key={s.label}>
                <p className="text-4xl font-black text-primary">{s.value}</p>
                <p className="text-sm font-bold text-slate-800 mt-1">{s.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 px-5 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Up and running in minutes</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Four steps to never missing a bill payment again
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] w-full h-px bg-slate-200 z-0" />
                )}
                <div className="relative z-10 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center h-full">
                  <div className="text-4xl mb-4">{step.emoji}</div>
                  <div className="text-xs font-black text-primary mb-2 tracking-widest">{step.n}</div>
                  <h3 className="font-bold text-slate-800 mb-3">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ── */}
      <section id="industries" className="py-24 px-5 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Built for your business</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
              Two industries. One solution.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {INDUSTRIES.map(ind => (
              <div key={ind.id} className={`rounded-3xl p-8 border-2 ${ind.color === "orange" ? "bg-orange-50 border-orange-100" : "bg-blue-50 border-blue-100"}`}>
                <div className="text-5xl mb-4">{ind.emoji}</div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">{ind.name}</h3>
                <p className={`text-sm font-bold mb-3 ${ind.color === "orange" ? "text-orange-600" : "text-blue-600"}`}>
                  {ind.headline}
                </p>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">{ind.sub}</p>
                <div className="grid grid-cols-2 gap-2">
                  {ind.bills.map(b => (
                    <div key={b.name} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                      <span className="text-lg">{b.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{b.name}</p>
                        <p className="text-[10px] text-slate-400">{b.freq}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-5 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Everything you need. Nothing you don't.</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Built specifically for how Kenyan SMEs actually operate
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                    <Icon size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="py-24 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Testimonials</p>
            <h2 className="text-4xl font-black text-slate-900">Businesses that never miss payments</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-5">"{t.quote}"</p>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-5 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Simple. Transparent. No surprises.</h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Subscription only. Zero per-transaction fees. Ever.
            </p>
          </div>

          {/* Zero fees badge */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-bold px-5 py-2.5 rounded-full">
              <CheckCircle2 size={16} />
              KES 0 per transaction — pay your subscription and that's it
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div key={plan.key} className={`rounded-3xl p-8 border-2 relative flex flex-col ${
                plan.highlight
                  ? "bg-primary text-white border-primary shadow-2xl shadow-primary/20 scale-105"
                  : "bg-white border-slate-200"
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-black px-4 py-1.5 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <div>
                  <p className={`text-sm font-bold mb-1 ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.period && <span className={`text-sm ${plan.highlight ? "text-white/60" : "text-slate-400"}`}>{plan.period}</span>}
                  </div>
                  <p className={`text-sm mb-6 ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>{plan.desc}</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 size={15} className={`shrink-0 mt-0.5 ${plan.highlight ? "text-white/80" : "text-primary"}`} />
                      <span className={plan.highlight ? "text-white/90" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/login"
                  className={`w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all ${
                    plan.highlight
                      ? "bg-white text-primary hover:bg-slate-50"
                      : plan.key === "enterprise"
                        ? "bg-slate-900 text-white hover:bg-slate-800"
                        : "bg-primary text-white hover:bg-primary/90"
                  }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-400 mt-8">
            All plans include a 30-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-5 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Questions answered</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-5 bg-primary">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-6">🛡️</div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Start today. Never miss a payment again.
          </h2>
          <p className="text-xl text-white/70 mb-10 max-w-xl mx-auto">
            30 days free. No credit card. Full access.
            Your first automated payment will take less than 2 minutes to set up.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-3 bg-white text-primary font-black text-lg px-10 py-5 rounded-2xl hover:bg-slate-50 transition-all shadow-2xl shadow-black/20">
            Get started free <ArrowRight size={20} />
          </Link>
          <p className="text-white/50 text-sm mt-5">
            Join restaurants and logistics companies across Kenya
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield size={15} className="text-white" />
              </div>
              <span className="font-black text-white">ShieldPay</span>
              <span className="text-slate-600 text-sm ml-2">Automated bill payments for Kenyan SMEs</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="mailto:risewithdion@gmail.com" className="hover:text-white transition-colors">Contact</a>
              <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
              <Link to="/login" className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                Start free trial
              </Link>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-xs text-slate-600">
            © {new Date().getFullYear()} ShieldPay. Built in Kenya 🇰🇪
          </div>
        </div>
      </footer>

    </div>
  );
}
