"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WhatsAppConfig = {
  id: string;
  activo: boolean;
  hora_mensaje_automatico: string | null;
  plantilla_mensaje_id: string | null;
  phone_number_id: string | null;
  updated_at: string;
};

type WhatsAppTemplate = {
  id: string;
  nombre: string;
  cuerpo: string;
};

type ClienteOption = {
  id: string;
  nombre_negocio: string;
  whatsapp: string | null;
  telefono: string | null;
};

type Participante = {
  cliente_id: string;
  activo: boolean;
  recibe_mensaje_automatico: boolean;
  clientes?: ClienteOption | ClienteOption[] | null;
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export default function WhatsAppConfigPanel() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [plantillas, setPlantillas] = useState<WhatsAppTemplate[]>([]);
  const [credenciales, setCredenciales] = useState<Record<string, boolean>>({});
  const [conexion, setConexion] = useState<{ ok: boolean; detalle: string } | null>(
    null
  );
  const [webhookUrl, setWebhookUrl] = useState("");
  const [avisoPanel, setAvisoPanel] = useState<string | null>(null);

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [clienteAgregar, setClienteAgregar] = useState("");

  const participantesMap = useMemo(() => {
    return new Map(participantes.map((item) => [item.cliente_id, item]));
  }, [participantes]);

  const clientesDisponibles = useMemo(() => {
    return clientes.filter(
      (cliente) => !participantesMap.has(cliente.id)
    );
  }, [clientes, participantesMap]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [configRes, participantesRes] = await Promise.all([
        fetch("/api/admin/whatsapp/config"),
        fetch("/api/admin/whatsapp/participantes"),
      ]);

      if (configRes.status === 403 || participantesRes.status === 403) {
        throw new Error("No autorizado para ver la configuración de WhatsApp.");
      }

      const configData = (await configRes.json()) as {
        config: WhatsAppConfig | null;
        plantillas: WhatsAppTemplate[];
        credenciales: Record<string, boolean>;
        conexion: { ok: boolean; detalle: string };
        webhookUrl: string | null;
        aviso?: string;
        error?: string;
      };

      const participantesData = (await participantesRes.json()) as {
        participantes: Participante[];
        clientes: ClienteOption[];
        aviso?: string;
        error?: string;
      };

      if (configData.error && !configData.config) {
        setError(configData.error);
      }

      setConfig(configData.config);
      setPlantillas(configData.plantillas ?? []);
      setCredenciales(configData.credenciales ?? {});
      setConexion(configData.conexion ?? null);
      setWebhookUrl(configData.webhookUrl ?? "");
      setAvisoPanel(
        [configData.aviso, participantesData.aviso].filter(Boolean).join(" ") ||
          null
      );
      setParticipantes(participantesData.participantes ?? []);
      setClientes(participantesData.clientes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  async function guardarConfig() {
    if (!config) return;

    setGuardando(true);
    setError(null);
    setMensaje(null);

    try {
      const response = await fetch("/api/admin/whatsapp/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activo: config.activo,
          hora_mensaje_automatico: config.hora_mensaje_automatico,
          plantilla_mensaje_id: config.plantilla_mensaje_id,
          phone_number_id: config.phone_number_id,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "No se pudo guardar.");
      }

      setMensaje("Configuración guardada.");
      await cargarDatos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function agregarParticipante() {
    if (!clienteAgregar) return;

    const nuevos = [
      ...participantes,
      {
        cliente_id: clienteAgregar,
        activo: true,
        recibe_mensaje_automatico: true,
      },
    ];

    await guardarParticipantes(nuevos);
    setClienteAgregar("");
  }

  async function guardarParticipantes(lista: Participante[]) {
    setGuardando(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/whatsapp/participantes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantes: lista.map((item) => ({
            cliente_id: item.cliente_id,
            activo: item.activo,
            recibe_mensaje_automatico: item.recibe_mensaje_automatico,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudieron guardar los participantes.");
      }

      const data = (await response.json()) as { participantes: Participante[] };
      setParticipantes(data.participantes ?? []);
      setMensaje("Participantes actualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  function actualizarParticipante(
    clienteId: string,
    cambios: Partial<Pick<Participante, "activo" | "recibe_mensaje_automatico">>
  ) {
    setParticipantes((prev) =>
      prev.map((item) =>
        item.cliente_id === clienteId ? { ...item, ...cambios } : item
      )
    );
  }

  async function quitarParticipante(clienteId: string) {
    setGuardando(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/whatsapp/participantes?cliente_id=${encodeURIComponent(clienteId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("No se pudo quitar el participante.");
      }

      setParticipantes((prev) =>
        prev.filter((item) => item.cliente_id !== clienteId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al quitar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <p className="text-sm text-zinc-500">Cargando automatización de WhatsApp…</p>
    );
  }

  return (
    <div className="space-y-6">
      {avisoPanel ? (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {avisoPanel}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {mensaje ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {mensaje}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Estado de conexión
          </p>
          <p
            className={`mt-2 text-sm font-medium ${
              conexion?.ok ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {conexion?.ok ? "Conectado" : "No conectado"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{conexion?.detalle}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Credenciales (env)
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            <li>Proveedor: {(credenciales as { provider?: string }).provider ?? "ycloud"}</li>
            <li>YCLOUD_API_KEY (Supabase): {credenciales.ycloudApiKey ? "✓" : "✗"}</li>
            <li>YCLOUD_WEBHOOK_SECRET (Supabase): {credenciales.ycloudWebhookSecret ? "✓" : "✗"}</li>
            <li>YCLOUD_WHATSAPP_FROM (Supabase): {credenciales.ycloudFrom ? "✓" : "✗"}</li>
            <li>Service Role (panel admin): {credenciales.serviceRole ? "✓" : "✗"}</li>
            <li>OpenAI (Supabase secrets): {credenciales.openai ? "✓ en Vercel" : "— en Supabase"}</li>
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            WhatsApp (YCloud) y OpenAI deben estar en los secrets de Supabase Edge Functions.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Webhook URL (YCloud → Supabase)
        </label>
        <input
          readOnly
          value={
            webhookUrl ||
            "Configura NEXT_PUBLIC_SUPABASE_URL para ver la URL de Supabase."
          }
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Registra esta URL en YCloud con los eventos whatsapp.inbound_message.received
          y whatsapp.message.updated. Los mensajes se procesan en Supabase Edge Functions.
        </p>
      </div>

      {config ? (
        <div className="space-y-4 rounded-xl border border-zinc-200 p-4">
          <label className="flex items-center gap-3 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              checked={config.activo}
              onChange={(event) =>
                setConfig({ ...config, activo: event.target.checked })
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            Activar integración de WhatsApp
          </label>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Número WhatsApp del negocio
            </label>
            <input
              value={config.phone_number_id ?? ""}
              onChange={(event) =>
                setConfig({ ...config, phone_number_id: event.target.value })
              }
              placeholder="E.164 para YCloud, ej. +525512345678"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Hora del mensaje automático
            </label>
            <input
              type="time"
              value={config.hora_mensaje_automatico?.slice(0, 5) ?? ""}
              onChange={(event) =>
                setConfig({
                  ...config,
                  hora_mensaje_automatico: event.target.value
                    ? `${event.target.value}:00`
                    : null,
                })
              }
              className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Plantilla del mensaje automático
            </label>
            <select
              value={config.plantilla_mensaje_id ?? ""}
              onChange={(event) =>
                setConfig({
                  ...config,
                  plantilla_mensaje_id: event.target.value || null,
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Sin plantilla</option>
              {plantillas.map((plantilla) => (
                <option key={plantilla.id} value={plantilla.id}>
                  {plantilla.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void guardarConfig()}
            disabled={guardando}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">
          Clientes participantes
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Solo estos clientes pueden crear pedidos automáticos por WhatsApp.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={clienteAgregar}
            onChange={(event) => setClienteAgregar(event.target.value)}
            className="min-w-[14rem] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Agregar cliente…</option>
            {clientesDisponibles.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre_negocio}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void agregarParticipante()}
            disabled={!clienteAgregar || guardando}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            Agregar
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {participantes.length === 0 ? (
            <li className="text-sm text-zinc-500">Sin clientes participantes.</li>
          ) : (
            participantes.map((item) => {
              const cliente =
                resolverJoin(item.clientes) ??
                clientes.find((c) => c.id === item.cliente_id);

              return (
                <li
                  key={item.cliente_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {cliente?.nombre_negocio ?? item.cliente_id}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {cliente?.whatsapp || cliente?.telefono || "Sin teléfono"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={item.activo}
                        onChange={(event) =>
                          actualizarParticipante(item.cliente_id, {
                            activo: event.target.checked,
                          })
                        }
                      />
                      Activo
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={item.recibe_mensaje_automatico}
                        onChange={(event) =>
                          actualizarParticipante(item.cliente_id, {
                            recibe_mensaje_automatico: event.target.checked,
                          })
                        }
                      />
                      Mensaje automático
                    </label>
                    <button
                      type="button"
                      onClick={() => void quitarParticipante(item.cliente_id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {participantes.length > 0 ? (
          <button
            type="button"
            onClick={() => void guardarParticipantes(participantes)}
            disabled={guardando}
            className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            Guardar participantes
          </button>
        ) : null}
      </div>
    </div>
  );
}
