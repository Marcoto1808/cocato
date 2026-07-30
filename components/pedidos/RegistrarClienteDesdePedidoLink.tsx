import Link from "next/link";

type Props = {
  pedidoId: string;
};

export default function RegistrarClienteDesdePedidoLink({ pedidoId }: Props) {
  return (
    <Link
      href={`/clientes?desdePedido=${pedidoId}`}
      className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl border-2 border-emerald-300 bg-emerald-50 px-5 py-3 text-base font-bold text-emerald-800 transition hover:bg-emerald-100"
    >
      Registrar como cliente
    </Link>
  );
}
