import type {
  InterpretacionMensaje,
  LineaInterpretada,
  MensajeInterpreter,
  ProductoCatalogo,
} from "@/lib/interpretacion/mensaje-interpreter";

const FRASES_IA_FUTURA = [
  "lo de siempre",
  "lo mismo",
  "igual que ayer",
  "igual que el",
  "como siempre",
  "como ayer",
  "mismo pedido",
  "repite",
  "repetir",
];

const UNIDADES_KG = new Set(["kg", "kilo", "kilos", "kilogramo", "kilogramos"]);
const UNIDADES_PIEZA = new Set([
  "pz",
  "pza",
  "pieza",
  "piezas",
  "paquete",
  "paquetes",
  "caja",
  "cajas",
]);

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function requiereIa(texto: string): boolean {
  const normalizado = normalizarTexto(texto);
  return FRASES_IA_FUTURA.some((frase) => normalizado.includes(frase));
}

function segmentarMensaje(texto: string): string[] {
  return texto
    .split(/[\n,;]+|\s+y\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function parsearSegmento(segmento: string): {
  cantidad: number;
  unidad: "kg" | "pieza" | null;
  resto: string;
} | null {
  const limpio = segmento.trim();
  const match = limpio.match(
    /^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilo|piezas?|pz|pza|paquetes?|cajas?)?\s*(.+)$/i
  );

  if (!match) {
    return null;
  }

  const cantidad = Number(match[1].replace(",", "."));
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return null;
  }

  const unidadToken = match[2]?.toLowerCase() ?? null;
  let unidad: "kg" | "pieza" | null = null;

  if (unidadToken) {
    if (UNIDADES_KG.has(unidadToken)) {
      unidad = "kg";
    } else if (UNIDADES_PIEZA.has(unidadToken)) {
      unidad = "pieza";
    }
  }

  return {
    cantidad,
    unidad,
    resto: match[3].trim(),
  };
}

function buscarProducto(
  nombreBuscado: string,
  productos: ProductoCatalogo[]
): ProductoCatalogo | null {
  const buscado = normalizarTexto(nombreBuscado);
  if (!buscado) return null;

  const activos = productos.filter((producto) => producto.activo);
  const ordenados = [...activos].sort(
    (a, b) => b.nombre.length - a.nombre.length
  );

  const exacto = ordenados.find(
    (producto) => normalizarTexto(producto.nombre) === buscado
  );
  if (exacto) return exacto;

  const contiene = ordenados.find((producto) => {
    const nombre = normalizarTexto(producto.nombre);
    return nombre.includes(buscado) || buscado.includes(nombre);
  });

  return contiene ?? null;
}

function unidadParaProducto(
  producto: ProductoCatalogo,
  unidadExplicita: "kg" | "pieza" | null
): "kg" | "pieza" {
  if (unidadExplicita) return unidadExplicita;
  return producto.unidad === "kg" ? "kg" : "pieza";
}

export class ReglasSimplesInterpreter implements MensajeInterpreter {
  async interpretar(input: {
    texto: string;
    productos: ProductoCatalogo[];
  }): Promise<InterpretacionMensaje> {
    const texto = input.texto.trim();

    if (!texto) {
      return { tipo: "no_interpretado", motivo: "Mensaje vacío." };
    }

    if (requiereIa(texto)) {
      return {
        tipo: "referencia_historica",
        motivo: "Requiere interpretación avanzada (fase IA).",
      };
    }

    const segmentos = segmentarMensaje(texto);
    const lineas: LineaInterpretada[] = [];

    for (const segmento of segmentos) {
      const parsed = parsearSegmento(segmento);
      if (!parsed) {
        return {
          tipo: "no_interpretado",
          motivo: `No se pudo interpretar: "${segmento}"`,
        };
      }

      const producto = buscarProducto(parsed.resto, input.productos);
      if (!producto) {
        return {
          tipo: "no_interpretado",
          motivo: `Producto no reconocido: "${parsed.resto}"`,
        };
      }

      lineas.push({
        producto_id: producto.id,
        cantidad: parsed.cantidad,
        unidad: unidadParaProducto(producto, parsed.unidad),
        textoOriginal: segmento,
      });
    }

    if (lineas.length === 0) {
      return { tipo: "no_interpretado", motivo: "Sin líneas interpretables." };
    }

    return { tipo: "pedido", lineas };
  }
}

export const interpretadorReglasSimples = new ReglasSimplesInterpreter();
