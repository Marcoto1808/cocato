import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizarExpresionesCantidad,
  parsearSegmentoPedido,
  segmentarMensajePedido,
} from "@/lib/interpretacion/cantidad-natural";

describe("normalizarExpresionesCantidad", () => {
  const casos: Array<[string, string]> = [
    ["medio kilo", "0.5 kg"],
    ["medio kg", "0.5 kg"],
    ["kilo y medio", "1.5 kg"],
    ["kilo y cuarto", "1.25 kg"],
    ["cuarto de kilo", "0.25 kg"],
    ["tres cuartos de kilo", "0.75 kg"],
    ["2 kilos y medio", "2.5 kg"],
    ["kilo", "1 kg"],
  ];

  for (const [entrada, esperado] of casos) {
    it(`convierte "${entrada}" → "${esperado}"`, () => {
      assert.equal(normalizarExpresionesCantidad(entrada), esperado);
    });
  }

  it("normaliza expresiones con producto", () => {
    assert.equal(
      normalizarExpresionesCantidad("medio kilo de pierna"),
      "0.5 kg de pierna"
    );
    assert.equal(
      normalizarExpresionesCantidad("kilo y medio de costilla"),
      "1.5 kg de costilla"
    );
    assert.equal(
      normalizarExpresionesCantidad("2 kilos y medio de pierna"),
      "2.5 kg de pierna"
    );
  });

  it("no altera cantidades numéricas explícitas", () => {
    assert.equal(
      normalizarExpresionesCantidad("5 kilos de pierna"),
      "5 kilos de pierna"
    );
  });
});

describe("parsearSegmentoPedido con cantidades naturales", () => {
  it("interpreta expresiones de peso normalizadas", () => {
    const parsed = parsearSegmentoPedido("medio kilo de pierna");
    assert.ok(parsed);
    assert.equal(parsed.cantidad, 0.5);
    assert.equal(parsed.unidad, "kg");
    assert.equal(parsed.productoTexto, "pierna");
  });

  it("interpreta kilo y medio de producto", () => {
    const parsed = parsearSegmentoPedido("kilo y medio de costilla");
    assert.ok(parsed);
    assert.equal(parsed.cantidad, 1.5);
    assert.equal(parsed.unidad, "kg");
    assert.equal(parsed.productoTexto, "costilla");
  });

  it("interpreta 2 kilos y medio de producto", () => {
    const parsed = parsearSegmentoPedido("2 kilos y medio de pierna");
    assert.ok(parsed);
    assert.equal(parsed.cantidad, 2.5);
    assert.equal(parsed.unidad, "kg");
    assert.equal(parsed.productoTexto, "pierna");
  });

  it("segmenta mensajes con kilo y medio sin partir la expresión", () => {
    const segmentos = segmentarMensajePedido("kilo y medio de pierna");
    assert.deepEqual(segmentos, ["1.5 kg de pierna"]);
  });
});
