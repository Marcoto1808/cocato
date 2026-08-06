export type InterpretacionMensaje =
  | {
      tipo: "pedido";
      lineas: LineaInterpretada[];
      observaciones?: string[];
    }
  | {
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
};

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  unidad: string;
  precio_kg: number;
  activo: boolean;
};

export interface MensajeInterpreter {
  interpretar(input: {
    texto: string;
    productos: ProductoCatalogo[];
  }): Promise<InterpretacionMensaje>;
}
