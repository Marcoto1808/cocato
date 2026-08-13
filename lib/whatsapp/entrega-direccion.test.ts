import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  construirConfirmacionNuevaDireccionPedido,
  construirSolicitudConfirmarDireccionRegistrada,
  esOpcionConfirmarModificarDireccion,
} from "@/lib/whatsapp/conversation-states";

describe("entrega a domicilio: confirmar/modificar dirección", () => {
  it("muestra opciones de confirmar o modificar dirección registrada", () => {
    const mensaje = construirSolicitudConfirmarDireccionRegistrada(
      "Av. Reforma 123, Col. Centro"
    );
    assert.match(mensaje, /Entregaremos en su dirección registrada:/);
    assert.match(mensaje, /Av\. Reforma 123, Col\. Centro/);
    assert.match(mensaje, /1️⃣ Sí, enviar a esta dirección/);
    assert.match(mensaje, /2️⃣ Modificar dirección de envío/);
    assert.doesNotMatch(mensaje, /Gracias por su pedido/);
  });

  it("muestra confirmación de nueva dirección del pedido", () => {
    const mensaje = construirConfirmacionNuevaDireccionPedido(
      "Calle 5 de Mayo 45"
    );
    assert.match(mensaje, /La dirección de envío para este pedido será:/);
    assert.match(mensaje, /Calle 5 de Mayo 45/);
    assert.match(mensaje, /1️⃣ Sí, confirmar dirección/);
  });

  it("interpreta opciones 1 y 2", () => {
    assert.equal(esOpcionConfirmarModificarDireccion("1"), "1");
    assert.equal(esOpcionConfirmarModificarDireccion("2"), "2");
    assert.equal(esOpcionConfirmarModificarDireccion("confirmar dirección"), "1");
    assert.equal(esOpcionConfirmarModificarDireccion("modificar dirección"), "2");
    assert.equal(esOpcionConfirmarModificarDireccion("medio kilo de maciza"), null);
  });
});
