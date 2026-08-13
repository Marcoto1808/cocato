import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import { interpretarMensajeComercial } from "@/lib/interpretacion/motor-comercial";
import { PRODUCTO_PENDIENTE_DISAMBIGUACION_ID } from "@/lib/interpretacion/linea-libre";
import { construirResumenCarrito } from "@/lib/whatsapp/conversation-states";
import { esCantidadImporte } from "@/lib/pedido-cantidad";

const CATALOGO: ProductoCatalogo[] = [
  {
    id: "costilla",
    nombre: "Costilla",
    unidad: "pieza",
    precio_kg: 100,
    activo: true,
    categoria: "Cerdo",
  },
  {
    id: "costilla-asar",
    nombre: "Costilla para asar",
    unidad: "kg",
    precio_kg: 110,
    activo: true,
  },
  {
    id: "maciza",
    nombre: "Pulpa maciza",
    unidad: "kg",
    precio_kg: 150,
    activo: true,
    aliases: ["maciza", "pulpa", "pulpa maciza"],
  },
  {
    id: "caldo",
    nombre: "Retazo para caldo",
    unidad: "kg",
    precio_kg: 80,
    activo: true,
    aliases: ["carne para caldo", "caldo", "retazo"],
  },
  {
    id: "capote",
    nombre: "Capote",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
  },
  {
    id: "capote-doble",
    nombre: "Capote Doble",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
  },
  {
    id: "espinazo",
    nombre: "Espinazo",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
    categoria: "Cerdo",
  },
  {
    id: "pulpa",
    nombre: "Pulpa",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
    categoria: "Cerdo",
  },
  {
    id: "pierna",
    nombre: "Pierna",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
    categoria: "Cerdo",
  },
  {
    id: "espaldilla",
    nombre: "Espaldilla",
    unidad: "pieza",
    precio_kg: 0,
    activo: true,
    categoria: "Cerdo",
  },
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
  {
    id: "bistec",
    nombre: "Bistec de puerco",
    unidad: "kg",
    precio_kg: 120,
    activo: true,
    aliases: ["bistec", "bistec de puerco", "bistec de cerdo"],
  },
  {
    id: "manitas",
    nombre: "Manitas",
    unidad: "kg",
    precio_kg: 80,
    activo: true,
    categoria: "Cerdo",
    aliases: ["manitas"],
  },
];

function interpretar(texto: string) {
  return interpretarMensajeComercial({ texto, productos: CATALOGO });
}

function assertPedido(texto: string, cantidadLineas: number) {
  const resultado = interpretar(texto);
  assert.equal(resultado.tipo, "pedido", JSON.stringify(resultado));
  if (resultado.tipo !== "pedido") return null;
  assert.equal(resultado.lineas.length, cantidadLineas, texto);
  return resultado;
}

