import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import { resolverProductoEnCatalogo } from "@/lib/interpretacion/resolver-producto";

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
});
