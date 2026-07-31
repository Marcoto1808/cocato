import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluarCreditoCliente, MENSAJE_CREDITO_EXCEDIDO } from "@/lib/cliente-credito";
import { calcularTotalLineas } from "@/lib/pedido-calculo";
import { lineaTieneCantidadValida } from "@/lib/pedido-cantidad";
import type {
  CrearPedidoInput,
  CrearPedidoResultado,
} from "@/lib/pedidos/pedido-types";

function formatearErrorSupabase(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null): string {
  if (!error) return "Error desconocido.";
  return [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" | ");
}

export async function crearPedido(
  db: SupabaseClient,
  input: CrearPedidoInput
): Promise<CrearPedidoResultado> {
  if (!input.cliente_id?.trim()) {
    return { ok: false, error: "Cliente requerido." };
  }

  if (input.lineas.length === 0) {
    return { ok: false, error: "Agrega al menos un producto al pedido." };
  }

  const lineasInvalidas = input.lineas.filter(
    (linea) =>
      !lineaTieneCantidadValida(
        linea.cantidad_solicitada,
        linea.cantidad_texto
      )
  );

  if (lineasInvalidas.length > 0) {
    return { ok: false, error: "Todas las líneas deben tener una cantidad válida." };
  }

  const validarCredito = input.validarCredito ?? true;

  if (validarCredito) {
    try {
      const evaluacion = await evaluarCreditoCliente(
        input.cliente_id,
        Number(input.limite_credito ?? 0),
        db
      );

      if (!evaluacion.permitido) {
        return {
          ok: false,
          error: evaluacion.mensaje ?? MENSAJE_CREDITO_EXCEDIDO,
        };
      }
    } catch {
      return {
        ok: false,
        error: "No se pudo validar el crédito del cliente.",
      };
    }
  }

  const totalCalculado = calcularTotalLineas(
    input.lineas.map((linea) => ({ subtotal: linea.subtotal }))
  );
  const total = input.total > 0 ? input.total : totalCalculado;

  const { data: pedido, error: pedidoError } = await db
    .from("pedidos")
    .insert({
      cliente_id: input.cliente_id,
      tipo_cliente_id: input.tipo_cliente_id,
      lista_precio_id: input.lista_precio_id,
      estado: "Pendiente",
      fecha: new Date().toISOString(),
      mensaje_original: input.mensaje_original,
      observaciones: input.observaciones?.trim() || null,
      cliente_nombre_temporal: input.cliente_nombre_temporal?.trim() || null,
      cliente_telefono_temporal: input.cliente_telefono_temporal?.trim() || null,
      total,
      origen: input.origen,
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    return {
      ok: false,
      error: `No se pudo crear el pedido. ${formatearErrorSupabase(pedidoError)}`,
    };
  }

  const detallePayload = input.lineas.map((linea) => ({
    pedido_id: pedido.id,
    producto_id: linea.producto_id,
    cantidad_solicitada: linea.cantidad_solicitada,
    cantidad_texto: linea.cantidad_texto,
    unidad: linea.unidad,
    tipo_calculo: linea.tipo_calculo,
    peso_real: linea.peso_real ?? null,
    precio_lista: linea.precio_lista,
    precio_aplicado: linea.precio_aplicado,
    precio_modificado: linea.precio_modificado,
    subtotal: linea.subtotal,
  }));

  const { error: detalleError } = await db
    .from("detalle_pedido")
    .insert(detallePayload);

  if (detalleError) {
    await db.from("pedidos").delete().eq("id", pedido.id);
    return {
      ok: false,
      error: `No se pudo guardar el detalle. ${formatearErrorSupabase(detalleError)}`,
    };
  }

  return { ok: true, pedidoId: pedido.id };
}
