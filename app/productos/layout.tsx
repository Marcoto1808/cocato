import type { ReactNode } from "react";
import { requerirModulo } from "@/lib/auth-server";

export default async function ProductosLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requerirModulo("productos");
  return children;
}
