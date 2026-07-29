import BalanceModulo from "@/components/balance/BalanceModulo";
import { requerirModulo } from "@/lib/auth-server";

export const metadata = {
  title: "Balance | COCATO",
  description: "Cálculo de precios de venta diarios",
};

export default async function BalancePage() {
  await requerirModulo("balance");

  return <BalanceModulo />;
}
