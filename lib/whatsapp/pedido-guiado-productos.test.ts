import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  construirSlotTextoLibrePedidoGuiado,
  construirSlotsPedidoGuiado,
  codigoTipoClienteEsCarniceria,
  codigoTipoClienteEsCocina,
  codigoTipoClienteEsRestauranteOFonda,
  extraerTextoProductoParaValidacionLibre,
  usaMenuCarniceria,
  usaMenuCocinaRestauranteFonda,
  validarTextoLibrePedidoGuiado,
} from "@/lib/whatsapp/pedido-guiado-productos";
import { segmentarMensajePedido } from "@/lib/interpretacion/cantidad-natural";

const PRODUCTOS = [
  { id: "1", nombre: "Bistec de res", categoria: "Res", unidad: "kg" },
  { id: "2", nombre: "Molida corriente", categoria: "Res", unidad: "kg" },
  { id: "3", nombre: "Maciza", categoria: "Res", unidad: "kg" },
  { id: "4", nombre: "Costilla", categoria: "Cerdo", unidad: "kg" },
  { id: "5", nombre: "Costilla", categoria: "Res", unidad: "kg" },
  { id: "6", nombre: "Chuleta natural", categoria: "Cerdo", unidad: "kg" },
  { id: "7", nombre: "Milanesa", categoria: "Cerdo", unidad: "kg" },
  { id: "8", nombre: "Chuleta ahumada", categoria: "Cerdo", unidad: "kg" },
  { id: "9", nombre: "Espinazo", categoria: "Cerdo", unidad: "kg" },
  { id: "10", nombre: "Codillo", categoria: "Cerdo", unidad: "kg" },
  { id: "11", nombre: "Cabeza", categoria: "Cerdo", unidad: "pieza" },
  { id: "12", nombre: "Manitas", categoria: "Cerdo", unidad: "pieza" },
  { id: "13", nombre: "Capote", categoria: "Cerdo", unidad: "pieza" },
  { id: "14", nombre: "Pierna", categoria: "Cerdo", unidad: "kg" },
  { id: "15", nombre: "Pulpa blanca", categoria: "Res", unidad: "kg" },
  { id: "16", nombre: "Espaldilla", categoria: "Cerdo", unidad: "kg" },
  { id: "17", nombre: "Pecho", categoria: "Res", unidad: "kg" },
  { id: "18", nombre: "Cabeza", categoria: "Cerdo", unidad: "pieza" },
];

describe("codigoTipoCliente", () => {
  it("identifica restaurante, fonda y cocina", () => {
    assert.equal(codigoTipoClienteEsRestauranteOFonda("restaurante"), true);
    assert.equal(codigoTipoClienteEsRestauranteOFonda("fonda"), true);
    assert.equal(codigoTipoClienteEsRestauranteOFonda("cocina"), true);
    assert.equal(codigoTipoClienteEsCocina("cocina"), true);
    assert.equal(codigoTipoClienteEsRestauranteOFonda("carniceria"), false);
  });

  it("identifica carnicería", () => {
    assert.equal(codigoTipoClienteEsCarniceria("carniceria"), true);
    assert.equal(codigoTipoClienteEsCarniceria("restaurante"), false);
  });
});

