import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("cookie_consent");
    if (!accepted) {
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:max-w-xl z-[100] animate-fade-in">
      <div className="rounded-2xl bg-foreground text-background shadow-2xl border border-border/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Cookie className="h-4 w-4" />
              <span className="text-sm font-semibold">Cookie Notice</span>
            </div>
            <p className="text-xs text-background/80 leading-relaxed">
              StethoScribe uses essential cookies and browser storage only for
              authentication and user preferences. We do not use advertising cookies
              or track you across other websites. No patient data is stored in cookies.{" "}
              <Link to="/privacy" className="underline hover:text-background">Learn more</Link>
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={decline}
              className="text-xs border border-background/30 text-background/80 rounded-lg px-3 py-2 hover:border-background/60 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={accept}
              className="text-xs bg-primary text-primary-foreground rounded-lg px-4 py-2 font-semibold hover:opacity-90 transition-opacity"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}