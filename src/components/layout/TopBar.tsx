import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Logo from "@/components/Logo";

export default function TopBar() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/home")}
        aria-label="FlowCare home"
        className="flex items-center"
      >
        <Logo height={38} />
      </button>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/settings")} aria-label="Settings">
          <SettingsIcon className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
