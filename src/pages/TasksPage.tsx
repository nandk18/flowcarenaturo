import DashboardLayout from "@/components/layout/DashboardLayout";
import { useUrlState } from "@/hooks/useUrlState";
import CallTaskPage from "./CallTaskPage";
import TodoListPage from "./TodoListPage";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const [section, setSection] = useUrlState("section", "calls") as [
    string,
    (v: string) => void,
  ];

  return (
    <DashboardLayout title="Daily Ops">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-xl font-semibold">Daily ops</h1>
          <p className="text-sm text-muted-foreground">Call tasks and to-dos for today</p>
        </div>

        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setSection("calls")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              section === "calls" ? "bg-background text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Call task
          </button>
          <button
            type="button"
            onClick={() => setSection("todo")}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              section === "todo" ? "bg-background text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            To do list
          </button>
        </div>

        {section === "calls" ? <CallTaskPage bare /> : <TodoListPage bare />}
      </div>
    </DashboardLayout>
  );
}
