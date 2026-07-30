export const PRODUCTOS_BALANCE = [
  {
    id: "costilla",
    nombreRendimiento: "Costillas",
    nombreLista: "Costilla",
  },
  {
    id: "pierna",
    nombreRendimiento: "Piernas",
    nombreLista: "Pierna",
  },
  {
    id: "espaldilla",
    nombreRendimiento: "Espaldillas",
    nombreLista: "Espaldilla",
  },
  {
    id: "espinazo",
    nombreRendimiento: "Espinazos",
    nombreLista: "Espinazo",
  },
  {
    id: "cabeza",
    nombreRendimiento: "Cabezas",
    nombreLista: "Cabeza",
  },
  {
    id: "manitas",
    nombreRendimiento: "Manitas",
    nombreLista: "Manitas",
  },
  {
    id: "maletas",
    nombreRendimiento: "Maletas",
    nombreLista: "Maletas",
  },
  {
    id: "retazo",
    nombreRendimiento: "Retazo",
    nombreLista: "Retazo",
  },
] as const;

export type ProductoBalanceId = (typeof PRODUCTOS_BALANCE)[number]["id"];

export const PRODUCTOS_CAPOTE_IDS = [
  "costilla",
  "pierna",
  "espaldilla",
  "espinazo",
] as const satisfies readonly ProductoBalanceId[];

export const PRODUCTOS_SUBPRODUCTO_IDS = [
  "cabeza",
  "manitas",
  "maletas",
  "retazo",
] as const satisfies readonly ProductoBalanceId[];

export type CompraDiaState = {
  fecha: string;
  numeroPuercos: string;
  kilosTotales: string;
  precioCompraKg: string;
  gastosAdicionales: string;
};

export type RendimientoState = Record<ProductoBalanceId, string>;

export type PreciosState = Record<ProductoBalanceId, { precioNuevo: string }>;

export type PreciosAnterioresState = Record<
  ProductoBalanceId,
  { precio: string }
>;

export type ResultadosState = {
  utilidadTotal: string;
  utilidadPorPuerco: string;
  margen: string;
};

export type ResultadosCalculados = {
  ventaTotal: number | null;
  costoTotal: number | null;
  utilidadTotal: number | null;
  utilidadPorPuerco: number | null;
  margen: number | null;
};

export type IndicadorResultado = "excelente" | "aceptable" | "revisar";

export const PASOS_BALANCE = [
  {
    id: "compra-dia",
    titulo: "Compra del día",
    descripcion: "Captura los datos de la compra de cerdo para el balance.",
  },
  {
    id: "rendimiento",
    titulo: "Rendimiento",
    descripcion: "Kilos obtenidos de cada producto después del despiece.",
  },
  {
    id: "precios",
    titulo: "Precios",
    descripcion:
      "Simula precios de venta hasta encontrar el equilibrio entre el valor del capote y la utilidad por puerco.",
  },
  {
    id: "resultados",
    titulo: "Resultados",
    descripcion: "Utilidad y margen del balance del día.",
  },
] as const;

export function fechaBalanceHoy(): string {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function crearRendimientoInicial(): RendimientoState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = "";
      return acc;
    },
    {} as RendimientoState
  );
}

export function crearPreciosInicial(): PreciosState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = { precioNuevo: "" };
      return acc;
    },
    {} as PreciosState
  );
}

export function crearPreciosAnterioresInicial(): PreciosAnterioresState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = { precio: "" };
      return acc;
    },
    {} as PreciosAnterioresState
  );
}

export function preciosStateDesdeCodigosPublicados(
  preciosPorCodigo: Partial<Record<ProductoBalanceId, number>>
): PreciosState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      const valor = preciosPorCodigo[producto.id];
      acc[producto.id] = {
        precioNuevo:
          valor !== undefined && Number.isFinite(valor)
            ? formatearPesosEnterosInput(valor)
            : "",
      };
      return acc;
    },
    {} as PreciosState
  );
}

export function preciosStateDesdeAnteriores(
  anteriores: PreciosAnterioresState
): PreciosState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = {
        precioNuevo: anteriores[producto.id]?.precio ?? "",
      };
      return acc;
    },
    {} as PreciosState
  );
}

