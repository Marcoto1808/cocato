import type { DisambiguacionPendiente } from "@/lib/interpretacion/disambiguacion";

export type InterpretacionMensaje =
  | {
      tipo: "pedido";
      lineas: LineaInterpretada[];
      observaciones?: string[];
      aclaracion?: string;
      disambiguacion?: DisambiguacionPendiente;
    }  | {
      tipo: "no_interpretado";
      motivo: string;
    }
  | {
      tipo: "referencia_historica";
      motivo: string;
    };

export type LineaInterpretada = {
  producto_id: string;
  cantidad: number;
  unidad: "kg" | "pieza";
  textoOriginal: string;
  cantidadTexto?: string;
  /** Nombre a mostrar cuando no hay producto de catálogo o como override. */
  nombreMostrar?: string;
};

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  unidad: string;
  precio_kg: number;
  activo: boolean;
  categoria?: string;
  aliases?: string[];
};

export interface MensajeInterpreter {
  interpretar(input: {
    texto: string;
    productos: ProductoCatalogo[];
  }): Promise<InterpretacionMensaje>;
}
