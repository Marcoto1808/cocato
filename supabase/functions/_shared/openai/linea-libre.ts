export const PRODUCTO_LINEA_LIBRE_ID = "solicitud-cliente";

export const PRODUCTO_PENDIENTE_DISAMBIGUACION_ID = "pendiente-disambiguacion";

export function esLineaLibre(productoId: string): boolean {
  return productoId === PRODUCTO_LINEA_LIBRE_ID;
}

export function esLineaPendienteDisambiguacion(productoId: string): boolean {
  return productoId === PRODUCTO_PENDIENTE_DISAMBIGUACION_ID;
}

export function esLineaSinProductoCatalogo(productoId: string): boolean {
  return esLineaLibre(productoId) || esLineaPendienteDisambiguacion(productoId);
}
