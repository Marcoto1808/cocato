import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import {
  normalizarNombreProducto,
  normalizarPluralesComerciales,
  resolverProductoEnCatalogo,
} from "@/lib/interpretacion/resolver-producto";

function producto(
  id: string,
  nombre: string,
  aliases: string[] = []
): ProductoCatalogo {
  return {
    id,
    nombre,
    unidad: "kg",
    precio_kg: 0,
    activo: true,
    aliases,
  };
}

describe("resolverProductoEnCatalogo con aliases", () => {
  const catalogo = [
    producto("bistec-puerco", "Bistec de puerco", [
      "bistec",
      "bistec puerco",
      "bistec de puerco",
      "bistec de cerdo",
    ]),
    producto("retazo-caldo", "Retazo para caldo", [
      "carne para caldo",
      "caldo",
      "retazo",
    ]),
  ];

  it("resuelve alias bistec al producto del catálogo", () => {
    const resultado = resolverProductoEnCatalogo("bistec", catalogo);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Bistec de puerco");
  });

  it("resuelve alias bistec de cerdo al producto del catálogo", () => {
    const resultado = resolverProductoEnCatalogo("bistec de cerdo", catalogo);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Bistec de puerco");
  });

  it("resuelve alias bistec de puerco al producto del catálogo", () => {
    const resultado = resolverProductoEnCatalogo("bistec de puerco", catalogo);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Bistec de puerco");
  });

  it("resuelve alias retazo al producto Retazo para caldo", () => {
    const resultado = resolverProductoEnCatalogo("retazo", catalogo);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Retazo para caldo");
  });

  it("resuelve alias carne para caldo", () => {
    const resultado = resolverProductoEnCatalogo("carne para caldo", catalogo);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Retazo para caldo");
  });

  it("resuelve alias caldo", () => {
    const resultado = resolverProductoEnCatalogo("caldo", catalogo);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Retazo para caldo");
  });

  it("prioriza coincidencia exacta del nombre del catálogo sobre alias", () => {
    const catalogoConConflicto = [
      producto("caldo-especial", "Caldo", []),
      producto("retazo-caldo", "Retazo para caldo", ["caldo"]),
    ];

    const resultado = resolverProductoEnCatalogo("Caldo", catalogoConConflicto);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Caldo");
  });

  it("no resuelve texto sin alias ni nombre conocido", () => {
    const resultado = resolverProductoEnCatalogo("producto inventado", catalogo);
    assert.equal(resultado.tipo, "no_encontrado");
  });

  it("marca ambiguo cuando hay varios productos que empiezan con el término", () => {
    const catalogoBistecs = [
      producto("b-cerdo", "Bistec de cerdo"),
      producto("b-res", "Bistec de res"),
      producto("b-pulpa", "Bistec de pulpa negra"),
    ];

    const resultado = resolverProductoEnCatalogo("bistec", catalogoBistecs);
    assert.equal(resultado.tipo, "ambiguo");
    if (resultado.tipo !== "ambiguo") return;
    assert.equal(resultado.opciones.length, 3);
  });

  it("resuelve cuando el catálogo tiene exactamente Bistec", () => {
    const catalogoExacto = [producto("b", "Bistec")];
    const resultado = resolverProductoEnCatalogo("bistec", catalogoExacto);
    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.nombre, "Bistec");
  });

  it("marca ambiguo cuando hay varios bistecs y el cliente escribe solo bistec", () => {
    const catalogoBistecs = [
      producto("b-cerdo", "Bistec de cerdo"),
      producto("b-res", "Bistec de res"),
    ];

    const resultado = resolverProductoEnCatalogo("bistec", catalogoBistecs);
    assert.equal(resultado.tipo, "ambiguo");
  });

  it("resuelve errores de escritura cercanos como esoinazo → Espinazo", () => {
    const catalogo = [
      producto("espinazo", "Espinazo"),
      producto("pierna", "Pierna"),
    ];
    const resolucion = resolverProductoEnCatalogo("esoinazo", catalogo);
    assert.equal(resolucion.tipo, "ok");
    if (resolucion.tipo === "ok") {
      assert.equal(resolucion.producto.nombre, "Espinazo");
    }
  });
});

describe("normalizarPluralesComerciales Sprint 6.9", () => {
  const catalogoPiezas = [
    producto("costilla", "Costilla"),
    producto("pierna", "Pierna"),
    producto("espinazo", "Espinazo"),
    producto("cabeza", "Cabeza"),
    producto("pulpa", "Pulpa"),
    producto("chuleta", "Chuleta"),
    producto("capote", "Capote"),
    producto("capote-doble", "Capote doble"),
    producto("lomo", "Lomo"),
  ];

  const casosPluralSingular: Array<[string, string]> = [
    ["costillas", "Costilla"],
    ["piernas", "Pierna"],
    ["espinazos", "Espinazo"],
    ["cabezas", "Cabeza"],
    ["pulpas", "Pulpa"],
    ["chuletas", "Chuleta"],
    ["capotes", "Capote"],
    ["capotes dobles", "Capote doble"],
    ["lomos", "Lomo"],
  ];

  for (const [buscado, esperado] of casosPluralSingular) {
    it(`normaliza "${buscado}" → "${esperado}"`, () => {
      assert.equal(normalizarPluralesComerciales(buscado), normalizarNombreProducto(esperado));
      const resultado = resolverProductoEnCatalogo(buscado, catalogoPiezas);
      assert.equal(resultado.tipo, "ok");
      if (resultado.tipo !== "ok") return;
      assert.equal(resultado.producto.nombre, esperado);
    });
  }

  it("singular y plural resuelven al mismo producto", () => {
    for (const base of ["costilla", "pierna", "capote doble"]) {
      const singular = resolverProductoEnCatalogo(base, catalogoPiezas);
      const plural = resolverProductoEnCatalogo(`${base}s`, catalogoPiezas);
      assert.equal(singular.tipo, "ok");
      assert.equal(plural.tipo, "ok");
      if (singular.tipo !== "ok" || plural.tipo !== "ok") return;
      assert.equal(singular.producto.id, plural.producto.id);
    }
  });
});
