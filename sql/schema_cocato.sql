BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TABLE IF EXISTS public.detalle_pedido CASCADE;
DROP TABLE IF EXISTS public.pedidos CASCADE;
DROP TABLE IF EXISTS public.balance_precios CASCADE;
DROP TABLE IF EXISTS public.balance_rendimiento CASCADE;
DROP TABLE IF EXISTS public.balances CASCADE;
DROP TABLE IF EXISTS public.lista_precio_items CASCADE;
DROP TABLE IF EXISTS public.listas_precio CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.productos CASCADE;
DROP TABLE IF EXISTS public.tipos_cliente CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

DROP FUNCTION IF EXISTS public.verificar_login(TEXT, TEXT);

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  correo TEXT,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Trabajador')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_usuario ON public.usuarios (usuario);
CREATE INDEX idx_usuarios_activo ON public.usuarios (activo);
CREATE INDEX idx_usuarios_rol ON public.usuarios (rol);

CREATE OR REPLACE FUNCTION public.verificar_login(
  p_usuario TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  usuario TEXT,
  correo TEXT,
  rol TEXT,
  activo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.nombre,
    u.usuario,
    u.correo,
    u.rol,
    u.activo
  FROM public.usuarios u
  WHERE lower(u.usuario) = lower(p_usuario)
    AND u.password_hash = extensions.crypt(p_password, u.password_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO authenticated;

CREATE TABLE public.tipos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tipos_cliente_codigo_formato_check
    CHECK (codigo ~ '^[a-z0-9_]+$')
);

CREATE INDEX idx_tipos_cliente_activo ON public.tipos_cliente (activo);
CREATE INDEX idx_tipos_cliente_orden ON public.tipos_cliente (orden);

CREATE TRIGGER tipos_cliente_set_updated_at
BEFORE UPDATE ON public.tipos_cliente
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'kg',
  precio_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tipo_calculo TEXT NOT NULL DEFAULT 'POR_KILO',
  codigo_balance TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT productos_nombre_unique UNIQUE (nombre, categoria),
  CONSTRAINT productos_categoria_check
    CHECK (categoria IN ('Res', 'Cerdo')),
  CONSTRAINT productos_subcategoria_check
    CHECK (subcategoria IN ('Corte', 'Embutido', 'Vísceras', 'Huesos', 'Grasa', 'Obrador')),
  CONSTRAINT productos_unidad_check
    CHECK (unidad IN ('kg', 'pieza', 'paquete', 'caja')),
  CONSTRAINT productos_precio_kg_check
    CHECK (precio_kg >= 0),
  CONSTRAINT productos_tipo_calculo_check
    CHECK (tipo_calculo IN ('POR_KILO', 'POR_PESO_REAL', 'PRECIO_FIJO')),
  CONSTRAINT productos_codigo_balance_unique UNIQUE (codigo_balance)
);

CREATE INDEX idx_productos_categoria ON public.productos (categoria);
CREATE INDEX idx_productos_subcategoria ON public.productos (subcategoria);
CREATE INDEX idx_productos_activo ON public.productos (activo);
CREATE INDEX idx_productos_orden ON public.productos (orden);
CREATE INDEX idx_productos_nombre ON public.productos (nombre);
CREATE INDEX idx_productos_codigo_balance ON public.productos (codigo_balance)
  WHERE codigo_balance IS NOT NULL;

