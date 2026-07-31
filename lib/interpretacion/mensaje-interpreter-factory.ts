/** Punto de extensión para interpretación con IA (fase posterior). */
import type { MensajeInterpreter } from "@/lib/interpretacion/mensaje-interpreter";
import { interpretadorReglasSimples } from "@/lib/interpretacion/reglas-simples";

export function obtenerInterpretadorMensajes(): MensajeInterpreter {
  // Fase 2: retornar implementación IA cuando esté disponible.
  return interpretadorReglasSimples;
}
