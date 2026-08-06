import type { CarritoConversacion } from "../conversation/cart.ts";
import type { EstadoComercialConversacion } from "../conversation/states.ts";

export type ResultadoTurnoConversacion = {
  respuesta: string;
  estadoNuevo: EstadoComercialConversacion;
  carrito: CarritoConversacion;
  clienteId?: string | null;
  delegarConfirmacion?: boolean;
};