CREATE TRIGGER productos_set_updated_at
BEFORE UPDATE ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT NOT NULL DEFAULT 'BORRADOR'
    CHECK (estado IN ('BORRADOR', 'PUBLICADO')),
  numero_puercos INTEGER,
  kilos_totales NUMERIC(12, 3),
  precio_compra_kg NUMERIC(10, 2),
  gastos_adicionales NUMERIC(12, 2) DEFAULT 0,
  costo_total NUMERIC(12, 2),
  capote_real_kg NUMERIC(12, 3),
  valor_capote NUMERIC(12, 2),
  valor_subproductos NUMERIC(12, 2),
  utilidad_total NUMERIC(12, 2),
  utilidad_por_puerco NUMERIC(12, 2),
  margen_pct NUMERIC(6, 2),
  precio_canal NUMERIC(10, 2),
  tipo_cliente_destino_id UUID REFERENCES public.tipos_cliente (id) ON DELETE SET NULL,
  lista_precio_id UUID,
  publicado_en TIMESTAMPTZ,
  publicado_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balances_numero_puercos_check
    CHECK (numero_puercos IS NULL OR numero_puercos >= 0),
  CONSTRAINT balances_publicado_coherente_check
    CHECK (
      (estado = 'BORRADOR' AND publicado_en IS NULL)
      OR (estado = 'PUBLICADO' AND publicado_en IS NOT NULL)
    )
);

CREATE INDEX idx_balances_fecha ON public.balances (fecha DESC);
CREATE INDEX idx_balances_estado ON public.balances (estado);
CREATE INDEX idx_balances_publicado_en ON public.balances (publicado_en DESC)
  WHERE publicado_en IS NOT NULL;

CREATE TRIGGER balances_set_updated_at
BEFORE UPDATE ON public.balances
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.listas_precio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cliente_id UUID NOT NULL REFERENCES public.tipos_cliente (id) ON DELETE RESTRICT,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'publicada', 'archivada')),
  es_vigente BOOLEAN NOT NULL DEFAULT false,
  origen TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('balance', 'manual')),
  balance_id UUID REFERENCES public.balances (id) ON DELETE SET NULL,
  publicada_en TIMESTAMPTZ,
  publicada_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT listas_precio_vigente_publicada_check
    CHECK (NOT es_vigente OR estado = 'publicada')
);

CREATE INDEX idx_listas_precio_tipo_cliente ON public.listas_precio (tipo_cliente_id);
CREATE INDEX idx_listas_precio_estado ON public.listas_precio (estado);
CREATE INDEX idx_listas_precio_es_vigente ON public.listas_precio (tipo_cliente_id, es_vigente)
  WHERE es_vigente = true;
CREATE INDEX idx_listas_precio_balance_id ON public.listas_precio (balance_id)
  WHERE balance_id IS NOT NULL;

CREATE UNIQUE INDEX idx_listas_precio_una_vigente_por_tipo
  ON public.listas_precio (tipo_cliente_id)
  WHERE es_vigente = true;

CREATE TRIGGER listas_precio_set_updated_at
BEFORE UPDATE ON public.listas_precio
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.balances
  ADD CONSTRAINT balances_lista_precio_id_fkey
  FOREIGN KEY (lista_precio_id) REFERENCES public.listas_precio (id) ON DELETE SET NULL;

CREATE TABLE public.lista_precio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_precio_id UUID NOT NULL REFERENCES public.listas_precio (id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos (id) ON DELETE RESTRICT,
  precio NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lista_precio_items_precio_check CHECK (precio >= 0),
  CONSTRAINT lista_precio_items_unique_producto UNIQUE (lista_precio_id, producto_id)
);

CREATE INDEX idx_lista_precio_items_lista ON public.lista_precio_items (lista_precio_id);
CREATE INDEX idx_lista_precio_items_producto ON public.lista_precio_items (producto_id);

