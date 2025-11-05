"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export type ProfileRecord = {
  id?: string;
  user_id?: string;
  full_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  is_staff?: boolean | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type SupabaseAuthContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  profile: ProfileRecord | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext =
  createContext<SupabaseAuthContextValue | null>(null);

const PROFILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PROFILES_TABLE?.trim() ||
  process.env.SUPABASE_PROFILES_TABLE?.trim() ||
  "profiles";

export function SupabaseAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const isFetchingProfile = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }
      if (error) {
        console.warn("Failed to fetch Supabase session", error);
        setSession(null);
        return;
      }
      setSession(data.session ?? null);
    });

    const {
      data: subscription,
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const loadProfile = useCallback(
    async (currentUser: User | null) => {
      if (!currentUser || isFetchingProfile.current) {
        setProfile(null);
        setProfileError(null);
        return;
      }

      isFetchingProfile.current = true;
      setProfileLoading(true);
      setProfileError(null);

      try {
        const { data, error } = await supabase
          .from(PROFILES_TABLE)
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (!data) {
          const insertPayload: Record<string, unknown> = {
            user_id: currentUser.id,
            email: currentUser.email ?? null,
            full_name:
              currentUser.user_metadata?.full_name ??
              currentUser.user_metadata?.name ??
              null,
          };

          const { error: insertError } = await supabase
            .from(PROFILES_TABLE)
            .insert(insertPayload);

          if (insertError && insertError.code !== "23505") {
            throw insertError;
          }

          const { data: fetchedAfterInsert, error: requeryError } =
            await supabase
              .from(PROFILES_TABLE)
              .select("*")
              .eq("user_id", currentUser.id)
              .maybeSingle();

          if (requeryError && requeryError.code !== "PGRST116") {
            throw requeryError;
          }

          setProfile(
            (fetchedAfterInsert as ProfileRecord | null) ?? {
              user_id: currentUser.id,
              email: currentUser.email ?? null,
            },
          );
          return;
        }

        setProfile(data as ProfileRecord);
      } catch (error) {
        console.error("Failed to load customer profile", error);
        setProfileError(
          error instanceof Error
            ? error.message
            : "We couldn't load your profile details.",
        );
        setProfile(null);
      } finally {
        setProfileLoading(false);
        isFetchingProfile.current = false;
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadProfile(session?.user ?? null);
  }, [session?.user, loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null);
  }, [loadProfile, session?.user]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setProfile(null);
  }, [supabase]);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      profileError,
      refreshProfile,
      signOut,
    }),
    [
      supabase,
      session,
      profile,
      profileLoading,
      profileError,
      refreshProfile,
      signOut,
    ],
  );

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider.",
    );
  }
  return context;
}
