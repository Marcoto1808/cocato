export default function Dashboard() {
    return (
      <main className="min-h-screen bg-zinc-100 p-8">
        <h1 className="text-3xl font-bold">Bienvenido a COCATO</h1>
  
        <p className="mt-2 text-zinc-600">
          Has iniciado sesión correctamente.
        </p>
  
        <div className="grid grid-cols-2 gap-6 mt-10">
  
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="font-bold text-xl">👥 Clientes</h2>
            <p className="text-zinc-500 mt-2">Administrar clientes</p>
          </div>
  
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="font-bold text-xl">🥩 Productos</h2>
            <p className="text-zinc-500 mt-2">Administrar productos</p>
          </div>
  
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="font-bold text-xl">🛒 Pedidos</h2>
            <p className="text-zinc-500 mt-2">Crear y consultar pedidos</p>
          </div>
  
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="font-bold text-xl">👤 Usuarios</h2>
            <p className="text-zinc-500 mt-2">Administrar usuarios</p>
          </div>
  
        </div>
      </main>
    );
  }