CREATE TRIGGER lista_precio_items_set_updated_at
BEFORE UPDATE ON public.lista_precio_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.balance_rendimiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_id UUID NOT NULL REFERENCES public.balances (id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos (id) ON DELETE RESTRICT,
  kilos NUMERIC(12, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balance_rendimiento_kilos_check CHECK (kilos >= 0),
  CONSTRAINT balance_rendimiento_unique_producto UNIQUE (balance_id, producto_id)
);

CREATE INDEX idx_balance_rendimiento_balance ON public.balance_rendimiento (balance_id);

CREATE TABLE public.balance_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_id UUID NOT NULL REFERENCES public.balances (id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos (id) ON DELETE RESTRICT,
  precio_anterior NUMERIC(10, 2),
  precio_publicado NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balance_precios_precio_anterior_check
    CHECK (precio_anterior IS NULL OR precio_anterior >= 0),
  CONSTRAINT balance_precios_precio_publicado_check CHECK (precio_publicado >= 0),
  CONSTRAINT balance_precios_unique_producto UNIQUE (balance_id, producto_id)
);

CREATE INDEX idx_balance_precios_balance ON public.balance_precios (balance_id);

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_negocio TEXT NOT NULL,
  propietario TEXT,
  telefono TEXT,
  whatsapp TEXT,
  direccion TEXT,
  maps_url TEXT,
  observaciones TEXT,
  tipo_cliente_id UUID NOT NULL REFERENCES public.tipos_cliente (id) ON DELETE RESTRICT,
  lista_precio_id UUID REFERENCES public.listas_precio (id) ON DELETE SET NULL,
  dias_visita TEXT[] NOT NULL DEFAULT '{}',
  limite_credito NUMERIC(12, 2) NOT NULL DEFAULT 10000,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clientes_nombre_negocio ON public.clientes (nombre_negocio);
CREATE INDEX idx_clientes_tipo_cliente ON public.clientes (tipo_cliente_id);
CREATE INDEX idx_clientes_lista_precio ON public.clientes (lista_precio_id)
  WHERE lista_precio_id IS NOT NULL;
CREATE INDEX idx_clientes_activo ON public.clientes (activo);

CREATE TRIGGER clientes_set_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes (id) ON DELETE RESTRICT,
  tipo_cliente_id UUID NOT NULL REFERENCES public.tipos_cliente (id) ON DELETE RESTRICT,
  lista_precio_id UUID REFERENCES public.listas_precio (id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  mensaje_original TEXT NOT NULL,
  observaciones TEXT,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estado_pago TEXT,
  pagado_en TIMESTAMPTZ,
  capturado_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_total_check CHECK (total >= 0)
);

CREATE INDEX idx_pedidos_cliente ON public.pedidos (cliente_id);
CREATE INDEX idx_pedidos_estado ON public.pedidos (estado);
CREATE INDEX idx_pedidos_fecha ON public.pedidos (fecha DESC);
CREATE INDEX idx_pedidos_lista_precio ON public.pedidos (lista_precio_id);

CREATE TRIGGER pedidos_set_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.detalle_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos (id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos (id) ON DELETE RESTRICT,
  cantidad_solicitada NUMERIC(10, 3) NOT NULL DEFAULT 1,
  cantidad_texto TEXT,
  unidad TEXT NOT NULL DEFAULT 'kg',
  tipo_calculo TEXT NOT NULL DEFAULT 'POR_KILO',
  peso_real NUMERIC(10, 3),
  precio_lista NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_aplicado NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_modificado BOOLEAN NOT NULL DEFAULT false,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT detalle_pedido_unidad_check
    CHECK (unidad IN ('kg', 'pieza', 'paquete', 'caja')),
  CONSTRAINT detalle_pedido_tipo_calculo_check
    CHECK (tipo_calculo IN ('POR_KILO', 'POR_PESO_REAL', 'PRECIO_FIJO')),
  CONSTRAINT detalle_pedido_cantidad_check CHECK (cantidad_solicitada > 0),
  CONSTRAINT detalle_pedido_peso_real_check
    CHECK (peso_real IS NULL OR peso_real >= 0),
  CONSTRAINT detalle_pedido_precio_lista_check CHECK (precio_lista >= 0),
  CONSTRAINT detalle_pedido_precio_aplicado_check CHECK (precio_aplicado >= 0),
  CONSTRAINT detalle_pedido_subtotal_check CHECK (subtotal >= 0),
  CONSTRAINT detalle_pedido_unique_producto UNIQUE (pedido_id, producto_id)
);

CREATE INDEX idx_detalle_pedido_pedido_id ON public.detalle_pedido (pedido_id);
CREATE INDEX idx_detalle_pedido_producto_id ON public.detalle_pedido (producto_id);

CREATE TRIGGER detalle_pedido_set_updated_at
BEFORE UPDATE ON public.detalle_pedido
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_precio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_rendimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_pedido ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usuarios FROM anon;
REVOKE ALL ON TABLE public.usuarios FROM authenticated;

DROP POLICY IF EXISTS "tipos_cliente_select_anon" ON public.tipos_cliente;
DROP POLICY IF EXISTS "tipos_cliente_insert_anon" ON public.tipos_cliente;
DROP POLICY IF EXISTS "tipos_cliente_update_anon" ON public.tipos_cliente;
DROP POLICY IF EXISTS "tipos_cliente_delete_anon" ON public.tipos_cliente;

CREATE POLICY "tipos_cliente_select_anon" ON public.tipos_cliente FOR SELECT TO anon USING (true);
CREATE POLICY "tipos_cliente_insert_anon" ON public.tipos_cliente FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "tipos_cliente_update_anon" ON public.tipos_cliente FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "tipos_cliente_delete_anon" ON public.tipos_cliente FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "productos_select_anon" ON public.productos;
DROP POLICY IF EXISTS "productos_insert_anon" ON public.productos;
DROP POLICY IF EXISTS "productos_update_anon" ON public.productos;
DROP POLICY IF EXISTS "productos_delete_anon" ON public.productos;

CREATE POLICY "productos_select_anon" ON public.productos FOR SELECT TO anon USING (true);
CREATE POLICY "productos_insert_anon" ON public.productos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "productos_update_anon" ON public.productos FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "productos_delete_anon" ON public.productos FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "listas_precio_select_anon" ON public.listas_precio;
DROP POLICY IF EXISTS "listas_precio_insert_anon" ON public.listas_precio;
DROP POLICY IF EXISTS "listas_precio_update_anon" ON public.listas_precio;
DROP POLICY IF EXISTS "listas_precio_delete_anon" ON public.listas_precio;

CREATE POLICY "listas_precio_select_anon" ON public.listas_precio FOR SELECT TO anon USING (true);
CREATE POLICY "listas_precio_insert_anon" ON public.listas_precio FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "listas_precio_update_anon" ON public.listas_precio FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "listas_precio_delete_anon" ON public.listas_precio FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "lista_precio_items_select_anon" ON public.lista_precio_items;
DROP POLICY IF EXISTS "lista_precio_items_insert_anon" ON public.lista_precio_items;
DROP POLICY IF EXISTS "lista_precio_items_update_anon" ON public.lista_precio_items;
DROP POLICY IF EXISTS "lista_precio_items_delete_anon" ON public.lista_precio_items;

CREATE POLICY "lista_precio_items_select_anon" ON public.lista_precio_items FOR SELECT TO anon USING (true);
CREATE POLICY "lista_precio_items_insert_anon" ON public.lista_precio_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "lista_precio_items_update_anon" ON public.lista_precio_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "lista_precio_items_delete_anon" ON public.lista_precio_items FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "balances_select_anon" ON public.balances;
DROP POLICY IF EXISTS "balances_insert_anon" ON public.balances;
DROP POLICY IF EXISTS "balances_update_anon" ON public.balances;
DROP POLICY IF EXISTS "balances_delete_anon" ON public.balances;

CREATE POLICY "balances_select_anon" ON public.balances FOR SELECT TO anon USING (true);
CREATE POLICY "balances_insert_anon" ON public.balances FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "balances_update_anon" ON public.balances FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "balances_delete_anon" ON public.balances FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "balance_rendimiento_select_anon" ON public.balance_rendimiento;
DROP POLICY IF EXISTS "balance_rendimiento_insert_anon" ON public.balance_rendimiento;
DROP POLICY IF EXISTS "balance_rendimiento_update_anon" ON public.balance_rendimiento;
DROP POLICY IF EXISTS "balance_rendimiento_delete_anon" ON public.balance_rendimiento;

CREATE POLICY "balance_rendimiento_select_anon" ON public.balance_rendimiento FOR SELECT TO anon USING (true);
CREATE POLICY "balance_rendimiento_insert_anon" ON public.balance_rendimiento FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "balance_rendimiento_update_anon" ON public.balance_rendimiento FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "balance_rendimiento_delete_anon" ON public.balance_rendimiento FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "balance_precios_select_anon" ON public.balance_precios;
DROP POLICY IF EXISTS "balance_precios_insert_anon" ON public.balance_precios;
DROP POLICY IF EXISTS "balance_precios_update_anon" ON public.balance_precios;
DROP POLICY IF EXISTS "balance_precios_delete_anon" ON public.balance_precios;

CREATE POLICY "balance_precios_select_anon" ON public.balance_precios FOR SELECT TO anon USING (true);
CREATE POLICY "balance_precios_insert_anon" ON public.balance_precios FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "balance_precios_update_anon" ON public.balance_precios FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "balance_precios_delete_anon" ON public.balance_precios FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "clientes_select_anon" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_anon" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_anon" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_anon" ON public.clientes;

CREATE POLICY "clientes_select_anon" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "clientes_insert_anon" ON public.clientes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "clientes_update_anon" ON public.clientes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "clientes_delete_anon" ON public.clientes FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "pedidos_select_anon" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_insert_anon" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_update_anon" ON public.pedidos;
DROP POLICY IF EXISTS "pedidos_delete_anon" ON public.pedidos;

CREATE POLICY "pedidos_select_anon" ON public.pedidos FOR SELECT TO anon USING (true);
CREATE POLICY "pedidos_insert_anon" ON public.pedidos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pedidos_update_anon" ON public.pedidos FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "pedidos_delete_anon" ON public.pedidos FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "detalle_pedido_select_anon" ON public.detalle_pedido;
DROP POLICY IF EXISTS "detalle_pedido_insert_anon" ON public.detalle_pedido;
DROP POLICY IF EXISTS "detalle_pedido_update_anon" ON public.detalle_pedido;
DROP POLICY IF EXISTS "detalle_pedido_delete_anon" ON public.detalle_pedido;

CREATE POLICY "detalle_pedido_select_anon" ON public.detalle_pedido FOR SELECT TO anon USING (true);
CREATE POLICY "detalle_pedido_insert_anon" ON public.detalle_pedido FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "detalle_pedido_update_anon" ON public.detalle_pedido FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "detalle_pedido_delete_anon" ON public.detalle_pedido FOR DELETE TO anon USING (true);

INSERT INTO public.tipos_cliente (codigo, nombre, descripcion, orden)
VALUES
  ('carniceria', 'Carnicería', 'Clientes tipo carnicería', 10),
  ('fonda', 'Fonda', 'Clientes tipo fonda / comedor', 20),
  ('restaurante', 'Restaurante', 'Restaurantes y cocinas', 30),
  ('mayoreo', 'Mayoreo', 'Clientes de venta al mayoreo', 40),
  ('detalle', 'Detalle', 'Venta al detalle / mostrador', 50)
ON CONFLICT (codigo) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden,
  activo = true;

INSERT INTO public.usuarios (nombre, usuario, correo, password_hash, rol, activo)
VALUES
  (
    'Marco Torres',
    'marco',
    'marco@cocato.local',
    extensions.crypt('180898', extensions.gen_salt('bf')),
    'Administrador',
    true
  ),
  (
    'Arturo',
    'arturo',
    'arturo@cocato.local',
    extensions.crypt('12345', extensions.gen_salt('bf')),
    'Trabajador',
    true
  )
ON CONFLICT (usuario) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  correo = EXCLUDED.correo,
  password_hash = EXCLUDED.password_hash,
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;

COMMIT;
