import type { ReactNode } from "react";
import { requerirModulo } from "@/lib/auth-server";

export default async function PedidosLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requerirModulo("pedidos");
  return children;
}
