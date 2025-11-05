/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-namespace */
import type { AuthProvider } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import { canAccess } from "../commons/canAccess";
import { supabase } from "./supabase";

const baseAuthProvider = supabaseAuthProvider(supabase, {
  getIdentity: async () => {
    const sale = await getSaleFromCache();

    if (sale == null) {
      throw new Error();
    }

    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`,
      avatar: sale.avatar?.src,
    };
  },
});

type CachedSale = {
  id: number;
  first_name: string;
  last_name: string;
  avatar?: { src?: string };
  administrator: boolean;
  disabled: boolean;
  user_id: string;
  is_staff: boolean | null;
};

let cachedSale: CachedSale | undefined;
const profilesTableName =
  typeof import.meta.env.VITE_SUPABASE_PROFILES_TABLE === "string" &&
  import.meta.env.VITE_SUPABASE_PROFILES_TABLE.trim().length > 0
    ? import.meta.env.VITE_SUPABASE_PROFILES_TABLE.trim()
    : "profiles";
let skipStaffLookup = false;

const getSaleFromCache = async () => {
  if (cachedSale != null) return cachedSale;

  const { data: dataSession, error: errorSession } =
    await supabase.auth.getSession();

  // Shouldn't happen after login but just in case
  if (dataSession?.session?.user == null || errorSession) {
    return undefined;
  }

  const { data: dataSale, error: errorSale } = await supabase
    .from("sales")
    .select("id, first_name, last_name, avatar, administrator, disabled, user_id")
    .match({ user_id: dataSession?.session?.user.id })
    .single();

  // Shouldn't happen either as all users are sales but just in case
  if (dataSale == null || errorSale) {
    return undefined;
  }

  let isStaff: boolean | null = null;
  if (!skipStaffLookup && dataSale.user_id) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from(profilesTableName)
        .select("is_staff")
        .eq("user_id", dataSale.user_id)
        .maybeSingle();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          isStaff = false;
        } else if (profileError.code === "42P01") {
          skipStaffLookup = true;
          isStaff = null;
        } else {
          console.warn("Failed to fetch profile staff flag", profileError);
          skipStaffLookup = true;
          isStaff = null;
        }
      } else if (profile == null) {
        isStaff = false;
      } else {
        const flag =
          (profile as { is_staff?: boolean | null }).is_staff ?? false;
        isStaff = flag === true;
      }
    } catch (error) {
      console.warn("Unexpected error while fetching staff flag", error);
      skipStaffLookup = true;
      isStaff = null;
    }
  }

  cachedSale = { ...dataSale, is_staff: isStaff } as CachedSale;
  return cachedSale;
};

type InactiveReason = "disabled" | "missing" | "not_staff";

const ensureActiveSale = async (): Promise<{ reason: InactiveReason | null }> => {
  cachedSale = undefined;
  const sale = await getSaleFromCache();
  if (sale == null) {
    await supabase.auth.signOut();
    cachedSale = undefined;
    return { reason: "missing" };
  }

  if (sale.disabled) {
    await supabase.auth.signOut();
    cachedSale = undefined;
    return { reason: "disabled" };
  }

  if (sale.is_staff === false) {
    await supabase.auth.signOut();
    cachedSale = undefined;
    return { reason: "not_staff" };
  }

  return { reason: null };
};

export async function getIsInitialized() {
  if (getIsInitialized._is_initialized_cache == null) {
    const { data } = await supabase.from("init_state").select("is_initialized");

    getIsInitialized._is_initialized_cache = data?.at(0)?.is_initialized > 0;
  }

  return getIsInitialized._is_initialized_cache;
}

export namespace getIsInitialized {
  export var _is_initialized_cache: boolean | null = null;
}

export const authProvider: AuthProvider = {
  ...baseAuthProvider,
  login: async (params) => {
    const result = await baseAuthProvider.login(params);
    // clear cached sale
    cachedSale = undefined;
    const { reason } = await ensureActiveSale();
    if (reason != null) {
      throw new Error(
        reason === "disabled"
          ? "Your account has been disabled. Contact your administrator."
          : reason === "not_staff"
            ? "Access is limited to staff members. Ask an administrator to mark your profile as staff."
            : "You do not have permission to access the CRM.",
      );
    }
    return result;
  },
  checkAuth: async (params) => {
    // Users are on the set-password page, nothing to do
    if (
      window.location.pathname === "/set-password" ||
      window.location.hash.includes("#/set-password")
    ) {
      return;
    }
    // Users are on the forgot-password page, nothing to do
    if (
      window.location.pathname === "/forgot-password" ||
      window.location.hash.includes("#/forgot-password")
    ) {
      return;
    }
    // Users are on the sign-up page, nothing to do
    if (
      window.location.pathname === "/sign-up" ||
      window.location.hash.includes("#/sign-up")
    ) {
      return;
    }

    const isInitialized = await getIsInitialized();

    if (!isInitialized) {
      await supabase.auth.signOut();
      throw {
        redirectTo: "/sign-up",
        message: false,
      };
    }

    await baseAuthProvider.checkAuth(params);

    const { reason } = await ensureActiveSale();
    if (reason != null) {
      throw {
        redirectTo: "/login",
        message:
          reason === "disabled"
            ? "Your account has been disabled. Contact your administrator."
            : reason === "not_staff"
              ? "Access is limited to staff members. Ask an administrator to mark your profile as staff."
            : "You do not have permission to access the CRM.",
      };
    }

    return;
  },
  canAccess: async (params) => {
    const isInitialized = await getIsInitialized();
    if (!isInitialized) return false;

    // Get the current user
    const sale = await getSaleFromCache();
    if (sale == null || sale.disabled || sale.is_staff === false) return false;

    // Compute access rights from the sale role
    const role = sale.administrator ? "admin" : "user";
    return canAccess(role, params);
  },
};