export function preciosTienenValores(precios: PreciosState): boolean {
  return PRODUCTOS_BALANCE.some(
    (producto) => parsearNumero(precios[producto.id]?.precioNuevo ?? "") !== null
  );
}

export function crearResultadosInicial(): ResultadosState {
  return {
    utilidadTotal: "",
    utilidadPorPuerco: "",
    margen: "",
  };
}

export function parsearNumero(valor: string): number | null {
  const limpio = valor.trim().replace(/,/g, "");
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function redondearPesos(valor: number | null): number | null {
  if (valor === null) return null;
  return Math.round(valor);
}

export function formatearNumeroBalance(
  valor: number | null,
  decimales = 2
): string {
  if (valor === null) return "";
  return valor.toFixed(decimales).replace(/\.?0+$/, "");
}

export function formatearPesosEnteros(valor: number | null): string {
  if (valor === null) return "—";
  return redondearPesos(valor)!.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

export function formatearPesosEnterosInput(valor: number | null): string {
  if (valor === null) return "";
  return String(redondearPesos(valor));
}

export function calcularPrecioCanal(
  preciosPorProducto: Record<ProductoBalanceId, number>,
  rendimiento: RendimientoState
): number | null {
  let sumaPonderada = 0;
  let totalKilos = 0;

  for (const producto of PRODUCTOS_BALANCE) {
    const kilos = parsearNumero(rendimiento[producto.id]);
    const precio = preciosPorProducto[producto.id];

    if (kilos !== null && kilos > 0) {
      sumaPonderada += precio * kilos;
      totalKilos += kilos;
    }
  }

  return totalKilos > 0 ? Math.round(sumaPonderada / totalKilos) : null;
}

/** Valor total ($) al vender los cortes del capote con los precios simulados. */
export function calcularValorCapoteTotal(
  preciosPorProducto: Partial<Record<ProductoBalanceId, number>>,
  rendimiento: RendimientoState
): number | null {
  let total = 0;
  let tieneValor = false;

  for (const id of PRODUCTOS_CAPOTE_IDS) {
    const kilos = parsearNumero(rendimiento[id]);
    const precio = preciosPorProducto[id];

    if (kilos !== null && kilos > 0 && precio !== undefined) {
      total += precio * kilos;
      tieneValor = true;
    }
  }

  return tieneValor ? Math.round(total) : null;
}

/** Valor total ($) al vender los subproductos con los precios simulados. */
export function calcularValorSubproductosTotal(
  preciosPorProducto: Partial<Record<ProductoBalanceId, number>>,
  rendimiento: RendimientoState
): number | null {
  let total = 0;
  let tieneValor = false;

  for (const id of PRODUCTOS_SUBPRODUCTO_IDS) {
    const kilos = parsearNumero(rendimiento[id]);
    const precio = preciosPorProducto[id];

    if (kilos !== null && kilos > 0 && precio !== undefined) {
      total += precio * kilos;
      tieneValor = true;
    }
  }

  return tieneValor ? Math.round(total) : null;
}

export function sumarKilosRendimiento(
  rendimiento: RendimientoState
): number | null {
  let total = 0;
  let tieneValor = false;

  for (const producto of PRODUCTOS_BALANCE) {
    const kilos = parsearNumero(rendimiento[producto.id]);
    if (kilos !== null) {
      total += kilos;
      tieneValor = true;
    }
  }

  return tieneValor ? total : null;
}

export function calcularCapoteTotal(
  rendimiento: RendimientoState
): number | null {
  let total = 0;
  let tieneValor = false;

  for (const id of PRODUCTOS_CAPOTE_IDS) {
    const kilos = parsearNumero(rendimiento[id]);
    if (kilos !== null) {
      total += kilos;
      tieneValor = true;
    }
  }

  return tieneValor ? total : null;
}

export function calcularCostoTotalCompra(
  compra: CompraDiaState
): number | null {
  const kilos = parsearNumero(compra.kilosTotales);
  const precio = parsearNumero(compra.precioCompraKg);
  const gastos = parsearNumero(compra.gastosAdicionales) ?? 0;

  if (kilos === null || precio === null) return null;

  return kilos * precio + gastos;
}

export function calcularResultadosBalance(
  compra: CompraDiaState,
  rendimientoSnapshot: RendimientoState,
  precios: PreciosState,
  costoTotalManual: string
): ResultadosCalculados {
  const costoDesdeCompra = calcularCostoTotalCompra(compra);
  const costoTotal = parsearNumero(costoTotalManual) ?? costoDesdeCompra;

  let ventaTotal = 0;
  let tieneVenta = false;

  for (const producto of PRODUCTOS_BALANCE) {
    const kilos = parsearNumero(rendimientoSnapshot[producto.id]);
    const precio = parsearNumero(precios[producto.id].precioNuevo);

    if (kilos !== null && precio !== null) {
      ventaTotal += kilos * precio;
      tieneVenta = true;
    }
  }

  const venta = tieneVenta ? ventaTotal : null;
  const utilidadTotal =
    venta !== null && costoTotal !== null ? venta - costoTotal : null;

  const puercos = parsearNumero(compra.numeroPuercos);
  const utilidadPorPuerco =
    utilidadTotal !== null && puercos !== null && puercos > 0
      ? utilidadTotal / puercos
      : null;

  const margen =
    utilidadTotal !== null && venta !== null && venta > 0
      ? (utilidadTotal / venta) * 100
      : null;

  return {
    ventaTotal: venta,
    costoTotal,
    utilidadTotal,
    utilidadPorPuerco,
    margen,
  };
}

export function resultadosCalculadosAString(
  calculados: ResultadosCalculados
): ResultadosState {
  return {
    utilidadTotal: formatearPesosEnterosInput(calculados.utilidadTotal),
    utilidadPorPuerco: formatearPesosEnterosInput(calculados.utilidadPorPuerco),
    margen:
      calculados.margen === null
        ? ""
        : formatearNumeroBalance(calculados.margen, 1),
  };
}

export function indicadorDesdeMargen(
  margen: number | null
): IndicadorResultado | null {
  if (margen === null) return null;
  if (margen >= 15) return "excelente";
  if (margen >= 8) return "aceptable";
  return "revisar";
}

export const ETIQUETAS_INDICADOR: Record<
  IndicadorResultado,
  { emoji: string; etiqueta: string; className: string }
> = {
  excelente: {
    emoji: "🟢",
    etiqueta: "Excelente",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  aceptable: {
    emoji: "🟡",
    etiqueta: "Aceptable",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  revisar: {
    emoji: "🔴",
    etiqueta: "Revisar precios",
    className: "border-red-200 bg-red-50 text-red-900",
  },
};

export function normalizarPreciosEnteros(precios: PreciosState): PreciosState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      const valor = parsearNumero(precios[producto.id]?.precioNuevo ?? "");
      acc[producto.id] = {
        precioNuevo:
          valor === null ? "" : formatearPesosEnterosInput(valor),
      };
      return acc;
    },
    {} as PreciosState
  );
}

export function clonarPrecios(precios: PreciosState): PreciosState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = {
        precioNuevo: precios[producto.id]?.precioNuevo ?? "",
      };
      return acc;
    },
    {} as PreciosState
  );
}

export function clonarPreciosAnteriores(
  precios: PreciosAnterioresState
): PreciosAnterioresState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = {
        precio: precios[producto.id]?.precio ?? "",
      };
      return acc;
    },
    {} as PreciosAnterioresState
  );
}

export function normalizarPreciosAnterioresEnteros(
  precios: PreciosAnterioresState
): PreciosAnterioresState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      const valor = parsearNumero(precios[producto.id]?.precio ?? "");
      acc[producto.id] = {
        precio: valor === null ? "" : formatearPesosEnterosInput(valor),
      };
      return acc;
    },
    {} as PreciosAnterioresState
  );
}

export function preciosAnterioresComoNumeros(
  precios: PreciosAnterioresState
): Record<ProductoBalanceId, number | null> {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = parsearNumero(precios[producto.id].precio);
      return acc;
    },
    {} as Record<ProductoBalanceId, number | null>
  );
}

export function tienePreciosAnterioresCompletos(
  precios: PreciosAnterioresState
): boolean {
  return PRODUCTOS_BALANCE.every(
    (producto) => parsearNumero(precios[producto.id].precio) !== null
  );
}

export function indicePasoPrecios(): number {
  return PASOS_BALANCE.findIndex((paso) => paso.id === "precios");
}
