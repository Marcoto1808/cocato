"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatMoneda } from "@/lib/pedido-calculo";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";
import ClienteHistorialPedidos from "@/components/clientes/ClienteHistorialPedidos";
import ClienteResumenCredito from "@/components/clientes/ClienteResumenCredito";
import {
  calcularResumenCredito,
  cargarPedidosCreditoCliente,
  type PedidoCredito,
} from "@/lib/cliente-credito";
import { esAdministrador, type RolUsuario } from "@/lib/roles";

type TipoCliente = {
  id: string;
  nombre: string;
  codigo: string;
};

type ClienteDetalle = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  limite_credito: number;
  activo: boolean;
  tipos_cliente: TipoCliente | TipoCliente[] | null;
};

type SesionPublica = {
  rol: RolUsuario;
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export default function ClienteDetallePage() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id;

  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [pedidos, setPedidos] = useState<PedidoCredito[]>([]);
  const [sesion, setSesion] = useState<SesionPublica | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [modalLimiteAbierto, setModalLimiteAbierto] = useState(false);
  const [limiteTemporal, setLimiteTemporal] = useState("");
  const [guardandoLimite, setGuardandoLimite] = useState(false);

  const esAdmin = sesion ? esAdministrador(sesion.rol) : false;

  const cargarDatos = useCallback(async () => {
    if (!clienteId) return;

    setCargando(true);
    setError(null);

    const [clienteRes, pedidosData, sesionRes] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id, nombre_negocio, propietario, telefono, whatsapp, direccion, limite_credito, activo, tipos_cliente(id, nombre, codigo)"
        )
        .eq("id", clienteId)
        .maybeSingle(),
      cargarPedidosCreditoCliente(clienteId),
      fetch("/api/auth/session").then((response) => response.json()),
    ]);

    if (clienteRes.error || !clienteRes.data) {
      setError("No se encontró el cliente.");
      setCargando(false);
      return;
    }

    setCliente(clienteRes.data as ClienteDetalle);
    setPedidos(pedidosData);

    if (sesionRes?.usuario?.rol) {
      setSesion({ rol: sesionRes.usuario.rol });
    }

    setCargando(false);
  }, [clienteId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const limiteCredito = Number(cliente?.limite_credito ?? 0);
  const resumen = useMemo(
    () => calcularResumenCredito(pedidos, limiteCredito),
    [pedidos, limiteCredito]
  );

  const tipoCliente = resolverJoin(cliente?.tipos_cliente ?? null);

  function abrirModalLimite() {
    setLimiteTemporal(String(limiteCredito));
    setModalLimiteAbierto(true);
    setMensajeExito(null);
    setError(null);
  }

  function cerrarModalLimite() {
    setModalLimiteAbierto(false);
    setLimiteTemporal("");
  }

  async function guardarLimiteCredito() {
    if (!cliente) return;

    const valor = Number(limiteTemporal);
    if (!Number.isFinite(valor) || valor < 0) {
      setError("Ingresa un límite de crédito válido.");
      return;
    }

    setGuardandoLimite(true);
    setError(null);
    setMensajeExito(null);

    const { data, error: updateError } = await supabase
      .from("clientes")
      .update({ limite_credito: valor })
      .eq("id", cliente.id)
      .select(
        "id, nombre_negocio, propietario, telefono, whatsapp, direccion, limite_credito, activo, tipos_cliente(id, nombre, codigo)"
      )
      .single();

    setGuardandoLimite(false);

    if (updateError || !data) {
      setError("No se pudo actualizar el límite de crédito.");
      return;
    }

    setCliente(data as ClienteDetalle);
    cerrarModalLimite();
    setMensajeExito(
      `Límite actualizado: ${formatMoneda(limiteCredito)} → ${formatMoneda(valor)}`
    );
  }

  function handlePagoRegistrado(pedidoId: string, pagadoEn: string) {
    setPedidos((prev) =>
      prev.map((pedido) =>
        pedido.id === pedidoId
          ? { ...pedido, estado_pago: "pagado", pagado_en: pagadoEn }
          : pedido
      )
    );
    setMensajeExito("Pago registrado correctamente.");
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-zinc-100 p-8">
        <VolverAlDashboardLink />
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          Cargando cliente...
        </div>
      </main>
    );
  }

  if (!cliente) {
    return (
      <main className="min-h-screen bg-zinc-100 p-8">
        <VolverAlDashboardLink />
        <div className="rounded-xl bg-red-50 p-6 text-red-700 ring-1 ring-red-200">
          {error ?? "Cliente no encontrado."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <VolverAlDashboardLink />

      <div className="mb-6">
        <p className="text-sm text-zinc-500">
          <Link href="/clientes" className="hover:underline">
            Clientes
          </Link>
          {" / Cobranza"}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-zinc-900">
          {cliente.nombre_negocio}
        </h1>
        <p className="mt-1 text-zinc-500">
          {tipoCliente?.nombre ?? "Sin tipo"}
          {cliente.propietario ? ` · ${cliente.propietario}` : ""}
        </p>
        {(cliente.telefono || cliente.whatsapp || cliente.direccion) && (
          <p className="mt-2 text-sm text-zinc-600">
            {[
              cliente.telefono?.trim(),
              cliente.whatsapp?.trim()
                ? `WhatsApp ${cliente.whatsapp.trim()}`
                : null,
              cliente.direccion?.trim(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {mensajeExito ? (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {mensajeExito}
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <ClienteResumenCredito
        resumen={resumen}
        limiteCredito={limiteCredito}
        esAdministrador={esAdmin}
        onEditarLimite={abrirModalLimite}
      />

      <div className="mt-6">
        <ClienteHistorialPedidos
          pedidos={pedidos}
          onPagoRegistrado={handlePagoRegistrado}
        />
      </div>

      {modalLimiteAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">
              Editar límite de crédito
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              {cliente.nombre_negocio}
            </p>

            <div className="mt-6 flex items-center justify-center gap-3 text-lg font-semibold text-zinc-900">
              <span>{formatMoneda(limiteCredito)}</span>
              <span className="text-zinc-400">→</span>
              <input
                id="limite-credito-modal"
                type="number"
                min={0}
                step={100}
                value={limiteTemporal}
                onChange={(event) => setLimiteTemporal(event.target.value)}
                className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-lg font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={cerrarModalLimite}
                disabled={guardandoLimite}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarLimiteCredito}
                disabled={guardandoLimite}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {guardandoLimite ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
