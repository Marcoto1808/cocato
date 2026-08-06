import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteResuelto } from "@/lib/whatsapp/client-resolver";
import { normalizarTelefonoWa } from "@/lib/whatsapp/phone-utils";

export const ESTADO_VALIDACION_PENDIENTE = "Pendiente de validación comercial";

export type DatosRegistroNegocio = {
  nombreNegocio: string;
  tipoNegocio: string;
};

export function parsearDatosRegistro(
  texto: string
): DatosRegistroNegocio | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  const separadores = [" - ", " – ", " — ", "-"];
  for (const sep of separadores) {
    const indice = limpio.lastIndexOf(sep);
    if (indice <= 0) continue;

    const nombreNegocio = limpio.slice(0, indice).trim();
    const tipoNegocio = limpio.slice(indice + sep.length).trim();
    if (nombreNegocio.length >= 2 && tipoNegocio.length >= 2) {
      return { nombreNegocio, tipoNegocio };
    }
  }

  return null;
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export async function resolverTipoClienteId(
  db: SupabaseClient,
  tipoNegocio: string
): Promise<string> {
  const { data, error } = await db
    .from("tipos_cliente")
    .select("id, nombre, codigo")
    .eq("activo", true)
    .order("orden");

  if (error) throw new Error(error.message);

  const tipos = data ?? [];
  const buscado = normalizarTexto(tipoNegocio);

  const exacto = tipos.find(
    (tipo) => normalizarTexto(tipo.nombre as string) === buscado
  );
  if (exacto) return exacto.id as string;

  const parcial = tipos.find((tipo) => {
    const nombre = normalizarTexto(tipo.nombre as string);
    return nombre.includes(buscado) || buscado.includes(nombre);
  });
  if (parcial) return parcial.id as string;

  if (tipos.length === 0) {
    throw new Error("No hay tipos de cliente configurados en Supabase.");
  }

  return tipos[0].id as string;
}

async function resolverListaPrecioPorTipo(
  db: SupabaseClient,
  tipoClienteId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("listas_precio")
    .select("id")
    .eq("tipo_cliente_id", tipoClienteId)
    .eq("es_vigente", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function crearClienteDesdeWhatsApp(
  db: SupabaseClient,
  input: {
    telefono: string;
    nombreNegocio: string;
    tipoNegocio: string;
  }
): Promise<ClienteResuelto> {
  const telefono = normalizarTelefonoWa(input.telefono);
  const tipoClienteId = await resolverTipoClienteId(db, input.tipoNegocio);
  const listaPrecioId = await resolverListaPrecioPorTipo(db, tipoClienteId);

  const { data, error } = await db
    .from("clientes")
    .insert({
      nombre_negocio: input.nombreNegocio.trim(),
      propietario: null,
      telefono,
      whatsapp: telefono,
      direccion: null,
      observaciones: ESTADO_VALIDACION_PENDIENTE,
      tipo_cliente_id: tipoClienteId,
      lista_precio_id: listaPrecioId,
      activo: true,
      limite_credito: 10000,
    })
    .select(
      "id, nombre_negocio, propietario, tipo_cliente_id, lista_precio_id, limite_credito, telefono, whatsapp, activo"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar el cliente.");
  }

  return data as ClienteResuelto;
}

export async function registrarAlertaComercial(
  db: SupabaseClient,
  input: {
    clienteId: string;
    pedidoId?: string | null;
    tipo: string;
    detalle: string;
  }
): Promise<void> {
  const marca = `[ALERTA WhatsApp ${new Date().toISOString()}] ${input.tipo}: ${input.detalle}`;

  console.log(
    JSON.stringify({
      event: "whatsapp_alerta_comercial",
      destinatario: "Arturo",
      cliente_id: input.clienteId,
      pedido_id: input.pedidoId ?? null,
      tipo: input.tipo,
      detalle: input.detalle,
    })
  );

  const { data: cliente } = await db
    .from("clientes")
    .select("observaciones")
    .eq("id", input.clienteId)
    .maybeSingle();

  const observacionesPrevias = (cliente?.observaciones as string | null) ?? "";
  const observaciones = observacionesPrevias
    ? `${observacionesPrevias}\n${marca}`
    : marca;

  await db
    .from("clientes")
    .update({ observaciones })
    .eq("id", input.clienteId);

  if (input.pedidoId) {
    const { data: pedido } = await db
      .from("pedidos")
      .select("observaciones")
      .eq("id", input.pedidoId)
      .maybeSingle();

    const obsPedido = (pedido?.observaciones as string | null) ?? "";
    await db
      .from("pedidos")
      .update({
        observaciones: obsPedido ? `${obsPedido}\n${marca}` : marca,
      })
      .eq("id", input.pedidoId);
  }
}
