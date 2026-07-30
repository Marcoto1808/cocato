import {
  PRODUCTOS_BALANCE,
  type CompraDiaState,
  type PreciosAnterioresState,
  type PreciosState,
  type RendimientoState,
} from "@/lib/balance";

export type BalanceBorradorLocal = {
  compra: CompraDiaState;
  costoTotal: string;
  rendimiento: RendimientoState;
  capoteReal: string;
  rendimientoParaPrecios: RendimientoState;
  capoteRealParaPrecios: string;
  preciosAnteriores: PreciosAnterioresState;
  preciosGuardados: PreciosState;
  actualizadoEn: string;
};

export type ListaPreciosPublicadaLocal = {
  precios: PreciosState;
  precioCanal: number | null;
  publicadoEn: string;
};

const CLAVE_BORRADOR_BALANCE = "cocato_balance_borrador";
const CLAVE_LISTA_PUBLICADA = "cocato_balance_lista_publicada";
const CLAVE_PRECIOS_ANTERIORES = "cocato_balance_precios_anteriores";

function leerJson<T>(clave: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(clave);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function escribirJson<T>(clave: string, valor: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(clave, JSON.stringify(valor));
}

function leerBorrador(): BalanceBorradorLocal | null {
  return leerJson<BalanceBorradorLocal>(CLAVE_BORRADOR_BALANCE);
}

function escribirBorrador(borrador: BalanceBorradorLocal) {
  escribirJson(CLAVE_BORRADOR_BALANCE, borrador);
}

export function cargarListaPreciosPublicadaLocal(): ListaPreciosPublicadaLocal | null {
  return leerJson<ListaPreciosPublicadaLocal>(CLAVE_LISTA_PUBLICADA);
}

export function cargarPreciosAnterioresGuardadosLocal(): PreciosAnterioresState | null {
  return leerJson<PreciosAnterioresState>(CLAVE_PRECIOS_ANTERIORES);
}

function guardarPreciosAnterioresLocal(preciosAnteriores: PreciosAnterioresState) {
  escribirJson(CLAVE_PRECIOS_ANTERIORES, preciosAnteriores);
}

function guardarListaPublicadaLocal(lista: ListaPreciosPublicadaLocal) {
  escribirJson(CLAVE_LISTA_PUBLICADA, lista);
}

export function persistirListaPublicadaLocal(lista: ListaPreciosPublicadaLocal) {
  guardarListaPublicadaLocal(lista);
}

export function preciosAnterioresDesdePreciosGuardados(
  precios: PreciosState
): PreciosAnterioresState {
  return PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      acc[producto.id] = {
        precio: precios[producto.id]?.precioNuevo ?? "",
      };
      return acc;
    },
    {} as PreciosAnterioresState
  );
}

/** Guarda los precios del balance actual (local por ahora; Supabase después). */
export async function guardarPreciosBalance(
  borrador: BalanceBorradorLocal
): Promise<{ actualizadoEn: string }> {
  const actualizadoEn = new Date().toISOString();
  const preciosAnteriores = preciosAnterioresDesdePreciosGuardados(
    borrador.preciosGuardados
  );

  await new Promise((resolve) => setTimeout(resolve, 300));

  escribirBorrador({
    ...borrador,
    preciosAnteriores,
    actualizadoEn,
  });

  guardarPreciosAnterioresLocal(preciosAnteriores);

  return { actualizadoEn };
}

/** Guarda el borrador completo del balance (local por ahora; Supabase después). */
export async function guardarBorradorBalance(
  borrador: BalanceBorradorLocal
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  escribirBorrador({
    ...borrador,
    actualizadoEn: new Date().toISOString(),
  });
}

/** Publica el balance en Supabase y persiste la base local para el siguiente ciclo. */
export async function publicarBalance(
  borrador: BalanceBorradorLocal,
  precioCanal: number | null,
  opciones?: { publicadoPorId?: string | null }
): Promise<{ publicadoEn: string }> {
  const { publicarBalanceEnSupabase, PublicacionBalanceError } = await import(
    "@/lib/balance-publicacion"
  );

  const preciosAnteriores = preciosAnterioresDesdePreciosGuardados(
    borrador.preciosGuardados
  );

  let publicadoEn: string;

  try {
    const resultado = await publicarBalanceEnSupabase(
      borrador,
      precioCanal,
      opciones
    );
    publicadoEn = resultado.publicadoEn;
  } catch (error) {
    if (error instanceof PublicacionBalanceError) {
      throw error;
    }
    throw new PublicacionBalanceError(
      "No se pudo publicar el balance. Intenta de nuevo."
    );
  }

  escribirBorrador({
    ...borrador,
    preciosAnteriores,
    actualizadoEn: publicadoEn,
  });

  guardarListaPublicadaLocal({
    precios: borrador.preciosGuardados,
    precioCanal,
    publicadoEn,
  });
  guardarPreciosAnterioresLocal(preciosAnteriores);

  return { publicadoEn };
}

export function cargarBorradorBalanceLocal(): BalanceBorradorLocal | null {
  return leerBorrador();
}

export function preciosAnterioresDesdeListaPublicada(
  lista: ListaPreciosPublicadaLocal
): PreciosAnterioresState {
  return preciosAnterioresDesdePreciosGuardados(lista.precios);
}
