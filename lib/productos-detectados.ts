export type ProductoDetectado = {
  nombre: string;
  cantidad: number;
  unidad: string;
  encontradoEnCatalogo: boolean;
};

export type ProductoCatalogoDeteccion = {
  nombre: string;
  unidad: string;
};

function capitalizar(texto: string) {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizarNombre(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function variantesNombre(nombre: string) {
  const base = normalizarNombre(nombre);
  const variantes = new Set<string>([base]);

  if (base.endsWith("es") && base.length > 3) {
    variantes.add(base.slice(0, -2));
    variantes.add(base.slice(0, -1));
  }

  if (base.endsWith("s") && base.length > 2) {
    variantes.add(base.slice(0, -1));
  }

  return [...variantes];
}

function nombresCoinciden(detectado: string, catalogo: string) {
  const variantesDetectadas = variantesNombre(detectado);
  const variantesCatalogo = variantesNombre(catalogo);

  for (const nombreDetectado of variantesDetectadas) {
    for (const nombreCatalogo of variantesCatalogo) {
      if (nombreDetectado === nombreCatalogo) return true;
    }
  }

  return false;
}

export function buscarProductoEnCatalogo(
  nombreDetectado: string,
  catalogo: ProductoCatalogoDeteccion[]
): ProductoCatalogoDeteccion | null {
  if (!nombreDetectado.trim() || catalogo.length === 0) return null;

  return (
    catalogo.find((producto) =>
      nombresCoinciden(nombreDetectado, producto.nombre)
    ) ?? null
  );
}

function normalizarUnidadExplicita(valor: string | undefined): string | null {
  if (!valor) return null;

  const unidad = valor.toLowerCase();

  if (unidad === "kg" || unidad.startsWith("kil")) return "kg";
  if (unidad.startsWith("gram")) return "g";
  if (unidad.startsWith("pieza")) return "pieza";
  if (unidad.startsWith("paquete")) return "paquete";
  if (unidad.startsWith("caja")) return "caja";

  return null;
}

function formatearCantidad(cantidad: number) {
  return cantidad % 1 === 0 ? String(cantidad) : cantidad.toString();
}

function etiquetaUnidad(cantidad: number, unidad: string) {
  switch (unidad) {
    case "pieza":
      return cantidad === 1 ? "pieza" : "piezas";
    case "paquete":
      return cantidad === 1 ? "paquete" : "paquetes";
    case "caja":
      return cantidad === 1 ? "caja" : "cajas";
    default:
      return unidad;
  }
}

export function formatearProductoDetectado(producto: ProductoDetectado) {
  const unidad = etiquetaUnidad(producto.cantidad, producto.unidad);
  return `${producto.nombre} - ${formatearCantidad(producto.cantidad)} ${unidad}`;
}

/**
 * Extrae productos y cantidades del mensaje original.
 * La unidad se obtiene del catálogo cuando hay coincidencia de producto.
 */
export function detectarProductosEnMensaje(
  mensaje: string | null | undefined,
  catalogo: ProductoCatalogoDeteccion[] = []
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
    const nombreCrudo = match[3].trim();
    const unidadExplicita = normalizarUnidadExplicita(match[2]);

    if (Number.isNaN(cantidad) || cantidad <= 0 || !nombreCrudo) continue;

    const coincidencia = buscarProductoEnCatalogo(nombreCrudo, catalogo);

    if (coincidencia) {
      productos.push({
        nombre: coincidencia.nombre,
        cantidad,
        unidad: coincidencia.unidad,
        encontradoEnCatalogo: true,
      });
      continue;
    }

    productos.push({
      nombre: capitalizar(nombreCrudo),
      cantidad,
      unidad: unidadExplicita ?? "unidad",
      encontradoEnCatalogo: false,
    });
  }

  return productos;
}