describe("interpretarMensajeComercial - casos obligatorios", () => {
  it('interpreta "Quiero 3 costillas."', () => {
    const resultado = assertPedido("Quiero 3 costillas.", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].cantidad, 3);
    assert.equal(resultado.lineas[0].producto_id, "costilla");
    assert.equal(resultado.lineas[0].unidad, "pieza");
  });

  it('interpreta "Necesito medio kilo de maciza."', () => {
    const resultado = assertPedido("Necesito medio kilo de maciza.", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].cantidad, 0.5);
    assert.equal(resultado.lineas[0].producto_id, "maciza");
    assert.equal(resultado.lineas[0].unidad, "kg");
  });

  it('interpreta "Dame 200 pesos de carne para caldo."', () => {
    const resultado = assertPedido("Dame 200 pesos de carne para caldo.", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].producto_id, "caldo");
    assert.equal(resultado.lineas[0].cantidad, 1);
    assert.ok(esCantidadImporte(resultado.lineas[0].cantidadTexto));
    assert.match(resultado.lineas[0].cantidadTexto ?? "", /^\$200$/);
  });

  it('interpreta "Ponme 2 cabezas." como Cabeza de cerdo sin preguntar', () => {
    const resultado = interpretar("Ponme 2 cabezas.");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;
    assert.equal(resultado.lineas.length, 1);
    assert.equal(resultado.lineas[0].producto_id, "cabeza-cerdo");
    assert.equal(resultado.disambiguacion, undefined);
  });

  it('interpreta "Échame un capote doble."', () => {
    const resultado = assertPedido("Échame un capote doble.", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].cantidad, 1);
    assert.equal(resultado.lineas[0].producto_id, "capote-doble");
  });

  it('interpreta pedido mixto con comas y "y"', () => {
    const resultado = assertPedido(
      "3 costillas, 2 espinazos y 200 pesos de carne para caldo.",
      3
    );
    if (!resultado) return;
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["costilla", "espinazo", "caldo"]
    );
    assert.ok(esCantidadImporte(resultado.lineas[2].cantidadTexto));
  });

  it('interpreta "2 capotes dobles y tres cuartos de costilla para asar."', () => {
    const resultado = assertPedido(
      "2 capotes dobles y tres cuartos de costilla para asar.",
      2
    );
    if (!resultado) return;
    assert.equal(resultado.lineas[0].producto_id, "capote-doble");
    assert.equal(resultado.lineas[0].cantidad, 2);
    assert.equal(resultado.lineas[1].producto_id, "costilla-asar");
    assert.equal(resultado.lineas[1].cantidad, 0.75);
    assert.equal(resultado.lineas[1].unidad, "kg");
  });

  it('interpreta "100 pesos de maciza, un espinazo y medio kilo de bistec."', () => {
    const resultado = assertPedido(
      "100 pesos de maciza, un espinazo y medio kilo de bistec.",
      3
    );
    if (!resultado) return;
    assert.equal(resultado.lineas[0].producto_id, "maciza");
    assert.ok(esCantidadImporte(resultado.lineas[0].cantidadTexto));
    assert.equal(resultado.lineas[1].producto_id, "espinazo");
    assert.equal(resultado.lineas[1].cantidad, 1);
    assert.equal(resultado.lineas[2].producto_id, "bistec");
    assert.equal(resultado.lineas[2].cantidad, 0.5);
  });
});

describe("interpretarMensajeComercial - Sprint 6.1", () => {
  it('interpreta importe sin "pesos": "200 de bistec"', () => {
    const resultado = assertPedido("200 de bistec", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].producto_id, "bistec");
    assert.equal(resultado.lineas[0].cantidad, 1);
    assert.ok(esCantidadImporte(resultado.lineas[0].cantidadTexto));
  });

  it('interpreta "100 de maciza"', () => {
    const resultado = assertPedido("100 de maciza", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].producto_id, "maciza");
    assert.ok(esCantidadImporte(resultado.lineas[0].cantidadTexto));
  });

  it('interpreta "300 pesos de carne para caldo"', () => {
    const resultado = assertPedido("300 pesos de carne para caldo", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].producto_id, "caldo");
    assert.ok(esCantidadImporte(resultado.lineas[0].cantidadTexto));
  });

  it("mezcla productos reconocidos sin preguntar por cabezas", () => {
    const resultado = interpretar("3 costillas\n2 cabezas\n200 de maciza");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["costilla", "cabeza-cerdo", "maciza"]
    );
    assert.equal(resultado.disambiguacion, undefined);
  });

  it("no trata cantidades pequeñas como importe", () => {
    const resultado = assertPedido("3 de costillas", 1);
    if (!resultado) return;
    assert.equal(resultado.lineas[0].cantidad, 3);
    assert.equal(resultado.lineas[0].producto_id, "costilla");
  });
});

describe("interpretarMensajeComercial - Sprint 6.9 plurales comerciales", () => {
  const mensajesCostilla = [
    "2 costillas",
    "2 costilla",
    "quiero 2 costillas",
    "agregame 2 costillas",
    "tambien 2 costillas",
    "me faltan 2 costillas",
  ];

  for (const texto of mensajesCostilla) {
    it(`interpreta "${texto}" como Costilla ×2`, () => {
      const resultado = assertPedido(texto, 1);
      if (!resultado) return;
      assert.equal(resultado.lineas[0].producto_id, "costilla");
      assert.equal(resultado.lineas[0].cantidad, 2);
      assert.equal(resultado.lineas[0].unidad, "pieza");
    });
  }
});

