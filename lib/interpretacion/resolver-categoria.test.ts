import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolverSeleccionCategoria } from "@/lib/interpretacion/resolver-categoria";

describe("resolverSeleccionCategoria", () => {
  const categorias = ["Cerdo", "Res"];

  it("acepta número de opción", () => {
    assert.equal(resolverSeleccionCategoria("1", categorias), 1);
    assert.equal(resolverSeleccionCategoria("2", categorias), 2);
  });

  it("acepta cerdo y puerco como Cerdo", () => {
    assert.equal(resolverSeleccionCategoria("cerdo", categorias), 1);
    assert.equal(resolverSeleccionCategoria("puerco", categorias), 1);
    assert.equal(resolverSeleccionCategoria("carne de puerco", categorias), 1);
  });

  it("acepta res y carne de res como Res", () => {
    assert.equal(resolverSeleccionCategoria("res", categorias), 2);
    assert.equal(resolverSeleccionCategoria("carne de res", categorias), 2);
  });

  it("rechaza texto desconocido", () => {
    assert.equal(resolverSeleccionCategoria("pollo", categorias), null);
  });
});
