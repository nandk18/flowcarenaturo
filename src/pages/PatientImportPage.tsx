import DashboardLayout from "@/components/layout/DashboardLayout";
import { Upload } from "lucide-react";

export default function PatientImportPage() {
  return (
    <DashboardLayout title="Patient Import">
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-12 text-center">
        <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h2 className="font-display text-xl font-semibold">Patient Import — Coming Soon</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bulk import patients from CSV or Excel files. This module is under construction.
        </p>
      </div>
    </DashboardLayout>
  );
}
