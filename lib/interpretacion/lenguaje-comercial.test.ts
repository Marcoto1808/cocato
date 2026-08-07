import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limpiarPrefijoPedido } from "@/lib/interpretacion/cantidad-natural";
import { normalizarLenguajeComercial } from "@/lib/interpretacion/lenguaje-comercial";

describe("normalizarLenguajeComercial", () => {
  const casos: Array<[string, string]> = [
    ["Quiero pedir 3 costillas", "3 costillas"],
    ["Dame 5 kilos de costilla", "5 kilos de costilla"],
    ["Necesito 2 capotes", "2 capotes"],
    ["Ponme 3 espinazos", "3 espinazos"],
    ["Quisiera 1 kilo de pierna", "1 kilo de pierna"],
    ["Me das 2 capotes dobles", "2 capotes dobles"],
    ["Échame medio kilo de retazo", "medio kilo de retazo"],
    ["Mándame 4 costillas", "4 costillas"],
    ["Ocupo 3 kilos de bistec", "3 kilos de bistec"],
    ["Por favor 2 capotes", "2 capotes"],
    ["Quiero 5 kilos de costilla, por favor", "5 kilos de costilla"],
  ];

  for (const [entrada, esperado] of casos) {
    it(`normaliza "${entrada}" → "${esperado}"`, () => {
      assert.equal(normalizarLenguajeComercial(entrada), esperado);
    });
  }
});

describe("limpiarPrefijoPedido integra lenguaje comercial", () => {
  it("limpia saludo y frase comercial antes del pedido", () => {
    assert.equal(
      limpiarPrefijoPedido("Hola, quiero pedir 3 costillas"),
      "3 costillas"
    );
  });

  it("no altera pedidos directos sin frases comerciales", () => {
    assert.equal(limpiarPrefijoPedido("3 costillas"), "3 costillas");
  });
});
