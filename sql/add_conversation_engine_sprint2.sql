-- Sprint 2: Conversation Engine — pedido guiado, carrito y confirmación
-- Ejecutar manualmente en Supabase antes de desplegar.

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_estado_comercial_check;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_estado_comercial_check
  CHECK (estado_comercial IN (
    'NUEVA',
    'MENU_PRINCIPAL',
    'PEDIDO_GUIADO_CATEGORIA',
    'PEDIDO_GUIADO_PRODUCTO',
    'PEDIDO_GUIADO_CANTIDAD',
    'PEDIDO_EN_CONSTRUCCION',
    'ESPERANDO_CONFIRMACION',
    'CONFIRMADO',
    'CANCELADO'
  ));

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS carrito_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_conversations.carrito_json IS
  'Carrito acumulado y contexto del pedido guiado (Conversation Engine Sprint 2).';
