import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  actualizarUltimoMensajeConversacion,
  obtenerOCrearConversacion,
} from "../repositories/conversation.repository.ts";
import {
  clienteParticipaWhatsApp,
  resolverClientePorTelefono,
} from "../repositories/client.repository.ts";
import {
  cargarHistorialConversacion,
  guardarMensajeEntrante,
  guardarMensajeSaliente,
  marcarMensajeConError,
  mensajeYaExiste,
} from "../repositories/message.repository.ts";
import { obtenerWhatsAppConfig } from "../repositories/config.repository.ts";
import { procesarMensajeConPedido } from "./pedido.service.ts";
import type {
  ProcesarMensajeResultado,
  WhatsAppInboundMessage,
} from "../types.ts";
import { enviarMensajeTexto } from "../whatsapp/messenger.ts";

const MENSAJE_NO_REGISTRADO =
  "Hola. Tu número no está registrado en nuestro sistema. Comunícate con la empresa para darte de alta y poder realizar pedidos por WhatsApp.";

const MENSAJE_NO_PARTICIPANTE =
  "Hola. Tu número está registrado pero aún no está habilitado para pedidos por WhatsApp. Comunícate con la empresa para activar este servicio.";

async function responderYGuardar(input: {
  db: SupabaseClient;
  to: string;
  body: string;
  conversationId: string;
  phoneNumberId: string | null;
  inboundMessageId: string;
  pedidoId?: string | null;
}): Promise<ProcesarMensajeResultado> {
  const envio = await enviarMensajeTexto({
    to: input.to,
    body: input.body,
    phoneNumberId: input.phoneNumberId,
  });

  if (!envio.ok) {
    await marcarMensajeConError(input.db, input.inboundMessageId, envio.error);
    return {
      estado: "error",
      error: envio.error,
      messageId: input.inboundMessageId,
    };
  }

  await guardarMensajeSaliente(input.db, {
    conversationId: input.conversationId,
    waMessageId: envio.waMessageId,
    contenido: input.body,
    inboundMessageId: input.inboundMessageId,
    pedidoId: input.pedidoId,
  });

  if (input.pedidoId) {
    return {
      estado: "pedido_creado",
      messageId: input.inboundMessageId,
      respuesta: input.body,
      pedidoId: input.pedidoId,
    };
  }

  return {
    estado: "respondido",
    messageId: input.inboundMessageId,
    respuesta: input.body,
  };
}

export class ChatbotService {
  constructor(private readonly db: SupabaseClient) {}

  async procesarMensajeEntrante(
    mensaje: WhatsAppInboundMessage,
    phoneNumberIdConfig: string | null
  ): Promise<ProcesarMensajeResultado> {
    if (await mensajeYaExiste(this.db, mensaje.waMessageId)) {
      return { estado: "duplicado" };
    }

    const cliente = await resolverClientePorTelefono(this.db, mensaje.from);
    const conversacion = await obtenerOCrearConversacion(
      this.db,
      mensaje.from,
      cliente?.id ?? null
    );

    const registro = await guardarMensajeEntrante(this.db, {
      conversationId: conversacion.id,
      waMessageId: mensaje.waMessageId,
      contenido: mensaje.texto,
      payloadRaw: mensaje,
    });

    if (!registro) {
      return { estado: "duplicado" };
    }

    await actualizarUltimoMensajeConversacion(this.db, conversacion.id);

    const phoneNumberId =
      phoneNumberIdConfig ?? mensaje.phoneNumberId ?? null;

    if (!cliente) {
      return responderYGuardar({
        db: this.db,
        to: mensaje.from,
        body: MENSAJE_NO_REGISTRADO,
        conversationId: conversacion.id,
        phoneNumberId,
        inboundMessageId: registro.id,
      });
    }

    const participa = await clienteParticipaWhatsApp(this.db, cliente.id);

    if (!participa) {
      return responderYGuardar({
        db: this.db,
        to: mensaje.from,
        body: MENSAJE_NO_PARTICIPANTE,
        conversationId: conversacion.id,
        phoneNumberId,
        inboundMessageId: registro.id,
      });
    }

    try {
      const historial = await cargarHistorialConversacion(
        this.db,
        conversacion.id
      );
      const historialSinUltimo = historial.slice(0, -1);

      const resultado = await procesarMensajeConPedido({
        db: this.db,
        cliente,
        mensajeOriginal: mensaje.texto,
        historial: historialSinUltimo,
      });

      return await responderYGuardar({
        db: this.db,
        to: mensaje.from,
        body: resultado.respuesta,
        conversationId: conversacion.id,
        phoneNumberId,
        inboundMessageId: registro.id,
        pedidoId:
          resultado.tipo === "pedido_creado" ? resultado.pedidoId : null,
      });
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : "Error al procesar mensaje.";

      await marcarMensajeConError(this.db, registro.id, detalle);

      const fallback =
        "Recibimos tu mensaje pero tuvimos un problema al procesarlo. Intenta de nuevo en unos minutos.";

      await responderYGuardar({
        db: this.db,
        to: mensaje.from,
        body: fallback,
        conversationId: conversacion.id,
        phoneNumberId,
        inboundMessageId: registro.id,
      });

      return { estado: "error", error: detalle, messageId: registro.id };
    }
  }

  async procesarWebhook(mensajes: WhatsAppInboundMessage[]) {
    const config = await obtenerWhatsAppConfig(this.db);

    if (!config?.activo) {
      return {
        procesados: 0,
        omitido: "integracion_inactiva" as const,
        resultados: [],
      };
    }

    const resultados: ProcesarMensajeResultado[] = [];

    for (const mensaje of mensajes) {
      const resultado = await this.procesarMensajeEntrante(
        mensaje,
        config.phone_number_id
      );
      resultados.push(resultado);
    }

    return { procesados: resultados.length, resultados };
  }
}
