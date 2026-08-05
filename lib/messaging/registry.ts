import type { MessagingProvider } from "@/lib/messaging/types";

let proveedorActivo: MessagingProvider | null = null;

export function registrarMessagingProvider(proveedor: MessagingProvider): void {
  proveedorActivo = proveedor;
}

export function obtenerMessagingProviderRegistrado(): MessagingProvider | null {
  return proveedorActivo;
}

export function limpiarMessagingProviderRegistrado(): void {
  proveedorActivo = null;
}
