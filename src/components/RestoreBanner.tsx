import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface RestoreBannerProps {
  visible: boolean;
  message?: string;
  onContinue: () => void;
  onDiscard: () => void;
}

/** Yellow banner shown when a saved draft is restored. */
export default function RestoreBanner({
  visible,
  message = "You have unsaved changes from your last session",
  onContinue,
  onDiscard,
}: RestoreBannerProps) {
  if (!visible) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
      <FileText className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-[200px]">{message}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="default" onClick={onContinue}>
          Continue Editing
        </Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>
          <X className="mr-1 h-3 w-3" /> Start Fresh
        </Button>
      </div>
    </div>
  );
}
