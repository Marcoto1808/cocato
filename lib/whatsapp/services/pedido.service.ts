import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerInterpretadorMensajes } from "@/lib/interpretacion/mensaje-interpreter-factory";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import {
  agregarLineasAlCarrito,
  carritoVacio,
  lineaCarritoDesdeInterpretada,
  reemplazarLineaPendienteDisambiguacion,
  type CarritoConversacion,
  type LineaCarrito,
} from "@/lib/whatsapp/conversation-cart";
import { obtenerUltimoPedidoCliente } from "@/lib/whatsapp/conversation-repository";
import {
  construirInstruccionAgregarMas,
  construirInstruccionPedidoLibre,
  construirMenuCategorias,
  construirMenuEspecie,
  construirMenuProductos,
  construirMensajePostAgregarCarrito,
  construirResumenCarrito,
  construirRespuestaMenuPrincipalInvalida,
  construirSolicitudCantidad,
  construirSolicitudInformacionPendiente,
  esClienteIndicaListo,
  esClienteDeseaSeguirAgregando,
  esOpcionMenuPrincipal,
  esSaludo,
  MENSAJE_SIN_ULTIMO_PEDIDO,
  parsearSeleccionNumerica,
} from "@/lib/whatsapp/conversation-states";
import {
  construirConfirmacionSeleccionGuiada,
  construirErrorCantidadGuiada,
  construirMenuProductosGuiados,
  construirMensajePostPedidoGuiado,
  construirPreguntaCantidadGuiada,
  construirResumenPedidoGuiado,
  mensajeContieneTextoProducto,
  parsearCantidadPedidoGuiado,
  parsearSeleccionesMultiples,
} from "@/lib/whatsapp/pedido-guiado-cantidad";
import { esLineaLibre, esLineaPendienteDisambiguacion } from "@/lib/interpretacion/linea-libre";
import { construirLineasPedidoDesdeInterpretacion } from "@/lib/whatsapp/pedido-desde-mensaje";
import type { ResultadoTurnoConversacion } from "@/lib/whatsapp/services/conversation-turn.types";
import {
  aplicarCorreccionCarrito,
  construirMensajePostCorregirCarrito,
  parsearSolicitudCorreccion,
} from "@/lib/whatsapp/carrito-correccion";
import {
  esComandoNuevoPedido,
  esOpcionConfirmacionPedido,
  reiniciarPedidoConversacion,
} from "@/lib/whatsapp/comandos-pedido";
import {
  aplicarEspeciePreferidaAlMensaje,
  combinarLineaConAclaracion,
} from "@/lib/whatsapp/especie-preferida";
import { requiereDisambiguacionPorEspecie } from "@/lib/interpretacion/disambiguacion";
import {
  construirSlotsPedidoGuiado,
  construirSlotTextoLibrePedidoGuiado,
  construirMensajeProductoLibreNoEncontrado,
  extraerTextoProductoParaValidacionLibre,
  productosMenuDesdeSlots,
  validarTextoLibrePedidoGuiado,
  type ProductoGuiadoSlot,
} from "@/lib/whatsapp/pedido-guiado-productos";
import { PRODUCTO_LINEA_LIBRE_ID } from "@/lib/interpretacion/linea-libre";
import {
  limpiarPrefijoPedido,
  segmentarMensajePedido,
} from "@/lib/interpretacion/cantidad-natural";
import { separarCantidadInicial } from "@/lib/interpretacion/resolver-producto";
import { cargarAliasesPorProductos } from "@/lib/producto-aliases";
import { resolverSeleccionCategoria } from "@/lib/interpretacion/resolver-categoria";
import { continuarDisambiguacionComercial } from "@/lib/interpretacion/disambiguacion";
import type { ClienteResuelto } from "@/lib/whatsapp/client-resolver";
import {
  aplicarEliminacionCarrito,
  construirMensajePostEliminarCarrito,
  parsearSolicitudEliminacion,
} from "@/lib/whatsapp/carrito-eliminacion";

type ProductoMenu = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
};

export class PedidoService {
  private productosCache: ProductoMenu[] | null = null;

  constructor(private readonly db: SupabaseClient) {}

  async listarProductos(): Promise<ProductoMenu[]> {
    if (this.productosCache) return this.productosCache;

    const { data, error } = await this.db
      .from("productos")
      .select("id, nombre, categoria, unidad, activo, orden")
      .eq("activo", true)
      .order("orden");

    if (error) throw new Error(error.message);
    this.productosCache = (data ?? []) as ProductoMenu[];
    return this.productosCache;
  }

