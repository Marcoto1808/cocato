import type { SupabaseClient } from "@supabase/supabase-js";
import { carritoVacio, type CarritoConversacion } from "@/lib/whatsapp/conversation-cart";
import {
  crearClienteDesdeWhatsApp,
  parsearDatosRegistro,
} from "@/lib/whatsapp/cliente-registro";
import {
  construirBienvenidaRegistro,
  construirMenuPostRegistro,
  MENSAJE_REGISTRO_INVALIDO,
  type EstadoComercialConversacion,
} from "@/lib/whatsapp/conversation-states";
import type { ResultadoTurnoConversacion } from "@/lib/whatsapp/services/conversation-turn.types";

export class ClienteRegistroService {
  constructor(private readonly db: SupabaseClient) {}

  async procesarTurno(input: {
    waTelefono: string;
    mensajeRecibido: string;
    estadoAnterior: EstadoComercialConversacion;
    carrito: CarritoConversacion;
  }): Promise<ResultadoTurnoConversacion> {
    if (input.estadoAnterior === "REGISTRO_CLIENTE") {
      return this.completarRegistro(input.waTelefono, input.mensajeRecibido, input.carrito);
    }

    return this.iniciarRegistro(input.waTelefono, input.carrito);
  }

  private async completarRegistro(
    waTelefono: string,
    mensajeRecibido: string,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    const datos = parsearDatosRegistro(mensajeRecibido);
    if (!datos) {
      return {
        respuesta: MENSAJE_REGISTRO_INVALIDO,
        estadoNuevo: "REGISTRO_CLIENTE",
        carrito,
      };
    }

    const cliente = await crearClienteDesdeWhatsApp(this.db, {
      telefono: waTelefono,
      nombreNegocio: datos.nombreNegocio,
      tipoNegocio: datos.tipoNegocio,
    });

    return {
      respuesta: construirMenuPostRegistro(),
      estadoNuevo: "MENU_PRINCIPAL",
      carrito: carritoVacio(),
      clienteId: cliente.id,
    };
  }

  private iniciarRegistro(
    waTelefono: string,
    carrito: CarritoConversacion
  ): ResultadoTurnoConversacion {
    return {
      respuesta: construirBienvenidaRegistro(),
      estadoNuevo: "REGISTRO_CLIENTE",
      carrito: {
        ...carrito,
        registro: { telefono: waTelefono },
      },
    };
  }
}
