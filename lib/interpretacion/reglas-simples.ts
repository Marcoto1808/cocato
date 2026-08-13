import type {
  InterpretacionMensaje,
  MensajeInterpreter,
  ProductoCatalogo,
} from "@/lib/interpretacion/mensaje-interpreter";
import { interpretarMensajeComercial } from "@/lib/interpretacion/motor-comercial";

export class ReglasSimplesInterpreter implements MensajeInterpreter {
  async interpretar(input: {
    texto: string;
    productos: ProductoCatalogo[];
  }): Promise<InterpretacionMensaje> {
    return interpretarMensajeComercial(input);
  }
}

export const interpretadorReglasSimples = new ReglasSimplesInterpreter();