  async calcularTotal(
    cliente: ClienteResuelto,
    lineas: LineaCarrito[]
  ): Promise<number | null> {
    if (lineas.length === 0) return null;

    const interpretadas = lineas
      .filter(
        (linea) =>
          !esLineaLibre(linea.producto_id) &&
          !esLineaPendienteDisambiguacion(linea.producto_id)
      )
      .map((linea) => ({
      producto_id: linea.producto_id,
      cantidad: linea.cantidad,
      unidad: linea.unidad,
      textoOriginal: linea.textoOriginal,
      cantidadTexto: linea.cantidadTexto,
    }));

    const resultado = await construirLineasPedidoDesdeInterpretacion(
      this.db,
      cliente,
      interpretadas
    );

    if ("error" in resultado) return null;
    return resultado.total;
  }

  async agregarTextoAlCarrito(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion,
    mensaje: string
  ): Promise<
    | { ok: true; carrito: CarritoConversacion; aclaracion?: string }
    | { ok: false; error: string }
  > {
    const productos = await this.listarProductos();

    if (mensajeContieneTextoProducto(mensaje)) {
      const segmentos = segmentarMensajePedido(
        limpiarPrefijoPedido(mensaje.trim())
      );
      for (const segmento of segmentos) {
        const textoValidar = extraerTextoProductoParaValidacionLibre(segmento);
        if (!validarTextoLibrePedidoGuiado(textoValidar, productos)) {
          return {
            ok: false,
            error: construirMensajeProductoLibreNoEncontrado(),
          };
        }
      }
    }

    const especie =
      carrito.especiePreferida ?? carrito.contextoGuiado?.especiePreferida;
    const mensajeInterpretar = especie
      ? aplicarEspeciePreferidaAlMensaje(mensaje, especie)
      : mensaje;
    const interpretacion = await this.interpretarTexto(mensajeInterpretar, productos);

    if (interpretacion.tipo === "referencia_historica") {
      return { ok: false, error: interpretacion.motivo };
    }

    if (interpretacion.tipo !== "pedido") {
      return {
        ok: false,
        error:
          interpretacion.tipo === "no_interpretado"
            ? interpretacion.motivo
            : "No entendí ese producto.",
      };
    }

    if (interpretacion.lineas.length === 0 && !interpretacion.disambiguacion) {
      return {
        ok: false,
        error: "No pude interpretar el pedido.",
      };
    }

    const nombres = new Map(
      productos.map((producto) => [producto.id, producto.nombre])
    );

    const carritoActualizado = agregarLineasAlCarrito(
      carrito,
      interpretacion.lineas,
      nombres,
      interpretacion.observaciones
    );

    if (interpretacion.disambiguacion) {
      return {
        ok: true,
        carrito: {
          ...carritoActualizado,
          contextoDisambiguacion: interpretacion.disambiguacion,
        },
        aclaracion: interpretacion.aclaracion,
      };
    }

    return {
      ok: true,
      carrito: {
        ...carritoActualizado,
        contextoDisambiguacion: null,
      },
    };
  }

