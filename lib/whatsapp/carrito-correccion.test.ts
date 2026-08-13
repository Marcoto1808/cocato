import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import type { CarritoConversacion } from "@/lib/whatsapp/conversation-cart";
import {
  aplicarCorreccionCarrito,
  parsearSolicitudCorreccion,
} from "@/lib/whatsapp/carrito-correccion";

const CATALOGO: ProductoCatalogo[] = [
  {
    id: "molida-1",
    nombre: "Molida corriente",
    unidad: "kg",
    precio_kg: 0,
    activo: true,
  },
  {
    id: "pierna-1",
    nombre: "Pierna",
    unidad: "kg",
    precio_kg: 0,
    activo: true,
  },
];

function carritoCon(...lineas: CarritoConversacion["lineas"]): CarritoConversacion {
  return { lineas };
}

describe("parsearSolicitudCorreccion", () => {
  it("reconoce corrección explícita", () => {
    assert.deepEqual(parsearSolicitudCorreccion("Corrige la molida, son 300 pesos"), {
      tipo: "reemplazar",
      productoTexto: "molida",
      textoNuevo: "300 pesos",
    });
  });

  it("reconoce quise decir", () => {
    assert.deepEqual(parsearSolicitudCorreccion("Quise decir 2 piernas"), {
      tipo: "quise_decir",
      textoNuevo: "2 piernas",
    });
  });

  it("reconoce aclaración de especie", () => {
    assert.deepEqual(parsearSolicitudCorreccion("Es bistec de cerdo"), {
      tipo: "aclarar",
      textoNuevo: "bistec de cerdo",
    });
  });

  it("no confunde pedido normal con corrección", () => {
    assert.equal(parsearSolicitudCorreccion("2 piernas"), null);
  });
});

describe("aplicarCorreccionCarrito", () => {
  it("reemplaza la línea existente sin duplicar", () => {
    const carrito = carritoCon({
      textoOriginal: "$200 de molida",
      producto_id: "molida-1",
      producto_nombre: "Molida corriente",
      cantidad: 200,
      unidad: "kg",
    });

    const solicitud = parsearSolicitudCorreccion("Corrige la molida, son 300 pesos");
    assert.ok(solicitud);

    const resultado = aplicarCorreccionCarrito({
      carrito,
      solicitud: solicitud!,
      lineaNueva: {
        textoOriginal: "$300 de molida",
        producto_id: "molida-1",
        producto_nombre: "Molida corriente",
        cantidad: 300,
        unidad: "kg",
      },
      productos: CATALOGO,
    });

    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas.length, 1);
    assert.equal(resultado.carrito.lineas[0].cantidad, 300);
    assert.equal(resultado.carrito.lineas[0].textoOriginal, "$300 de molida");
  });

  it("quise decir corrige la última línea coincidente", () => {
    const carrito = carritoCon({
      textoOriginal: "3 pza Pierna",
      producto_id: "pierna-1",
      producto_nombre: "Pierna",
      cantidad: 3,
      unidad: "kg",
    });

    const solicitud = parsearSolicitudCorreccion("Quise decir 2 piernas");
    assert.ok(solicitud);

    const resultado = aplicarCorreccionCarrito({
      carrito,
      solicitud: solicitud!,
      lineaNueva: {
        textoOriginal: "2 pza Pierna",
        producto_id: "pierna-1",
        producto_nombre: "Pierna",
        cantidad: 2,
        unidad: "kg",
      },
      productos: CATALOGO,
    });

    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.carrito.lineas[0].cantidad, 2);
  });
});