describe("interpretarMensajeComercial - Sprint 7 segmentos comerciales", () => {
  it("divide y procesa un pedido mixto en un solo mensaje", () => {
    const resultado = assertPedido(
      "Quiero 2 costillas, 2 espinazos y 3 pulpas",
      3
    );
    if (!resultado) return;
    assert.deepEqual(
      resultado.lineas.map((linea) => ({
        id: linea.producto_id,
        cantidad: linea.cantidad,
      })),
      [
        { id: "costilla", cantidad: 2 },
        { id: "espinazo", cantidad: 2 },
        { id: "pulpa", cantidad: 3 },
      ]
    );
    assert.equal(resultado.aclaracion, undefined);
    assert.equal(resultado.disambiguacion, undefined);
  });

  it("divide pedidos sin comas detectando cantidad + producto", () => {
    const resultado = assertPedido(
      "3 piernas 2 espinazos 1 capote 3 kg de bistec 3 cabezas",
      5
    );
    if (!resultado) return;
    assert.deepEqual(resultado.lineas.map((linea) => linea.producto_id), [
      "pierna",
      "espinazo",
      "capote",
      "bistec",
      "cabeza-cerdo",
    ]);
    assert.equal(resultado.disambiguacion, undefined);
  });

  it("procesa pedido complejo sin preguntar por cabezas", () => {
    const resultado = interpretar(
      [
        "Quiero 2 piernas,",
        "3 costillas,",
        "medio kilo de bistec,",
        "200 pesos de maciza,",
        "2 cabezas",
      ].join("\n")
    );
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;
    assert.equal(resultado.lineas.length, 5);
    assert.deepEqual(resultado.lineas.map((linea) => linea.producto_id), [
      "pierna",
      "costilla",
      "bistec",
      "maciza",
      "cabeza-cerdo",
    ]);
    assert.equal(resultado.disambiguacion, undefined);
  });

  it("agrega todo el mensaje aunque haya un segmento desconocido", () => {
    const resultado = interpretar(
      "2 costillas\nxyz\n3 pulpas"
    );
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["costilla", "solicitud-cliente", "pulpa"]
    );
    assert.equal(resultado.aclaracion, undefined);
  });

  it("agrega productos válidos junto con productos no catalogados", () => {
    const resultado = interpretar(
      "2 piernas, 5 alas de dragón, 3 costillas"
    );
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["pierna", "solicitud-cliente", "costilla"]
    );
    assert.equal(resultado.aclaracion, undefined);
  });

  it("agrega cabezas como Cerdo sin preguntar especie", () => {
    const resultado = interpretar("2 piernas, 3 costillas, 2 cabezas");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;
    assert.deepEqual(resultado.lineas.map((linea) => linea.producto_id), [
      "pierna",
      "costilla",
      "cabeza-cerdo",
    ]);
    assert.equal(resultado.disambiguacion, undefined);
  });
});

describe("interpretarMensajeComercial - disambiguación obligatoria", () => {
  const CATALOGO_DUAL: ProductoCatalogo[] = [
    {
      id: "capote",
      nombre: "Capote",
      unidad: "pieza",
      precio_kg: 0,
      activo: true,
      categoria: "Cerdo",
    },
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
    {
      id: "espinazo",
      nombre: "Espinazo",
      unidad: "pieza",
      precio_kg: 0,
      activo: true,
      categoria: "Cerdo",
    },
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
  ];

  function interpretarDual(texto: string) {
    return interpretarMensajeComercial({ texto, productos: CATALOGO_DUAL });
  }

  it('agrega "2 costillas" como Cerdo sin preguntar', () => {
    const resultado = interpretarDual("2 costillas");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 1);
    assert.equal(resultado.lineas[0].producto_id, "costilla-cerdo");
    assert.equal(resultado.disambiguacion, undefined);
  });

  it('no pregunta por "2 espinazos" con un solo espinazo en catálogo', () => {
    const resultado = interpretarDual("2 espinazos");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 1);
    assert.equal(resultado.lineas[0].producto_id, "espinazo");
    assert.equal(resultado.disambiguacion, undefined);
  });

  it("agrega costillas y cabezas como Cerdo sin preguntar", () => {
    const resultado = interpretarDual("2 costillas\n3 espinazos\n2 cabezas");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["costilla-cerdo", "espinazo", "cabeza-cerdo"]
    );
    assert.equal(resultado.disambiguacion, undefined);
  });

  it("recorre todo el mensaje resolviendo costillas como Cerdo", () => {
    const resultado = interpretarDual(
      "Quiero 2 capotes, 3 costillas y 2 espinazos."
    );
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(resultado.lineas.map((linea) => linea.producto_id), [
      "capote",
      "costilla-cerdo",
      "espinazo",
    ]);
    assert.equal(resultado.disambiguacion, undefined);

    const nombres = new Map(CATALOGO_DUAL.map((producto) => [producto.id, producto.nombre]));
    const resumen = construirResumenCarrito(
      resultado.lineas.map((linea) => ({
        cantidad: linea.cantidad,
        unidad: linea.unidad,
        producto_id: linea.producto_id,
        producto_nombre:
          linea.nombreMostrar ?? nombres.get(linea.producto_id) ?? linea.producto_id,
        cantidadTexto: linea.cantidadTexto,
      }))
    );
    assert.match(resumen, /Capote/i);
    assert.match(resumen, /Costilla/i);
    assert.match(resumen, /Espinazo/i);
    assert.doesNotMatch(resumen, /pendiente de confirmar/i);
  });
});

