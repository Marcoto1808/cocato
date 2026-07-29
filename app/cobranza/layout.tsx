import type { ReactNode } from "react";
import { requerirModulo } from "@/lib/auth-server";

export default async function CobranzaLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requerirModulo("cobranza");
  return children;
}
