import { Clock } from "lucide-react";

interface Props {
  open: boolean;
  timeLeft: number; // seconds
  onStay: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutWarning({ open, timeLeft, onStay, onLogout }: Props) {
  if (!open) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-elevated border border-border">
        <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-warning/10">
          <Clock className="h-7 w-7 text-warning" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground text-center mb-2">
          Session Expiring Soon
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-1">Your session will expire in</p>
        <p className="text-4xl font-bold text-primary text-center mb-3 tabular-nums font-display">
          {mins}:{String(secs).padStart(2, "0")}
        </p>
        <p className="text-xs text-muted-foreground text-center mb-5">
          You will be automatically logged out due to inactivity. Any unsaved changes may be lost.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Logout Now
          </button>
          <button
            onClick={onStay}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}