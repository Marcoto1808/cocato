export type PeriodoReporte =
  | "hoy"
  | "semana"
  | "mes"
  | "anio"
  | "personalizado";

export type RangoFechas = {
  inicio: Date;
  fin: Date;
  etiqueta: string;
};

function inicioDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function finDia(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

function inicioSemana(fecha: Date): Date {
  const copia = inicioDia(fecha);
  const dia = copia.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  copia.setDate(copia.getDate() - diff);
  return copia;
}

function inicioMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

function inicioAnio(fecha: Date): Date {
  return new Date(fecha.getFullYear(), 0, 1);
}

export function calcularRangoPeriodo(
  periodo: PeriodoReporte,
  personalizado?: { desde: string; hasta: string }
): RangoFechas {
  const hoy = new Date();

  switch (periodo) {
    case "hoy":
      return {
        inicio: inicioDia(hoy),
        fin: finDia(hoy),
        etiqueta: "Hoy",
      };
    case "semana":
      return {
        inicio: inicioSemana(hoy),
        fin: finDia(hoy),
        etiqueta: "Esta semana",
      };
    case "mes":
      return {
        inicio: inicioMes(hoy),
        fin: finDia(hoy),
        etiqueta: "Este mes",
      };
    case "anio":
      return {
        inicio: inicioAnio(hoy),
        fin: finDia(hoy),
        etiqueta: "Este año",
      };
    case "personalizado": {
      const desde = personalizado?.desde
        ? inicioDia(new Date(`${personalizado.desde}T00:00:00`))
        : inicioMes(hoy);
      const hasta = personalizado?.hasta
        ? finDia(new Date(`${personalizado.hasta}T00:00:00`))
        : finDia(hoy);

      return {
        inicio: desde,
        fin: hasta,
        etiqueta: "Personalizado",
      };
    }
  }
}

export function pedidoEnRango(fechaIso: string, rango: RangoFechas): boolean {
  const fecha = new Date(fechaIso);
  return fecha >= rango.inicio && fecha <= rango.fin;
}

export function fechaEnRango(fechaIso: string, rango: RangoFechas): boolean {
  return pedidoEnRango(fechaIso, rango);
}

export const ETIQUETAS_PERIODO: Record<PeriodoReporte, string> = {
  hoy: "Hoy",
  semana: "Semana",
  mes: "Mes",
  anio: "Año",
  personalizado: "Personalizado",
};
