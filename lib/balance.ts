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

export type CompraDiaState = {
  fecha: string;
  numeroPuercos: string;
  kilosTotales: string;
  precioCompraKg: string;
  gastosAdicionales: string;
};

export type RendimientoState = Record<ProductoBalanceId, string>;

export type PreciosMercadoState = Record<
  ProductoBalanceId,
  { precioMercado: string; miPrecio: string }
>;

export type ResultadosState = {
  ventaTotal: string;
  costoTotal: string;
  utilidadTotal: string;
  utilidadPorPuerco: string;
  utilidadPorKilogramo: string;
  margen: string;
};

export type ResultadosCalculados = {
  ventaTotal: number | null;
  costoTotal: number | null;
  utilidadTotal: number | null;
  utilidadPorPuerco: number | null;
  utilidadPorKilogramo: number | null;
  margen: number | null;
};

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
    id: "precios-mercado",
    titulo: "Precios del mercado",
    descripcion: "Compara el mercado con tus precios de venta propuestos.",
  },
  {
    id: "resultados",
    titulo: "Resultados",
    descripcion: "Indicadores del balance actualizados en tiempo real.",
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

export function crearPreciosMercadoInicial(): PreciosMercadoState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = { precioMercado: "", miPrecio: "" };
      return acc;
    },
    {} as PreciosMercadoState
  );
}

export function crearResultadosInicial(): ResultadosState {
  return {
    ventaTotal: "",
    costoTotal: "",
    utilidadTotal: "",
    utilidadPorPuerco: "",
    utilidadPorKilogramo: "",
    margen: "",
  };
}

export function parsearNumero(valor: string): number | null {
  const limpio = valor.trim().replace(/,/g, "");
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function formatearNumeroBalance(valor: number | null, decimales = 2): string {
  if (valor === null) return "";
  return valor.toFixed(decimales).replace(/\.?0+$/, "");
}

export function calcularDiferenciaPrecio(
  precioMercado: string,
  miPrecio: string
): number | null {
  const mercado = parsearNumero(precioMercado);
  const propio = parsearNumero(miPrecio);
  if (mercado === null || propio === null) return null;
  return propio - mercado;
}

export function sumarKilosRendimiento(rendimiento: RendimientoState): number | null {
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

export function calcularCostoTotalCompra(compra: CompraDiaState): number | null {
  const kilos = parsearNumero(compra.kilosTotales);
  const precio = parsearNumero(compra.precioCompraKg);
  const gastos = parsearNumero(compra.gastosAdicionales) ?? 0;

  if (kilos === null || precio === null) return null;

  return kilos * precio + gastos;
}

export function calcularResultadosBalance(
  compra: CompraDiaState,
  rendimiento: RendimientoState,
  precios: PreciosMercadoState,
  costoTotalManual: string
): ResultadosCalculados {
  const costoDesdeCompra = calcularCostoTotalCompra(compra);
  const costoTotal =
    parsearNumero(costoTotalManual) ?? costoDesdeCompra;

  let ventaTotal = 0;
  let tieneVenta = false;

  for (const producto of PRODUCTOS_BALANCE) {
    const kilos = parsearNumero(rendimiento[producto.id]);
    const precio = parsearNumero(precios[producto.id].miPrecio);

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

  const kilosRendimiento = sumarKilosRendimiento(rendimiento);
  const kilosBase =
    kilosRendimiento ?? parsearNumero(compra.kilosTotales);
  const utilidadPorKilogramo =
    utilidadTotal !== null && kilosBase !== null && kilosBase > 0
      ? utilidadTotal / kilosBase
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
    utilidadPorKilogramo,
    margen,
  };
}

export function resultadosCalculadosAString(
  calculados: ResultadosCalculados
): ResultadosState {
  return {
    ventaTotal: formatearNumeroBalance(calculados.ventaTotal),
    costoTotal: formatearNumeroBalance(calculados.costoTotal),
    utilidadTotal: formatearNumeroBalance(calculados.utilidadTotal),
    utilidadPorPuerco: formatearNumeroBalance(calculados.utilidadPorPuerco),
    utilidadPorKilogramo: formatearNumeroBalance(
      calculados.utilidadPorKilogramo
    ),
    margen:
      calculados.margen === null ? "" : formatearNumeroBalance(calculados.margen, 1),
  };
}
