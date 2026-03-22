import type { PlanKey, Frequency } from "./types";
import { PLANS } from "./constants";

export function fmtKES(n: number): string {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// No transaction fees in v3 — subscription only
export function getPlatformFee(): number {
  return 0;
}

export function getNextDate(from: string, freq: Frequency): string {
  const d = new Date(from);
  switch (freq) {
    case "daily":     d.setDate(d.getDate() + 1);         break;
    case "weekly":    d.setDate(d.getDate() + 7);         break;
    case "biweekly":  d.setDate(d.getDate() + 14);        break;
    case "monthly":   d.setMonth(d.getMonth() + 1);       break;
    case "quarterly": d.setMonth(d.getMonth() + 3);       break;
    case "biannual":  d.setMonth(d.getMonth() + 6);       break;
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

export function isTrialExpired(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now();
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export function formatEAT(dateStr: string, fmt = "dd MMM yyyy"): string {
  // Kenya EAT = UTC+3
  const d = new Date(new Date(dateStr).getTime() + 3 * 3600 * 1000);
  return d.toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" });
}

export function clsx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function planAllows(plan: PlanKey, currentCount: number): boolean {
  return currentCount < PLANS[plan].maxSchedules;
}
