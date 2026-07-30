export type PrecioDiaItem = {
  id: string;
  etiqueta: string;
  nombre: string;
  categoria: string;
};

export type PrecioDiaFila = {
  id: string;
  etiqueta: string;
  precio: number | null;
};

/** Productos destacados en el panel lateral del dashboard del trabajador. */
export const PRECIOS_DIA_DASHBOARD: PrecioDiaItem[] = [
  { id: "capote", etiqueta: "Capote", nombre: "Capote", categoria: "Cerdo" },
  {
    id: "costilla",
    etiqueta: "Costilla",
    nombre: "Costilla",
    categoria: "Cerdo",
  },
  {
    id: "espinazo",
    etiqueta: "Espinazo",
    nombre: "Espinazo",
    categoria: "Cerdo",
  },
  {
    id: "espaldilla",
    etiqueta: "Espaldilla",
    nombre: "Espaldilla",
    categoria: "Cerdo",
  },
  { id: "pierna", etiqueta: "Pierna", nombre: "Pierna", categoria: "Cerdo" },
  {
    id: "bistec-res",
    etiqueta: "Bistec Res",
    nombre: "Bistec de res",
    categoria: "Res",
  },
  {
    id: "bistec-puerco",
    etiqueta: "Bistec Puerco",
    nombre: "Bistec de cerdo",
    categoria: "Cerdo",
  },
  {
    id: "molida-res",
    etiqueta: "Molida Res",
    nombre: "Molida corriente",
    categoria: "Res",
  },
  {
    id: "molida-puerco",
    etiqueta: "Molida Puerco",
    nombre: "Molida de cerdo",
    categoria: "Cerdo",
  },
];

export function resolverPreciosDelDia(
  productos: Array<{
    nombre: string;
    categoria: string;
    precio_kg: number | null;
  }>
): PrecioDiaFila[] {
  return PRECIOS_DIA_DASHBOARD.map((item) => {
    const producto = productos.find(
      (candidato) =>
        candidato.nombre === item.nombre &&
        candidato.categoria === item.categoria
    );

    const precio =
      producto?.precio_kg !== null && producto?.precio_kg !== undefined
        ? Number(producto.precio_kg)
        : null;

    return {
      id: item.id,
      etiqueta: item.etiqueta,
      precio: Number.isFinite(precio) ? precio : null,
    };
  });
}

export function formatPrecioDelDia(precio: number | null): string {
  if (precio === null || !Number.isFinite(precio)) return "—";
  return `$${Math.round(precio)}`;
}
