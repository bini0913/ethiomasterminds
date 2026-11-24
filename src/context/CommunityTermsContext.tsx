import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const COMMUNITY_TERMS_VERSION = "2026-11-24";
const COMMUNITY_POLICY_KEY = "community_terms";

type CommunityTermsContextValue = {
  runWithCommunityTerms: (action: () => Promise<unknown>, feature?: 'social' | 'friend_requests' | 'direct_messages' | 'multiplayer' | 'calls') => Promise<boolean>;
};

const CommunityTermsContext = createContext<CommunityTermsContextValue | undefined>(undefined);

export const CommunityTermsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const acceptedUserRef = useRef<string | null>(null);
  const pendingActionRef = useRef<(() => Promise<unknown>) | null>(null);
  const pendingResolveRef = useRef<((accepted: boolean) => void) | null>(null);

  useEffect(() => {
    acceptedUserRef.current = null;
    pendingActionRef.current = null;
    pendingResolveRef.current?.(false);
    pendingResolveRef.current = null;
    setOpen(false);
    setChecked(false);
  }, [user?.id]);

  const runWithCommunityTerms = useCallback(async (action: () => Promise<unknown>, feature: 'social' | 'friend_requests' | 'direct_messages' | 'multiplayer' | 'calls' = 'social') => {
    if (!user?.id) {
      toast.error("Sign in before using community features.");
      return false;
    }

    const { data: featureEnabled, error: featureError } = await (supabase as any).rpc("is_current_user_feature_enabled", {
      p_feature: feature,
    });
    if (featureError) {
      console.error("Could not verify parent feature settings:", featureError);
      toast.error("Your safety settings could not be checked. Please try again.");
      return false;
    }
    if (featureEnabled !== true) {
      toast.info("This feature has not been enabled by your parent or guardian. Ask them to review your Parent Controls.");
      return false;
    }

    if (acceptedUserRef.current === user.id) {
      await action();
      return true;
    }

    const { data, error } = await (supabase as any).rpc("has_accepted_policy", {
      p_policy_key: COMMUNITY_POLICY_KEY,
      p_policy_version: COMMUNITY_TERMS_VERSION,
    });
    if (error) {
      console.error("Could not verify community terms acceptance:", error);
      toast.error("Community rules could not be checked. Please try again.");
      return false;
    }
    if (data === true) {
      acceptedUserRef.current = user.id;
      await action();
      return true;
    }

    if (pendingActionRef.current) {
      toast.info("Please review the community rules first.");
      return false;
    }

    return new Promise<boolean>((resolve) => {
      pendingActionRef.current = action;
      pendingResolveRef.current = resolve;
      setChecked(false);
      setOpen(true);
    });
  }, [user?.id]);

  const acceptAndContinue = async () => {
    if (!user?.id || !checked || saving) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("user_policy_acceptances").insert({
        user_id: user.id,
        policy_key: COMMUNITY_POLICY_KEY,
        policy_version: COMMUNITY_TERMS_VERSION,
        source: "in_app",
      });
      if (error && error.code !== "23505") throw error;

      acceptedUserRef.current = user.id;
      setOpen(false);
      const action = pendingActionRef.current;
      const resolve = pendingResolveRef.current;
      pendingActionRef.current = null;
      pendingResolveRef.current = null;
      if (action) {
        try {
          await action();
          resolve?.(true);
        } catch (error) {
          console.error("Community action failed after terms acceptance:", error);
          toast.error("Your action could not be completed. Please try again.");
          resolve?.(false);
        }
      } else {
        resolve?.(true);
      }
    } catch (error) {
      console.error("Could not save community terms acceptance:", error);
      toast.error("Your acceptance could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setOpen(false);
    const resolve = pendingResolveRef.current;
    pendingActionRef.current = null;
    pendingResolveRef.current = null;
    resolve?.(false);
  };

  return (
    <CommunityTermsContext.Provider value={{ runWithCommunityTerms }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-terms-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Before you participate</p>
            <h2 id="community-terms-title" className="mt-2 text-xl font-bold">Community rules and safety</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Before posting, commenting, messaging or creating community content, please review these rules. Be respectful, do not bully or threaten anyone, do not share private information or images without permission, and never post sexual, exploitative or dangerous content.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              You can report content or users in the app. Use blocking when you do not want another account to contact you. Serious safety concerns should also be shared with a parent, guardian or trusted adult.
            </p>
            <a className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4" href="/terms" target="_blank" rel="noreferrer">
              Read the full Terms of Use and Community Guidelines
            </a>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm leading-5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
              />
              <span>I have read and agree to the Terms of Use and Community Guidelines.</span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancel} disabled={saving}>Not now</Button>
              <Button type="button" onClick={() => void acceptAndContinue()} disabled={!checked || saving}>
                {saving ? "Saving…" : "Agree and continue"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </CommunityTermsContext.Provider>
  );
};

export const useCommunityTerms = () => {
  const context = useContext(CommunityTermsContext);
  if (!context) throw new Error("useCommunityTerms must be used inside CommunityTermsProvider");
  return context;
};