describe("construirSlotsPedidoGuiado", () => {
  it("restaurante: orden y productos comunes con interpretación para ambiguos", () => {
    const slots = construirSlotsPedidoGuiado("restaurante", PRODUCTOS);
    const etiquetas = slots.map((slot) => slot.etiqueta);

    assert.deepEqual(etiquetas, [
      "Bistec",
      "Molida",
      "Maciza",
      "Costilla",
      "Chuleta fresca",
      "Milanesa",
      "Chuleta ahumada",
      "Espinazo",
      "Codillo",
      "Cabeza",
      "Manitas",
    ]);

    assert.equal(slots[0].textoPedido, "bistec");
    assert.equal(slots[1].textoPedido, "molida");
    assert.equal(slots[3].productoId, "4");
  });

  it("carnicería: orden y costilla de cerdo", () => {
    const slots = construirSlotsPedidoGuiado("carniceria", PRODUCTOS);
    const etiquetas = slots.map((slot) => slot.etiqueta);

    assert.deepEqual(etiquetas, [
      "Capote",
      "Pierna",
      "Costilla",
      "Pulpa",
      "Espaldilla",
      "Espinazo",
      "Pecho",
      "Cabeza",
    ]);

    const costilla = slots.find((slot) => slot.etiqueta === "Costilla");
    assert.equal(costilla?.productoId, "4");
    assert.equal(slots[3].textoPedido, "pulpa");
  });

  it("carnicería con res incluye pecho de res", () => {
    const slots = construirSlotsPedidoGuiado("carniceria", PRODUCTOS, "Res");
    const pecho = slots.find((slot) => slot.etiqueta === "Pecho");
    assert.equal(pecho?.productoId, "17");
  });

  it("cocina: mismo menú que restaurante/fonda", () => {
    const slots = construirSlotsPedidoGuiado("cocina", PRODUCTOS);
    const etiquetas = slots.map((slot) => slot.etiqueta);

    assert.deepEqual(etiquetas, [
      "Bistec",
      "Molida",
      "Maciza",
      "Costilla",
      "Chuleta fresca",
      "Milanesa",
      "Chuleta ahumada",
      "Espinazo",
      "Codillo",
      "Cabeza",
      "Manitas",
    ]);
  });

  it("prioriza fonda aunque el código esté mal", () => {
    assert.equal(
      usaMenuCocinaRestauranteFonda({ codigo: "carniceria", nombre: "Fonda" }),
      true
    );
    assert.equal(
      usaMenuCarniceria({ codigo: "carniceria", nombre: "Fonda" }),
      false
    );

    const slots = construirSlotsPedidoGuiado(
      { codigo: "carniceria", nombre: "Fonda" },
      PRODUCTOS
    );
    assert.equal(slots[0].etiqueta, "Bistec");
  });

  it("tipo desconocido usa lista restaurante/fonda", () => {
    const slots = construirSlotsPedidoGuiado("otro", PRODUCTOS);
    assert.equal(slots[0].etiqueta, "Bistec");
  });
});

const CATALOGO_CARNICERIA = PRODUCTOS.filter((producto) =>
  ["Capote", "Pierna", "Pulpa blanca", "Espaldilla", "Costilla", "Espinazo"].includes(
    producto.nombre
  )
).map((producto) => ({ ...producto, activo: true }));

describe("validarTextoLibrePedidoGuiado", () => {
  it("acepta texto libre con coincidencia razonable y conserva el texto original", () => {
    assert.equal(validarTextoLibrePedidoGuiado("Capote doble", CATALOGO_CARNICERIA), true);
    assert.equal(
      validarTextoLibrePedidoGuiado("Pulpa de pierna", CATALOGO_CARNICERIA),
      true
    );

    const slot = construirSlotTextoLibrePedidoGuiado("Capote doble");
    assert.equal(slot.etiqueta, "Capote doble");
    assert.equal(slot.textoPedido, "Capote doble");
    assert.equal(slot.productoId, undefined);
  });

  it("rechaza texto sin coincidencia con el catálogo", () => {
    assert.equal(validarTextoLibrePedidoGuiado("Hola", CATALOGO_CARNICERIA), false);
    assert.equal(
      validarTextoLibrePedidoGuiado("Elimina esa opción", CATALOGO_CARNICERIA),
      false
    );
  });

  it("valida producto libre con cantidad al inicio", () => {
    assert.equal(
      validarTextoLibrePedidoGuiado("2 capotes dobles", CATALOGO_CARNICERIA),
      true
    );
    assert.equal(
      validarTextoLibrePedidoGuiado("3 costillas de puerco", CATALOGO_CARNICERIA),
      true
    );
  });

  it("acepta errores de escritura cercanos al catálogo", () => {
    assert.equal(validarTextoLibrePedidoGuiado("esoinazo", CATALOGO_CARNICERIA), true);
    assert.equal(validarTextoLibrePedidoGuiado("hola", CATALOGO_CARNICERIA), false);
  });

  it("valida cada segmento de un pedido escrito pegado", () => {
    const catalogo = [
      ...CATALOGO_CARNICERIA,
      {
        id: "bistec-cerdo",
        nombre: "Bistec de cerdo",
        categoria: "Cerdo",
        unidad: "kg",
        activo: true,
        aliases: ["bistec de puerco", "bistec de cerdo"],
      },
      { id: "manitas", nombre: "Manitas", categoria: "Cerdo", unidad: "kg", activo: true },
    ];
    const mensaje =
      "200 de bistec de puerco1capote3costillas y 3kilos de manitas";
    const segmentos = segmentarMensajePedido(mensaje);

    assert.equal(segmentos.length, 4);

    for (const segmento of segmentos) {
      const textoProducto = extraerTextoProductoParaValidacionLibre(segmento);
      assert.equal(
        validarTextoLibrePedidoGuiado(textoProducto, catalogo),
        true,
        `${segmento} -> ${textoProducto}`
      );
    }
  });
});
