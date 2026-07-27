import Link from "next/link";

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <h1 className="text-3xl font-bold">Bienvenido a COCATO</h1>

      <p className="mt-2 text-zinc-600">
        Has iniciado sesión correctamente.
      </p>

      <div className="grid grid-cols-2 gap-6 mt-10">
        <Link href="/clientes">
          <div className="rounded-xl bg-white p-6 shadow hover:bg-zinc-50 cursor-pointer transition">
            <h2 className="text-xl font-bold">👥 Clientes</h2>
            <p className="mt-2 text-zinc-500">
              Administrar clientes
            </p>
          </div>
        </Link>

        <Link href="/productos">
          <div className="rounded-xl bg-white p-6 shadow hover:bg-zinc-50 cursor-pointer transition">
            <h2 className="text-xl font-bold">🥩 Productos</h2>
            <p className="mt-2 text-zinc-500">
              Administrar productos
            </p>
          </div>
        </Link>

        <Link href="/dashboard/pedidos">
          <div className="rounded-xl bg-white p-6 shadow hover:bg-zinc-50 cursor-pointer transition border-2 border-blue-500">
            <h2 className="text-xl font-bold">📦 Pedidos</h2>
            <p className="mt-2 text-zinc-500">
              Ver pedidos del día
            </p>
          </div>
        </Link>

        <Link href="/usuarios">
          <div className="rounded-xl bg-white p-6 shadow hover:bg-zinc-50 cursor-pointer transition">
            <h2 className="text-xl font-bold">👤 Usuarios</h2>
            <p className="mt-2 text-zinc-500">
              Administrar usuarios
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}