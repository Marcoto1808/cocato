import {
  ETIQUETAS_TIPO_CALCULO,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";

export type Producto = {
  id: string;
  nombre: string;
  precio_kg: number;
  unidad: string;
  categoria: string;
  subcategoria: string;
  tipo_calculo: TipoCalculoProducto;
  activo: boolean;
};

type Props = {
  productos: Producto[];
  onEditar: (producto: Producto) => void;
  onToggleActivo: (producto: Producto) => void;
  sinResultados?: boolean;
};

function formatPrecio(precio: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(precio);
}

function estiloCategoria(categoria: string) {
  switch (categoria.toLowerCase()) {
    case "res":
      return "bg-red-100 text-red-800";
    case "cerdo":
      return "bg-pink-100 text-pink-800";
    case "pollo":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default function ProductosTable({
  productos,
  onEditar,
  onToggleActivo,
  sinResultados = false,
}: Props) {
  if (productos.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        {sinResultados
          ? "No se encontraron productos con ese criterio."
          : "No hay productos registrados."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead className="bg-zinc-100">
            <tr>
              <th className="p-3 text-left text-sm font-medium text-zinc-700">
                Nombre
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-700">
                Categoría
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-700">
                Precio / kg
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-700">
                Unidad
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-700">
                Tipo de cálculo
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-700">
                Estado
              </th>
              <th className="p-3 text-right text-sm font-medium text-zinc-700">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id} className="border-t border-zinc-100">
                <td className="p-3 font-medium text-zinc-900">
                  {producto.nombre}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${estiloCategoria(producto.categoria)}`}
                  >
                    {producto.categoria}
                  </span>
                </td>
                <td className="p-3 text-zinc-700">
                  {formatPrecio(producto.precio_kg)}
                </td>
                <td className="p-3 text-zinc-700">{producto.unidad}</td>
                <td className="p-3 text-zinc-700">
                  {ETIQUETAS_TIPO_CALCULO[producto.tipo_calculo] ??
                    producto.tipo_calculo}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      producto.activo
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {producto.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEditar(producto)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActivo(producto)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white transition ${
                        producto.activo
                          ? "bg-zinc-700 hover:bg-zinc-800"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {producto.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
