import type { CarritoConversacion } from "./cart.ts";
import type { EstadoComercialConversacion } from "./states.ts";
import type { ResultadoTurnoConversacion } from "../services/conversation-turn.types.ts";
import { carritoVacio } from "./cart.ts";
import {
  construirMensajePostAgregarCarrito,
  construirResumenCarrito,
  construirSolicitudConfirmacion,
} from "./states.ts";

function normalizarComando(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coincideComando(normalizado: string, frases: string[]): boolean {
  return frases.some(
    (frase) => normalizado === frase || normalizado.startsWith(`${frase} `)
  );
}

const FRASES_NUEVO_PEDIDO = [
  "nuevo pedido",
  "empezar de nuevo",
  "reiniciar",
  "cancelar pedido",
  "borrar pedido",
];

const FRASES_VER_PEDIDO = ["ver pedido", "que llevo", "qué llevo"];
const FRASES_VER_PEDIDO_EXACTAS = ["pedido", "carrito"];

const FRASES_RECUPERACION_CONTINUAR = [
  "continuar",
  "continuar pedido",
  "continuar el pedido",
  "seguir",
  "seguir pedido",
];

const FRASES_RECUPERACION_NUEVO = [
  "empezar uno nuevo",
  "nuevo pedido",
  "empezar de nuevo",
  "reiniciar",
];

export const MENSAJE_NUEVO_PEDIDO = "Listo. Iniciamos un pedido nuevo.";

export const ESTADOS_PEDIDO_ABIERTO: EstadoComercialConversacion[] = [
  "PEDIDO_GUIADO_ESPECIE",
  "PEDIDO_GUIADO_CATEGORIA",
  "PEDIDO_GUIADO_PRODUCTO",
  "PEDIDO_GUIADO_CANTIDAD",
  "PEDIDO_EN_CONSTRUCCION",
  "ESPERANDO_CONFIRMACION",
];

export function horasPedidoInactivoConfiguradas(): number {
  const raw = Deno.env.get("WHATSAPP_PEDIDO_INACTIVO_HORAS")?.trim();
  const parsed = raw ? Number(raw) : 24;
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return parsed;
}

export function esComandoNuevoPedido(texto: string): boolean {
  const normalizado = normalizarComando(texto);
  if (!normalizado) return false;
  return coincideComando(normalizado, FRASES_NUEVO_PEDIDO);
}

export function esComandoVerPedido(texto: string): boolean {
  const normalizado = normalizarComando(texto);
  if (!normalizado) return false;
  if (FRASES_VER_PEDIDO_EXACTAS.includes(normalizado)) return true;
  return coincideComando(normalizado, FRASES_VER_PEDIDO);
}

export type OpcionConfirmacionPedido = "confirmar" | "seguir" | "reiniciar";

export function esOpcionConfirmacionPedido(
  texto: string
): OpcionConfirmacionPedido | null {
  const normalizado = normalizarComando(texto);

  if (
    normalizado === "1" ||
    normalizado === "confirmar" ||
    normalizado.startsWith("confirmar ")
  ) {
    return "confirmar";
  }

  if (
    normalizado === "2" ||
    normalizado.includes("seguir agregando") ||
    normalizado.includes("agregar algo mas") ||
    normalizado.includes("agregar mas") ||
    normalizado === "seguir"
  ) {
    return "seguir";
  }

  if (
    normalizado === "3" ||
    coincideComando(normalizado, FRASES_NUEVO_PEDIDO)
  ) {
    return "reiniciar";
  }

  return null;
}

export type OpcionRecuperacionPedido = "continuar" | "nuevo";

export function esOpcionRecuperacionPedido(
  texto: string
): OpcionRecuperacionPedido | null {
  const normalizado = normalizarComando(texto);

  if (
    normalizado === "1" ||
    normalizado.startsWith("1 ") ||
    coincideComando(normalizado, FRASES_RECUPERACION_CONTINUAR)
  ) {
    return "continuar";
  }

  if (
    normalizado === "2" ||
    normalizado.startsWith("2 ") ||
    coincideComando(normalizado, FRASES_RECUPERACION_NUEVO)
  ) {
    return "nuevo";
  }

  return null;
}

export function pedidoInactivo(
  ultimoMensajeEn: string | null | undefined,
  ahoraMs: number = Date.now()
): boolean {
  if (!ultimoMensajeEn) return false;

  const anterior = new Date(ultimoMensajeEn).getTime();
  if (!Number.isFinite(anterior)) return false;

  const horas = horasPedidoInactivoConfiguradas();
  return ahoraMs - anterior >= horas * 60 * 60 * 1000;
}

export function tienePedidoSinTerminar(
  estado: EstadoComercialConversacion,
  carrito: CarritoConversacion
): boolean {
  if (!ESTADOS_PEDIDO_ABIERTO.includes(estado)) return false;
  if (carrito.lineas.length > 0) return true;
  if (estado === "ESPERANDO_CONFIRMACION") return true;
  if (carrito.mensajeLibre?.trim()) return true;
  if (carrito.contextoDisambiguacion) return true;
  if (carrito.contextoGuiado && Object.keys(carrito.contextoGuiado).length > 0) {
    return true;
  }
  return false;
}

export function debeOfrecerRecuperacionPedido(input: {
  estado: EstadoComercialConversacion;
  carrito: CarritoConversacion;
  ultimoMensajeEn: string | null | undefined;
}): boolean {
  if (input.estado === "RECUPERACION_PEDIDO") return false;
  if (!pedidoInactivo(input.ultimoMensajeEn)) return false;
  return tienePedidoSinTerminar(input.estado, input.carrito);
}

export function construirSolicitudRecuperacionPedido(resumen: string): string {
  return [
    "Tiene un pedido sin terminar:",
    "",
    resumen,
    "",
    "¿Qué desea hacer?",
    "",
    "1. Continuar el pedido anterior",
    "2. Empezar uno nuevo",
  ].join("\n");
}

export function construirMensajeVerPedido(resumen: string): string {
  return ["Su pedido actual:", "", resumen].join("\n");
}

export function reiniciarPedidoConversacion(
  menu: string
): ResultadoTurnoConversacion {
  return {
    respuesta: `${MENSAJE_NUEVO_PEDIDO}\n\n${menu}`,
    estadoNuevo: "MENU_PRINCIPAL",
    carrito: carritoVacio(),
  };
}

export function respuestaVerPedido(input: {
  carrito: CarritoConversacion;
  estadoActual: EstadoComercialConversacion;
}): ResultadoTurnoConversacion {
  const resumen = construirResumenCarrito(
    input.carrito.lineas,
    input.carrito.observaciones
  );

  return {
    respuesta: construirMensajeVerPedido(resumen),
    estadoNuevo: input.estadoActual,
    carrito: input.carrito,
  };
}

export function iniciarRecuperacionPedido(input: {
  estado: EstadoComercialConversacion;
  carrito: CarritoConversacion;
}): ResultadoTurnoConversacion {
  const resumen = construirResumenCarrito(
    input.carrito.lineas,
    input.carrito.observaciones
  );

  const { recuperacionPedido: _omitido, ...carritoGuardado } = input.carrito;

  return {
    respuesta: construirSolicitudRecuperacionPedido(resumen),
    estadoNuevo: "RECUPERACION_PEDIDO",
    carrito: {
      ...input.carrito,
      recuperacionPedido: {
        estadoGuardado: input.estado,
        carritoGuardado,
      },
    },
  };
}

export function continuarPedidoRecuperado(
  carrito: CarritoConversacion
): ResultadoTurnoConversacion | null {
  const pendiente = carrito.recuperacionPedido;
  if (!pendiente) return null;

  const restaurado: CarritoConversacion = {
    ...pendiente.carritoGuardado,
    recuperacionPedido: null,
  };

  const resumen = construirResumenCarrito(
    restaurado.lineas,
    restaurado.observaciones
  );

  if (pendiente.estadoGuardado === "ESPERANDO_CONFIRMACION") {
    return {
      respuesta: [
        "Continuamos su pedido anterior.",
        "",
        construirSolicitudConfirmacion(resumen),
      ].join("\n"),
      estadoNuevo: pendiente.estadoGuardado,
      carrito: restaurado,
    };
  }

  return {
    respuesta: [
      "Continuamos su pedido anterior.",
      "",
      construirMensajePostAgregarCarrito(resumen),
    ].join("\n"),
    estadoNuevo: pendiente.estadoGuardado,
    carrito: restaurado,
  };
}

export function respuestaRecuperacionInvalida(
  carrito: CarritoConversacion
): ResultadoTurnoConversacion {
  const resumen = construirResumenCarrito(
    carrito.recuperacionPedido?.carritoGuardado.lineas ?? carrito.lineas,
    carrito.recuperacionPedido?.carritoGuardado.observaciones ??
      carrito.observaciones
  );

  return {
    respuesta: `Opción no válida.\n\n${construirSolicitudRecuperacionPedido(resumen)}`,
    estadoNuevo: "RECUPERACION_PEDIDO",
    carrito,
  };
}
