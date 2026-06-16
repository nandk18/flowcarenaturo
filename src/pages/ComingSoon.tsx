import { useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, LucideIcon } from "lucide-react";

interface ComingSoonProps {
  tag: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  accentClass?: string;
}

export default function ComingSoon({ tag, title, description, Icon, accentClass = "text-primary bg-primary/10" }: ComingSoonProps) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar />
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
        </Button>
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <div className={`mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${accentClass}`}>
          <Icon className="h-10 w-10" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{tag}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">{description}</p>
        <Badge variant="secondary" className="mt-6">
          <Sparkles className="mr-1.5 h-3 w-3" /> Coming Soon
        </Badge>
      </main>
    </div>
  );
}
