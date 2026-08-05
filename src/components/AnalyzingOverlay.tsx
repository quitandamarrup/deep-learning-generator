import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";

/**
 * Full-screen "AI is working" experience shown while CP Analysis is in
 * flight. Purely presentational — everything here is simulated/visual only
 * (progress %, checklist steps, elapsed-time messages). It does not know
 * anything about the real analysis stages; it just makes waiting feel alive.
 */

const ROTATING_MESSAGES = [
  "🧠 AI sedang membaca Capaian Pembelajaran...",
  "📖 Memahami kompetensi yang harus dicapai...",
  "🔍 Mengidentifikasi kompetensi utama...",
  "📚 Mengelompokkan materi pembelajaran...",
  "🎯 Menentukan tujuan pembelajaran...",
  "📝 Menyusun topik pembelajaran...",
  "📅 Menghitung estimasi jumlah pertemuan...",
  "📊 Menentukan alur tujuan pembelajaran (ATP)...",
  "✅ Memastikan hasil sesuai Kurikulum Merdeka...",
  "✨ Menyusun rekomendasi pembelajaran terbaik...",
  "⏳ Mohon tunggu sebentar...",
];

const CHECKLIST_STEPS = [
  "Membaca CP",
  "Mengidentifikasi Kompetensi",
  "Menentukan TP",
  "Menentukan Materi",
  "Menentukan ATP",
  "Menyusun Hasil",
];

function longProcessingMessage(elapsedSec: number): string | null {
  if (elapsedSec >= 90) {
    return "AI masih bekerja dan belum berhenti. Silakan tetap membuka halaman ini. Hasil akan ditampilkan secara otomatis setelah proses selesai.";
  }
  if (elapsedSec >= 60) {
    return "Permintaan sedang diproses oleh layanan AI. Pada waktu tertentu proses dapat memerlukan waktu lebih lama. Terima kasih atas kesabaran Anda.";
  }
  if (elapsedSec >= 40) {
    return "CP yang sedang dianalisis memiliki tingkat kompleksitas yang tinggi sehingga memerlukan waktu sedikit lebih lama.";
  }
  if (elapsedSec >= 20) {
    return "Analisis masih berlangsung dengan normal.";
  }
  return null;
}

export type AnalyzePhase = "idle" | "loading" | "success";

export function AnalyzingOverlay({ phase }: { phase: AnalyzePhase }) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(6);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "loading") {
      startRef.current = null;
      setElapsedSec(0);
      setMessageIndex(0);
      setProgress(6);
      return;
    }
    startRef.current = Date.now();
    const tick = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
    }, 1000);
    const rotate = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ROTATING_MESSAGES.length);
    }, 4000);
    // Progress eases toward 99% and never reaches 100 on its own — it's a
    // visual approximation, not a real completion signal (requirement 6).
    const grow = setInterval(() => {
      setProgress((p) => (p >= 99 ? 99 : Math.min(99, p + (99 - p) * 0.12 + Math.random() * 2)));
    }, 700);
    return () => {
      clearInterval(tick);
      clearInterval(rotate);
      clearInterval(grow);
    };
  }, [phase]);

  if (phase === "idle") return null;

  const completedSteps =
    phase === "success"
      ? CHECKLIST_STEPS.length
      : Math.min(CHECKLIST_STEPS.length - 1, Math.floor(elapsedSec / 15));
  const longMsg = phase === "loading" ? longProcessingMessage(elapsedSec) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f2b5b]/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        {phase === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <p className="text-lg font-semibold text-slate-800">Analisis berhasil diselesaikan.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0f2b5b]/20" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0f2b5b]/10">
                  <Sparkles className="h-7 w-7 animate-pulse text-[#0f2b5b]" />
                </div>
              </div>
              <p
                key={messageIndex}
                className="min-h-[2.5rem] text-sm font-medium text-slate-800 animate-in fade-in duration-300"
              >
                {ROTATING_MESSAGES[messageIndex]}
              </p>
            </div>

            <div className="mt-5 space-y-1.5">
              <Progress value={progress} className="h-2" />
              <p className="text-right text-xs tabular-nums text-slate-400">
                {Math.round(progress)}%
              </p>
            </div>

            <ul className="mt-5 space-y-1.5">
              {CHECKLIST_STEPS.map((step, i) => {
                const done = i < completedSteps;
                const active = i === completedSteps;
                return (
                  <li
                    key={step}
                    className={`flex items-center gap-2 text-sm transition-colors ${
                      done ? "text-emerald-600" : active ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0" />
                    )}
                    {step}
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              Mohon menunggu... AI sedang menganalisis Capaian Pembelajaran secara menyeluruh untuk
              menghasilkan administrasi pembelajaran yang lebih akurat. Lama proses bergantung pada
              kompleksitas CP dan waktu respons layanan AI.
            </div>

            {longMsg && (
              <div
                key={longMsg}
                className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 animate-in fade-in duration-300"
              >
                {longMsg}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
