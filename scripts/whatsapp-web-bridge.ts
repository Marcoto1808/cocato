/**
 * Bridge WhatsApp Web → Conversation Engine
 *
 * Proceso Node independiente. No usa Edge Function ni YCloud.
 *
 * Ejecutar: npm run whatsapp-web
 * (desde la raíz del repo, con MESSAGING_PROVIDER=whatsapp-web en .env.local)
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import qrcode from "qrcode-terminal";
import {
  registrarMessagingProvider,
  WhatsAppWebProvider,
} from "../lib/messaging/index";
import { obtenerWhatsAppService } from "../lib/whatsapp/whatsapp-service";
import { obtenerSupabaseServiceRoleKey } from "../lib/supabase-server-key";

const envPath = resolve(process.cwd(), ".env.local");
config({ path: envPath });

function validarEntorno(): void {
  const faltantes: string[] = [];

  if (!existsSync(envPath)) {
    console.warn(`[whatsapp-web] No se encontró ${envPath}; usando variables del sistema.`);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    faltantes.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!obtenerSupabaseServiceRoleKey()) {
    faltantes.push("SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY");
  }

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables en .env.local: ${faltantes.join(", ")}`
    );
  }
}

async function main() {
  validarEntorno();

  process.env.MESSAGING_PROVIDER = "whatsapp-web";

  console.log("═══════════════════════════════════════════════════════");
  console.log("  DICATO — Bridge WhatsApp Web");
  console.log("  Conversation Engine (sin YCloud en este proceso)");
  console.log("═══════════════════════════════════════════════════════\n");

  const proveedor = new WhatsAppWebProvider();
  registrarMessagingProvider(proveedor);

  proveedor.onQr((qr) => {
    if (proveedor.isAutenticado() || proveedor.isReady()) return;

    console.log("\n┌─────────────────────────────────────────────────────┐");
    console.log("│  QR en esta terminal — escanéalo con el teléfono    │");
    console.log("│  WhatsApp → Dispositivos vinculados → Vincular      │");
    console.log("└─────────────────────────────────────────────────────┘\n");
    qrcode.generate(qr, { small: true });
    console.log("\nEsperando escaneo… (el QR se renovará si expira)\n");
  });

  proveedor.onAuthenticated(() => {
    console.log(
      "\n[whatsapp-web] QR autenticado. Sincronizando sesión (loading_screen → ready)…\n"
    );
  });

  proveedor.onReady((origen) => {
    console.log("\n✓ WhatsApp Web conectado.");
    if (origen) {
      console.log(`  Origen del ready: ${origen}`);
    }
    console.log("  Entrada  → WhatsAppService.procesarMensajeEntrante()");
    console.log("  Salida   → WhatsAppWebProvider.sendTextMessage()");
    console.log("  Envía un mensaje de prueba desde un cliente registrado.\n");
  });

  proveedor.onDisconnected((reason) => {
    console.warn(`\n[whatsapp-web] Desconectado: ${reason}\n`);
  });

  proveedor.onInboundMessage(async (mensaje) => {
    try {
      const servicio = obtenerWhatsAppService();
      const resultado = await servicio.procesarMensajeEntrante({
        from: mensaje.from,
        waMessageId: mensaje.waMessageId,
        texto: mensaje.texto,
        phoneNumberId: null,
      });

      console.log(
        JSON.stringify({
          event: "whatsapp_web_bridge_procesado",
          from: mensaje.from,
          resultado,
        })
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "whatsapp_web_bridge_error",
          from: mensaje.from,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  });

  const cerrar = async () => {
    console.log("\n[whatsapp-web] Cerrando sesión…");
    await proveedor.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void cerrar();
  });
  process.on("SIGTERM", () => {
    void cerrar();
  });

  console.log("[whatsapp-web] Iniciando whatsapp-web.js (primera vez puede tardar 1–2 min)…\n");
  await proveedor.start();
}

main().catch((error) => {
  console.error("\n[whatsapp-web] Error fatal:", error);
  process.exit(1);
});
