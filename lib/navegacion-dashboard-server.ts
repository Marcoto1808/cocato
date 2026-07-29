import { cookies } from "next/headers";
import {
  COOKIE_ROL,
  rutaDashboardDesdeCookie,
} from "@/lib/navegacion-dashboard";

export async function obtenerRutaDashboardServidor() {
  const cookieStore = await cookies();
  return rutaDashboardDesdeCookie(cookieStore.get(COOKIE_ROL)?.value);
}
