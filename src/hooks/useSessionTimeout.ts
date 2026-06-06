import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 25 * 60 * 1000; // warn at 25 minutes
const COUNTDOWN_SECONDS = 300; // 5 min countdown after warning

export function useSessionTimeout(isAuthenticated: boolean) {
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);

  const clearAll = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return;
    setShowWarning(false);
    clearAll();

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeLeft(COUNTDOWN_SECONDS);
      countdownRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_MS);

    timeoutRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login?reason=session_expired");
    }, TIMEOUT_MS);
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearAll();
      setShowWarning(false);
      return;
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    const handler = () => {
      // Don't reset while warning modal is open — user must click stay/logout
      if (!showWarning) resetTimers();
    };
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearAll();
    };
  }, [isAuthenticated, resetTimers, showWarning]);

  const stayLoggedIn = () => {
    setShowWarning(false);
    resetTimers();
  };

  const logoutNow = async () => {
    clearAll();
    setShowWarning(false);
    await supabase.auth.signOut();
    navigate("/login?reason=session_expired");
  };

  return { showWarning, timeLeft, stayLoggedIn, logoutNow };
}