describe("interpretarMensajeComercial - nombres estrictos", () => {
  const CATALOGO_BISTECS: ProductoCatalogo[] = [
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
    {
      id: "costilla",
      nombre: "Costilla",
      unidad: "pieza",
      precio_kg: 100,
      activo: true,
      categoria: "Cerdo",
    },
  ];

  function interpretarBistecs(texto: string) {
    return interpretarMensajeComercial({ texto, productos: CATALOGO_BISTECS });
  }

  it('pide especie solo para "3 kg de bistec"', () => {
    const resultado = interpretarBistecs("2 costillas\n3 kg de bistec");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["costilla", PRODUCTO_PENDIENTE_DISAMBIGUACION_ID]
    );
    assert.ok(resultado.disambiguacion);
    assert.match(resultado.aclaracion ?? "", /¿Es de:/i);
    assert.match(resultado.aclaracion ?? "", /1\. Res/);
    assert.match(resultado.aclaracion ?? "", /2\. Cerdo\?/);
    assert.equal(resultado.lineas.some((linea) => linea.producto_id.startsWith("b-")), false);
  });

  it('agrega "3 kg de bistec de res" sin preguntar', () => {
    const resultado = interpretarBistecs("3 kg de bistec de res");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 1);
    assert.equal(resultado.lineas[0].producto_id, "b-res");
    assert.equal(resultado.disambiguacion, undefined);
  });
});

describe("interpretarMensajeComercial - éxito parcial", () => {
  it("agrega todo lo interpretado sin mensajes de error", () => {
    const resultado = interpretar(
      "3 costillas\n2 espinazos\n200 pesos de maciza\nmedio kilo de bistec\nproducto inventado"
    );

    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 5);
    assert.equal(resultado.aclaracion, undefined);
  });
});

