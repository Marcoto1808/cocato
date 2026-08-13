-- Pedido guiado: pregunta res/cerdo antes de la lista de productos.
-- Ejecutar en Supabase SQL Editor si el bot no responde al elegir "Pedido guiado".

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_estado_comercial_check;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_estado_comercial_check
  CHECK (estado_comercial IN (
    'NUEVA',
    'REGISTRO_CLIENTE',
    'MENU_PRINCIPAL',
    'PEDIDO_GUIADO_ESPECIE',
    'PEDIDO_GUIADO_CATEGORIA',
    'PEDIDO_GUIADO_PRODUCTO',
    'PEDIDO_GUIADO_CANTIDAD',
    'PEDIDO_EN_CONSTRUCCION',
    'ESPERANDO_CONFIRMACION',
    'RECUPERACION_PEDIDO',
    'ENTREGA_OPCION',
    'ENTREGA_DIRECCION',
    'CONFIRMADO',
    'CANCELADO'
  ));
