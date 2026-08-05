import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverClientePorTelefono } from "../repositories/client.repository.ts";
import type { ClienteResuelto } from "../types.ts";

/**
 * Motivos de acceso denegado al flujo conversacional.
 * Sprint futuro: implementar "cliente_no_habilitado" vía whatsapp_clientes_participantes.
 */
export type MotivoAccesoDenegado =
  | "cliente_no_encontrado"
  | "cliente_no_habilitado";

export type ResultadoAutorizacionWhatsApp =
  | { permitido: true; cliente: ClienteResuelto }
  | { permitido: false; motivo: MotivoAccesoDenegado };

/** Puerto de autorización. El Conversation Engine no conoce tablas ni reglas de acceso. */
export type AutorizadorWhatsApp = {
  autorizar(waPhone: string): Promise<ResultadoAutorizacionWhatsApp>;
};

/**
 * Sprint 1: acceso si el teléfono coincide con un cliente activo en `clientes`.
 * No consulta whatsapp_clientes_participantes.
 */
export function crearAutorizadorPorClienteRegistrado(
  db: SupabaseClient
): AutorizadorWhatsApp {
  return {
    async autorizar(waPhone: string): Promise<ResultadoAutorizacionWhatsApp> {
      const cliente = await resolverClientePorTelefono(db, waPhone);

      if (!cliente) {
        return { permitido: false, motivo: "cliente_no_encontrado" };
      }

      return { permitido: true, cliente };
    },
  };
}

/**
 * Punto de ensamblaje del autorizador activo.
 * En el sprint de participantes, cambiar solo esta fábrica (o componer estrategias).
 */
export function crearAutorizadorWhatsApp(db: SupabaseClient): AutorizadorWhatsApp {
  return crearAutorizadorPorClienteRegistrado(db);
}

export function clienteIdDesdeAutorizacion(
  acceso: ResultadoAutorizacionWhatsApp
): string | null {
  return acceso.permitido ? acceso.cliente.id : null;
}
