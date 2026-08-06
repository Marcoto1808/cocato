/** Estados comerciales del Conversation Engine. */
import {
  formatearCantidadEnResumen,
  parsearSegmentoPedido,
} from "@/lib/interpretacion/cantidad-natural";
export type EstadoComercialConversacion =
  | "NUEVA"
  | "REGISTRO_CLIENTE"
  | "MENU_PRINCIPAL"
  | "PEDIDO_GUIADO_CATEGORIA"
  | "PEDIDO_GUIADO_PRODUCTO"
  | "PEDIDO_GUIADO_CANTIDAD"
  | "PEDIDO_EN_CONSTRUCCION"
  | "ESPERANDO_CONFIRMACION"
  | "ENTREGA_OPCION"
  | "ENTREGA_DIRECCION"
  | "CONFIRMADO"
  | "CANCELADO";

export const ESTADOS_COMERCIALES: EstadoComercialConversacion[] = [
  "NUEVA",
  "REGISTRO_CLIENTE",
  "MENU_PRINCIPAL",
  "PEDIDO_GUIADO_CATEGORIA",
  "PEDIDO_GUIADO_PRODUCTO",
  "PEDIDO_GUIADO_CANTIDAD",
  "PEDIDO_EN_CONSTRUCCION",
  "ESPERANDO_CONFIRMACION",
  "ENTREGA_OPCION",
  "ENTREGA_DIRECCION",
  "CONFIRMADO",
  "CANCELADO",
];

export function esEstadoComercialConversacion(
  valor: string | null | undefined
): valor is EstadoComercialConversacion {
  return ESTADOS_COMERCIALES.includes(valor as EstadoComercialConversacion);
}

function normalizarEntrada(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function esSaludo(texto: string): boolean {
  const normalizado = normalizarEntrada(texto);
  if (!normalizado) return false;

  const saludos = [
    "hola",
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "buen dia",
    "que tal",
    "hey",
    "hi",
  ];

  return saludos.some(
    (saludo) =>
      normalizado === saludo ||
      normalizado.startsWith(`${saludo} `) ||
      normalizado.endsWith(` ${saludo}`)
  );
}

export function esOpcionMenuPrincipal(
  texto: string
): "1" | "2" | "3" | null {
  const normalizado = normalizarEntrada(texto);
  if (
    normalizado === "1" ||
    normalizado.startsWith("1 ") ||
    normalizado.includes("escribir")
  ) {
    return "1";
  }
  if (
    normalizado === "2" ||
    normalizado.startsWith("2 ") ||
    normalizado.includes("guiado")
  ) {
    return "2";
  }
  if (
    normalizado === "3" ||
    normalizado.startsWith("3 ") ||
    normalizado.includes("repetir") ||
    normalizado.includes("ultimo")
  ) {
    return "3";
  }
  return null;
}

export function esOpcionEntrega(texto: string): "1" | "2" | null {
  const normalizado = normalizarEntrada(texto);
  if (
    normalizado === "1" ||
    normalizado.startsWith("1 ") ||
    normalizado.includes("domicilio") ||
    normalizado.includes("envio")
  ) {
    return "1";
  }
  if (
    normalizado === "2" ||
    normalizado.startsWith("2 ") ||
    normalizado.includes("recoger") ||
    normalizado.includes("recojo") ||
    normalizado.includes("pasare")
  ) {
    return "2";
  }
  return null;
}

export function esVolverMenu(texto: string): boolean {
  const normalizado = normalizarEntrada(texto);
  return (
    normalizado === "menu" ||
    normalizado === "0" ||
    normalizado === "inicio" ||
    normalizado === "volver"
  );
}

export function esClienteIndicaListo(texto: string): boolean {
  const normalizado = normalizarEntrada(texto);
  const frases = [
    "listo",
    "eso es todo",
    "nada mas",
    "confirmar",
    "terminar",
    "ya esta",
    "fin",
  ];
  return frases.some(
    (frase) => normalizado === frase || normalizado.startsWith(`${frase} `)
  );
}

export function esConfirmacion(texto: string): boolean {
  const normalizado = normalizarEntrada(texto);
  const frases = ["si", "sí", "confirmo", "confirmar", "adelante", "ok", "vale"];
  return frases.some(
    (frase) => normalizado === frase || normalizado.startsWith(`${frase} `)
  );
}

export function esCancelacion(texto: string): boolean {
  const normalizado = normalizarEntrada(texto);
  const frases = ["no", "cancelar", "cancelo", "olvidalo", "olvídalo", "anular"];
  return frases.some(
    (frase) => normalizado === frase || normalizado.startsWith(`${frase} `)
  );
}

export function pareceSolicitudCambioDireccion(
  texto: string,
  direccionActual: string
): boolean {
  const normalizado = normalizarEntrada(texto);
  const dirNorm = normalizarEntrada(direccionActual);
  if (normalizado.length < 8) return false;
  if (normalizado === dirNorm) return false;
  if (dirNorm && normalizado.includes(dirNorm)) return false;

  const indicadores = [
    "otra direccion",
    "cambiar direccion",
    "diferente direccion",
    "mandar a",
    "entregar en",
    "enviar a",
  ];
  return indicadores.some((frase) => normalizado.includes(frase));
}

export function parsearSeleccionNumerica(
  texto: string,
  max: number
): number | null {
  const match = texto.trim().match(/^(\d+)/);
  if (!match) return null;
  const valor = Number(match[1]);
  if (!Number.isInteger(valor) || valor < 1 || valor > max) return null;
  return valor;
}

export function parsearCantidad(texto: string): number | null {
  const match = texto.trim().replace(",", ".").match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    const cantidad = Number(match[1]);
    if (Number.isFinite(cantidad) && cantidad > 0) return cantidad;
  }

  const parsed = parsearSegmentoPedido(`${texto.trim()} de producto`);
  if (parsed && parsed.cantidad > 0) return parsed.cantidad;

  return null;
}

