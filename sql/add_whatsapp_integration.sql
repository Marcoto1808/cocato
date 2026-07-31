-- Integración WhatsApp Cloud API + campo origen en pedidos
-- Ejecutar manualmente en Supabase

-- ---------------------------------------------------------------------------
-- pedidos.origen
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'whatsapp'));

UPDATE public.pedidos
SET origen = 'whatsapp'
WHERE origen = 'manual'
  AND mensaje_original IS NOT NULL
  AND mensaje_original NOT ILIKE 'Pedido manual%'
  AND mensaje_original NOT ILIKE 'Pedido rápido%'
  AND mensaje_original NOT ILIKE 'Pedido rapido%';

-- ---------------------------------------------------------------------------
-- Plantillas de mensaje (operativas, sin tokens)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  meta_template_name TEXT,
  cuerpo TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Configuración operativa (singleton lógico)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activo BOOLEAN NOT NULL DEFAULT false,
  hora_mensaje_automatico TIME,
  plantilla_mensaje_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_config (activo)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_config LIMIT 1);

-- ---------------------------------------------------------------------------
-- Conversaciones (enlace a clientes existentes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  wa_phone TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'pausada', 'cerrada')),
  ultimo_mensaje_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_cliente
  ON public.whatsapp_conversations (cliente_id);

-- ---------------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,
  direccion TEXT NOT NULL CHECK (direccion IN ('inbound', 'outbound')),
  tipo TEXT NOT NULL DEFAULT 'text',
  contenido TEXT,
  payload_raw JSONB,
  procesado BOOLEAN NOT NULL DEFAULT false,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  error_procesamiento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation
  ON public.whatsapp_messages (conversation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Clientes participantes en automatización
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_clientes_participantes (
  cliente_id UUID PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  recibe_mensaje_automatico BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plantilla por defecto para mensaje de número no registrado (referencia interna)
INSERT INTO public.whatsapp_templates (nombre, cuerpo, activo)
SELECT
  'Número no registrado',
  'Hola. Tu número no está registrado en nuestro sistema. Comunícate con la empresa para darte de alta y poder realizar pedidos por WhatsApp.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates WHERE nombre = 'Número no registrado'
);
