import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Business, BusinessMember, MemberRole } from "@/lib/types";
import { ROLE_CONFIG, SUPER_ADMIN_EMAIL } from "@/lib/constants";

interface AuthState {
  user:         User | null;
  business:     Business | null;
  member:       BusinessMember | null;
  role:         MemberRole | null;
  loading:      boolean;
  isSuperAdmin: boolean;
  isOwner:      boolean;
  isAdmin:      boolean;
  canApprove:   boolean;
  canExecute:   boolean;
  canWrite:     boolean;
  isViewer:     boolean;
  signOut:      () => Promise<void>;
  refetch:      () => void;
}

export function useAuth(): AuthState {
  const [user, setUser]         = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [member, setMember]     = useState<BusinessMember | null>(null);
  const [loading, setLoading]   = useState(true);

  const fetchContext = useCallback(async (uid: string) => {
    // STEP 1: Try to find an active member record
    const { data: mem } = await supabase
      .from("business_members")
      .select("*")
      .eq("user_id", uid)
      .eq("status", "active")
      .maybeSingle();

    if (mem) {
      // Member found — load business normally
      setMember(mem as BusinessMember);
      const { data: biz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", mem.business_id)
        .maybeSingle();
      setBusiness(biz as Business | null);
      setLoading(false);
      return;
    }

    // STEP 2: No member row found — check if user OWNS a business directly
    // This handles the case where business was created but member insert failed
    const { data: ownedBiz } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_user_id", uid)
      .maybeSingle();

    if (ownedBiz) {
      // Business exists but member row is missing — auto-repair it
      const { data: userInfo } = await supabase.auth.getUser();
      const email = userInfo?.user?.email ?? "";

      const { data: newMem } = await supabase
        .from("business_members")
        .upsert({
          business_id: ownedBiz.id,
          user_id:     uid,
          email:       email,
          role:        "owner",
          status:      "active",
          joined_at:   new Date().toISOString(),
        }, { onConflict: "business_id,email" })
        .select()
        .maybeSingle();

      setBusiness(ownedBiz as Business);
      setMember(newMem as BusinessMember | null);
      setLoading(false);
      return;
    }

    // STEP 3: No business at all — user needs to create one
    setMember(null);
    setBusiness(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchContext(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchContext(session.user.id);
      else {
        setUser(null);
        setMember(null);
        setBusiness(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchContext]);

  const role    = member?.role ?? null;
  const roleCfg = role ? ROLE_CONFIG[role] : null;

  return {
    user, business, member, role, loading,
    isSuperAdmin: user?.email === SUPER_ADMIN_EMAIL,
    isOwner:      role === "owner",
    isAdmin:      roleCfg?.isAdmin    ?? false,
    canApprove:   roleCfg?.canApprove ?? false,
    canExecute:   roleCfg?.canExecute ?? false,
    canWrite:     roleCfg?.canWrite   ?? false,
    isViewer:     role === "viewer",
    signOut:      async () => { await supabase.auth.signOut(); },
    refetch:      () => { if (user) fetchContext(user.id); },
  };
}
