import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUrlState } from "@/hooks/useUrlState";
import CallTaskPage from "./CallTaskPage";
import TodoListPage from "./TodoListPage";
import { Phone, CheckSquare } from "lucide-react";

export default function TasksPage() {
  const [section, setSection] = useUrlState("section", "calls") as [
    string,
    (v: string) => void,
  ];

  return (
    <DashboardLayout title="Tasks">
      <Tabs value={section} onValueChange={setSection} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls">
            <Phone className="mr-1 h-4 w-4" /> Call Task
          </TabsTrigger>
          <TabsTrigger value="todo">
            <CheckSquare className="mr-1 h-4 w-4" /> To Do List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="space-y-4">
          <CallTaskPage bare />
        </TabsContent>
        <TabsContent value="todo" className="space-y-4">
          <TodoListPage bare />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
