import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsearDatosRegistro } from "@/lib/whatsapp/cliente-registro";

describe("parsearDatosRegistro", () => {
  const casosValidos = [
    "Carnicería Torres",
    "Carnes Torres",
    "Restaurante El Fogón",
    "Taquería El Güero",
    "Fonda Lupita",
    "Abarrotes San Juan",
    "Juan Pérez",
    "María López",
    "Pedro",
    "Carnicería Torres - Carnicería",
  ];

  for (const nombre of casosValidos) {
    it(`acepta "${nombre}" sin exigir formato`, () => {
      const datos = parsearDatosRegistro(nombre);
      assert.ok(datos);
      assert.equal(datos.nombreNegocio, nombre);
      assert.equal(datos.tipoNegocio, "");
    });
  }

  it("conserva espacios internos y mayúsculas del usuario", () => {
    const datos = parsearDatosRegistro("  Restaurante  El  Fogón  ");
    assert.ok(datos);
    assert.equal(datos.nombreNegocio, "Restaurante  El  Fogón");
  });

  it("rechaza nombre vacío", () => {
    assert.equal(parsearDatosRegistro(""), null);
    assert.equal(parsearDatosRegistro("   "), null);
  });
});
