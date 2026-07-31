import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";
import {
  clienteParticipaWhatsApp,
  resolverClientePorTelefono,
} from "@/lib/whatsapp/client-resolver";
import {
  obtenerOCrearConversacion,
  actualizarUltimoMensajeConversacion,
} from "@/lib/whatsapp/conversation-repository";
import {
  guardarMensajeEntrante,
  guardarMensajeSaliente,
  marcarMensajeProcesado,
  mensajeYaProcesado,
} from "@/lib/whatsapp/message-repository";
import { enviarMensajeTextoWhatsApp } from "@/lib/whatsapp/outbound-messenger";
import { crearPedidoDesdeMensajeWhatsApp } from "@/lib/whatsapp/pedido-desde-mensaje";
import { obtenerWhatsAppConfig } from "@/lib/whatsapp/config-repository";
import { resolverListaPrecioCliente } from "@/lib/lista-precio-vigente";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-validator";
import { extraerMensajesTexto } from "@/lib/whatsapp/webhook-validator";

const MENSAJE_NO_REGISTRADO =
  "Hola. Tu número no está registrado en nuestro sistema. Comunícate con la empresa para darte de alta y poder realizar pedidos por WhatsApp.";

const MENSAJE_NO_PARTICIPANTE =
  "Hola. Tu número está registrado pero aún no está habilitado para pedidos por WhatsApp. Comunícate con la empresa para activar este servicio.";

const MENSAJE_NO_INTERPRETADO =
  "Recibimos tu mensaje pero no pudimos interpretarlo automáticamente. Escribe tu pedido con cantidad y producto, por ejemplo: 5 costillas o 10 kg molida.";

const MENSAJE_REQUIERE_IA =
  "Recibimos tu mensaje. Los pedidos con referencias como \"lo de siempre\" se procesarán próximamente. Por ahora escribe cantidad y producto, por ejemplo: 5 costillas.";

const MENSAJE_PEDIDO_CREADO =
  "Tu pedido fue registrado correctamente. Gracias.";

export class WhatsAppService {
  private db: SupabaseClient | null = null;

  private obtenerDb(): SupabaseClient {
    if (!this.db) {
      this.db = obtenerSupabaseAdmin();
    }
    return this.db;
  }

  async procesarWebhook(payload: WhatsAppWebhookPayload) {
    const db = this.obtenerDb();
    const config = await obtenerWhatsAppConfig(db);

    if (!config?.activo) {
      return { procesados: 0, omitido: "integracion_inactiva" };
    }

    const mensajes = extraerMensajesTexto(payload);
    let procesados = 0;

    for (const mensaje of mensajes) {
      const yaExiste = await mensajeYaProcesado(db, mensaje.waMessageId);
      if (yaExiste) continue;

      await this.procesarMensajeEntrante({
        from: mensaje.from,
        waMessageId: mensaje.waMessageId,
        texto: mensaje.texto,
        phoneNumberId: config.phone_number_id ?? mensaje.phoneNumberId ?? null,
      });

      procesados += 1;
    }

    return { procesados };
  }

  async procesarMensajeEntrante(input: {
    from: string;
    waMessageId: string;
    texto: string;
    phoneNumberId: string | null;
  }) {
    const db = this.obtenerDb();
    const config = await obtenerWhatsAppConfig(db);
    const phoneNumberId = input.phoneNumberId ?? config?.phone_number_id ?? null;

    const cliente = await resolverClientePorTelefono(db, input.from);
    const conversacion = await obtenerOCrearConversacion(
      db,
      input.from,
      cliente?.id ?? null
    );

    const registro = await guardarMensajeEntrante(db, {
      conversationId: conversacion.id,
      waMessageId: input.waMessageId,
      contenido: input.texto,
      payloadRaw: input,
    });

    await actualizarUltimoMensajeConversacion(db, conversacion.id);

    if (!cliente) {
      await this.responderTexto({
        to: input.from,
        body: MENSAJE_NO_REGISTRADO,
        conversationId: conversacion.id,
        phoneNumberId,
      });

      await marcarMensajeProcesado(db, registro.id, {
        error: "numero_no_registrado",
      });

      return { estado: "numero_no_registrado" as const };
    }

    const participa = await clienteParticipaWhatsApp(db, cliente.id);

    if (!participa) {
      await this.responderTexto({
        to: input.from,
        body: MENSAJE_NO_PARTICIPANTE,
        conversationId: conversacion.id,
        phoneNumberId,
      });

      await marcarMensajeProcesado(db, registro.id, {
        error: "cliente_no_participante",
      });

      return { estado: "cliente_no_participante" as const };
    }

    const { lista } = await resolverListaPrecioCliente(
      cliente.tipo_cliente_id,
      cliente.lista_precio_id,
      db
    );

    const resultado = await crearPedidoDesdeMensajeWhatsApp(db, {
      cliente,
      mensajeOriginal: input.texto,
      listaPrecioId: lista?.id ?? null,
    });

    if (resultado.ok) {
      await marcarMensajeProcesado(db, registro.id, {
        pedidoId: resultado.pedidoId,
      });

      await this.responderTexto({
        to: input.from,
        body: MENSAJE_PEDIDO_CREADO,
        conversationId: conversacion.id,
        phoneNumberId,
      });

      return { estado: "pedido_creado" as const, pedidoId: resultado.pedidoId };
    }

    const mensajeRespuesta =
      "requiereIa" in resultado && resultado.requiereIa
        ? MENSAJE_REQUIERE_IA
        : MENSAJE_NO_INTERPRETADO;

    await this.responderTexto({
      to: input.from,
      body: mensajeRespuesta,
      conversationId: conversacion.id,
      phoneNumberId,
    });

    await marcarMensajeProcesado(db, registro.id, {
      error: resultado.error,
    });

    return { estado: "no_interpretado" as const, error: resultado.error };
  }

  async enviarMensaje(input: {
    to: string;
    body: string;
    phoneNumberId?: string | null;
  }) {
    const db = this.obtenerDb();
    const config = await obtenerWhatsAppConfig(db);
    const phoneNumberId =
      input.phoneNumberId ?? config?.phone_number_id ?? null;

    const cliente = await resolverClientePorTelefono(db, input.to);
    const conversacion = await obtenerOCrearConversacion(
      db,
      input.to,
      cliente?.id ?? null
    );

    return this.responderTexto({
      to: input.to,
      body: input.body,
      conversationId: conversacion.id,
      phoneNumberId,
    });
  }

  private async responderTexto(input: {
    to: string;
    body: string;
    conversationId: string;
    phoneNumberId: string | null;
  }) {
    const db = this.obtenerDb();
    const resultado = await enviarMensajeTextoWhatsApp({
      to: input.to,
      body: input.body,
      phoneNumberId: input.phoneNumberId,
    });

    if (resultado.ok) {
      await guardarMensajeSaliente(db, {
        conversationId: input.conversationId,
        waMessageId: resultado.waMessageId,
        contenido: input.body,
      });
    }

    return resultado;
  }
}

let instanciaWhatsApp: WhatsAppService | null = null;

export function obtenerWhatsAppService(): WhatsAppService {
  if (!instanciaWhatsApp) {
    instanciaWhatsApp = new WhatsAppService();
  }
  return instanciaWhatsApp;
}
