import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  agregarLineasAlCarrito,
  carritoVacio,
  lineaCarritoDesdeInterpretada,
  mensajeOriginalDesdeCarrito,
  type CarritoConversacion,
  type LineaCarrito,
} from "../conversation/cart.ts";
import {
  construirInstruccionPedidoLibre,
  construirMenuCategorias,
  construirMenuProductos,
  construirMensajePostAgregarCarrito,
  construirResumenCarrito,
  construirSolicitudCantidad,
  esClienteIndicaListo,
  esOpcionMenuPrincipal,
  esSaludo,
  MENSAJE_SIN_ULTIMO_PEDIDO,
  parsearCantidad,
  parsearSeleccionNumerica,
} from "../conversation/states.ts";
import { interpretarMensajeSimple } from "../openai/reglas-simples.ts";
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
    const mensajeOriginal = mensajeOriginalDesdeCarrito(lineas);
    const analisis = interpretarMensajeSimple({
      mensaje: mensajeOriginal,
      productos,
      nombreCliente: cliente.nombre_negocio,
    });

    if (!analisis.ok) return null;

    const lista = await resolverListaPrecioCliente(
      this.db,
      cliente.tipo_cliente_id,
      cliente.lista_precio_id
    );
    const preciosLista = lista
      ? await cargarPreciosLista(this.db, lista.id)
      : new Map<string, number>();

    const lineasPedido = [];
    for (const linea of analisis.analisis.lineas) {
      const producto = buscarProductoPorNombre(linea.producto_nombre, productos);
      if (!producto) return null;

      const tipoCalculo: TipoCalculoProducto =
        producto.tipo_calculo === "POR_KILO" ||
        producto.tipo_calculo === "POR_PESO_REAL" ||
        producto.tipo_calculo === "PRECIO_FIJO"
          ? producto.tipo_calculo
          : tipoCalculoPorDefecto(producto.unidad);

      lineasPedido.push(
        crearLineaPedido({
          producto_id: producto.id,
          unidadProducto: producto.unidad,
          tipo_calculo: tipoCalculo,
          cantidad: linea.cantidad,
          unidadCaptura:
            linea.unidad === "kg" ? "kg" : producto.unidad === "kg" ? "kg" : "pieza",
          precioLista: precioProductoParaPedido(preciosLista, producto),
        })
      );
    }

    return calcularTotalLineas(lineasPedido);
  }

  async agregarTextoAlCarrito(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion,
    mensaje: string
  ): Promise<{ ok: true; carrito: CarritoConversacion } | { ok: false; error: string }> {
    const productos = await this.listarProductos();
    const analisis = interpretarMensajeSimple({
      mensaje,
      productos,
      nombreCliente: cliente.nombre_negocio,
    });

    if (!analisis.ok) {
      return { ok: false, error: analisis.motivo };
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
        carrito,
        nuevas,
        analisis.observacionesLista
      ),
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
    const productos = await this.listarProductos();

    if (opcion === "1") {
      return {
        respuesta: construirInstruccionPedidoLibre(),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito: { ...carritoVacio(), modo: "libre", mensajeLibre: "" },
      };
    }

    if (opcion === "2") {
      return {
        respuesta: construirMenuCategorias(this.categoriasOrdenadas(productos)),
        estadoNuevo: "PEDIDO_GUIADO_CATEGORIA",
        carrito: { ...carritoVacio(), modo: "guiado", contextoGuiado: {} },
      };
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

    const pedidoDirecto = await this.agregarTextoAlCarrito(
      cliente,
      { ...carritoVacio(), modo: "libre" },
      mensajeRecibido
    );

    if (pedidoDirecto.ok) {
      const resumen = construirResumenCarrito(
        pedidoDirecto.carrito.lineas,
        pedidoDirecto.carrito.observaciones
      );

      return {
        respuesta: construirMensajePostAgregarCarrito(resumen),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito: pedidoDirecto.carrito,
      };
    }

    return {
      respuesta: `${menu}\n\nResponda 1, 2 o 3 para continuar.`,
      estadoNuevo: "MENU_PRINCIPAL",
      carrito,
    };
  }

  async procesarCategoria(input: {
    mensajeRecibido: string;
    carrito: CarritoConversacion;
  }): Promise<ResultadoTurnoConversacion> {
    const productos = await this.listarProductos();
    const categorias = this.categoriasOrdenadas(productos);
    const seleccion = parsearSeleccionNumerica(input.mensajeRecibido, categorias.length);

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
    const productoId = input.carrito.contextoGuiado?.productoId;
    const productoNombre = input.carrito.contextoGuiado?.productoNombre;

    if (!productoId || !productoNombre) {
      return {
        respuesta: input.menu,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    const cantidad = parsearCantidad(input.mensajeRecibido);
    if (!cantidad) {
      return {
        respuesta: `Cantidad no válida.\n\n${construirSolicitudCantidad(productoNombre, producto?.unidad ?? "pieza")}`,
        estadoNuevo: "PEDIDO_GUIADO_CANTIDAD",
        carrito: input.carrito,
      };
    }

    const productos = await this.listarProductos();
    const producto = productos.find((item) => item.id === productoId);
    const unidad = producto?.unidad === "kg" ? "kg" : "pieza";
    const unidadTexto = unidad === "kg" ? "kg" : "pza";

    const carrito: CarritoConversacion = {
      ...input.carrito,
      lineas: [
        ...input.carrito.lineas,
        {
          textoOriginal: `${cantidad} ${unidadTexto} ${productoNombre}`,
          producto_id: productoId,
          producto_nombre: productoNombre,
          cantidad,
          unidad,
        },
      ],
      contextoGuiado: null,
      totalEstimado: undefined,
    };

    const resumen = construirResumenCarrito(carrito.lineas, carrito.observaciones);

    return {
      respuesta: construirMensajePostAgregarCarrito(resumen),
      estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
      carrito,
    };
  }

  async procesarConstruccion(input: {
    mensajeRecibido: string;
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
  }): Promise<
    | { tipo: "turno"; resultado: ResultadoTurnoConversacion }
    | { tipo: "listo"; carrito: CarritoConversacion }
    | { tipo: "listo_libre"; carrito: CarritoConversacion }
  > {
    const { mensajeRecibido, cliente, carrito } = input;

    if (esOpcionMenuPrincipal(mensajeRecibido) === "2") {
      const productos = await this.listarProductos();
      return {
        tipo: "turno",
        resultado: {
          respuesta: construirMenuCategorias(this.categoriasOrdenadas(productos)),
          estadoNuevo: "PEDIDO_GUIADO_CATEGORIA",
          carrito: { ...carrito, modo: "guiado", contextoGuiado: {} },
        },
      };
    }

    if (esClienteIndicaListo(mensajeRecibido)) {
      if (carrito.lineas.length > 0) {
        return { tipo: "listo", carrito };
      }
      if (carrito.modo === "libre") {
        return { tipo: "listo_libre", carrito };
      }
      return { tipo: "listo", carrito };
    }

    const eliminacion = await this.intentarEliminarDelCarrito(
      carrito,
      mensajeRecibido
    );
    if (eliminacion) {
      return { tipo: "turno", resultado: eliminacion };
    }

    const agregado = await this.agregarTextoAlCarrito(cliente, carrito, mensajeRecibido);

    if (!agregado.ok) {
      return {
        tipo: "turno",
        resultado: {
          respuesta: `${agregado.error}\n\nEscriba otro producto o *listo* para confirmar.`,
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
          carrito,
        },
      };
    }

    const resumen = construirResumenCarrito(
      agregado.carrito.lineas,
      agregado.carrito.observaciones
    );

    return {
      tipo: "turno",
      resultado: {
        respuesta: construirMensajePostAgregarCarrito(resumen),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito: agregado.carrito,
      },
    };
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
