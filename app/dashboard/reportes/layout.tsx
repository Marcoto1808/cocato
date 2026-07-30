import type { ReactNode } from "react";
import { requerirModulo } from "@/lib/auth-server";

export default async function ReportesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requerirModulo("reportes");
  return children;
}
