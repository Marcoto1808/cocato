import {
  historialMaxMensajes,
  openaiApiKey,
  openaiModel,
  openaiSystemPrompt,
} from "../env.ts";
import type { MensajeHistorial } from "../types.ts";

export type GenerarRespuestaInput = {
  mensajeUsuario: string;
  historial: MensajeHistorial[];
  contextoExtra?: string;
};

export async function generarRespuestaOpenAI(
  input: GenerarRespuestaInput
): Promise<string> {
  const systemParts = [openaiSystemPrompt()];

  if (input.contextoExtra?.trim()) {
    systemParts.push(`\n\nContexto del negocio:\n${input.contextoExtra.trim()}`);
  }

  const messages = [
    { role: "system" as const, content: systemParts.join("") },
    ...input.historial.slice(-historialMaxMensajes()),
    { role: "user" as const, content: input.mensajeUsuario },
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
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const detalle = data?.error?.message ?? `OpenAI HTTP ${response.status}`;
    throw new Error(detalle);
  }

  const texto = data?.choices?.[0]?.message?.content?.trim();

  if (!texto) {
    throw new Error("OpenAI no devolvió contenido en la respuesta.");
  }

  return texto;
}
