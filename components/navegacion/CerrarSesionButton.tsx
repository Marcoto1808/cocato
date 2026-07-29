"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  className?: string;
};

export default function CerrarSesionButton({
  className = "rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50",
}: Props) {
  const router = useRouter();
  const [cerrando, setCerrando] = useState(false);

  async function handleCerrarSesion() {
    if (cerrando) return;

    setCerrando(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setCerrando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCerrarSesion}
      disabled={cerrando}
      className={className}
    >
      {cerrando ? "Cerrando..." : "Cerrar sesión"}
    </button>
  );
}
