import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  agregarLineasAlCarrito,
  carritoVacio,
  lineaCarritoDesdeInterpretada,
  mensajeOriginalDesdeCarrito,
  reemplazarLineaPendienteDisambiguacion,
  type CarritoConversacion,
  type LineaCarrito,
} from "../conversation/cart.ts";
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
  esClienteDeseaSeguirAgregando,
  esClienteIndicaListo,
  esOpcionMenuPrincipal,
  esSaludo,
  MENSAJE_SIN_ULTIMO_PEDIDO,
  parsearSeleccionNumerica,
} from "../conversation/states.ts";
import { aplicarEspeciePreferidaAlMensaje } from "../conversation/especie-preferida.ts";
import {
  construirMenuProductosGuiados,
  construirSlotsPedidoGuiado,
  construirSlotTextoLibrePedidoGuiado,
  construirMensajeProductoLibreNoEncontrado,
  extraerTextoProductoParaValidacionLibre,
  productosMenuDesdeSlots,
  validarTextoLibrePedidoGuiado,
  type ProductoGuiadoSlot,
} from "../conversation/pedido-guiado-productos.ts";
import { PRODUCTO_LINEA_LIBRE_ID } from "../openai/linea-libre.ts";
import {
  esLineaLibre,
  esLineaPendienteDisambiguacion,
} from "../openai/linea-libre.ts";
import {
  construirConfirmacionSeleccionGuiada,
  construirErrorCantidadGuiada,
  construirMensajePostPedidoGuiado,
  construirPreguntaCantidadGuiada,
  construirResumenPedidoGuiado,
  mensajeContieneTextoProducto,
  parsearCantidadPedidoGuiado,
  parsearSeleccionesMultiples,
} from "../conversation/pedido-guiado-cantidad.ts";
import { esOpcionConfirmacionPedido } from "../conversation/comandos-pedido.ts";
import {
  limpiarPrefijoPedido,
  segmentarMensajePedido,
} from "../openai/cantidad-natural.ts";
import { interpretarMensajeSimple } from "../openai/reglas-simples.ts";
import { separarCantidadInicial } from "../openai/resolver-producto.ts";
import { resolverSeleccionCategoria } from "../openai/resolver-categoria.ts";
import {
  continuarDisambiguacionComercial,
  requiereDisambiguacionPorEspecie,
} from "../openai/disambiguacion.ts";
import {
  calcularTotalLineas,
  crearLineaPedido,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "../pedidos/calculo.ts";
import {
  cargarPreciosLista,
  precioProductoParaPedido,
  resolverListaPrecioCliente,
} from "../pedidos/lista-precio.repository.ts";
import { obtenerUltimoPedidoCliente } from "../repositories/conversation.repository.ts";
import {
  buscarProductoPorNombre,
  listarProductosCompletos,
  type ProductoCatalogo,
} from "../repositories/product.repository.ts";
import type { ClienteResuelto } from "../types.ts";
import type { ResultadoTurnoConversacion } from "./conversation-turn.types.ts";
import {
  aplicarEliminacionCarrito,
  construirMensajePostEliminarCarrito,
  parsearSolicitudEliminacion,
} from "../conversation/carrito-eliminacion.ts";
import { construirLineasDesdeCarrito } from "./pedido-desde-mensaje.service.ts";

export class PedidoService {
  private productosCache: ProductoCatalogo[] | null = null;

  constructor(private readonly db: SupabaseClient) {}

  async listarProductos(): Promise<ProductoCatalogo[]> {
    if (this.productosCache) return this.productosCache;
    this.productosCache = await listarProductosCompletos(this.db);
    return this.productosCache;
  }

  async calcularTotal(
    cliente: ClienteResuelto,
    lineas: LineaCarrito[]
  ): Promise<number | null> {
    if (lineas.length === 0) return null;

    const productos = await this.listarProductos();
    const lineasValidas = lineas.filter(
      (linea) =>
        !esLineaLibre(linea.producto_id) &&
        !esLineaPendienteDisambiguacion(linea.producto_id)
    );

    if (lineasValidas.length === 0) return null;

    const resultado = await construirLineasDesdeCarrito(
      this.db,
      cliente,
      lineasValidas,
      productos
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
    const analisis = interpretarMensajeSimple({
      mensaje: mensajeInterpretar,
      productos,
      nombreCliente: cliente.nombre_negocio,
    });

    if (!analisis.ok) {
      return { ok: false, error: analisis.motivo };
    }

    if (analisis.analisis.lineas.length === 0 && !analisis.disambiguacion) {
      return {
        ok: false,
        error: "No pude interpretar el pedido.",
      };
    }

    const conservarTextoCliente = mensajeContieneTextoProducto(mensaje);

    const nuevas = analisis.analisis.lineas.map((linea) => {
      const productoId =
        linea.producto_id ??
        buscarProductoPorNombre(linea.producto_nombre, productos)?.id ??
        linea.producto_nombre;
      const textoOriginal =
        linea.texto_original ??
        (linea.cantidad_texto
          ? `${linea.cantidad_texto} ${linea.producto_nombre}`
          : `${linea.cantidad} ${linea.producto_nombre}`);
      const nombreMostrar = conservarTextoCliente
        ? extraerTextoProductoParaValidacionLibre(textoOriginal) ||
          textoOriginal.trim()
        : linea.producto_nombre;

      return lineaCarritoDesdeInterpretada(
        {
          producto_id: productoId,
          cantidad: linea.cantidad,
          unidad: linea.unidad,
          textoOriginal,
          cantidadTexto: linea.cantidad_texto,
        },
        nombreMostrar
      );
    });

    const carritoActualizado = agregarLineasAlCarrito(
      carrito,
      nuevas,
      analisis.observacionesLista
    );

    if (analisis.disambiguacion) {
      return {
        ok: true,
        carrito: {
          ...carritoActualizado,
          contextoDisambiguacion: analisis.disambiguacion,
        },
        aclaracion: analisis.aclaracion,
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
            colaCantidadGuiada: cola.map((s) => ({ ...s })),
            indiceCantidadGuiada: siguienteIndice,
            productoNombre: siguiente.etiqueta,
            textoPedido: siguiente.textoPedido,
            productoId: siguiente.productoId,
          },
        },
      };
    }

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
    parseada: {
      cantidad: number;
      unidad: "kg" | "pieza";
      cantidadTexto?: string;
      textoOriginal: string;
    }
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

  async intentarEliminarDelCarrito(
    carrito: CarritoConversacion,
    mensaje: string
  ): Promise<ResultadoTurnoConversacion | null> {
    const solicitud = parsearSolicitudEliminacion(mensaje);
    if (!solicitud) return null;

    const productos = await this.listarProductos();
    const resultado = aplicarEliminacionCarrito(carrito, solicitud, productos);

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
    const analisis = interpretarMensajeSimple({
      mensaje: textoCompleto,
      productos,
      nombreCliente: cliente.nombre_negocio,
    });

    if (!analisis.ok) {
      return {
        ok: false,
        resultado: {
          respuesta: `${analisis.motivo}\n\nRevise el texto e intente de nuevo, o escriba *menu* para volver.`,
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        },
      };
    }

    const nuevas = analisis.analisis.lineas.map((linea) => {
      const producto = buscarProductoPorNombre(linea.producto_nombre, productos);
      const unidadTexto = linea.unidad === "kg" ? "kg" : "pza";
      return lineaCarritoDesdeInterpretada(
        {
          producto_id: producto?.id ?? linea.producto_nombre,
          cantidad: linea.cantidad,
          unidad: linea.unidad,
          textoOriginal: `${linea.cantidad} ${unidadTexto} ${linea.producto_nombre}`,
        },
        linea.producto_nombre
      );
    });

    return {
      ok: true,
      carrito: agregarLineasAlCarrito(
        { ...carritoVacio(), modo: "libre", mensajeLibre: textoCompleto },
        nuevas,
        analisis.observacionesLista
      ),
    };
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
    _cliente: ClienteResuelto,
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

  private async iniciarPedidoGuiado(
    _cliente: ClienteResuelto,
    _carrito: CarritoConversacion
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
    _carrito: CarritoConversacion,
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

  private categoriasOrdenadas(productos: ProductoCatalogo[]): string[] {
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
    productos: ProductoCatalogo[],
    categoria: string
  ): ProductoCatalogo[] {
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
