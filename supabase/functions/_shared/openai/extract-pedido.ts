import { historialMaxMensajes, openaiApiKey, openaiModel } from "../env.ts";
import type { MensajeHistorial } from "../types.ts";

export type LineaExtraidaIA = {
  producto_id?: string;
  producto_nombre: string;
  cantidad: number;
  unidad: "kg" | "pieza";
  cantidad_texto?: string;
  texto_original?: string;
};

export type AnalisisPedidoIA = {
  es_pedido: boolean;
  lineas: LineaExtraidaIA[];
  observaciones: string | null;
  respuesta_cliente: string;
  motivo_no_pedido: string | null;
};

const PROMPT_EXTRACCION = `Eres el asistente de pedidos de DICATO (carnicería).
Analiza el mensaje del cliente y responde SOLO con JSON válido (sin markdown).

Reglas:
- es_pedido: true si el cliente está pidiendo productos con cantidades.
- es_pedido: false si saluda, pregunta horarios, agradece, o no hay productos claros.
- lineas: solo productos del catálogo provisto. Usa el nombre más cercano del catálogo.
- cantidad: número decimal positivo.
- unidad: "kg" para peso, "pieza" para piezas/pz/paquetes contados por pieza.
- observaciones: notas del cliente (entrega, corte especial, etc.) o null.
- respuesta_cliente: mensaje natural en español para WhatsApp (breve, amable).
  Si es_pedido=true, confirma lo que entendiste y que el pedido fue registrado.
  Si es_pedido=false, responde la duda o pide que indique cantidad y producto.
- motivo_no_pedido: null si es_pedido=true; breve explicación si es_pedido=false.

Formato JSON:
{
  "es_pedido": boolean,
  "lineas": [{ "producto_nombre": string, "cantidad": number, "unidad": "kg"|"pieza" }],
  "observaciones": string|null,
  "respuesta_cliente": string,
  "motivo_no_pedido": string|null
}`;

export async function analizarMensajeParaPedido(input: {
  mensajeUsuario: string;
  historial: MensajeHistorial[];
  catalogoTexto: string;
  nombreCliente: string;
}): Promise<AnalisisPedidoIA> {
  const messages = [
    { role: "system" as const, content: PROMPT_EXTRACCION },
    {
      role: "user" as const,
      content: [
        `Cliente: ${input.nombreCliente}`,
        `Catálogo:\n${input.catalogoTexto}`,
        input.historial.length > 0
          ? `Historial reciente:\n${input.historial
              .slice(-historialMaxMensajes())
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n")}`
          : "",
        `Mensaje actual: ${input.mensajeUsuario}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openaiModel(),
      messages,
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `OpenAI HTTP ${response.status}`);
  }

  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI no devolvió JSON.");
  }

  const parsed = JSON.parse(raw) as AnalisisPedidoIA;

  if (typeof parsed.es_pedido !== "boolean" || !parsed.respuesta_cliente) {
    throw new Error("JSON de OpenAI incompleto.");
  }

  parsed.lineas = Array.isArray(parsed.lineas) ? parsed.lineas : [];
  parsed.observaciones = parsed.observaciones?.trim() || null;
  parsed.motivo_no_pedido = parsed.motivo_no_pedido?.trim() || null;

  return parsed;
}
