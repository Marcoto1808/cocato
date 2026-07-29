import type { ReactNode } from "react";
import { requerirModulo } from "@/lib/auth-server";

export default async function ClientesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requerirModulo("clientes");
  return children;
}
