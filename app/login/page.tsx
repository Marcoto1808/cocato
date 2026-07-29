"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizarRol } from "@/lib/roles";
import {
  guardarSesionEnCookies,
  rutaDashboardPorRol,
} from "@/lib/navegacion-dashboard";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .eq("usuario", email)
      .eq("password", password)
      .single();

    if (data) {
      const rol = normalizarRol(String(data.rol ?? "")) ?? "colaborador";
      guardarSesionEnCookies(String(data.usuario), rol);
      router.push(rutaDashboardPorRol(rol));
    } else {
      alert("Usuario o contraseña incorrectos");
    }
  };

  return (
<div className="flex min-h-screen items-center justify-center bg-gray-100">
  <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">

    <h1 className="text-3xl font-bold text-center">
      COCATO
    </h1>

    <p className="mt-2 text-center text-gray-500">
      Sistema Integral de Distribución de Carne
    </p>

    <form onSubmit={handleSubmit} className="mt-8 space-y-4">

      <input
        type="text"
        placeholder="Usuario"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border p-3"
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border p-3"
      />

      <button
        type="submit"
        className="w-full rounded-lg bg-black p-3 text-white"
      >
        Entrar
      </button>

    </form>

  </div>
</div>

    
  );
}