"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });

      const datos = (await respuesta.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!respuesta.ok) {
        setError(
          datos.error ??
            (respuesta.status === 403
              ? "Este usuario está deshabilitado."
              : "Usuario o contraseña incorrectos.")
        );
        setEnviando(false);
        return;
      }

      router.push(datos.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg ring-1 ring-zinc-200">
        <h1 className="text-center text-3xl font-bold text-zinc-900">COCATO</h1>
        <p className="mt-2 text-center text-zinc-500">
          Sistema Integral de Distribución de Carne
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="usuario"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Usuario
            </label>
            <input
              id="usuario"
              type="text"
              placeholder="Usuario"
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              autoComplete="username"
              required
              disabled={enviando}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={enviando}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-black py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
