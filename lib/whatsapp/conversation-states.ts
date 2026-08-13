/** Estados comerciales del Conversation Engine. */
import {
  formatearCantidadEnResumen,
  parsearSegmentoPedido,
} from "@/lib/interpretacion/cantidad-natural";
import { esLineaLibre, esLineaPendienteDisambiguacion } from "@/lib/interpretacion/linea-libre";
import type { DisambiguacionPendiente } from "@/lib/interpretacion/disambiguacion";
import { construirMensajeDisambiguacion } from "@/lib/interpretacion/disambiguacion";
import type { CarritoConversacion } from "@/lib/whatsapp/conversation-cart";
import {
  normalizarEntradaConversacional as normalizarEntrada,
  OPCION_CONFIRMAR,
  OPCIONES_DESEAR_AGREGAR_MAS,
  OPCIONES_ENTREGA,
  OPCIONES_ENTREGA_IDS,
  OPCIONES_MENU_PRINCIPAL,
  OPCIONES_SI_NO,
  OPCIONES_CANCELACION,
  OPCION_RECHAZAR,
  OPCION_SEGUIR_AGREGANDO,
  OPCION_TERMINAR_PEDIDO,
  resolverOpcionConversacional,
} from "@/lib/whatsapp/resolver-opcion-conversacional";
export type EstadoComercialConversacion =
  | "NUEVA"
  | "REGISTRO_CLIENTE"
  | "MENU_PRINCIPAL"
  | "PEDIDO_GUIADO_ESPECIE"
  | "PEDIDO_GUIADO_CATEGORIA"
  | "PEDIDO_GUIADO_PRODUCTO"
  | "PEDIDO_GUIADO_CANTIDAD"
  | "PEDIDO_EN_CONSTRUCCION"
  | "ESPERANDO_CONFIRMACION"
  | "RECUPERACION_PEDIDO"
  | "ENTREGA_OPCION"
  | "ENTREGA_DIRECCION"
  | "CONFIRMADO"
  | "CANCELADO";

export const ESTADOS_COMERCIALES: EstadoComercialConversacion[] = [
  "NUEVA",
  "REGISTRO_CLIENTE",
  "MENU_PRINCIPAL",
  "PEDIDO_GUIADO_ESPECIE",
  "PEDIDO_GUIADO_CATEGORIA",
  "PEDIDO_GUIADO_PRODUCTO",
  "PEDIDO_GUIADO_CANTIDAD",
  "PEDIDO_EN_CONSTRUCCION",
  "ESPERANDO_CONFIRMACION",
  "RECUPERACION_PEDIDO",
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
  return resolverOpcionConversacional(texto, OPCIONES_MENU_PRINCIPAL);
}

export function esOpcionEntrega(texto: string): "1" | "2" | null {
  const opcion = resolverOpcionConversacional(texto, OPCIONES_ENTREGA);
  if (opcion === OPCIONES_ENTREGA_IDS.envio) return "1";
  if (opcion === OPCIONES_ENTREGA_IDS.recoger) return "2";
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
  return (
    resolverOpcionConversacional(texto, OPCIONES_DESEAR_AGREGAR_MAS) ===
    OPCION_TERMINAR_PEDIDO
  );
}

export function esClienteDeseaSeguirAgregando(texto: string): boolean {
  return (
    resolverOpcionConversacional(texto, OPCIONES_DESEAR_AGREGAR_MAS) ===
    OPCION_SEGUIR_AGREGANDO
  );
}

export function esConfirmacion(texto: string): boolean {
  return (
    resolverOpcionConversacional(texto, OPCIONES_SI_NO) === OPCION_CONFIRMAR
  );
}

export function esCancelacion(texto: string): boolean {
  return (
    resolverOpcionConversacional(texto, OPCIONES_CANCELACION) === OPCION_RECHAZAR
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
  const limpio = texto.trim();
  if (/\p{L}/u.test(limpio.normalize("NFD").replace(/\p{M}/gu, ""))) {
    return null;
  }

  const match = limpio.match(/^(\d+)$/);
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
    `👋 Hola, ${nombre}.`,
    "",
    "¿Cómo le podemos ayudar?",
    "",
    "1️⃣ Escribir mi pedido",
    "2️⃣ Pedido guiado",
    "3️⃣ Repetir mi último pedido",
  ].join("\n");
}

