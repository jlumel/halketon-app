"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem("promotor");
    if (p) {
      router.replace("/programa");
      return;
    }
    setListo(true);
  }, [router]);

  function ingresar(e: FormEvent) {
    e.preventDefault();
    const valor = nombre.trim();
    if (!valor) return;
    localStorage.setItem("promotor", valor);
    router.replace("/programa");
  }

  if (!listo) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6 py-10">
      <div className="mb-10">
        <p className="text-sm font-medium text-stone-500">Pequeños Pasos</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight text-stone-900">
          Registro de campo
        </h1>
        <p className="mt-2 text-base text-stone-600">
          Registrá tu intervención por voz, incluso sin conexión.
        </p>
      </div>

      <form onSubmit={ingresar} className="flex flex-col gap-4">
        <label htmlFor="nombre" className="text-lg font-semibold text-stone-800">
          ¿Cómo te llamás?
        </label>
        <input
          id="nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          autoFocus
          placeholder="Tu nombre"
          className="min-h-[56px] rounded-2xl border-2 border-stone-200 bg-white px-5 text-xl text-stone-900 outline-none transition focus:border-stone-800"
        />
        <button
          type="submit"
          disabled={!nombre.trim()}
          className="min-h-[56px] rounded-2xl bg-stone-900 text-xl font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-40"
        >
          Ingresar
        </button>
      </form>
    </main>
  );
}