export function nombreParaSaludo(input: {
  propietario: string | null;
  nombre_negocio: string;
}): string {
  const propietario = input.propietario?.trim();
  if (propietario) return propietario;
  return input.nombre_negocio.trim();
}

export function construirBienvenidaRegistro(): string {
  return [
    "Buenas tardes. Bienvenido a Distribuidora de Carnes DICATO.",
    "",
    "Será un gusto atenderle.",
    "",
    "Antes de comenzar, ¿me puede indicar el nombre de su negocio y qué tipo de negocio es?",
    "",
    "Ejemplo:",
    "",
    "• Carnicería San José - Carnicería",
    "• Fonda Lupita - Fonda",
    "• Restaurante El Patrón - Restaurante",
  ].join("\n");
}

export function construirMenuPostRegistro(): string {
  return [
    "Muchas gracias.",
    "",
    "Ya quedó registrado.",
    "",
    "¿Cómo le podemos ayudar?",
    "",
    "1️⃣ Escribir mi pedido",
    "2️⃣ Pedido guiado",
    "3️⃣ Repetir mi último pedido",
  ].join("\n");
}

export function construirMenuPrincipal(nombre: string): string {
  return [
    `Hola, Don ${nombre}.`,
    "",
    "¿Cómo le podemos ayudar?",
    "",
    "1️⃣ Escribir mi pedido",
    "2️⃣ Pedido guiado",
    "3️⃣ Repetir mi último pedido",
  ].join("\n");
}

export function construirMenuCategorias(categorias: string[]): string {
  const lineas = categorias.map(
    (categoria, indice) => `${indice + 1}. ${categoria}`
  );
  return [
    "Elige una categoría:",
    "",
    ...lineas,
    "",
    "Responde con el número. Escribe *menu* para volver al inicio.",
  ].join("\n");
}

export function construirMenuProductos(
  categoria: string,
  productos: Array<{ nombre: string }>
): string {
  const lineas = productos.map(
    (producto, indice) => `${indice + 1}. ${producto.nombre}`
  );
  return [
    `Productos de ${categoria}:`,
    "",
    ...lineas,
    "",
    "Responde con el número del producto. Escribe *menu* para volver.",
  ].join("\n");
}