export function construirMenuEspecie(): string {
  return [
    "¿Su pedido es de res o de cerdo?",
    "",
    "1. Res",
    "2. Cerdo",
    "",
    "Responde con el número o escribe res / cerdo / puerco.",
    "Escribe *menu* para volver al inicio.",
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
    producto_id?: string;
    textoOriginal?: string;
    cantidadTexto?: string | null;
  }>,
  observaciones?: string[] | null
): string {
  if (lineas.length === 0) {
    return "Su pedido está vacío.";
  }

  const detalle = lineas
    .map((linea) => {
      if (linea.producto_id && esLineaLibre(linea.producto_id)) {
        return `• ${linea.textoOriginal?.trim() || linea.producto_nombre}`;
      }
      if (linea.producto_id && esLineaPendienteDisambiguacion(linea.producto_id)) {
        const base = formatearCantidadEnResumen(
          linea.cantidad,
          linea.unidad === "kg" ? "kg" : "pieza",
          linea.producto_nombre,
          linea.cantidadTexto,
          linea.textoOriginal
        );
        return `${base} (pendiente de confirmar)`;
      }
      return formatearCantidadEnResumen(
        linea.cantidad,
        linea.unidad === "kg" ? "kg" : "pieza",
        linea.producto_nombre,
        linea.cantidadTexto,
        linea.textoOriginal
      );
    })
    .join("\n");

  if (!observaciones?.length) {
    return detalle;
  }

  const obs = observaciones.map((item) => `• ${item}`).join("\n");
  return [detalle, "", "Observaciones:", obs].join("\n");
}

export function carritoTieneInformacionPendiente(
  carrito: Pick<CarritoConversacion, "lineas" | "contextoDisambiguacion">
): boolean {
  if (carrito.contextoDisambiguacion) return true;
  return carrito.lineas.some(
    (linea) =>
      linea.producto_id && esLineaPendienteDisambiguacion(linea.producto_id)
  );
}

export function construirSolicitudInformacionPendiente(
  resumen: string,
  pendiente: DisambiguacionPendiente
): string {
  return [
    "Su pedido:",
    "",
    resumen,
    "",
    "⚠️ FALTA INFORMACIÓN",
    "",
    construirMensajeDisambiguacion(
      pendiente.opciones,
      pendiente.productoBuscado
    ),
  ].join("\n");
}

export function construirSolicitudConfirmacion(
  resumen: string
): string {
  return construirListaPedidoConOpciones(resumen, true);
}

export function construirRespuestaConfirmacionInvalida(): string {
  return [
    "No entendí su respuesta.",
    "",
    "Por favor seleccione una opción:",
    "",
    "1️⃣ Confirmar pedido",
    "2️⃣ Agregar algo más",
    "3️⃣ Empezar de nuevo",
  ].join("\n");
}

export function construirRespuestaMenuPrincipalInvalida(menu: string): string {
  return ["No entendí su respuesta.", "", menu].join("\n");
}

export function construirListaPedidoConOpciones(
  resumen: string,
  incluirReiniciar = false
): string {
  const lineas = [
    "Su pedido:",
    "",
    resumen,
    "",
    "¿Confirma su pedido o gusta agregar algo más?",
    "",
    "1. Confirmar pedido",
    "2. Agregar algo más",
  ];

  if (incluirReiniciar) {
    lineas.push("3. Empezar de nuevo");
  }

  return lineas.join("\n");
}

export function construirInstruccionAgregarMas(): string {
  return ["Perfecto.", "", "Escriba los productos que desea agregar."].join("\n");
}

export function construirInstruccionPedidoLibre(): string {
  return [
    "Escriba su pedido cuando guste.",
    "",
    "Ejemplos: 2 capotes, medio kilo de costilla, 200 pesos de maciza.",
    "",
    "Puede escribir varios productos en un solo mensaje.",
    "Escriba *menu* para volver al inicio.",
  ].join("\n");
}

export function construirMensajePostAgregarCarrito(resumen: string): string {
  return construirListaPedidoConOpciones(resumen, false);
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
  "✅ Pedido confirmado.";

export function construirSolicitudOtroPedido(): string {
  return [
    "¿Desea realizar otro pedido?",
    "",
    "1️⃣ Sí, hacer otro pedido",
    "2️⃣ No, terminar",
  ].join("\n");
}

export function construirMensajePostPedidoConfirmado(): string {
  return [
    MENSAJE_PEDIDO_CONFIRMADO,
    "",
    "Gracias por su pedido.",
    "",
    construirSolicitudOtroPedido(),
  ].join("\n");
}

export const MENSAJE_PEDIDO_CANCELADO =
  "Pedido cancelado. Cuando quiera, escriba *menu* para ver las opciones.";

export const MENSAJE_SIN_ULTIMO_PEDIDO =
  "No encontramos un pedido anterior. Elija una opción del menú.";

export const MENSAJE_CAMBIO_DIRECCION_REQUIERE_VALIDACION =
  "El cambio de dirección requiere validación comercial. Arturo revisará su solicitud y le contactaremos. Por ahora usaremos su dirección registrada.";
