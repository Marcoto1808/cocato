import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esComandoNuevoPedido,
  esComandoVerPedido,
  esOpcionConfirmacionPedido,
  esOpcionOtroPedido,
  esOpcionRecuperacionPedido,
  pedidoInactivo,
  debeOfrecerRecuperacionPedido,
  reiniciarPedidoConversacion,
} from "@/lib/whatsapp/comandos-pedido";

describe("comandos de pedido Sprint 6.2", () => {
  it("reconoce nuevo pedido y alias", () => {
    for (const frase of [
      "nuevo pedido",
      "otro pedido",
      "hacer otro pedido",
      "empezar de nuevo",
      "reiniciar",
      "cancelar pedido",
      "borrar pedido",
    ]) {
      assert.ok(esComandoNuevoPedido(frase), frase);
    }
  });

  it("interpreta opción otro pedido post-confirmación", () => {
    assert.equal(esOpcionOtroPedido("1"), "si");
    assert.equal(esOpcionOtroPedido("otro pedido"), "si");
    assert.equal(esOpcionOtroPedido("2"), "no");
    assert.equal(esOpcionOtroPedido("terminar"), "no");
  });

  it("reinicia conversación con carrito vacío", () => {
    const menu = "👋 Hola, Test.\n\n1️⃣ Escribir mi pedido";
    const turno = reiniciarPedidoConversacion(menu, { omitirMensajePrevio: true });

    assert.equal(turno.estadoNuevo, "MENU_PRINCIPAL");
    assert.equal(turno.respuesta, menu);
    assert.deepEqual(turno.carrito.lineas, []);
    assert.equal(turno.carrito.mensajeLibre, undefined);
    assert.equal(turno.carrito.contextoGuiado, null);
  });

  it("reconoce ver pedido y alias", () => {
    for (const frase of [
      "ver pedido",
      "pedido",
      "carrito",
      "qué llevo",
      "que llevo",
    ]) {
      assert.ok(esComandoVerPedido(frase), frase);
    }
  });

  it("interpreta opciones de confirmación", () => {
    assert.equal(esOpcionConfirmacionPedido("1"), "confirmar");
    assert.equal(esOpcionConfirmacionPedido("2"), "seguir");
    assert.equal(esOpcionConfirmacionPedido("3"), "reiniciar");
    assert.equal(esOpcionConfirmacionPedido("empezar de nuevo"), "reiniciar");
  });

  it("interpreta opciones de recuperación", () => {
    assert.equal(esOpcionRecuperacionPedido("1"), "continuar");
    assert.equal(esOpcionRecuperacionPedido("2"), "nuevo");
    assert.equal(esOpcionRecuperacionPedido("continuar pedido"), "continuar");
  });

  it("detecta pedido inactivo", () => {
    const hace25Horas = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    assert.ok(pedidoInactivo(hace25Horas));
    assert.ok(!pedidoInactivo(new Date().toISOString()));
  });

  it("ofrece recuperación solo con pedido abierto e inactividad", () => {
    const hace30Horas = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();

    assert.ok(
      debeOfrecerRecuperacionPedido({
        estado: "PEDIDO_EN_CONSTRUCCION",
        carrito: {
          lineas: [
            {
              textoOriginal: "2 capotes",
              producto_id: "1",
              producto_nombre: "Capote",
              cantidad: 2,
              unidad: "pieza",
            },
          ],
        },
        ultimoMensajeEn: hace30Horas,
      })
    );

    assert.ok(
      !debeOfrecerRecuperacionPedido({
        estado: "MENU_PRINCIPAL",
        carrito: { lineas: [] },
        ultimoMensajeEn: hace30Horas,
      })
    );
  });
});