export function construirSolicitudCantidad(
  productoNombre: string,
  unidad: string = "pieza"
): string {
  if (unidad === "kg") {
    return [
      `¿Cuántos kilos de *${productoNombre}* necesita?`,
      "",
      "Ejemplos: 5, 8.5",
      "Escriba *menu* para cancelar.",
    ].join("\n");
  }

  return [
    `¿Cuántas piezas de *${productoNombre}* necesita?`,
    "",
    "Ejemplos: 1, 2, 1.5",
    "Escriba *menu* para cancelar.",
  ].join("\n");
}

export function construirResumenCarrito(
  lineas: Array<{
    cantidad: number;
    unidad: string;
    producto_nombre: string;
    cantidadTexto?: string | null;
  }>,
  observaciones?: string[] | null
): string {
  if (lineas.length === 0) {
    return "Su pedido está vacío.";
  }

  const detalle = lineas
    .map((linea) =>
      formatearCantidadEnResumen(
        linea.cantidad,
        linea.unidad === "kg" ? "kg" : "pieza",
        linea.producto_nombre,
        linea.cantidadTexto
      )
    )
    .join("\n");

  if (!observaciones?.length) {
    return detalle;
  }

  const obs = observaciones.map((item) => `• ${item}`).join("\n");
  return [detalle, "", "Observaciones:", obs].join("\n");
}

export function construirSolicitudConfirmacion(
  resumen: string
): string {
  return [
    "Le confirmo su pedido:",
    "",
    resumen,
    "",
    "¿Es correcto?",
  ].join("\n");
}

export function construirInstruccionPedidoLibre(): string {
  return [
    "Escriba su pedido cuando guste.",
    "",
    "Ejemplos: 2 capotes, medio capote, 5 kilos de costilla sin grasa.",
    "",
    "Cuando termine escriba *listo*.",
    "Escriba *menu* para volver al inicio.",
  ].join("\n");
}

export function construirMensajePostAgregarCarrito(resumen: string): string {
  return [
    "Hasta el momento lleva:",
    "",
    resumen,
    "",
    "¿Desea agregar algo más?",
    "",
    "Escriba otro producto o escriba *listo* para confirmar.",
  ].join("\n");
}

export function construirSolicitudEntrega(): string {
  return [
    "¿Cómo desea recibir su pedido?",
    "",
    "1️⃣ Envío a domicilio",
    "2️⃣ Pasaré a recogerlo",
  ].join("\n");
}

export function construirEntregaDomicilioExistente(direccion: string): string {
  return [
    "Perfecto.",
    "",
    `Entregaremos en su dirección registrada:`,
    direccion,
    "",
    "Gracias por su pedido.",
  ].join("\n");
}

export function construirSolicitudDireccionEntrega(): string {
  return [
    "Indíquenos la dirección completa de entrega (calle, número, colonia y referencias).",
    "",
    "Esta quedará registrada como su dirección oficial.",
  ].join("\n");
}

export function construirEntregaRecoger(): string {
  return [
    "Perfecto. Su pedido quedará listo para recoger.",
    "",
    "Gracias por su pedido.",
  ].join("\n");
}

export function construirEntregaDireccionGuardada(direccion: string): string {
  return [
    "Dirección registrada:",
    direccion,
    "",
    "Gracias por su pedido.",
  ].join("\n");
}

export const MENSAJE_REGISTRO_INVALIDO =
  "No pude leer el formato. Envíe: Nombre del negocio - Tipo de negocio\nEjemplo: Carnicería San José - Carnicería";

export const MENSAJE_CLIENTE_NO_EXISTE =
  "Gracias por contactarnos. Un vendedor continuará la conversación contigo en breve.";

export const MENSAJE_PEDIDO_CONFIRMADO =
  "✅ Pedido confirmado. Lo verá en preparación pronto.";

export const MENSAJE_PEDIDO_CANCELADO =
  "Pedido cancelado. Cuando quiera, escriba *menu* para ver las opciones.";

export const MENSAJE_SIN_ULTIMO_PEDIDO =
  "No encontramos un pedido anterior. Elija una opción del menú.";

export const MENSAJE_CAMBIO_DIRECCION_REQUIERE_VALIDACION =
  "El cambio de dirección requiere validación comercial. Arturo revisará su solicitud y le contactaremos. Por ahora usaremos su dirección registrada.";
