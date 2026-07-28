-- Catálogo maestro de productos COCATO
-- Carnicería y obrador de res y cerdo

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS public.productos CASCADE;

CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT NOT NULL,
  unidad TEXT NOT NULL DEFAULT 'kg',
  precio_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tipo_calculo TEXT NOT NULL DEFAULT 'POR_KILO',
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
    CHECK (tipo_calculo IN ('POR_KILO', 'POR_PESO_REAL', 'PRECIO_FIJO'))
);

CREATE INDEX idx_productos_categoria ON public.productos (categoria);
CREATE INDEX idx_productos_subcategoria ON public.productos (subcategoria);
CREATE INDEX idx_productos_activo ON public.productos (activo);
CREATE INDEX idx_productos_orden ON public.productos (orden);
CREATE INDEX idx_productos_nombre ON public.productos (nombre);

CREATE TRIGGER productos_set_updated_at
BEFORE UPDATE ON public.productos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.productos IS 'Catálogo maestro de productos para carnicería y obrador COCATO';
COMMENT ON COLUMN public.productos.precio_kg IS 'Precio de referencia por kilogramo';
COMMENT ON COLUMN public.productos.orden IS 'Orden de visualización en catálogo';
