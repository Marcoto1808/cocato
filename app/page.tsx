import { supabase } from "@/lib/supabase";

export default async function Home() {

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <main className="w-full max-w-sm">
        <div className="rounded-xl border border-zinc-200 p-8 shadow-sm">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-wide text-zinc-900">
              COCATO
            </h1>
            
            <p className="mt-2 text-sm text-zinc-500">
              Sistema Integral de Distribución de Carne
            </p>
          </header>

          <form className="space-y-4">
            <div>
              <label
                htmlFor="usuario"
                className="block text-sm font-medium text-zinc-700"
              >
                Usuario
              </label>
              <input
                id="usuario"
                name="usuario"
                type="text"
                autoComplete="username"
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-md bg-black py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Entrar
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
