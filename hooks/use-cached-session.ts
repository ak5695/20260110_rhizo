"use client";

import { authClient } from "@/lib/auth-client";
import { useEffect, useState } from "react";

const SESSION_CACHE_KEY = "jotion-session-cache";

export const useCachedSession = () => {
    // 1. Start with null to match Server-Side Rendering (avoids hydration mismatch)
    const [session, setSession] = useState<any>(null);
    // Track if we have read from cache yet - only use effect once
    const [isRestored, setIsRestored] = useState(false);

    // 2. Read from localStorage immediately on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const cached = localStorage.getItem(SESSION_CACHE_KEY);
            if (cached) {
                try {
                    setSession(JSON.parse(cached));
                } catch (e) {
                    console.error("Failed to parse cached session", e);
                }
            }
            setIsRestored(true);
        }
    }, []);

    // 3. Fetch real session in background
    const { data: serverSession, isPending: isServerLoading } = authClient.useSession();

    useEffect(() => {
        if (!isServerLoading) {
            // Server response received
            if (serverSession) {
                // Login valid: Update cache and state
                setSession(serverSession);
                localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(serverSession));
            } else {
                // Login invalid/logout: Clear cache and state
                setSession(null);
                localStorage.removeItem(SESSION_CACHE_KEY);
            }
        }
    }, [serverSession, isServerLoading]);

    return {
        data: session,
        // Loading logic:
        // If restored from cache (session exists), we are NOT pending.
        // If not restored yet, we are pending.
        // If restored but no session, and server is loading, we are pending.
        isPending: (isServerLoading && !session && isRestored) || (!isRestored),
        isOptimistic: !!session && isServerLoading
    };
};
