import { formatMoneda } from "@/lib/pedido-calculo";
import {
  clienteCreditoBloqueado,
  type ResumenCreditoCliente,
} from "@/lib/cliente-credito";

type Props = {
  resumen: ResumenCreditoCliente;
  limiteCredito: number;
  esAdministrador: boolean;
  onEditarLimite: () => void;
};

function formatFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Metrica({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-zinc-200/80">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {etiqueta}
      </p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{valor}</p>
    </div>
  );
}

export default function ClienteResumenCredito({
  resumen,
  limiteCredito,
  esAdministrador,
  onEditarLimite,
}: Props) {
  const bloqueado = clienteCreditoBloqueado(resumen);

  return (
    <section
      className={`space-y-4 rounded-2xl p-6 shadow-sm ring-1 ${
        bloqueado
          ? "bg-red-50 ring-red-200"
          : "bg-emerald-50 ring-emerald-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
              bloqueado
                ? "bg-red-100 text-red-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {bloqueado ? "🔴 Crédito bloqueado" : "🟢 Crédito disponible"}
          </p>
          <h2 className="mt-3 text-lg font-semibold text-zinc-900">
            Resumen de crédito
          </h2>
        </div>

        {esAdministrador ? (
          <button
            type="button"
            onClick={onEditarLimite}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Editar límite de crédito
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metrica
          etiqueta="Límite de crédito"
          valor={formatMoneda(limiteCredito)}
        />
        <Metrica
          etiqueta="Crédito disponible"
          valor={formatMoneda(resumen.creditoDisponible)}
        />
        <Metrica
          etiqueta="Saldo pendiente"
          valor={formatMoneda(resumen.saldoPendiente)}
        />
        <Metrica
          etiqueta="Notas pendientes"
          valor={String(resumen.notasPendientes)}
        />
        <Metrica
          etiqueta="Último pedido"
          valor={
            resumen.ultimoPedido
              ? `${formatFecha(resumen.ultimoPedido.fecha)} · ${formatMoneda(resumen.ultimoPedido.total)}`
              : "—"
          }
        />
        <Metrica
          etiqueta="Último pago"
          valor={
            resumen.ultimoPago
              ? `${formatFecha(resumen.ultimoPago.fecha)} · ${formatMoneda(resumen.ultimoPago.total)}`
              : "—"
          }
        />
      </div>
    </section>
  );
}
