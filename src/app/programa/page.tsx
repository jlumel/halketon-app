"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Apple, Briefcase, GraduationCap, HeartPulse, LogOut } from "lucide-react";
import { PROGRAMAS_LISTA } from "@/lib/programas";
import type { ProgramaId } from "@/lib/types";

const ICONS: Record<ProgramaId, typeof Apple> = {
  nutricion: Apple,
  salud: HeartPulse,
  educacion: GraduationCap,
  trabajo: Briefcase,
};

export default function ProgramaPage() {
  const router = useRouter();
  const [promotor, setPromotor] = useState<string | null>(null);

  useEffect(() => {
    const p = localStorage.getItem("promotor");
    if (!p) {
      router.replace("/");
      return;
    }
    setPromotor(p);
  }, [router]);

  function elegir(id: ProgramaId) {
    sessionStorage.setItem("programa", id);
    router.push("/registro");
  }

  function salir() {
    localStorage.removeItem("promotor");
    router.replace("/");
  }

  if (!promotor) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-500">Hola,</p>
          <p className="text-lg font-bold text-stone-900">{promotor}</p>
        </div>
        <button
          onClick={salir}
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-stone-500 transition active:bg-stone-200"
        >
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </header>

      <h1 className="mb-5 text-xl font-bold text-stone-900">
        ¿Qué programa registrás?
      </h1>

      <div className="flex flex-col gap-4">
        {PROGRAMAS_LISTA.map((p) => {
          const Icon = ICONS[p.id];
          return (
            <button
              key={p.id}
              onClick={() => elegir(p.id)}
              style={{ backgroundColor: p.color }}
              className="flex min-h-[88px] items-center gap-4 rounded-3xl px-6 text-left text-white shadow-md transition active:scale-[0.98]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Icon className="h-8 w-8" strokeWidth={2.2} />
              </span>
              <span className="text-2xl font-bold">{p.label}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
