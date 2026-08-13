import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esCancelacion } from "@/lib/whatsapp/conversation-states";
import {
  OPCIONES_CANCELACION,
  OPCIONES_DESEAR_AGREGAR_MAS,
  OPCIONES_ENTREGA,
  OPCIONES_SI_NO,
  OPCION_CONFIRMAR,
  OPCION_RECHAZAR,
  OPCION_SEGUIR_AGREGANDO,
  OPCION_TERMINAR_PEDIDO,
  OPCIONES_ENTREGA_IDS,
  resolverOpcionConversacional,
} from "@/lib/whatsapp/resolver-opcion-conversacional";

describe("resolverOpcionConversacional", () => {
  it("acepta números como hoy", () => {
    assert.equal(
      resolverOpcionConversacional("1", OPCIONES_SI_NO),
      OPCION_CONFIRMAR
    );
    assert.equal(
      resolverOpcionConversacional("2", OPCIONES_SI_NO),
      OPCION_RECHAZAR
    );
  });

  it("opción 1: sí, si, claro, ok", () => {
    for (const mensaje of ["sí", "si", "claro", "ok"]) {
      assert.equal(
        resolverOpcionConversacional(mensaje, OPCIONES_SI_NO),
        OPCION_CONFIRMAR,
        mensaje
      );
    }
  });

  it("opción 2: no, ya, es todo, gracias", () => {
    for (const mensaje of ["no", "ya", "es todo", "gracias"]) {
      assert.equal(
        resolverOpcionConversacional(mensaje, OPCIONES_SI_NO),
        OPCION_RECHAZAR,
        mensaje
      );
    }
  });

  it("resuelve desear agregar más", () => {
    assert.equal(
      resolverOpcionConversacional("si", OPCIONES_DESEAR_AGREGAR_MAS),
      OPCION_SEGUIR_AGREGANDO
    );
    assert.equal(
      resolverOpcionConversacional("claro", OPCIONES_DESEAR_AGREGAR_MAS),
      OPCION_SEGUIR_AGREGANDO
    );
    assert.equal(
      resolverOpcionConversacional("1", OPCIONES_DESEAR_AGREGAR_MAS),
      OPCION_SEGUIR_AGREGANDO
    );
    assert.equal(
      resolverOpcionConversacional("ya", OPCIONES_DESEAR_AGREGAR_MAS),
      OPCION_TERMINAR_PEDIDO
    );
    assert.equal(
      resolverOpcionConversacional("nada mas", OPCIONES_DESEAR_AGREGAR_MAS),
      OPCION_TERMINAR_PEDIDO
    );
  });

  it("no interpreta pedido escrito que empieza con cantidad como agregar más", () => {
    assert.equal(
      resolverOpcionConversacional(
        "1 capote2piernas y 200 pesos de bistec de puerco",
        OPCIONES_DESEAR_AGREGAR_MAS
      ),
      null
    );
    assert.equal(
      resolverOpcionConversacional("2 piernas", OPCIONES_DESEAR_AGREGAR_MAS),
      null
    );
  });

  it("resuelve opciones de entrega", () => {
    assert.equal(
      resolverOpcionConversacional("domicilio", OPCIONES_ENTREGA),
      OPCIONES_ENTREGA_IDS.envio
    );
    assert.equal(
      resolverOpcionConversacional("1", OPCIONES_ENTREGA),
      OPCIONES_ENTREGA_IDS.envio
    );
    assert.equal(
      resolverOpcionConversacional("recojo", OPCIONES_ENTREGA),
      OPCIONES_ENTREGA_IDS.recoger
    );
    assert.equal(
      resolverOpcionConversacional("2", OPCIONES_ENTREGA),
      OPCIONES_ENTREGA_IDS.recoger
    );
  });

  it("devuelve null si no reconoce la respuesta", () => {
    assert.equal(
      resolverOpcionConversacional("medio kilo de maciza", OPCIONES_SI_NO),
      null
    );
  });

  it("no trata números como opción en listas de una sola entrada", () => {
    assert.equal(resolverOpcionConversacional("1", OPCIONES_CANCELACION), null);
    assert.equal(esCancelacion("1"), false);
    assert.equal(esCancelacion("cancelar"), true);
  });
});
