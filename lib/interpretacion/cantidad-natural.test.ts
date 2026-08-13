import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  desconcatenarCantidadesProductoSinEspacio,
  formatearCantidadEnResumen,
  normalizarExpresionesCantidad,
  parsearSegmentoPedido,
  pluralizarNombreProducto,
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

describe("segmentarMensajePedido sin comas", () => {
  it("separa productos solo por cantidad + nombre", () => {
    const segmentos = segmentarMensajePedido(
      "3 piernas 2 espinazos 1 capote 3 kg de bistec 3 cabezas"
    );
    assert.deepEqual(segmentos, [
      "3 piernas",
      "2 espinazos",
      "1 capote",
      "3 kg de bistec",
      "3 cabezas",
    ]);
  });

  it("separa importes, piezas y peso en un solo bloque", () => {
    const segmentos = segmentarMensajePedido(
      "200 pesos de maciza 3 piernas medio kilo de bistec 2 cabezas"
    );
    assert.deepEqual(segmentos, [
      "200 pesos de maciza",
      "3 piernas",
      "0.5 kg de bistec",
      "2 cabezas",
    ]);
  });

  it("sigue separando por conectores y comas", () => {
    assert.deepEqual(
      segmentarMensajePedido("2 costillas y 3 espinazos y 2 cabezas"),
      ["2 costillas", "3 espinazos", "2 cabezas"]
    );
    assert.deepEqual(
      segmentarMensajePedido("3 piernas, 2 espinazos, 1 capote"),
      ["3 piernas", "2 espinazos", "1 capote"]
    );
  });

  it("no parte expresiones de kilo y medio en pedidos mixtos", () => {
    const segmentos = segmentarMensajePedido(
      "2 kilos y medio de pierna 3 costillas"
    );
    assert.deepEqual(segmentos, ["2.5 kg de pierna", "3 costillas"]);
  });

  it("separa cantidades pegadas sin espacios", () => {
    assert.equal(
      desconcatenarCantidadesProductoSinEspacio("3piernas4espaldillas5costillas"),
      "3 piernas 4 espaldillas 5 costillas"
    );

    assert.deepEqual(
      segmentarMensajePedido("3piernas4espaldillas5costillas y 1 esoinazo"),
      ["3 piernas", "4 espaldillas", "5 costillas", "1 esoinazo"]
    );

    assert.deepEqual(
      segmentarMensajePedido("3piernas4espaldillas5costillas1espinazo"),
      ["3 piernas", "4 espaldillas", "5 costillas", "1 espinazo"]
    );

    assert.deepEqual(
      segmentarMensajePedido("3piernas 4espaldillas 5costillas y 1espinazo"),
      ["3 piernas", "4 espaldillas", "5 costillas", "1 espinazo"]
    );

    assert.deepEqual(
      segmentarMensajePedido("3 piernas, 4 espaldillas, 5 costillas y 1 espinazo"),
      ["3 piernas", "4 espaldillas", "5 costillas", "1 espinazo"]
    );

    assert.deepEqual(
      segmentarMensajePedido("1 capote2piernas y 200 pesos de bistec de puerco"),
      ["1 capote", "2 piernas", "200 pesos de bistec de puerco"]
    );

    assert.equal(
      desconcatenarCantidadesProductoSinEspacio(
        "200bistecdepuerco1capote3costillas3kilosdemanitas"
      ),
      "200 de bistec de puerco 1 capote 3 costillas 3 kilos de manitas"
    );

    assert.deepEqual(
      segmentarMensajePedido(
        "200 de bistec de puerco1capote3costillas y 3kilos de manitas"
      ),
      [
        "200 de bistec de puerco",
        "1 capote",
        "3 costillas",
        "3 kilos de manitas",
      ]
    );

    assert.deepEqual(
      segmentarMensajePedido(
        "200bistecdepuerco1capote3costillas3kilosdemanitas"
      ),
      [
        "200 de bistec de puerco",
        "1 capote",
        "3 costillas",
        "3 kilos de manitas",
      ]
    );
  });
});

describe("pluralizarNombreProducto en resumen", () => {
  it("usa singular cuando la cantidad es exactamente 1", () => {
    assert.equal(pluralizarNombreProducto("Pierna", 1), "Pierna");
    assert.equal(pluralizarNombreProducto("Piernas", 1), "Pierna");
    assert.equal(pluralizarNombreProducto("Costilla", 1), "Costilla");
    assert.equal(pluralizarNombreProducto("Espinazo", 1), "Espinazo");
    assert.equal(pluralizarNombreProducto("Cabeza de cerdo", 1), "Cabeza de cerdo");
  });

  it("usa plural cuando la cantidad es mayor que 1", () => {
    assert.equal(pluralizarNombreProducto("Pierna", 2), "Piernas");
    assert.equal(pluralizarNombreProducto("Costilla", 3), "Costillas");
    assert.equal(pluralizarNombreProducto("Espinazo", 4), "Espinazos");
    assert.equal(pluralizarNombreProducto("Cabeza", 2), "Cabezas");
    assert.equal(pluralizarNombreProducto("Pulpa", 5), "Pulpas");
    assert.equal(pluralizarNombreProducto("Capote", 2), "Capotes");
    assert.equal(pluralizarNombreProducto("Capote Doble", 3), "Capotes Dobles");
    assert.equal(pluralizarNombreProducto("Cabeza de cerdo", 2), "Cabezas de cerdo");
  });

  it("formatea el resumen del carrito con pluralización", () => {
    assert.equal(
      formatearCantidadEnResumen(1, "pieza", "Pierna"),
      "• 1 Pierna"
    );
    assert.equal(
      formatearCantidadEnResumen(3, "pieza", "Costilla"),
      "• 3 Costillas"
    );
    assert.equal(
      formatearCantidadEnResumen(2, "kg", "Pierna"),
      "• 2 kg de Pierna"
    );
    assert.equal(
      formatearCantidadEnResumen(0.5, "kg", "bistec", "0.5 kg"),
      "• 0.5 kg de bistec"
    );
    assert.equal(
      formatearCantidadEnResumen(1, "pieza", "molida", "200 pesos"),
      "• $200 de molida"
    );
    assert.equal(
      formatearCantidadEnResumen(1, "pieza", "Bistec de puerco", null, "300 pesos de bistec de res"),
      "• $300 de bistec de res"
    );
    assert.equal(
      formatearCantidadEnResumen(1, "pieza", "Bistec de puerco", null, "300 pesos de bistec para asar"),
      "• $300 de bistec para asar"
    );
  });
});
