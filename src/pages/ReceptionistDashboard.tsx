import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PatientRegistration from "@/components/receptionist/PatientRegistration";
import TodayQueue from "@/components/receptionist/TodayQueue";
import TodayAppointmentsWidget from "@/components/appointments/TodayAppointmentsWidget";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, UserPlus } from "lucide-react";

export default function ReceptionistDashboard() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Reception Desk</h1>
        <p className="text-sm text-muted-foreground">Manage patient check-ins and today's queue</p>
      </div>

      <TodayAppointmentsWidget />

      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="queue"><CalendarDays className="mr-2 h-4 w-4" /> Today's Queue</TabsTrigger>
          <TabsTrigger value="register"><UserPlus className="mr-2 h-4 w-4" /> Register Patient</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <TodayQueue />
        </TabsContent>

        <TabsContent value="register">
          <PatientRegistration />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