describe("interpretarMensajeComercial - pedido escrito sin espacios", () => {
  it('interpreta "3piernas4espaldillas5costillas y 1 esoinazo"', () => {
    const resultado = interpretar(
      "3piernas4espaldillas5costillas y 1 esoinazo"
    );

    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 4);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["pierna", "espaldilla", "costilla", "espinazo"]
    );
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.cantidad),
      [3, 4, 5, 1]
    );
  });

  it('interpreta "1 capote2piernas y 200 pesos de bistec de puerco"', () => {
    const resultado = interpretar(
      "1 capote2piernas y 200 pesos de bistec de puerco"
    );

    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["capote", "pierna", "bistec"]
    );
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.cantidad),
      [1, 2, 1]
    );
    assert.match(resultado.lineas[2].cantidadTexto ?? "", /\$200|200 pesos/i);
  });

  it('interpreta "1 capote, 2 piernas y $200 de bistec de puerco"', () => {
    const resultado = interpretar(
      "1 capote, 2 piernas y $200 de bistec de puerco"
    );

    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["capote", "pierna", "bistec"]
    );
    assert.match(resultado.lineas[2].cantidadTexto ?? "", /^\$200$/);
  });

  it('interpreta pedido mixto pegado "200 de bistec de puerco1capote3costillas y 3kilos de manitas"', () => {
    const mensajes = [
      "200 de bistec de puerco1capote3costillas y 3kilos de manitas",
      "200bistecdepuerco1capote3costillas3kilosdemanitas",
      "200 de bistec de puerco 1 capote 3 costillas y 3 kilos de manitas",
      "200 pesos de bistec de puerco, 1 capote, 3 costillas y 3 kilos de manitas",
    ];

    for (const mensaje of mensajes) {
      const resultado = interpretar(mensaje);
      assert.equal(resultado.tipo, "pedido", mensaje);
      if (resultado.tipo !== "pedido") return;

      assert.equal(resultado.lineas.length, 4, mensaje);
      assert.deepEqual(
        resultado.lineas.map((linea) => linea.producto_id),
        ["bistec", "capote", "costilla", "manitas"],
        mensaje
      );
      assert.match(resultado.lineas[0].cantidadTexto ?? "", /\$200|200 pesos/i);
      assert.equal(resultado.lineas[1].cantidad, 1);
      assert.equal(resultado.lineas[2].cantidad, 3);
      assert.equal(resultado.lineas[3].cantidad, 3);
      assert.equal(resultado.lineas[3].unidad, "kg");
    }
  });

  it('interpreta "300 pesos de bistec para asar" y muestra resumen monetario', () => {
    const resultado = interpretar("300 pesos de bistec para asar");
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 1);
    assert.equal(resultado.lineas[0].producto_id, "bistec");
    assert.match(resultado.lineas[0].textoOriginal ?? "", /bistec para asar/i);

    const resumen = construirResumenCarrito(
      resultado.lineas.map((linea) => ({
        cantidad: linea.cantidad,
        unidad: linea.unidad,
        producto_id: linea.producto_id,
        producto_nombre: "Bistec de puerco",
        cantidadTexto: linea.cantidadTexto,
        textoOriginal: linea.textoOriginal,
      }))
    );
    assert.match(resumen, /\$300 de bistec para asar/i);
    assert.doesNotMatch(resumen, /piezas de pesos/i);
  });

  it('interpreta "1 capote 2 piernas y 200 pesos de bistec de puerco" con 3 productos', () => {
    const resultado = interpretar(
      "1 capote 2 piernas y 200 pesos de bistec de puerco"
    );
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["capote", "pierna", "bistec"]
    );

    const resumen = construirResumenCarrito(
      resultado.lineas.map((linea) => ({
        cantidad: linea.cantidad,
        unidad: linea.unidad,
        producto_id: linea.producto_id,
        producto_nombre:
          CATALOGO.find((p) => p.id === linea.producto_id)?.nombre ?? linea.producto_id,
        cantidadTexto: linea.cantidadTexto,
        textoOriginal: linea.textoOriginal,
      }))
    );
    assert.match(resumen, /Capote/i);
    assert.match(resumen, /Piernas/i);
    assert.match(resumen, /\$200 de bistec de puerco/i);
  });

  it('interpreta "3 kg de bistec de res 2 capotes 3 costillas" con unidades correctas', () => {
    const CATALOGO_RES: ProductoCatalogo[] = [
      ...CATALOGO.filter((p) => p.id !== "bistec"),
      {
        id: "bistec-res",
        nombre: "Bistec de res",
        unidad: "kg",
        precio_kg: 130,
        activo: true,
        aliases: ["bistec de res", "bistec"],
      },
    ];

    const resultado = interpretarMensajeComercial({
      texto: "3 kg de bistec de res 2 capotes 3 costillas",
      productos: CATALOGO_RES,
    });
    assert.equal(resultado.tipo, "pedido");
    if (resultado.tipo !== "pedido") return;

    assert.equal(resultado.lineas.length, 3);
    assert.deepEqual(
      resultado.lineas.map((linea) => linea.producto_id),
      ["bistec-res", "capote", "costilla"]
    );

    const resumen = construirResumenCarrito(
      resultado.lineas.map((linea) => ({
        cantidad: linea.cantidad,
        unidad: linea.unidad,
        producto_id: linea.producto_id,
        producto_nombre:
          CATALOGO_RES.find((p) => p.id === linea.producto_id)?.nombre ??
          linea.producto_id,
        cantidadTexto: linea.cantidadTexto,
        textoOriginal: linea.textoOriginal,
      }))
    );
    assert.match(resumen, /3 kg de bistec de res/i);
    assert.match(resumen, /2 Capotes/i);
    assert.match(resumen, /3 Costillas/i);
    assert.doesNotMatch(resumen, /piezas de pesos/i);
  });
});
