import {
  formatPrecioDelDia,
  type PrecioDiaFila,
} from "@/lib/precios-dia-dashboard";

type Props = {
  precios: PrecioDiaFila[];
  className?: string;
};

export default function PreciosDelDiaPanel({ precios, className = "" }: Props) {
  return (
    <aside
      className={`rounded-2xl bg-white p-5 shadow-md ring-1 ring-zinc-200 sm:p-6 ${className}`}
      aria-label="Precios del día"
    >
      <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
        <span className="text-3xl leading-none" aria-hidden>
          🥩
        </span>
        <h2 className="text-lg font-bold uppercase tracking-wide text-zinc-900 sm:text-xl">
          Precios del día
        </h2>
      </div>

      <ul className="mt-4 space-y-3">
        {precios.map((fila) => (
          <li
            key={fila.id}
            className="flex items-baseline justify-between gap-4 border-b border-zinc-50 pb-3 last:border-b-0 last:pb-0"
          >
            <span className="text-base font-medium text-zinc-700 sm:text-lg">
              {fila.etiqueta}
            </span>
            <span className="shrink-0 text-right text-lg font-bold tabular-nums text-zinc-900 sm:text-xl">
              {formatPrecioDelDia(fila.precio)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
