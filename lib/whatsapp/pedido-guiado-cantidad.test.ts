import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  construirConfirmacionSeleccionGuiada,
  construirMenuProductosGuiados,
  construirMensajePostPedidoGuiado,
  construirPreguntaCantidadGuiada,
  formatearLineaResumenGuiado,
  parsearCantidadPedidoGuiado,
  parsearSeleccionesMultiples,
} from "@/lib/whatsapp/pedido-guiado-cantidad";

describe("parsearSeleccionesMultiples", () => {
  it("acepta selección múltiple 1 2 4", () => {
    assert.deepEqual(parsearSeleccionesMultiples("1 2 4", 7), [1, 2, 4]);
  });

  it("acepta dígitos juntos 124 como 1, 2, 4", () => {
    assert.deepEqual(parsearSeleccionesMultiples("124", 7), [1, 2, 4]);
  });

  it("acepta un solo número", () => {
    assert.deepEqual(parsearSeleccionesMultiples("1", 7), [1]);
  });

  it("acepta opción 10 cuando existe en el menú", () => {
    assert.deepEqual(parsearSeleccionesMultiples("10", 11), [10]);
  });

  it("rechaza opciones fuera de rango", () => {
    assert.equal(parsearSeleccionesMultiples("1 8", 7), null);
  });

  it("no interpreta número con texto como selección de menú", () => {
    assert.equal(parsearSeleccionesMultiples("2 capotes dobles", 7), null);
    assert.equal(parsearSeleccionesMultiples("3 costillas de puerco", 7), null);
  });
});

describe("parsearCantidadPedidoGuiado", () => {
  it("PRUEBA 3: número solo → piezas", () => {
    const resultado = parsearCantidadPedidoGuiado("3", "Capote");
    assert.equal(resultado?.unidad, "pieza");
    assert.equal(resultado?.cantidad, 3);
    assert.equal(resultado?.cantidadTexto, "3 piezas");
  });

  it("PRUEBA 3: 3 piezas → piezas", () => {
    const resultado = parsearCantidadPedidoGuiado("3 piezas", "Capote");
    assert.equal(resultado?.unidad, "pieza");
    assert.equal(resultado?.cantidad, 3);
  });

  it("PRUEBA 3: 5 kg → kg", () => {
    const resultado = parsearCantidadPedidoGuiado("5 kg", "Pierna");
    assert.equal(resultado?.unidad, "kg");
    assert.equal(resultado?.cantidad, 5);
  });

  it("PRUEBA 3: $200 → importe", () => {
    const resultado = parsearCantidadPedidoGuiado("$200", "Pulpa");
    assert.equal(resultado?.cantidadTexto, "$200");
    assert.equal(resultado?.cantidad, 1);
  });

  it("PRUEBA 3: 200 pesos → importe", () => {
    const resultado = parsearCantidadPedidoGuiado("200 pesos", "Pulpa");
    assert.match(resultado?.cantidadTexto ?? "", /200/);
  });

  it("PRUEBA 3: 200 solo NO es importe", () => {
    const resultado = parsearCantidadPedidoGuiado("200", "Pulpa");
    assert.equal(resultado?.unidad, "pieza");
    assert.equal(resultado?.cantidad, 200);
  });

  it("PRUEBA 3: medio kilo → 0.5 kg", () => {
    const resultado = parsearCantidadPedidoGuiado("medio kilo", "Pierna");
    assert.equal(resultado?.unidad, "kg");
    assert.equal(resultado?.cantidad, 0.5);
  });

  it("acepta lenguaje natural con producto", () => {
    const resultado = parsearCantidadPedidoGuiado("quiero 3 capotes", "Capote");
    assert.equal(resultado?.cantidad, 3);
    assert.equal(resultado?.unidad, "pieza");
  });

  it("acepta uno → 1 pieza", () => {
    const resultado = parsearCantidadPedidoGuiado("uno", "Capote");
    assert.equal(resultado?.cantidad, 1);
    assert.equal(resultado?.cantidadTexto, "1 pieza");
  });
});

describe("construirMenuProductosGuiados", () => {
  it("muestra instrucciones claras para elegir o escribir producto", () => {
    const mensaje = construirMenuProductosGuiados("Cerdo", [{ nombre: "Costilla" }]);

    assert.match(mensaje, /Elija el número del producto que desea\./);
    assert.match(mensaje, /Puede elegir uno o varios, por ejemplo: 1 2 4\./);
    assert.match(mensaje, /¿No encuentra el producto que busca\?/);
    assert.match(mensaje, /escríbalo con su nombre y lo agregaremos a su pedido\./);
  });
});

describe("construirPreguntaCantidadGuiada", () => {
  it("muestra ejemplos solo cuando se solicita", () => {
    const conEjemplos = construirPreguntaCantidadGuiada("Capote", true);
    assert.match(conEjemplos, /3 kilos, 2 piezas o \$200/);

    const sinEjemplos = construirPreguntaCantidadGuiada("Pierna", false);
    assert.doesNotMatch(sinEjemplos, /3 kilos/);
    assert.match(sinEjemplos, /Pierna/);
  });
});

describe("construirConfirmacionSeleccionGuiada", () => {
  it("lista productos y avisa que irá uno por uno", () => {
    const mensaje = construirConfirmacionSeleccionGuiada([
      "Capote",
      "Pierna",
      "Cabeza",
    ]);
    assert.match(mensaje, /Perfecto\. Seleccionaste:/);
    assert.match(mensaje, /- Capote/);
    assert.match(mensaje, /Vamos uno por uno\./);
  });
});

describe("construirMensajePostPedidoGuiado", () => {
  it("muestra resumen con opciones 1 confirmar 2 agregar 3 reiniciar", () => {
    const mensaje = construirMensajePostPedidoGuiado(
      "• 3 kg de Capote\n• 2 piezas de Pierna"
    );
    assert.match(mensaje, /Su pedido:/);
    assert.match(mensaje, /1\. Confirmar pedido/);
    assert.match(mensaje, /2\. Agregar algo más/);
    assert.match(mensaje, /3\. Empezar de nuevo/);
    assert.doesNotMatch(mensaje, /Perfecto\./);
  });
});

describe("formatearLineaResumenGuiado", () => {
  it("PRUEBA 4: conserva unidades exactas en resumen", () => {
    assert.equal(
      formatearLineaResumenGuiado({
        producto_nombre: "Capote",
        cantidad: 3,
        unidad: "pieza",
        cantidadTexto: "3 piezas",
      }),
      "• 3 piezas de Capote"
    );
    assert.equal(
      formatearLineaResumenGuiado({
        producto_nombre: "Pierna",
        cantidad: 5,
        unidad: "kg",
        cantidadTexto: "5 kg",
      }),
      "• 5 kg de Pierna"
    );
    assert.equal(
      formatearLineaResumenGuiado({
        producto_nombre: "Pulpa",
        cantidad: 1,
        unidad: "pieza",
        cantidadTexto: "$200",
      }),
      "• $200 de Pulpa"
    );
  });
});
