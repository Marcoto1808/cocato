"use client";

import { useCallback, useEffect, useState } from "react";
import {
  crearAliasProducto,
  eliminarAliasProducto,
  formatearErrorAlias,
  listarAliasesDeProducto,
  type ProductoAlias,
} from "@/lib/producto-aliases";

type Props = {
  productoId: string;
  productoNombre: string;
};

export default function ProductoAliasesEditor({
  productoId,
  productoNombre,
}: Props) {
  const [aliases, setAliases] = useState<ProductoAlias[]>([]);
  const [nuevoAlias, setNuevoAlias] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarAliases = useCallback(async () => {
    setCargando(true);
    setError(null);

    const resultado = await listarAliasesDeProducto(productoId);
    if (resultado.error) {
      setError(formatearErrorAlias(resultado.error));
      setCargando(false);
      return;
    }

    setAliases(resultado.aliases);
    setCargando(false);
  }, [productoId]);

  useEffect(() => {
    cargarAliases();
  }, [cargarAliases]);

  async function agregarAlias(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const alias = nuevoAlias.trim();
    if (!alias) return;

    setGuardando(true);
    setError(null);

    const resultado = await crearAliasProducto(productoId, alias);
    if (resultado.error || !resultado.alias) {
      setError(formatearErrorAlias(resultado.error));
      setGuardando(false);
      return;
    }

    setNuevoAlias("");
    setGuardando(false);
    await cargarAliases();
  }

  async function quitarAlias(aliasId: string) {
    setEliminandoId(aliasId);
    setError(null);

    const resultado = await eliminarAliasProducto(aliasId);
    if (resultado.error) {
      setError(formatearErrorAlias(resultado.error));
      setEliminandoId(null);
      return;
    }

    setEliminandoId(null);
    await cargarAliases();
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div>
        <p className="text-sm font-medium text-zinc-900">Alias comerciales</p>
        <p className="mt-1 text-xs text-zinc-500">
          Formas en que los clientes piden &quot;{productoNombre}&quot; por
          WhatsApp. Ejemplo: maciza, bistec de cerdo.
        </p>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando alias...</p>
        ) : aliases.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Sin alias registrados. Agrega cómo hablan tus clientes.
          </p>
        ) : (
          aliases.map((alias) => (
            <div
              key={alias.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2"
            >
              <span className="text-sm text-zinc-800">
                <span className="mr-2 text-emerald-600">✓</span>
                {alias.alias}
              </span>
              <button
                type="button"
                onClick={() => quitarAlias(alias.id)}
                disabled={eliminandoId === alias.id}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
              >
                {eliminandoId === alias.id ? "Quitando..." : "Quitar"}
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={agregarAlias} className="mt-4 flex gap-2">
        <input
          type="text"
          value={nuevoAlias}
          onChange={(event) => setNuevoAlias(event.target.value)}
          placeholder="Nuevo alias, ej. maciza"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
        <button
          type="submit"
          disabled={guardando || !nuevoAlias.trim()}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? "Agregando..." : "Agregar"}
        </button>
      </form>
    </div>
  );
}
