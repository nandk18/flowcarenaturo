import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type JobStatus = "idle" | "queued" | "processing" | "completed" | "failed";

const QUEUE_NAMES: Record<string, string> = {
  transcribe_audio: "ai_transcription",
  format_notes: "ai_formatting",
  generate_pdf: "pdf_generation",
};

export function useJobQueue() {
  const [jobStatus, setJobStatus] = useState<Record<string, JobStatus>>({});
  const subscriptions = useRef<Record<string, any>>({});

  const enqueue = async (
    jobType: string,
    payload: Record<string, any>,
    clinicId: string
  ): Promise<string> => {
    const { data: job, error } = await supabase
      .from("background_jobs")
      .insert({
        queue_name: QUEUE_NAMES[jobType] || "default",
        job_type: jobType,
        status: "queued",
        clinic_id: clinicId,
        payload,
      })
      .select()
      .single();

    if (error) throw error;

    setJobStatus((prev) => ({ ...prev, [job.id]: "queued" }));

    // Trigger worker immediately (don't wait for cron)
    supabase.functions.invoke("process-queue").catch(() => {});

    return job.id;
  };

  const waitForJob = (jobId: string, timeoutMs = 60000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const channel = supabase
        .channel(`job-${jobId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "background_jobs",
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const job = payload.new as any;
            setJobStatus((prev) => ({ ...prev, [jobId]: job.status }));

            if (job.status === "completed") {
              supabase.removeChannel(channel);
              resolve(job.result);
            } else if (job.status === "failed") {
              supabase.removeChannel(channel);
              reject(new Error(job.error_message || "Job failed"));
            }
          }
        )
        .subscribe();

      subscriptions.current[jobId] = channel;

      setTimeout(() => {
        supabase.removeChannel(channel);
        reject(new Error("Job timed out"));
      }, timeoutMs);
    });
  };

  const getStatusLabel = (jobId: string) => {
    const status = jobStatus[jobId] || "idle";
    const labels: Record<JobStatus, string> = {
      idle: "",
      queued: "Queued...",
      processing: "Processing...",
      completed: "Done",
      failed: "Failed",
    };
    return labels[status];
  };

  return { enqueue, waitForJob, jobStatus, getStatusLabel };
}