  async procesarMenuPrincipal(input: {
    mensajeRecibido: string;
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const { mensajeRecibido, cliente, carrito, menu } = input;

    if (esSaludo(mensajeRecibido)) {
      return { respuesta: menu, estadoNuevo: "MENU_PRINCIPAL", carrito };
    }

    if (esComandoNuevoPedido(mensajeRecibido)) {
      return reiniciarPedidoConversacion(menu, { omitirMensajePrevio: true });
    }

    const opcion = esOpcionMenuPrincipal(mensajeRecibido);

    if (opcion === "1") {
      return {
        respuesta: construirInstruccionPedidoLibre(),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito: { ...carritoVacio(), modo: "libre", mensajeLibre: "" },
      };
    }

    if (opcion === "2") {
      return this.iniciarPedidoGuiado(cliente, carrito);
    }

    if (opcion === "3") {
      const carritoRepetir = await this.carritoParaRepetirUltimo(cliente.id);
      if (!carritoRepetir) {
        return {
          respuesta: `${MENSAJE_SIN_ULTIMO_PEDIDO}\n\n${menu}`,
          estadoNuevo: "MENU_PRINCIPAL",
          carrito: carritoVacio(),
        };
      }

      return {
        respuesta: "",
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoRepetir,
        delegarConfirmacion: true,
      };
    }

    return {
      respuesta: construirRespuestaMenuPrincipalInvalida(menu),
      estadoNuevo: "MENU_PRINCIPAL",
      carrito,
    };
  }

  async procesarEspecieGuiada(input: {
    mensajeRecibido: string;
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
  }): Promise<ResultadoTurnoConversacion> {
    const seleccion = resolverSeleccionCategoria(input.mensajeRecibido, [
      "Res",
      "Cerdo",
    ]);

    if (!seleccion) {
      return {
        respuesta: `Opción no válida.\n\n${construirMenuEspecie()}`,
        estadoNuevo: "PEDIDO_GUIADO_ESPECIE",
        carrito: input.carrito,
      };
    }

    const especie = seleccion === 1 ? "Res" : "Cerdo";
    return this.mostrarProductosGuiados(input.cliente, input.carrito, especie);
  }

  async procesarCategoria(input: {
    mensajeRecibido: string;
    carrito: CarritoConversacion;
  }): Promise<ResultadoTurnoConversacion> {
    if (input.carrito.contextoGuiado?.slotsGuiado?.length) {
      return this.procesarProductoGuiado(input.mensajeRecibido, input.carrito);
    }

    const productos = await this.listarProductos();
    const categorias = this.categoriasOrdenadas(productos);
    const seleccion = resolverSeleccionCategoria(input.mensajeRecibido, categorias);

    if (!seleccion) {
      return {
        respuesta: `Opción no válida.\n\n${construirMenuCategorias(categorias)}`,
        estadoNuevo: "PEDIDO_GUIADO_CATEGORIA",
        carrito: input.carrito,
      };
    }

    const categoria = categorias[seleccion - 1];
    return {
      respuesta: construirMenuProductos(
        categoria,
        this.productosPorCategoria(productos, categoria)
      ),
      estadoNuevo: "PEDIDO_GUIADO_PRODUCTO",
      carrito: { ...input.carrito, contextoGuiado: { categoria } },
    };
  }

  async procesarProducto(input: {
    mensajeRecibido: string;
    carrito: CarritoConversacion;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    if (input.carrito.contextoGuiado?.slotsGuiado?.length) {
      return this.procesarProductoGuiado(input.mensajeRecibido, input.carrito);
    }

    const categoria = input.carrito.contextoGuiado?.categoria;
    if (!categoria) {
      return {
        respuesta: input.menu,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    const productos = await this.listarProductos();
    const productosCategoria = this.productosPorCategoria(productos, categoria);
    const seleccion = parsearSeleccionNumerica(
      input.mensajeRecibido,
      productosCategoria.length
    );

    if (!seleccion) {
      const textoLibre = input.mensajeRecibido.trim();
      if (validarTextoLibrePedidoGuiado(textoLibre, productos)) {
        const agregadoDirecto = this.intentarAgregarTextoLibreGuiadoConCantidad(
          input.carrito,
          textoLibre
        );
        if (agregadoDirecto) return agregadoDirecto;

        return this.iniciarCapturaCantidadesGuiadas(input.carrito, [
          construirSlotTextoLibrePedidoGuiado(textoLibre),
        ]);
      }

      return {
        respuesta: `Opción no válida.\n\n${construirMenuProductos(categoria, productosCategoria)}`,
        estadoNuevo: "PEDIDO_GUIADO_PRODUCTO",
        carrito: input.carrito,
      };
    }

    const producto = productosCategoria[seleccion - 1];
    return {
      respuesta: construirSolicitudCantidad(producto.nombre, producto.unidad),
      estadoNuevo: "PEDIDO_GUIADO_CANTIDAD",
      carrito: {
        ...input.carrito,
        contextoGuiado: {
          categoria,
          productoId: producto.id,
          productoNombre: producto.nombre,
        },
      },
    };
  }

  async procesarCantidadGuiada(input: {
    mensajeRecibido: string;
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const cola = input.carrito.contextoGuiado?.colaCantidadGuiada;
    const indiceRaw = input.carrito.contextoGuiado?.indiceCantidadGuiada ?? 0;
    const indice = Number(indiceRaw);

    if (cola?.length && Number.isFinite(indice)) {
      return this.procesarCantidadGuiadaEnCola(input, cola, indice);
    }

    return {
      respuesta: input.menu,
      estadoNuevo: "MENU_PRINCIPAL",
      carrito: carritoVacio(),
    };
  }

  private async procesarCantidadGuiadaEnCola(
    input: {
      mensajeRecibido: string;
      cliente: ClienteResuelto;
      carrito: CarritoConversacion;
    },
    cola: ProductoGuiadoSlot[],
    indice: number
  ): Promise<ResultadoTurnoConversacion> {
    const slot = cola[indice];
    if (!slot) {
      return {
        respuesta: "No hay productos pendientes de cantidad.",
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    const parseada = parsearCantidadPedidoGuiado(
      input.mensajeRecibido,
      slot.etiqueta
    );

    if (!parseada) {
      return {
        respuesta: construirErrorCantidadGuiada(slot.etiqueta, indice),
        estadoNuevo: "PEDIDO_GUIADO_CANTIDAD",
        carrito: input.carrito,
      };
    }

    const linea = await this.crearLineaDesdeCantidadGuiada(
      input.cliente,
      input.carrito,
      slot,
      parseada
    );

    if ("error" in linea) {
      return {
        respuesta: `${linea.error}\n\n${construirPreguntaCantidadGuiada(
          slot.etiqueta,
          indice === 0
        )}`,
        estadoNuevo: "PEDIDO_GUIADO_CANTIDAD",
        carrito: input.carrito,
      };
    }

    const especiePreferida =
      input.carrito.especiePreferida ??
      input.carrito.contextoGuiado?.especiePreferida;

    const carritoConLinea: CarritoConversacion = {
      ...input.carrito,
      lineas: [...input.carrito.lineas, linea],
      especiePreferida,
      totalEstimado: undefined,
    };

    const slotsGuiado = input.carrito.contextoGuiado?.slotsGuiado;
    const siguienteIndice = indice + 1;

    if (siguienteIndice < cola.length) {
      const siguiente = cola[siguienteIndice];
      return {
        respuesta: construirPreguntaCantidadGuiada(siguiente.etiqueta, false),
        estadoNuevo: "PEDIDO_GUIADO_CANTIDAD",
        carrito: {
          ...carritoConLinea,
          contextoGuiado: {
            slotsGuiado,
            especiePreferida,
            colaCantidadGuiada: cola.map((slot) => ({ ...slot })),
            indiceCantidadGuiada: siguienteIndice,
            productoNombre: siguiente.etiqueta,
            textoPedido: siguiente.textoPedido,
            productoId: siguiente.productoId,
          },
        },
      };
    }

    // Todos los productos seleccionados ya tienen cantidad → resumen intermedio
    const resumen = construirResumenPedidoGuiado(carritoConLinea.lineas);

    return {
      respuesta: construirMensajePostPedidoGuiado(resumen),
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito: {
        ...carritoConLinea,
        modo: "guiado",
        contextoGuiado: slotsGuiado?.length
          ? { slotsGuiado, especiePreferida }
          : null,
      },
    };
  }

  private async crearLineaDesdeCantidadGuiada(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion,
    slot: ProductoGuiadoSlot,
    parseada: import("@/lib/whatsapp/pedido-guiado-cantidad").CantidadGuiadaParseada
  ): Promise<LineaCarrito | { error: string }> {
    if (slot.textoPedido && !slot.productoId) {
      const nombre = slot.etiqueta.trim();
      const cantidadDisplay =
        parseada.cantidadTexto ?? String(parseada.cantidad);

      return {
        textoOriginal: `${cantidadDisplay} de ${nombre}`,
        producto_id: PRODUCTO_LINEA_LIBRE_ID,
        producto_nombre: nombre,
        cantidad: parseada.cantidad,
        unidad: parseada.unidad,
        cantidadTexto: parseada.cantidadTexto,
      };
    }

    const productos = await this.listarProductos();
    const producto = slot.productoId
      ? productos.find((item) => item.id === slot.productoId)
      : undefined;

    if (slot.productoId && !producto) {
      return { error: "No encontré ese producto en el catálogo." };
    }

    const nombre = slot.etiqueta || producto?.nombre || "producto";
    const textoOriginal = parseada.textoOriginal.includes(nombre)
      ? parseada.textoOriginal
      : `${parseada.cantidadTexto ?? parseada.cantidad} de ${nombre}`;

    return {
      textoOriginal,
      producto_id: slot.productoId ?? nombre,
      producto_nombre: nombre,
      cantidad: parseada.cantidad,
      unidad: parseada.unidad,
      cantidadTexto: parseada.cantidadTexto,
    };
  }

  async procesarConstruccion(input: {
    mensajeRecibido: string;
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
  }  ): Promise<
    | { tipo: "turno"; resultado: ResultadoTurnoConversacion }
    | { tipo: "listo"; carrito: CarritoConversacion }
    | { tipo: "listo_libre"; carrito: CarritoConversacion }
    | { tipo: "confirmar"; carrito: CarritoConversacion }
  > {
    const { mensajeRecibido, cliente, carrito } = input;

    if (
      carrito.modo !== "libre" &&
      carrito.lineas.length === 0 &&
      esOpcionMenuPrincipal(mensajeRecibido) === "2"
    ) {
      return {
        tipo: "turno",
        resultado: await this.iniciarPedidoGuiado(cliente, carrito),
      };
    }

    if (
      carrito.modo === "guiado" &&
      carrito.lineas.length > 0 &&
      carrito.contextoGuiado?.slotsGuiado?.length
    ) {
      const opcion = esOpcionConfirmacionPedido(mensajeRecibido);
      if (opcion === "confirmar") {
        return { tipo: "confirmar", carrito };
      }
      if (opcion === "reiniciar") {
        return {
          tipo: "turno",
          resultado: await this.iniciarPedidoGuiado(cliente, carritoVacio()),
        };
      }
      if (opcion === "seguir") {
        const especie =
          carrito.especiePreferida ??
          carrito.contextoGuiado.especiePreferida ??
          "Cerdo";
        const productos = await this.listarProductos();

        return {
          tipo: "turno",
          resultado: {
            respuesta: construirMenuProductosGuiados(
              especie,
              productosMenuDesdeSlots(
                carrito.contextoGuiado.slotsGuiado,
                productos
              )
            ),
            estadoNuevo: "PEDIDO_GUIADO_PRODUCTO",
            carrito: {
              ...carrito,
              contextoDisambiguacion: null,
            },
          },
        };
      }
    }

    if (esClienteIndicaListo(mensajeRecibido)) {
      if (carrito.contextoDisambiguacion) {
        return {
          tipo: "turno",
          resultado: this.responderInformacionPendiente(carrito),
        };
      }

      if (carrito.lineas.length > 0) {
        return { tipo: "listo", carrito };
      }
      if (carrito.modo === "libre") {
        return { tipo: "listo_libre", carrito };
      }
      return { tipo: "listo", carrito };
    }

    if (esClienteDeseaSeguirAgregando(mensajeRecibido)) {
      if (
        carrito.modo === "guiado" &&
        carrito.contextoGuiado?.slotsGuiado?.length
      ) {
        const especie =
          carrito.especiePreferida ??
          carrito.contextoGuiado.especiePreferida ??
          "Cerdo";
        const productos = await this.listarProductos();

        return {
          tipo: "turno",
          resultado: {
            respuesta: construirMenuProductosGuiados(
              especie,
              productosMenuDesdeSlots(
                carrito.contextoGuiado.slotsGuiado,
                productos
              )
            ),
            estadoNuevo: "PEDIDO_GUIADO_PRODUCTO",
            carrito: {
              ...carrito,
              contextoDisambiguacion: null,
            },
          },
        };
      }

      return {
        tipo: "turno",
        resultado: {
          respuesta: construirInstruccionAgregarMas(),
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito: {
            ...carrito,
            modo: "libre",
            contextoGuiado: null,
            contextoDisambiguacion: null,
          },
        },
      };
    }

    const eliminacion = await this.intentarEliminarDelCarrito(
      carrito,
      mensajeRecibido
    );
    if (eliminacion) {
      return { tipo: "turno", resultado: eliminacion };
    }

    const correccion = await this.intentarCorregirDelCarrito(
      cliente,
      carrito,
      mensajeRecibido
    );
    if (correccion) {
      return { tipo: "turno", resultado: correccion };
    }

    const resueltoDisambiguacion = await this.procesarDisambiguacionPendiente(
      cliente,
      carrito,
      mensajeRecibido
    );
    if (resueltoDisambiguacion) {
      return { tipo: "turno", resultado: resueltoDisambiguacion };
    }

    const agregado = await this.agregarTextoAlCarrito(cliente, carrito, mensajeRecibido);

    if (!agregado.ok) {
      return {
        tipo: "turno",
        resultado: {
          respuesta: `${agregado.error}\n\nEscriba su pedido de nuevo.`,
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        },
      };
    }

    if (agregado.carrito.contextoDisambiguacion) {
      return {
        tipo: "turno",
        resultado: this.responderInformacionPendiente(agregado.carrito),
      };
    }

    return { tipo: "listo", carrito: agregado.carrito };
  }

  async finalizarPedidoLibre(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion
  ): Promise<
    | { ok: true; carrito: CarritoConversacion }
    | { ok: false; resultado: ResultadoTurnoConversacion }
  > {
    if (carrito.lineas.length > 0) {
      return { ok: true, carrito };
    }

    const textoCompleto = carrito.mensajeLibre?.trim() ?? "";

    if (!textoCompleto) {
      return {
        ok: false,
        resultado: {
          respuesta:
            "Aún no recibimos productos. Escriba su pedido o elija *2* para pedido guiado.",
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        },
      };
    }

    const productos = await this.listarProductos();
    const interpretacion = await this.interpretarTexto(textoCompleto, productos);

    if (interpretacion.tipo === "referencia_historica") {
      return {
        ok: false,
        resultado: {
          respuesta: `${interpretacion.motivo}\n\nPuede corregir su mensaje o escriba *menu* para volver.`,
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        },
      };
    }

    if (interpretacion.tipo !== "pedido") {
      return {
        ok: false,
        resultado: {
          respuesta: `${
            interpretacion.tipo === "no_interpretado"
              ? interpretacion.motivo
              : "No pude interpretar su pedido."
          }\n\nRevise el texto e intente de nuevo, o escriba *menu* para volver.`,
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        },
      };
    }

    const nombres = new Map(
      productos.map((producto) => [producto.id, producto.nombre])
    );

    return {
      ok: true,
      carrito: agregarLineasAlCarrito(
        { ...carritoVacio(), modo: "libre", mensajeLibre: textoCompleto },
        interpretacion.lineas,
        nombres,
        interpretacion.observaciones
      ),
    };
  }

  async intentarCorregirDelCarrito(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion,
    mensaje: string
  ): Promise<ResultadoTurnoConversacion | null> {
    const solicitud = parsearSolicitudCorreccion(mensaje);
    if (!solicitud) return null;

    const productosMenu = await this.listarProductos();
    const catalogo = await this.catalogoDesdeProductos(productosMenu);

    let textoInterpretar =
      solicitud.tipo === "reemplazar"
        ? solicitud.textoNuevo
        : solicitud.textoNuevo;

    if (solicitud.tipo === "aclarar") {
      const lineaObjetivo = carrito.lineas.at(-1);
      if (!lineaObjetivo) {
        return {
          respuesta:
            "No encontré en su pedido el producto que desea aclarar.",
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        };
      }

      textoInterpretar = combinarLineaConAclaracion(
        lineaObjetivo.textoOriginal,
        solicitud.textoNuevo
      );
    }

    if (carrito.especiePreferida) {
      textoInterpretar = aplicarEspeciePreferidaAlMensaje(
        textoInterpretar,
        carrito.especiePreferida
      );
    }

    const interpretacion = await this.interpretarTexto(
      textoInterpretar,
      productosMenu
    );
    if (interpretacion.tipo !== "pedido" || interpretacion.lineas.length === 0) {
      return {
        respuesta:
          "No pude interpretar la corrección. Intente de nuevo, por ejemplo: Corrige la molida, son 300 pesos.",
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito,
      };
    }

    const nombres = new Map(
      productosMenu.map((producto) => [producto.id, producto.nombre])
    );
    const lineaNueva = lineaCarritoDesdeInterpretada(
      interpretacion.lineas[0],
      interpretacion.lineas[0].nombreMostrar ??
        nombres.get(interpretacion.lineas[0].producto_id) ??
        interpretacion.lineas[0].textoOriginal
    );

    const resultado = aplicarCorreccionCarrito({
      carrito,
      solicitud,
      lineaNueva,
      productos: catalogo,
    });

    if (!resultado.ok) {
      return {
        respuesta: `${resultado.error}\n\nEscriba otro producto o continúe su pedido.`,
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito,
      };
    }

    let carritoActualizado = resultado.carrito;
    if (interpretacion.disambiguacion) {
      carritoActualizado = {
        ...carritoActualizado,
        contextoDisambiguacion: interpretacion.disambiguacion,
      };
    }

    const resumen = construirResumenCarrito(
      carritoActualizado.lineas,
      carritoActualizado.observaciones
    );

    const respuestaBase = construirMensajePostCorregirCarrito(
      resultado.detalleCorregido,
      resumen
    );
    const respuesta = interpretacion.aclaracion
      ? `${respuestaBase}\n\n${interpretacion.aclaracion}`
      : respuestaBase;

    return {
      respuesta,
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito: carritoActualizado,
    };
  }

  private async iniciarPedidoGuiado(
    _cliente: ClienteResuelto,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    return {
      respuesta: construirMenuEspecie(),
      estadoNuevo: "PEDIDO_GUIADO_ESPECIE",
      carrito: {
        ...carritoVacio(),
        modo: "guiado",
        contextoGuiado: {},
      },
    };
  }

  private async mostrarProductosGuiados(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion,
    especie: "Res" | "Cerdo"
  ): Promise<ResultadoTurnoConversacion> {
    const productos = await this.listarProductos();
    const tipoCliente = await this.obtenerTipoClienteParaMenu(cliente.tipo_cliente_id);
    const slots = construirSlotsPedidoGuiado(tipoCliente, productos, especie);

    if (slots.length === 0) {
      return {
        respuesta: construirMenuCategorias(this.categoriasOrdenadas(productos)),
        estadoNuevo: "PEDIDO_GUIADO_CATEGORIA",
        carrito: {
          ...carritoVacio(),
          modo: "guiado",
          especiePreferida: especie,
          contextoGuiado: { especiePreferida: especie },
        },
      };
    }

    return {
      respuesta: construirMenuProductosGuiados(
        especie,
        productosMenuDesdeSlots(slots, productos)
      ),
      estadoNuevo: "PEDIDO_GUIADO_PRODUCTO",
      carrito: {
        ...carritoVacio(),
        lineas: carrito.lineas,
        modo: "guiado",
        especiePreferida: especie,
        contextoGuiado: { slotsGuiado: slots, especiePreferida: especie },
      },
    };
  }

  private async procesarProductoGuiado(
    mensajeRecibido: string,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    const slots = carrito.contextoGuiado?.slotsGuiado ?? [];
    const productos = await this.listarProductos();
    const especie =
      carrito.especiePreferida ?? carrito.contextoGuiado?.especiePreferida ?? "Cerdo";
    const selecciones = parsearSeleccionesMultiples(
      mensajeRecibido,
      slots.length
    );

    if (!selecciones) {
      const textoLibre = mensajeRecibido.trim();
      if (validarTextoLibrePedidoGuiado(textoLibre, productos)) {
        const agregadoDirecto = this.intentarAgregarTextoLibreGuiadoConCantidad(
          carrito,
          textoLibre
        );
        if (agregadoDirecto) return agregadoDirecto;

        return this.iniciarCapturaCantidadesGuiadas(carrito, [
          construirSlotTextoLibrePedidoGuiado(textoLibre),
        ]);
      }

      return {
        respuesta: `${construirMensajeProductoLibreNoEncontrado()}\n\n${construirMenuProductosGuiados(
          especie,
          productosMenuDesdeSlots(slots, productos)
        )}`,
        estadoNuevo: "PEDIDO_GUIADO_PRODUCTO",
        carrito,
      };
    }

    const cola = selecciones.map((indice) => slots[indice - 1]);
    return this.iniciarCapturaCantidadesGuiadas(carrito, cola);
  }

  private intentarAgregarTextoLibreGuiadoConCantidad(
    carrito: CarritoConversacion,
    textoLibre: string
  ): ResultadoTurnoConversacion | null {
    const limpio = limpiarPrefijoPedido(textoLibre.trim());
    const separado = separarCantidadInicial(limpio);
    if (!separado?.resto?.trim()) return null;

    const parseada =
      parsearCantidadPedidoGuiado(textoLibre, separado.resto) ?? {
        cantidad: separado.cantidad,
        unidad: separado.unidad ?? "pieza",
        cantidadTexto: separado.cantidadTexto,
        textoOriginal: textoLibre.trim(),
      };

    const linea: LineaCarrito = {
      textoOriginal: textoLibre.trim(),
      producto_id: PRODUCTO_LINEA_LIBRE_ID,
      producto_nombre: separado.resto.trim(),
      cantidad: parseada.cantidad,
      unidad: parseada.unidad,
      cantidadTexto: parseada.cantidadTexto,
    };

    const especiePreferida =
      carrito.especiePreferida ?? carrito.contextoGuiado?.especiePreferida;
    const slotsGuiado = carrito.contextoGuiado?.slotsGuiado;

    const carritoConLinea: CarritoConversacion = {
      ...carrito,
      lineas: [...carrito.lineas, linea],
      especiePreferida,
      totalEstimado: undefined,
    };

    const resumen = construirResumenPedidoGuiado(carritoConLinea.lineas);

    return {
      respuesta: construirMensajePostPedidoGuiado(resumen),
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito: {
        ...carritoConLinea,
        modo: carrito.modo ?? "guiado",
        contextoGuiado: slotsGuiado?.length
          ? { slotsGuiado, especiePreferida }
          : carrito.contextoGuiado,
      },
    };
  }

  private iniciarCapturaCantidadesGuiadas(
    carrito: CarritoConversacion,
    cola: ProductoGuiadoSlot[]
  ): ResultadoTurnoConversacion {
    const primera = cola[0];
    const confirmacion =
      cola.length > 1
        ? `${construirConfirmacionSeleccionGuiada(
            cola.map((slot) => slot.etiqueta)
          )}\n\n`
        : "";
    const pregunta = construirPreguntaCantidadGuiada(primera.etiqueta, true);

    return {
      respuesta: `${confirmacion}${pregunta}`,
      estadoNuevo: "PEDIDO_GUIADO_CANTIDAD",
      carrito: {
        ...carrito,
        contextoGuiado: {
          slotsGuiado: carrito.contextoGuiado?.slotsGuiado,
          especiePreferida: carrito.contextoGuiado?.especiePreferida,
          colaCantidadGuiada: cola.map((slot) => ({ ...slot })),
          indiceCantidadGuiada: 0,
          productoNombre: primera.etiqueta,
          textoPedido: primera.textoPedido,
          productoId: primera.productoId,
        },
      },
    };
  }

  private seleccionarSlotGuiado(
    carrito: CarritoConversacion,
    slot: ProductoGuiadoSlot,
    _productos: ProductoMenu[]
  ): ResultadoTurnoConversacion {
    return this.iniciarCapturaCantidadesGuiadas(carrito, [slot]);
  }

  private async obtenerTipoClienteParaMenu(
    tipoClienteId: string
  ): Promise<{ codigo: string | null; nombre: string | null }> {
    const { data, error } = await this.db
      .from("tipos_cliente")
      .select("codigo, nombre")
      .eq("id", tipoClienteId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return {
      codigo: (data?.codigo as string | undefined) ?? null,
      nombre: (data?.nombre as string | undefined) ?? null,
    };
  }

  async intentarEliminarDelCarrito(
    carrito: CarritoConversacion,
    mensaje: string
  ): Promise<ResultadoTurnoConversacion | null> {
    const solicitud = parsearSolicitudEliminacion(mensaje);
    if (!solicitud) return null;

    const productos = await this.listarProductos();
    const catalogo = await this.catalogoDesdeProductos(productos);
    const resultado = aplicarEliminacionCarrito(
      carrito,
      solicitud,
      catalogo
    );

    if (!resultado.ok) {
      return {
        respuesta: `${resultado.error}\n\nEscriba otro producto o *listo* para confirmar.`,
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito,
      };
    }

    const resumen = construirResumenCarrito(
      resultado.carrito.lineas,
      resultado.carrito.observaciones
    );

    return {
      respuesta: construirMensajePostEliminarCarrito(
        resultado.detalleEliminado,
        resumen
      ),
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito: resultado.carrito,
    };
  }

  private async interpretarTexto(mensaje: string, productos: ProductoMenu[]) {
    const interpretador = obtenerInterpretadorMensajes();
    return interpretador.interpretar({
      texto: mensaje,
      productos: await this.catalogoDesdeProductos(productos),
    });
  }

  private async catalogoDesdeProductos(
    productos: ProductoMenu[]
  ): Promise<ProductoCatalogo[]> {
    const aliasesPorProducto = await cargarAliasesPorProductos(
      this.db,
      productos.map((producto) => producto.id)
    );

    return productos.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      precio_kg: 0,
      activo: true,
      categoria: producto.categoria,
      aliases: aliasesPorProducto.get(producto.id) ?? [],
    }));
  }

  responderInformacionPendiente(
    carrito: CarritoConversacion
  ): ResultadoTurnoConversacion {
    const pendiente = carrito.contextoDisambiguacion;
    if (!pendiente) {
      throw new Error("No hay información pendiente en el carrito.");
    }

    const resumen = construirResumenCarrito(
      carrito.lineas,
      carrito.observaciones
    );

    return {
      respuesta: construirSolicitudInformacionPendiente(resumen, pendiente),
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito,
    };
  }

  async procesarDisambiguacionPendiente(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion,
    mensaje: string
  ): Promise<ResultadoTurnoConversacion | null> {
    const pendiente = carrito.contextoDisambiguacion;
    if (!pendiente) return null;

    const productos = await this.listarProductos();
    const unidadPorProductoId = new Map(
      productos.map((producto) => [
        producto.id,
        producto.unidad === "kg" ? ("kg" as const) : ("pieza" as const),
      ])
    );
    const resultado = continuarDisambiguacionComercial({
      mensaje,
      pendiente,
      unidadPorProductoId,
    });

    const resumenBase = construirResumenCarrito(
      carrito.lineas,
      carrito.observaciones
    );

    if (!resultado.ok) {
      return {
        respuesta: [
          "Opción no válida.",
          "",
          construirSolicitudInformacionPendiente(resumenBase, pendiente),
        ].join("\n"),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito,
      };
    }

    const lineaResuelta = lineaCarritoDesdeInterpretada(
      resultado.linea,
      resultado.productoNombre
    );

    const carritoActualizado: CarritoConversacion = {
      ...carrito,
      lineas: reemplazarLineaPendienteDisambiguacion(
        carrito.lineas,
        pendiente.segmento,
        lineaResuelta
      ),
      contextoDisambiguacion: resultado.siguiente,
      totalEstimado: undefined,
    };

    const resumen = construirResumenCarrito(
      carritoActualizado.lineas,
      carritoActualizado.observaciones
    );

    if (resultado.siguiente) {
      return {
        respuesta: construirSolicitudInformacionPendiente(
          resumen,
          resultado.siguiente
        ),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito: carritoActualizado,
      };
    }

    return {
      respuesta: "",
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito: carritoActualizado,
      delegarConfirmacion: true,
    };
  }

  private categoriasOrdenadas(productos: ProductoMenu[]): string[] {
    const vistos = new Set<string>();
    const categorias: string[] = [];
    for (const producto of productos) {
      if (!vistos.has(producto.categoria)) {
        vistos.add(producto.categoria);
        categorias.push(producto.categoria);
      }
    }
    return categorias;
  }

  private productosPorCategoria(
    productos: ProductoMenu[],
    categoria: string
  ): ProductoMenu[] {
    return productos.filter((producto) => producto.categoria === categoria);
  }

  private async carritoParaRepetirUltimo(
    clienteId: string
  ): Promise<CarritoConversacion | null> {
    const ultimo = await obtenerUltimoPedidoCliente(this.db, clienteId);
    if (!ultimo) return null;

    return {
      lineas: ultimo.lineas,
      modo: "repetir",
      contextoGuiado: null,
    };
  }
}
