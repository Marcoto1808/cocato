export type ProductoDetectado = {
  nombre: string;
  cantidad: number;
  unidad: string;
};

function capitalizar(texto: string) {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizarUnidad(valor: string | undefined): string {
  if (!valor) return "kg";

  const unidad = valor.toLowerCase();

  if (unidad === "kg" || unidad.startsWith("kil")) return "kg";
  if (unidad.startsWith("gram")) return "g";
  if (unidad.startsWith("pieza")) return "pieza";
  if (unidad.startsWith("paquete")) return "paquete";
  if (unidad.startsWith("caja")) return "caja";

  return "kg";
}

function formatearCantidad(cantidad: number) {
  return cantidad % 1 === 0 ? String(cantidad) : cantidad.toString();
}

export function formatearProductoDetectado(producto: ProductoDetectado) {
  return `${producto.nombre} - ${formatearCantidad(producto.cantidad)} ${producto.unidad}`;
}

/**
 * Extrae productos y cantidades del mensaje original.
 * Sustituible más adelante por resultados persistidos de IA.
 */
export function detectarProductosEnMensaje(
  mensaje: string | null | undefined
): ProductoDetectado[] {
  if (!mensaje?.trim()) return [];

  let texto = mensaje.trim().replace(/[.!?]+$/, "");

  texto = texto
    .replace(
      /^(?:hola[,!.\s]*)?(?:buenos?\s+d[ií]as[,!.\s]*)?(?:buenas?\s+tardes[,!.\s]*)?(?:me\s+puedes?\s+m(?:and(?:ar|as)|e\s+mand(?:ar|as))[,.\s]*)?(?:quiero|necesito|me\s+mandas?|me\s+env[ií]as?|dame|por\s+favor[,.\s]*)?/i,
      ""
    )
    .trim();

  const fragmentos = texto
    .split(/\s*,\s*|\s+y\s+/i)
    .map((fragmento) => fragmento.trim())
    .filter(Boolean);

  const productos: ProductoDetectado[] = [];

  for (const fragmento of fragmentos) {
    const match = fragmento.match(
      /^(\d+(?:[.,]\d+)?)\s*(?:(kg|kilos?|kilo|g|gramos?|piezas?|paquetes?|cajas?)\s*)?(?:de\s+)?(.+)$/i
    );

    if (!match) continue;

    const cantidad = Number.parseFloat(match[1].replace(",", "."));
    const nombre = capitalizar(match[3].trim());
    const unidad = normalizarUnidad(match[2]);

    if (Number.isNaN(cantidad) || cantidad <= 0 || !nombre) continue;

    productos.push({ nombre, cantidad, unidad });
  }

  return productos;
}
