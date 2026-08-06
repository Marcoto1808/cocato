import type { CarritoConversacion } from "@/lib/whatsapp/conversation-cart";
import type { EstadoComercialConversacion } from "@/lib/whatsapp/conversation-states";

/** Resultado estándar de un turno delegado a un servicio de conversación. */
export type ResultadoTurnoConversacion = {
  respuesta: string;
  estadoNuevo: EstadoComercialConversacion;
  carrito: CarritoConversacion;
  clienteId?: string | null;
  /** Indica al engine que debe delegar a ConfirmacionService.preparar(). */
  delegarConfirmacion?: boolean;
};
