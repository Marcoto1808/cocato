import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  carritoTieneInformacionPendiente,
  construirRespuestaConfirmacionInvalida,
  construirRespuestaMenuPrincipalInvalida,
  construirSolicitudConfirmacion,
  construirSolicitudInformacionPendiente,
} from "@/lib/whatsapp/conversation-states";
import { esOpcionConfirmacionPedido } from "@/lib/whatsapp/comandos-pedido";

describe("confirmación de pedido", () => {
  it("no interpreta respuestas ambiguas como opción de confirmación", () => {
    for (const frase of [
      "Por qué?",
      "por que",
      "si",
      "no",
      "quiero cambiarlo",
      "cuánto cuesta?",
      "buenas",
      "hola",
    ]) {
      assert.equal(esOpcionConfirmacionPedido(frase), null, frase);
    }
  });

  it("solo acepta opciones explícitas 1, 2 o 3", () => {
    assert.equal(esOpcionConfirmacionPedido("1"), "confirmar");
    assert.equal(esOpcionConfirmacionPedido("2"), "seguir");
    assert.equal(esOpcionConfirmacionPedido("3"), "reiniciar");
    assert.equal(esOpcionConfirmacionPedido("confirmar pedido"), "confirmar");
    assert.equal(esOpcionConfirmacionPedido("empezar de nuevo"), "reiniciar");
  });

  it("no interpreta número con texto de producto como opción 2", () => {
    assert.equal(esOpcionConfirmacionPedido("2 capotes dobles"), null);
    assert.equal(esOpcionConfirmacionPedido("1 pierna para milanesa"), null);
  });

  it("no muestra confirmación mientras falte información de especie", () => {
    const pendiente = {
      segmento: "300 pesos de molida mixta",
      cantidad: 1,
      cantidadTexto: "$300",
      unidad: "pieza" as const,
      productoBuscado: "molida mixta",
      opciones: [
        { id: "m-res", nombre: "Molida mixta de res", categoria: "Res" },
        { id: "m-cerdo", nombre: "Molida mixta de cerdo", categoria: "Cerdo" },
      ],
    };

    const resumen = "• $300 de molida mixta";
    const mensaje = construirSolicitudInformacionPendiente(resumen, pendiente);

    assert.match(mensaje, /⚠️ FALTA INFORMACIÓN/);
    assert.match(mensaje, /¿Es de:/i);
    assert.doesNotMatch(mensaje, /Confirmar pedido/);

    const confirmacion = construirSolicitudConfirmacion(resumen);
    assert.match(confirmacion, /Confirmar pedido/);
  });

  it("detecta carrito con disambiguación pendiente", () => {
    assert.equal(
      carritoTieneInformacionPendiente({
        lineas: [],
        contextoDisambiguacion: {
          segmento: "0.75 kg de molida",
          cantidad: 0.75,
          cantidadTexto: "0.75 kg",
          unidad: "kg",
          productoBuscado: "molida",
          opciones: [],
        },
      }),
      true
    );
  });

  it("construye mensaje de opción inválida con las 3 opciones", () => {
    const mensaje = construirRespuestaConfirmacionInvalida();
    assert.match(mensaje, /No entendí su respuesta\./);
    assert.match(mensaje, /1️⃣ Confirmar pedido/);
    assert.match(mensaje, /2️⃣ Agregar algo más/);
    assert.match(mensaje, /3️⃣ Empezar de nuevo/);
  });
});

describe("menú principal", () => {
  it("muestra el menú cuando la respuesta no es una opción válida", () => {
    const menu = "👋 Hola, Martha.\n\n1️⃣ Escribir mi pedido";
    const respuesta = construirRespuestaMenuPrincipalInvalida(menu);
    assert.match(respuesta, /No entendí su respuesta\./);
    assert.match(respuesta, /1️⃣ Escribir mi pedido/);
  });
});
