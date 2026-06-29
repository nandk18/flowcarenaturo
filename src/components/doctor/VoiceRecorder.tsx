import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { features } from "@/lib/featureFlags";
import { rateLimiter } from "@/lib/rateLimiter";
import { useJobQueue } from "@/hooks/useJobQueue";

type Props = {
  visitId: string;
  onTranscriptProcessed: (soapData: any) => void;
  clinicId?: string;
  doctorId?: string;
  templateName?: string;
  templateFields?: string[];
  patientContext?: string;
};

export default function VoiceRecorder({
  visitId,
  onTranscriptProcessed,
  clinicId,
  doctorId,
  templateName,
  templateFields,
  patientContext,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [freeformMode, setFreeformMode] = useState<boolean>(() => {
    try { return localStorage.getItem("voice_freeform_mode") !== "0"; } catch { return true; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(0));
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const { enqueue, waitForJob } = useJobQueue();

  const toggleFreeform = () => {
    setFreeformMode((m) => {
      const next = !m;
      try { localStorage.setItem("voice_freeform_mode", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const bars = 24;
    const step = Math.floor(data.length / bars);
    const levels = Array.from({ length: bars }, (_, i) => {
      const val = data[i * step] / 255;
      return Math.max(0.08, val);
    });
    setAudioLevels(levels);
    animFrameRef.current = requestAnimationFrame(updateAudioLevels);
  }, []);

  const handleTranscription = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);

    // Rate limit: max 10 transcriptions per minute per clinic
    if (clinicId) {
      const ok = rateLimiter.check(`voice:${clinicId}`, 10, 60);
      if (!ok) {
        const wait = rateLimiter.getTimeUntilReset(`voice:${clinicId}`);
        toast.error(`Too many requests. Please wait ${wait}s.`);
        setIsTranscribing(false);
        return;
      }
    }

    // Async queue path — non-blocking, scales to thousands of users
    if (features.asyncAI && clinicId && doctorId) {
      try {
        setProcessingStatus("Uploading audio...");
        const audioPath = `${clinicId}/${visitId}/audio_${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage
          .from("audio-recordings")
          .upload(audioPath, audioBlob, { upsert: true });
        if (upErr) throw upErr;

        setProcessingStatus("Queued for transcription...");
        const jobId = await enqueue(
          "transcribe_audio",
          {
            visit_id: visitId,
            audio_path: audioPath,
            doctor_id: doctorId,
            template_name: templateName || "SOAP Notes",
            template_fields: templateFields || ["subjective", "objective", "assessment", "plan"],
            patient_context: patientContext || "",
          },
          clinicId
        );

        setProcessingStatus("AI is transcribing...");
        const result = await waitForJob(jobId);
        const notes = result?.notes || result;
        if (result?.transcript) setTranscript(result.transcript);
        onTranscriptProcessed(notes);
        toast.success("Notes generated successfully");
      } catch (err: any) {
        toast.error("Processing failed: " + (err?.message || "Unknown error"));
        setManualMode(true);
      } finally {
        setIsTranscribing(false);
        setProcessingStatus("");
      }
      return;
    }

    // Synchronous fallback path (default)
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const { data, error } = await supabase.functions.invoke("transcribe-audio", { body: formData });

      if (error) {
        let msg = "Transcription failed.";
        try { const p = typeof error === "string" ? JSON.parse(error) : error; if (p?.context?.body) { const b = JSON.parse(p.context.body); msg = b.error || msg; } } catch {}
        toast.error(msg); setManualMode(true); return;
      }
      if (data?.error) { toast.error(data.error); setManualMode(true); return; }

      if (data?.transcript) {
        setTranscript(data.transcript);
        toast.success("Transcription complete! Processing SOAP notes...");
        try {
          const { data: soapData, error: soapError } = await supabase.functions.invoke("format-soap-notes", {
            body: { transcript: data.transcript, mode: freeformMode ? "freeform" : undefined },
          });
          if (soapError) { toast.error("Failed to generate SOAP notes."); setManualMode(true); return; }
          if (soapData?.error) { toast.error(soapData.error); setManualMode(true); return; }
          onTranscriptProcessed(soapData);
        } catch (err: any) { toast.error(err.message || "Failed to process SOAP notes"); setManualMode(true); }
      } else { toast.error("No transcript received."); setManualMode(true); }
    } catch (err: any) { toast.error(err.message || "Transcription failed."); setManualMode(true); }
    finally { setIsTranscribing(false); }
  }, [onTranscriptProcessed, clinicId, doctorId, visitId, templateName, templateFields, patientContext, enqueue, waitForJob]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Set up Web Audio API analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        audioCtx.close();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        setAudioLevels(new Array(24).fill(0));
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      animFrameRef.current = requestAnimationFrame(updateAudioLevels);
      toast.info("Recording started...");
    } catch {
      toast.error("Microphone access denied.");
      setManualMode(true);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processManualTranscript = async () => {
    if (!transcript.trim()) { toast.error("Please enter some notes"); return; }
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("format-soap-notes", {
        body: { transcript: transcript.trim() },
      });
      if (error) { toast.error("Failed to generate SOAP notes."); return; }
      if (data?.error) { toast.error(data.error); return; }
      onTranscriptProcessed(data);
      toast.success("SOAP notes generated!");
    } catch (err: any) { toast.error(err.message || "Failed to process notes"); }
    finally { setIsTranscribing(false); }
  };

  if (isTranscribing) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-display text-lg font-semibold text-foreground">
            {processingStatus || "Transcribing your notes..."}
          </p>
          <p className="text-sm text-muted-foreground">
            {features.asyncAI
              ? "You can switch tabs while AI processes. Notes will appear automatically."
              : "AI is converting your recording into structured SOAP notes"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        {!manualMode ? (
          <div className={`flex flex-col items-center gap-6 py-10 px-6 transition-all duration-500 ${isRecording ? "bg-[hsl(0,0%,11%)]" : "bg-card"}`}>
            {/* Waveform bars */}
            {isRecording && (
              <div className="flex items-end gap-[3px] h-16">
                {audioLevels.map((level, i) => (
                  <div
                    key={i}
                    className="w-[4px] rounded-full bg-destructive transition-all duration-75"
                    style={{ height: `${Math.max(4, level * 64)}px` }}
                  />
                ))}
              </div>
            )}

            {/* Timer */}
            {isRecording && (
              <p className="font-mono text-4xl font-light text-white tracking-wider">{formatTime(elapsed)}</p>
            )}

            {/* Record / Stop button */}
            <div className="relative">
              {isRecording ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); stopRecording(); }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90 transition-all shadow-lg"
                  style={{ pointerEvents: 'all', zIndex: 9999 }}
                >
                  <Square className="h-7 w-7 text-white" fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-all"
                >
                  <Mic className="h-10 w-10" />
                </button>
              )}
              {isRecording && (
                <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-destructive pointer-events-none" />
              )}
            </div>

            <p className={`text-sm ${isRecording ? "text-white/60" : "text-muted-foreground"}`}>
              {isRecording ? "Recording... Tap to stop" : "Tap to start recording"}
            </p>
            {!isRecording && (
              <Button variant="link" size="sm" onClick={() => setManualMode(true)} className="text-muted-foreground">
                Or type notes manually
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 p-6">
            <Textarea
              rows={6}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Type or paste your clinical notes here..."
              className="resize-none rounded-lg"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setManualMode(false)} className="rounded-lg">
                <Mic className="mr-2 h-4 w-4" /> Use Microphone
              </Button>
              <Button onClick={processManualTranscript} disabled={isTranscribing || !transcript.trim()} className="flex-1 rounded-lg">
                Generate SOAP Notes with AI
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
