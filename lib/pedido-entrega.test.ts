import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  etiquetaDireccionEntregaPedido,
  resolverDireccionEntregaPedido,
} from "@/lib/pedido-entrega";

describe("resolverDireccionEntregaPedido", () => {
  it("extrae dirección de envío a domicilio del pedido", () => {
    const resultado = resolverDireccionEntregaPedido(
      "Envío a domicilio: Av. Reforma 123, Col. Centro"
    );
    assert.equal(resultado.tipo, "domicilio");
    if (resultado.tipo === "domicilio") {
      assert.equal(resultado.direccion, "Av. Reforma 123, Col. Centro");
    }
  });

  it("extrae dirección registrada con prefijo largo", () => {
    const resultado = resolverDireccionEntregaPedido(
      "Envío a domicilio (dirección registrada): Calle 5 de Mayo 45"
    );
    assert.equal(resultado.tipo, "domicilio");
    if (resultado.tipo === "domicilio") {
      assert.equal(resultado.direccion, "Calle 5 de Mayo 45");
    }
  });

  it("detecta recoger en tienda", () => {
    assert.deepEqual(
      resolverDireccionEntregaPedido("Entrega: cliente pasa a recoger"),
      { tipo: "recoger" }
    );
  });

  it("devuelve no registrada si no hay anotación de entrega", () => {
    assert.deepEqual(resolverDireccionEntregaPedido(null), {
      tipo: "no_registrada",
    });
    assert.deepEqual(resolverDireccionEntregaPedido("Nota interna"), {
      tipo: "no_registrada",
    });
  });

  it("formatea etiqueta visible", () => {
    assert.equal(
      etiquetaDireccionEntregaPedido({
        tipo: "domicilio",
        direccion: "Calle 1",
      }),
      "Calle 1"
    );
    assert.equal(
      etiquetaDireccionEntregaPedido({ tipo: "recoger" }),
      "Cliente pasa a recoger"
    );
    assert.equal(
      etiquetaDireccionEntregaPedido({ tipo: "no_registrada" }),
      "No registrada"
    );
  });
});
