function capitalizar(texto: string) {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function generarSaludo(nombreUsuario?: string | null) {
  if (!nombreUsuario?.trim()) {
    return "Bienvenido a COCATO";
  }

  const hora = new Date().getHours();
  const nombre = capitalizar(nombreUsuario.trim());

  if (hora < 12) return `Buenos días, ${nombre}.`;
  if (hora < 19) return `Buenas tardes, ${nombre}.`;
  return `Buenas noches, ${nombre}.`;
}

export function esFechaHoy(fechaIso: string) {
  const fecha = new Date(fechaIso);
  const hoy = new Date();

  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

export function esFechaMesActual(fechaIso: string) {
  const fecha = new Date(fechaIso);
  const hoy = new Date();

  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth()
  );
}

export function esClienteActivoReciente(fechaIso: string, dias = 30) {
  const fecha = new Date(fechaIso);
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  return fecha >= limite;
}

export function formatearMoneda(cantidad: number) {
  return cantidad.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

export function formatearFechaPedido(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatearHoraPedido(fecha: string) {
  return new Date(fecha).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
