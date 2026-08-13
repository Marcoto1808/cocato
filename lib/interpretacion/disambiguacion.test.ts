import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import {
  construirMensajeDisambiguacion,
  continuarDisambiguacionComercial,
  esDisambiguacionPorEspecie,
  procesarResolucionAmbigua,
  resolverSeleccionDisambiguacion,
  type DisambiguacionPendiente,
} from "@/lib/interpretacion/disambiguacion";
import { PRODUCTO_PENDIENTE_DISAMBIGUACION_ID } from "@/lib/interpretacion/linea-libre";
import {
  lineaCarritoDesdeInterpretada,
  reemplazarLineaPendienteDisambiguacion,
  type LineaCarrito,
} from "@/lib/whatsapp/conversation-cart";

describe("disambiguacion comercial", () => {
  const opcionesCostilla: ProductoCatalogo[] = [
    {
      id: "costilla-cerdo",
      nombre: "Costilla",
      unidad: "pieza",
      precio_kg: 100,
      activo: true,
      categoria: "Cerdo",
    },
    {
      id: "costilla-res",
      nombre: "Costilla",
      unidad: "pieza",
      precio_kg: 100,
      activo: true,
      categoria: "Res",
    },
  ];

  it("resuelve costilla automáticamente como Cerdo", () => {
    const resultado = procesarResolucionAmbigua({
      nombreBuscado: "costillas",
      opciones: opcionesCostilla,
    });

    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.id, "costilla-cerdo");
  });

  it("resuelve cabeza automáticamente como Cerdo sin preguntar", () => {
    const resultado = procesarResolucionAmbigua({
      nombreBuscado: "cabezas",
      opciones: [
        {
          id: "cabeza-cerdo",
          nombre: "Cabeza de cerdo",
          unidad: "pieza",
          precio_kg: 0,
          activo: true,
          categoria: "Cerdo",
        },
        {
          id: "cabeza-res",
          nombre: "Cabeza de res",
          unidad: "pieza",
          precio_kg: 0,
          activo: true,
          categoria: "Res",
        },
      ],
    });

    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.id, "cabeza-cerdo");
  });

  const pendienteBistec: DisambiguacionPendiente = {
    segmento: "3 kg de bistec",
    cantidad: 3,
    cantidadTexto: "3 kg",
    unidad: "kg",
    productoBuscado: "bistec",
    opciones: [
      { id: "b-res", nombre: "Bistec de res", categoria: "Res" },
      { id: "b-cerdo", nombre: "Bistec de cerdo", categoria: "Cerdo" },
    ],
  };

  it('construye "¿Es de: Res Cerdo?" para bistec', () => {
    assert.equal(
      esDisambiguacionPorEspecie(
        pendienteBistec.opciones,
        pendienteBistec.productoBuscado
      ),
      true
    );

    const mensaje = construirMensajeDisambiguacion(
      pendienteBistec.opciones,
      pendienteBistec.productoBuscado
    );
    assert.match(mensaje, /¿Es de:/i);
    assert.match(mensaje, /1\. Res/);
    assert.match(mensaje, /2\. Cerdo\?/);
    assert.doesNotMatch(mensaje, /¿A cuál bistec/i);
  });

  it('construye pregunta de especie para molida en pesos', () => {
    const pendienteMolida: DisambiguacionPendiente = {
      segmento: "200 pesos de molida",
      cantidad: 1,
      cantidadTexto: "$200",
      unidad: "pieza",
      productoBuscado: "molida",
      opciones: [
        { id: "m-res", nombre: "Molida de res", categoria: "Res" },
        { id: "m-cerdo", nombre: "Molida de cerdo", categoria: "Cerdo" },
      ],
    };

    const mensaje = construirMensajeDisambiguacion(
      pendienteMolida.opciones,
      pendienteMolida.productoBuscado
    );
    assert.match(mensaje, /¿Es de:/i);
    assert.match(mensaje, /1\. Res/);
    assert.match(mensaje, /2\. Cerdo\?/);
    assert.doesNotMatch(mensaje, /peso molida/i);
  });

  it('resuelve "1" como RES en disambiguación por especie', () => {
    const opcion = resolverSeleccionDisambiguacion("1", pendienteBistec);
    assert.equal(opcion?.categoria, "Res");
  });

  it('resuelve "2" como Cerdo en disambiguación por especie', () => {
    const opcion = resolverSeleccionDisambiguacion("2", pendienteBistec);
    assert.equal(opcion?.categoria, "Cerdo");
  });

  it('resuelve "cerdo" sin importar mayúsculas', () => {
    const opcion = resolverSeleccionDisambiguacion("CERDO", pendienteBistec);
    assert.equal(opcion?.id, "b-cerdo");
  });

  it("continúa la cola tras resolver bistec", () => {
    const pendiente: DisambiguacionPendiente = {
      ...pendienteBistec,
      mensajeOriginal: "3 kg de bistec\n200 pesos de molida",
      cola: [
        {
          segmento: "200 pesos de molida",
          cantidad: 1,
          cantidadTexto: "$200",
          unidad: null,
          productoBuscado: "molida",
          opciones: [
            { id: "m-res", nombre: "Molida de res", categoria: "Res" },
            { id: "m-cerdo", nombre: "Molida de cerdo", categoria: "Cerdo" },
          ],
        },
      ],
    };

    const resultado = continuarDisambiguacionComercial({
      mensaje: "Res",
      pendiente,
    });

    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;

    assert.equal(resultado.linea.producto_id, "b-res");
    assert.equal(resultado.linea.cantidad, 3);
    assert.ok(resultado.siguiente);
    assert.equal(resultado.siguiente?.segmento, "200 pesos de molida");
    assert.match(resultado.aclaracion ?? "", /¿Es de:/i);
  });

  it('resuelve "bistec de cerdo" sin disambiguación', () => {
    const resultado = procesarResolucionAmbigua({
      nombreBuscado: "bistec de cerdo",
      opciones: [
        {
          id: "b-cerdo",
          nombre: "Bistec de cerdo",
          unidad: "kg",
          precio_kg: 120,
          activo: true,
          categoria: "Cerdo",
        },
        {
          id: "b-res",
          nombre: "Bistec de res",
          unidad: "kg",
          precio_kg: 130,
          activo: true,
          categoria: "Res",
        },
        {
          id: "b-pulpa",
          nombre: "Bistec de pulpa negra",
          unidad: "kg",
          precio_kg: 140,
          activo: true,
          categoria: "Res",
        },
      ],
    });

    assert.equal(resultado.tipo, "ok");
    if (resultado.tipo !== "ok") return;
    assert.equal(resultado.producto.id, "b-cerdo");
  });

  it("reemplaza la línea pendiente al resolver, sin agregar otra", () => {
    const lineas: LineaCarrito[] = [
      {
        textoOriginal: "2 capotes",
        producto_id: "capote",
        producto_nombre: "Capote",
        cantidad: 2,
        unidad: "pieza",
      },
      {
        textoOriginal: "3 kg de bistec",
        producto_id: PRODUCTO_PENDIENTE_DISAMBIGUACION_ID,
        producto_nombre: "bistec",
        cantidad: 3,
        unidad: "kg",
      },
      {
        textoOriginal: "2 espinazos",
        producto_id: "espinazo",
        producto_nombre: "Espinazo",
        cantidad: 2,
        unidad: "pieza",
      },
    ];

    const resuelta = lineaCarritoDesdeInterpretada(
      {
        producto_id: "b-cerdo",
        cantidad: 3,
        unidad: "kg",
        textoOriginal: "3 kg de bistec",
        cantidadTexto: "3 kg",
      },
      "Bistec de cerdo"
    );

    const actualizadas = reemplazarLineaPendienteDisambiguacion(
      lineas,
      "3 kg de bistec",
      resuelta
    );

    assert.equal(actualizadas.length, 3);
    assert.equal(actualizadas[1].producto_id, "b-cerdo");
    assert.equal(actualizadas[0].producto_id, "capote");
    assert.equal(actualizadas[2].producto_id, "espinazo");
  });

  it("enriquece el segmento con la especie elegida", () => {
    const resultado = continuarDisambiguacionComercial({
      mensaje: "Cerdo",
      pendiente: {
        segmento: "tres cuartos de molida",
        cantidad: 0.75,
        cantidadTexto: "0.75 kg",
        unidad: "kg",
        productoBuscado: "molida",
        opciones: [
          { id: "m-res", nombre: "Molida de res", categoria: "Res" },
          { id: "m-cerdo", nombre: "Molida de cerdo", categoria: "Cerdo" },
        ],
      },
    });

    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;
    assert.match(resultado.linea.textoOriginal ?? "", /molida de cerdo/i);
    assert.equal(resultado.linea.producto_id, "m-cerdo");
  });
});
