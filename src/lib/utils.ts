import type { PaymentMethod, PlanKey, Frequency } from "./types";
import { PLANS } from "./constants";

export function fmtKES(n: number): string {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getPlatformFee(method: PaymentMethod, plan: PlanKey): number {
  const fees = PLANS[plan].execFee;
  return method === "pesalink" ? fees.bank : fees.mpesa;
}

export function getNextDate(from: string, freq: Frequency): string {
  const d = new Date(from);
  switch (freq) {
    case "weekly":    d.setDate(d.getDate() + 7);         break;
    case "monthly":   d.setMonth(d.getMonth() + 1);       break;
    case "quarterly": d.setMonth(d.getMonth() + 3);       break;

    case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split("T")[0];
}

export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function trialDaysLeft(endsAt: string): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
