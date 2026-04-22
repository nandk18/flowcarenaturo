import { useNavigate } from "react-router-dom";
import { ArrowLeft, Stethoscope } from "lucide-react";

interface PublicNavbarProps {
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export default function PublicNavbar({
  showBack = true,
  backTo = "/",
  backLabel = "Back",
}: PublicNavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
        )}
      </div>
      <a href="/" className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        <Stethoscope className="h-5 w-5 text-primary" />
        <span className="font-bold text-primary text-sm">StethoScribe</span>
      </a>
      <div className="flex items-center gap-2">
        <a
          href="/auth"
          className="text-xs border border-primary/30 text-primary rounded-lg px-3 py-1.5 font-medium hover:bg-primary/10 transition-colors"
        >
          Login
        </a>
        <a
          href="/register-lab"
          className="text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 font-medium hover:opacity-90 transition-opacity"
        >
          Register Lab
        </a>
      </div>
    </nav>
  );
}