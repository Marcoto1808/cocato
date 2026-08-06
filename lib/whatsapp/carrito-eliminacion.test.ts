import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import type { CarritoConversacion } from "@/lib/whatsapp/conversation-cart";
import { construirResumenCarrito } from "@/lib/whatsapp/conversation-states";
import {
  aplicarEliminacionCarrito,
  construirMensajePostEliminarCarrito,
  esSolicitudEliminacion,
  parsearSolicitudEliminacion,
} from "@/lib/whatsapp/carrito-eliminacion";

const CATALOGO: ProductoCatalogo[] = [
  {
    id: "capote-1",
    nombre: "Capote",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
  },
  {
    id: "capote-doble-1",
    nombre: "Capote Doble",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
  },
];

function carritoCon(...lineas: CarritoConversacion["lineas"]): CarritoConversacion {
  return { lineas };
}

describe("parsearSolicitudEliminacion", () => {
  it("reconoce verbos de eliminación", () => {
    for (const mensaje of [
      "quita 1 capote",
      "quitar capotes",
      "eliminar capotes",
      "elimina 2 capotes",
      "borrar capotes",
      "borra todo",
      "cancelar capotes",
      "remueve capotes",
      "sacar capotes",
    ]) {
      assert.ok(esSolicitudEliminacion(mensaje), mensaje);
    }
  });

  it("reconoce vaciar carrito", () => {
    assert.deepEqual(parsearSolicitudEliminacion("quita todo"), { tipo: "vaciar" });
    assert.deepEqual(parsearSolicitudEliminacion("Empezar de nuevo"), {
      tipo: "vaciar",
    });
  });

  it("no confunde cancelar pedido con eliminar producto", () => {
    assert.equal(parsearSolicitudEliminacion("cancelar"), null);
  });

  it("parsea eliminación parcial y completa", () => {
    assert.deepEqual(parsearSolicitudEliminacion("Quita 1.5 capotes"), {
      tipo: "parcial",
      cantidad: 1.5,
      cantidadTexto: "1.5",
      productoTexto: "capotes",
    });

    assert.deepEqual(parsearSolicitudEliminacion("Quita capotes"), {
      tipo: "linea_completa",
      productoTexto: "capotes",
    });
  });
});

describe("aplicarEliminacionCarrito", () => {
  it("caso 1: elimina cantidad parcial y deja el resto del carrito", () => {
    const carrito = carritoCon(
      {
        textoOriginal: "1.5 pza Capote",
        producto_id: "capote-1",
        producto_nombre: "Capote",
        cantidad: 1.5,
        unidad: "pieza",
      },
      {
        textoOriginal: "2 pza Capote Doble",
        producto_id: "capote-doble-1",
        producto_nombre: "Capote Doble",
        cantidad: 2,
        unidad: "pieza",
      }
    );

    const solicitud = parsearSolicitudEliminacion("Quita 1.5 capotes");
    assert.ok(solicitud);

    const resultado = aplicarEliminacionCarrito(carrito, solicitud!, CATALOGO);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas.length, 1);
    assert.equal(resultado.carrito.lineas[0].producto_nombre, "Capote Doble");
    assert.equal(resultado.carrito.lineas[0].cantidad, 2);
    assert.equal(resultado.detalleEliminado, "1.5 Capotes");

    const resumen = construirResumenCarrito(resultado.carrito.lineas);
    const mensaje = construirMensajePostEliminarCarrito(
      resultado.detalleEliminado,
      resumen
    );

    assert.match(mensaje, /Listo, eliminé 1\.5 Capotes\./);
    assert.match(mensaje, /Hasta el momento lleva:/);
    assert.match(mensaje, /• 2 Capotes Dobles/);
  });

  it("caso 2: elimina cantidad parcial sin borrar toda la línea", () => {
    const carrito = carritoCon({
      textoOriginal: "3 pza Capote",
      producto_id: "capote-1",
      producto_nombre: "Capote",
      cantidad: 3,
      unidad: "pieza",
    });

    const solicitud = parsearSolicitudEliminacion("Quita 1 capote");
    assert.ok(solicitud);

    const resultado = aplicarEliminacionCarrito(carrito, solicitud!, CATALOGO);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas.length, 1);
    assert.equal(resultado.carrito.lineas[0].cantidad, 2);
    assert.equal(resultado.detalleEliminado, "1 Capote");
  });

  it("caso 3: sin cantidad elimina toda la línea", () => {
    const carrito = carritoCon({
      textoOriginal: "3 pza Capote",
      producto_id: "capote-1",
      producto_nombre: "Capote",
      cantidad: 3,
      unidad: "pieza",
    });

    const solicitud = parsearSolicitudEliminacion("Quita capotes");
    assert.ok(solicitud);

    const resultado = aplicarEliminacionCarrito(carrito, solicitud!, CATALOGO);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas.length, 0);
    assert.equal(resultado.detalleEliminado, "3 Capotes");
  });

  it("caso 4: quita todo vacía el carrito", () => {
    const carrito = carritoCon(
      {
        textoOriginal: "3 pza Capote",
        producto_id: "capote-1",
        producto_nombre: "Capote",
        cantidad: 3,
        unidad: "pieza",
      },
      {
        textoOriginal: "2 pza Capote Doble",
        producto_id: "capote-doble-1",
        producto_nombre: "Capote Doble",
        cantidad: 2,
        unidad: "pieza",
      }
    );

    const solicitud = parsearSolicitudEliminacion("Quita todo");
    assert.ok(solicitud);

    const resultado = aplicarEliminacionCarrito(carrito, solicitud!, CATALOGO);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas.length, 0);
    assert.equal(resultado.detalleEliminado, "todo");
  });

  it("caso 5: empezar de nuevo vacía el carrito", () => {
    const carrito = carritoCon({
      textoOriginal: "3 pza Capote",
      producto_id: "capote-1",
      producto_nombre: "Capote",
      cantidad: 3,
      unidad: "pieza",
    });

    const solicitud = parsearSolicitudEliminacion("Empezar de nuevo");
    assert.ok(solicitud);

    const resultado = aplicarEliminacionCarrito(carrito, solicitud!, CATALOGO);
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas.length, 0);
    assert.equal(resultado.detalleEliminado, "todo");
  });

  it("reporta error si el producto no está en el carrito", () => {
    const carrito = carritoCon({
      textoOriginal: "2 pza Capote Doble",
      producto_id: "capote-doble-1",
      producto_nombre: "Capote Doble",
      cantidad: 2,
      unidad: "pieza",
    });

    const solicitud = parsearSolicitudEliminacion("Quita capotes");
    assert.ok(solicitud);

    const resultado = aplicarEliminacionCarrito(carrito, solicitud!, CATALOGO);
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;

    assert.match(resultado.error, /No encontré "capotes"/);
  });
});
