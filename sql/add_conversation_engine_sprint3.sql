-- Sprint 3: registro de clientes, entrega y estados ampliados
-- Ejecutar manualmente en Supabase.

UPDATE public.whatsapp_conversations
SET estado_comercial = 'REGISTRO_CLIENTE'
WHERE estado_comercial = 'REGISTRO_NEGOCIO';

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_estado_comercial_check;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_estado_comercial_check
  CHECK (estado_comercial IN (
    'NUEVA',
    'REGISTRO_CLIENTE',
    'MENU_PRINCIPAL',
    'PEDIDO_GUIADO_CATEGORIA',
    'PEDIDO_GUIADO_PRODUCTO',
    'PEDIDO_GUIADO_CANTIDAD',
    'PEDIDO_EN_CONSTRUCCION',
    'ESPERANDO_CONFIRMACION',
    'ENTREGA_OPCION',
    'ENTREGA_DIRECCION',
    'CONFIRMADO',
    'CANCELADO'
  ));

COMMENT ON COLUMN public.clientes.observaciones IS
  'Notas comerciales; WhatsApp usa "Pendiente de validación comercial" para altas nuevas.';
