-- Sprint 1: Conversation Engine — estados comerciales y logs
-- Ejecutar manualmente en Supabase antes de desplegar la Edge Function.
--
-- Justificación:
-- 1. estado_comercial: la columna `estado` existente (activa/pausada/cerrada) es
--    operativa/técnica. Los estados NUEVA y MENU_PRINCIPAL son de flujo comercial
--    y requieren un campo dedicado (ver DICATO_WHATSAPP_SPEC.md §2).
-- 2. whatsapp_conversation_logs: persistir mensaje recibido, transición de estado
--    y respuesta enviada para pruebas y auditoría del Sprint 1.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS estado_comercial TEXT NOT NULL DEFAULT 'NUEVA'
    CHECK (estado_comercial IN ('NUEVA', 'MENU_PRINCIPAL'));

COMMENT ON COLUMN public.whatsapp_conversations.estado_comercial IS
  'Estado del flujo comercial WhatsApp (Conversation Engine). Distinto de estado (activa/pausada/cerrada).';

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  inbound_message_id UUID
    REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  mensaje_recibido TEXT NOT NULL,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  respuesta_enviada TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_logs_conversation
  ON public.whatsapp_conversation_logs (conversation_id, created_at DESC);
