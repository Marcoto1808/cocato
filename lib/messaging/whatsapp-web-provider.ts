import { jidATelefono, telefonoAJid } from "@/lib/messaging/phone-jid";
import { resolverEjecutablePuppeteer } from "@/lib/messaging/puppeteer-executable";
import type {
  InboundWhatsAppMessage,
  MessagingProvider,
  SendMessageInput,
  SendMessageResult,
  VerifyConnectionResult,
} from "@/lib/messaging/types";

type WhatsAppWebClient = {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  sendMessage(
    chatId: string,
    content: string
  ): Promise<{ id: { id: string; _serialized?: string } }>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  once(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  eventNames(): Array<string | symbol>;
  listenerCount(event: string | symbol): number;
  info?: { wid?: { user?: string } };
};

type WhatsAppWebClientInternal = WhatsAppWebClient & {
  attachEventListeners?: () => Promise<void>;
  pupPage?: {
    evaluate<T>(fn: string | (() => T | Promise<T>)): Promise<T>;
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
};

type WhatsAppWebMessage = {
  from: string;
  fromMe?: boolean;
  body?: string;
  type?: string;
  timestamp?: number;
  id?: { id?: string; _serialized?: string };
  notifyName?: string;
};

type WhatsAppWebModule = {
  Client: new (options: {
    authStrategy: unknown;
    authTimeoutMs?: number;
    takeoverOnConflict?: boolean;
    takeoverTimeoutMs?: number;
    webVersionCache?: { type: string; path?: string };
    puppeteer?: {
      headless?: boolean;
      args?: string[];
      executablePath?: string;
    };
  }) => WhatsAppWebClient;
  LocalAuth: new (options?: { dataPath?: string }) => unknown;
};

const READY_FALLBACK_MS = Number(
  process.env.WHATSAPP_WEB_READY_FALLBACK_MS ?? 15_000
);
const READY_TIMEOUT_MS = Number(
  process.env.WHATSAPP_WEB_READY_TIMEOUT_MS ?? 180_000
);

export class WhatsAppWebProvider implements MessagingProvider {
  readonly id = "whatsapp-web" as const;

  private client: WhatsAppWebClientInternal | null = null;
  private ready = false;
  private readyMarcado = false;
  private autenticado = false;
  private ultimoLoadingPercent: number | null = null;
  private ultimoEstado: string | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private fallbackReadyTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
  private mensajesRegistrados = false;

  private inboundHandlers: Array<
    (message: InboundWhatsAppMessage) => void | Promise<void>
  > = [];
  private qrHandlers: Array<(qr: string) => void> = [];
  private readyHandlers: Array<(origen: string) => void> = [];
  private authenticatedHandlers: Array<() => void> = [];
  private disconnectedHandlers: Array<(reason: string) => void> = [];

  private readonly sessionPath =
    process.env.WHATSAPP_WEB_SESSION_PATH?.trim() || ".wwebjs_auth";

  isReady(): boolean {
    return this.ready;
  }

  isAutenticado(): boolean {
    return this.autenticado;
  }

  onInboundMessage(
    handler: (message: InboundWhatsAppMessage) => void | Promise<void>
  ): void {
    this.inboundHandlers.push(handler);
  }

  onQr(handler: (qr: string) => void): void {
    this.qrHandlers.push(handler);
  }

  onReady(handler: (origen?: string) => void): void {
    this.readyHandlers.push(handler);
  }

  onAuthenticated(handler: () => void): void {
    this.authenticatedHandlers.push(handler);
  }

  onDisconnected(handler: (reason: string) => void): void {
    this.disconnectedHandlers.push(handler);
  }

  async start(): Promise<void> {
    if (this.client) return;

    const wwebMod = await import("whatsapp-web.js");
    const wweb = (wwebMod.default ?? wwebMod) as WhatsAppWebModule;
    const { Client, LocalAuth } = wweb;

    const executablePath = await resolverEjecutablePuppeteer();

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: this.sessionPath }),
      authTimeoutMs: 120_000,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 10_000,
      webVersionCache: {
        type: "local",
        path: ".wwebjs_cache",
      },
      puppeteer: {
        headless: true,
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    });

    this.registrarEventosCicloDeVida();

    const promesaReady = this.crearPromesaReady();

    try {
      console.log("A - ANTES initialize");

      await this.client.initialize();

      console.log("B - DESPUÉS initialize");

      this.logEvento("whatsapp_web_initialize_ok", {
        mensaje:
          "Navegador iniciado; registrando listeners inmediatamente después de initialize().",
      });
    } catch (error) {
      this.limpiarEsperaReady(
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }

    this.registrarConsolaNavegador();
    await this.attachListeners("post_initialize");

    console.log("C - DESPUÉS attachListeners");

    await promesaReady;
  }

  async stop(): Promise<void> {
    this.limpiarTimersFallback();
    this.limpiarEsperaReady();
    this.ready = false;
    this.readyMarcado = false;
    this.autenticado = false;

    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }

  async sendTextMessage(input: SendMessageInput): Promise<SendMessageResult> {
    if (!this.client || !this.ready) {
      return {
        ok: false,
        error: "WhatsApp Web no está conectado. Escanea el QR primero.",
      };
    }

    try {
      const chatId = telefonoAJid(input.to);
      const sent = await this.client.sendMessage(chatId, input.body);
      const waMessageId =
        sent.id._serialized ?? sent.id.id ?? `wweb-${Date.now()}`;

      this.logEvento("whatsapp_web_outbound_ok", {
        to: jidATelefono(chatId),
        wa_message_id: waMessageId,
      });

      return { ok: true, waMessageId };
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : "Error al enviar mensaje.";

      this.logEvento("whatsapp_web_outbound_error", {
        to: input.to,
        error: detalle,
      });

      return { ok: false, error: detalle };
    }
  }

  async verifyConnection(): Promise<VerifyConnectionResult> {
    if (!this.ready) {
      return {
        ok: false,
        detalle: this.autenticado
          ? "WhatsApp autenticado pero aún sincronizando. Espera el evento ready."
          : "WhatsApp Web no conectado. Ejecuta npm run whatsapp-web y escanea el QR.",
      };
    }

    const numero = this.client?.info?.wid?.user;
    return {
      ok: true,
      detalle: numero
        ? `WhatsApp Web conectado (${numero})`
        : "WhatsApp Web conectado",
    };
  }

  /** Engancha listeners internos de whatsapp-web.js y eventos de mensajes del bridge. */
  private async attachListeners(origen: string): Promise<void> {
    this.logEvento("whatsapp_web_attach_listeners_llamado", { origen });
    await this.ejecutarAttachListeners(origen);
  }

  private async ejecutarAttachListeners(origen: string): Promise<void> {
    console.log("ATTACH LISTENERS EJECUTADO", origen);
    this.logEvento("whatsapp_web_attach_listeners_inicio", { origen });

    if (!this.client) {
      console.log("ATTACH LISTENERS ABORTADO: client es null", origen);
      this.logEvento("whatsapp_web_attach_listeners_abortado", {
        origen,
        razon: "client_null",
      });
      return;
    }

    await this.engancharListenersInternosWaWeb(origen);
    this.registrarEventosMensajes(origen);
    this.logDiagnosticoListeners(origen);

    console.log("LISTENERS REGISTRADOS", origen);
    this.logEvento("whatsapp_web_attach_listeners_fin", { origen });
  }

  private registrarEventosCicloDeVida(): void {
    if (!this.client) return;

    this.client.on("qr", (qr: unknown) => {
      if (this.autenticado || this.ready) {
        this.logEvento("whatsapp_web_qr_ignorado", {
          razon: "Sesión ya autenticada; QR renovado por whatsapp-web.js.",
        });
        return;
      }

      const codigo = String(qr);
      for (const handler of this.qrHandlers) handler(codigo);
    });

    this.client.on("ready", () => {
      this.logEvento("whatsapp_web_evento_ready_recibido", {
        nota: "Evento ready de whatsapp-web.js; invocando marcarComoReady.",
      });
      void this.marcarComoReady("evento_ready");
    });

    this.client.on("authenticated", (payload: unknown) => {
      this.autenticado = true;
      this.logEvento("whatsapp_web_authenticated", {
        payload:
          payload && typeof payload === "object"
            ? payload
            : payload ?? null,
        ultimo_loading_percent: this.ultimoLoadingPercent,
        ultimo_estado: this.ultimoEstado,
      });

      for (const handler of this.authenticatedHandlers) handler();
      this.programarFallbackReady("authenticated");
    });

    this.client.on("auth_failure", (message: unknown) => {
      this.logEvento("whatsapp_web_auth_failure", {
        message: String(message),
        ultimo_loading_percent: this.ultimoLoadingPercent,
        ultimo_estado: this.ultimoEstado,
      });
      this.limpiarEsperaReady(new Error(`auth_failure: ${String(message)}`));
    });

    this.client.on("loading_screen", (percent: unknown, message: unknown) => {
      const pct = Number(percent);
      if (!Number.isNaN(pct)) {
        this.ultimoLoadingPercent = pct;
      }

      this.logEvento("whatsapp_web_loading_screen", {
        percent: this.ultimoLoadingPercent,
        message: String(message ?? ""),
        autenticado: this.autenticado,
        ready: this.ready,
      });

      if (this.autenticado && this.ultimoLoadingPercent === 100) {
        this.programarFallbackReady("loading_screen_100");
      }
    });

    this.client.on("change_state", (state: unknown) => {
      console.log("🔥 CHANGE_STATE:", state);
      this.ultimoEstado = String(state);
      this.logEvento("whatsapp_web_change_state", {
        state: this.ultimoEstado,
        autenticado: this.autenticado,
        ready: this.ready,
      });

      if (
        this.autenticado &&
        !this.readyMarcado &&
        this.ultimoEstado === "CONNECTED"
      ) {
        this.programarFallbackReady("change_state_connected");
      }
    });

    this.client.on("disconnected", (reason: unknown) => {
      console.log("🔥 DISCONNECTED:", reason);
      this.ready = false;
      this.readyMarcado = false;
      this.autenticado = false;
      this.limpiarTimersFallback();

      const texto = String(reason);
      this.logEvento("whatsapp_web_disconnected", {
        reason: texto,
      });

      for (const handler of this.disconnectedHandlers) handler(texto);
    });
  }

  private registrarConsolaNavegador(): void {
    if (!this.client?.pupPage) {
      this.logEvento("whatsapp_web_browser_console_omitido", {
        razon: "pupPage no disponible tras initialize()",
      });
      return;
    }

    this.client.pupPage.on("console", (msg: unknown) => {
      const consoleMsg = msg as { type?: () => string; text?: () => string };
      const tipo = consoleMsg.type?.() ?? "log";
      const texto = consoleMsg.text?.() ?? String(msg);

      if (
        tipo === "error" ||
        texto.includes("WWebJS") ||
        texto.includes("ready timeout") ||
        texto.includes("WAWeb")
      ) {
        this.logEvento("whatsapp_web_browser_console", { tipo, texto });
      }
    });
  }

  private crearPromesaReady(): Promise<void> {
    if (this.readyMarcado) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;

      this.readyTimeout = setTimeout(() => {
        void this.intentarReadyFallback("ready_timeout").then((ok) => {
          if (ok) return;
          this.limpiarEsperaReady(
            new Error(
              `whatsapp-web.js no emitió 'ready' en ${READY_TIMEOUT_MS}ms (autenticado=${this.autenticado}, loading=${this.ultimoLoadingPercent}, state=${this.ultimoEstado})`
            )
          );
        });
      }, READY_TIMEOUT_MS);
    });
  }

  private programarFallbackReady(origen: string): void {
    if (this.readyMarcado) return;

    this.limpiarTimersFallback();

    this.fallbackReadyTimer = setTimeout(() => {
      void this.intentarReadyFallback(origen);
    }, READY_FALLBACK_MS);

    this.fallbackPollTimer = setInterval(() => {
      void this.intentarReadyFallback(`${origen}_poll`);
    }, 3_000);
  }

  private async intentarReadyFallback(origen: string): Promise<boolean> {
    if (this.readyMarcado || !this.client?.pupPage || !this.autenticado) {
      return false;
    }

    try {
      const estado = await this.client.pupPage.evaluate(() => {
        const w = window as unknown as {
          WWebJS?: unknown;
          require?: (id: string) => {
            Socket?: { state?: string; hasSynced?: boolean };
          };
        };
        const socket = w.require?.("WAWebSocketModel")?.Socket;
        return {
          hasWWebJS: typeof w.WWebJS !== "undefined",
          state: socket?.state ?? null,
          hasSynced: Boolean(socket?.hasSynced),
        };
      });

      this.logEvento("whatsapp_web_ready_fallback_check", {
        origen,
        ...estado,
      });

      if (
        estado.hasWWebJS &&
        (estado.state === "CONNECTED" || estado.hasSynced)
      ) {
        await this.marcarComoReady(`fallback:${origen}`);
        return true;
      }
    } catch (error) {
      this.logEvento("whatsapp_web_ready_fallback_error", {
        origen,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return false;
  }

  private async marcarComoReady(origen: string): Promise<void> {
    if (this.readyMarcado) {
      this.logEvento("whatsapp_web_ready_omitido", {
        origen,
        razon: "readyMarcado ya es true",
      });
      await this.attachListeners(`ready_reintento:${origen}`);
      return;
    }

    this.readyMarcado = true;
    this.ready = true;
    this.limpiarTimersFallback();
    this.limpiarEsperaReady();

    await this.attachListeners(`ready:${origen}`);

    const numero = this.client?.info?.wid?.user ?? "desconocido";
    this.logEvento("whatsapp_web_ready", {
      origen,
      numero,
      ultimo_loading_percent: this.ultimoLoadingPercent,
      ultimo_estado: this.ultimoEstado,
    });

    for (const handler of this.readyHandlers) handler(origen);
  }

  private async engancharListenersInternosWaWeb(origen: string): Promise<void> {
    if (!this.client?.attachEventListeners) {
      this.logEvento("whatsapp_web_attach_listeners_omitido", {
        origen,
        razon: "attachEventListeners no disponible en el cliente",
      });
      return;
    }

    this.logEvento("whatsapp_web_attach_listeners_skipped", {
      origen,
      razon: "Diagnóstico temporal: no ejecutar attachEventListeners()",
    });
    return;

    try {
      await this.client.attachEventListeners();
      this.logEvento("whatsapp_web_attach_listeners_ok", { origen });
    } catch (error) {
      this.logEvento("whatsapp_web_attach_listeners_error", {
        origen,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private registrarEventosMensajes(origen: string): void {
    if (!this.client) {
      this.logEvento("whatsapp_web_message_listeners_abortado", {
        origen,
        razon: "client_null",
      });
      return;
    }

    if (this.mensajesRegistrados) {
      this.logEvento("whatsapp_web_message_listeners_ya_registrados", {
        origen,
        message_listener_count: this.client.listenerCount("message"),
      });
      return;
    }

    this.mensajesRegistrados = true;

    this.client.on("message", (raw: unknown) => {
      console.log("🔥 EVENTO MESSAGE DISPARADO");
      this.logEventoMensaje("message", raw);
      void this.procesarMensajeEntrante(raw as WhatsAppWebMessage);
    });

    this.client.on("message_create", (raw: unknown) => {
      console.log("🔥 EVENTO MESSAGE_CREATE DISPARADO");
      this.logEventoMensaje("message_create", raw);
    });

    this.client.on("message_ciphertext", (raw: unknown) => {
      this.logEventoMensaje("message_ciphertext", raw);
    });

    this.client.on("message_ack", (raw: unknown, ack: unknown) => {
      this.logEventoMensaje("message_ack", raw, { ack });
    });

    this.client.on("call", (raw: unknown) => {
      this.logEventoMensaje("incoming_call", raw);
    });

    this.logEvento("whatsapp_web_message_listeners_registrados", {
      origen,
      message_listener_count: this.client.listenerCount("message"),
    });
  }

  private logEventoMensaje(
    evento: string,
    raw: unknown,
    extra: Record<string, unknown> = {}
  ): void {
    const msg = this.normalizarMensajeRaw(raw);
    this.logEvento(`whatsapp_web_${evento}`, {
      from: msg.from,
      fromMe: msg.fromMe,
      type: msg.type,
      body_preview: msg.body?.slice(0, 120),
      wa_message_id: msg.waMessageId,
      ...extra,
    });
  }

  private normalizarMensajeRaw(raw: unknown): {
    from?: string;
    fromMe?: boolean;
    type?: string;
    body?: string;
    waMessageId?: string;
  } {
    if (!raw || typeof raw !== "object") {
      return {};
    }

    const msg = raw as WhatsAppWebMessage & {
      fromMe?: boolean;
      id?: { id?: string; _serialized?: string };
    };

    return {
      from: msg.from,
      fromMe: msg.fromMe,
      type: msg.type,
      body: typeof msg.body === "string" ? msg.body : undefined,
      waMessageId: msg.id?._serialized ?? msg.id?.id,
    };
  }

  private logDiagnosticoListeners(origen: string): void {
    if (!this.client) return;

    const eventNames = this.client.eventNames().map(String);
    this.logEvento("whatsapp_web_client_event_names", {
      origen,
      event_names: eventNames,
      message_listener_count: this.client.listenerCount("message"),
      message_create_listener_count: this.client.listenerCount("message_create"),
      message_ciphertext_listener_count:
        this.client.listenerCount("message_ciphertext"),
      message_ack_listener_count: this.client.listenerCount("message_ack"),
      incoming_call_listener_count: this.client.listenerCount("call"),
    });
  }

  private limpiarTimersFallback(): void {
    if (this.fallbackReadyTimer) {
      clearTimeout(this.fallbackReadyTimer);
      this.fallbackReadyTimer = null;
    }
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
  }

  private limpiarEsperaReady(error?: Error): void {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }

    if (error) {
      this.rejectReady?.(error);
    } else {
      this.resolveReady?.();
    }

    this.resolveReady = null;
    this.rejectReady = null;
  }

  private logEvento(
    event: string,
    datos: Record<string, unknown> = {}
  ): void {
    console.log(JSON.stringify({ event, ...datos }));
  }

  private async procesarMensajeEntrante(msg: WhatsAppWebMessage): Promise<void> {
    const normalizado = this.normalizarMensajeRaw(msg);

    if (msg.fromMe) {
      this.logEvento("whatsapp_web_inbound_omitido", {
        razon: "fromMe",
        ...normalizado,
      });
      return;
    }

    if (!msg.from?.endsWith("@c.us") && !msg.from?.endsWith("@lid")) {
      this.logEvento("whatsapp_web_inbound_omitido", {
        razon: "from_no_es_chat_privado",
        from: msg.from,
      });
      return;
    }

    if (msg.type && msg.type !== "chat") {
      this.logEvento("whatsapp_web_inbound_omitido", {
        razon: "tipo_no_chat",
        type: msg.type,
        from: msg.from,
      });
      return;
    }

    const texto = msg.body?.trim();
    if (!texto) {
      this.logEvento("whatsapp_web_inbound_omitido", {
        razon: "sin_texto",
        from: msg.from,
        type: msg.type,
      });
      return;
    }

    const waMessageId = msg.id?._serialized ?? msg.id?.id;
    if (!waMessageId) {
      this.logEvento("whatsapp_web_inbound_omitido", {
        razon: "sin_wa_message_id",
        from: msg.from,
      });
      return;
    }

    const inbound: InboundWhatsAppMessage = {
      from: jidATelefono(msg.from),
      waMessageId,
      texto,
      timestamp: msg.timestamp
        ? new Date(msg.timestamp * 1000).toISOString()
        : undefined,
      nombreContacto: msg.notifyName,
    };

    this.logEvento("whatsapp_web_inbound", {
      from: inbound.from,
      wa_message_id: inbound.waMessageId,
      texto_preview: inbound.texto.slice(0, 80),
    });

    for (const handler of this.inboundHandlers) {
      await handler(inbound);
    }
  }
}
