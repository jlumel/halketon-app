"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Mic,
  RotateCcw,
  Send,
  Square,
  Upload,
  WifiOff,
} from "lucide-react";
import { getPrograma } from "@/lib/programas";
import {
  countPending,
  flushPending,
  registerSync,
  savePending,
} from "@/lib/offline";
import type { ProgramaId } from "@/lib/types";

type Estado =
  | "listo"
  | "grabando"
  | "grabado"
  | "procesando"
  | "enviado"
  | "sin_red"
  | "error";

function fmt(segs: number) {
  const m = Math.floor(segs / 60)
    .toString()
    .padStart(2, "0");
  const s = (segs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function GrabarPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("listo");
  const [segundos, setSegundos] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [programaId, setProgramaId] = useState<ProgramaId | null>(null);
  const [pendientes, setPendientes] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refrescarPendientes = useCallback(() => {
    countPending().then(setPendientes).catch(() => {});
  }, []);

  useEffect(() => {
    const p = sessionStorage.getItem("programa") as ProgramaId | null;
    const b = sessionStorage.getItem("beneficiario");
    if (!p || !b) {
      router.replace("/programa");
      return;
    }
    setProgramaId(p);
    refrescarPendientes();
  }, [router, refrescarPendientes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onOnline() {
      flushPending()
        .then(() => refrescarPendientes())
        .catch(() => {});
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refrescarPendientes]);

  const programa = getPrograma(programaId);

  async function iniciar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setEstado("grabado");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setSegundos(0);
      setEstado("grabando");
      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      setEstado("error");
    }
  }

  function detener() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function regrabar() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setSegundos(0);
    setEstado("listo");
  }

  async function enviar() {
    if (!blobRef.current || !programaId) return;
    const promotor = localStorage.getItem("promotor") ?? "";
    const beneficiario = sessionStorage.getItem("beneficiario") ?? "{}";

    if (typeof navigator !== "undefined" && navigator.onLine) {
      setEstado("procesando");
      try {
        const form = new FormData();
        form.append("audio", blobRef.current, "audio.webm");
        form.append("promotor", promotor);
        form.append("programa", programaId);
        form.append("beneficiario", beneficiario);
        const pcUrl = process.env.NEXT_PUBLIC_PC_URL ?? "";
        const res = await fetch(`${pcUrl}/api/audio`, { method: "POST", body: form });
        if (!res.ok) throw new Error("upload failed");
        setEstado("enviado");
      } catch {
        await guardarOffline(promotor, beneficiario);
      }
    } else {
      await guardarOffline(promotor, beneficiario);
    }
  }

  async function guardarOffline(promotor: string, beneficiario: string) {
    if (!blobRef.current || !programaId) return;
    try {
      await savePending(blobRef.current, {
        promotor,
        programa: programaId,
        beneficiario,
      });
      await registerSync();
      refrescarPendientes();
      setEstado("sin_red");
    } catch {
      setEstado("error");
    }
  }

  async function reintentarPendientes() {
    const enviados = await flushPending();
    refrescarPendientes();
    if (enviados > 0 && estado === "sin_red") {
      // dejamos que el usuario vea el conteo actualizado
    }
  }

  function otraSesion() {
    sessionStorage.removeItem("beneficiario");
    router.push("/programa");
  }

  const estadoTexto: Record<Estado, string> = {
    listo: "Listo",
    grabando: `Grabando ${fmt(segundos)}`,
    grabado: "Audio listo para enviar",
    procesando: "Procesando…",
    enviado: "Enviado ✓",
    sin_red: "Guardado sin red",
    error: "Error — reintentá",
  };

  if (!programa) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col px-6 py-8">
      <header className="mb-2 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          disabled={estado === "grabando" || estado === "procesando"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition active:bg-stone-200 disabled:opacity-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: programa.color }}
        >
          {programa.label}
        </span>
      </header>

      {/* Estado actual */}
      <div className="mt-2 flex items-center justify-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
            estado === "enviado"
              ? "bg-emerald-100 text-emerald-800"
              : estado === "sin_red"
                ? "bg-amber-100 text-amber-800"
                : estado === "error"
                  ? "bg-red-100 text-red-800"
                  : estado === "grabando"
                    ? "bg-red-100 text-red-700"
                    : "bg-stone-200 text-stone-700"
          }`}
        >
          {estado === "sin_red" && <CloudOff className="h-4 w-4" />}
          {estado === "enviado" && <Check className="h-4 w-4" />}
          {estadoTexto[estado]}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {/* Botón central de grabación */}
        {(estado === "listo" ||
          estado === "grabando" ||
          estado === "error") && (
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={estado === "grabando" ? detener : iniciar}
              className={`relative flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition active:scale-95 ${
                estado === "grabando"
                  ? "animate-pulse bg-red-600"
                  : "bg-emerald-600"
              }`}
            >
              {estado === "grabando" && (
                <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
              )}
              {estado === "grabando" ? (
                <Square className="h-16 w-16 fill-white" />
              ) : (
                <Mic className="h-20 w-20" strokeWidth={2} />
              )}
            </button>

            {estado === "grabando" ? (
              <>
                <p className="font-mono text-4xl font-bold tabular-nums text-stone-900">
                  {fmt(segundos)}
                </p>
                <Ondas />
                <p className="text-sm text-stone-500">Tocá para detener</p>
              </>
            ) : (
              <p className="text-base text-stone-500">
                Tocá para empezar a grabar
              </p>
            )}
          </div>
        )}

        {/* Reproductor + acciones */}
        {estado === "grabado" && audioUrl && (
          <div className="flex w-full flex-col items-center gap-6">
            <p className="font-mono text-3xl font-bold tabular-nums text-stone-900">
              {fmt(segundos)}
            </p>
            <audio src={audioUrl} controls className="w-full" />
            <div className="flex w-full flex-col gap-3">
              <button
                onClick={enviar}
                className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-bold text-white transition active:scale-[0.98]"
              >
                <Send className="h-5 w-5" /> Enviar
              </button>
              <button
                onClick={regrabar}
                className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 bg-white text-lg font-bold text-stone-700 transition active:scale-[0.98]"
              >
                <RotateCcw className="h-5 w-5" /> Regrabar
              </button>
            </div>
          </div>
        )}

        {estado === "procesando" && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-stone-300 border-t-emerald-600" />
            <p className="text-base text-stone-500">Enviando audio…</p>
          </div>
        )}

        {(estado === "enviado" || estado === "sin_red") && (
          <div className="flex w-full flex-col items-center gap-6 text-center">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full ${
                estado === "enviado"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {estado === "enviado" ? (
                <Check className="h-14 w-14" strokeWidth={2.5} />
              ) : (
                <WifiOff className="h-12 w-12" />
              )}
            </div>
            <p className="max-w-xs text-base text-stone-600">
              {estado === "enviado"
                ? "El audio se envió a la sede para su procesamiento."
                : "Guardado sin conexión — se enviará al recuperar red."}
            </p>
            <button
              onClick={otraSesion}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-bold text-white transition active:scale-[0.98]"
            >
              Registrar otra sesión
            </button>
          </div>
        )}
      </div>

      {/* Cola offline (fallback iOS / manual) */}
      {pendientes > 0 && (
        <button
          onClick={reintentarPendientes}
          className="mb-2 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 text-base font-semibold text-amber-800 transition active:scale-[0.98]"
        >
          <Upload className="h-5 w-5" />
          Reintentar envíos pendientes ({pendientes})
        </button>
      )}
    </main>
  );
}

function Ondas() {
  return (
    <div className="flex h-10 items-center gap-1.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-red-500"
          style={{
            animation: "wave 0.9s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
            height: "100%",
          }}
        />
      ))}
      <style jsx>{`
        @keyframes wave {
          0%,
          100% {
            transform: scaleY(0.3);
          }
          50% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
