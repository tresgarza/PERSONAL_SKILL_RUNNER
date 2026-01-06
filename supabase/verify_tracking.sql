-- Script de Verificación Rápida del Sistema de Tracking
-- Ejecuta este script en Supabase SQL Editor para verificar que todo funciona

-- ============================================
-- 1. Verificar que las tablas existen
-- ============================================
SELECT 
  'Tablas' as categoria,
  COUNT(*) as cantidad
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sr_page_events',
    'sr_user_sessions',
    'sr_api_costs',
    'sr_performance_metrics',
    'sr_errors'
  );

-- ============================================
-- 2. Verificar que las funciones existen
-- ============================================
SELECT 
  'Funciones' as categoria,
  COUNT(*) as cantidad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_api_cost',
    'get_user_journey',
    'get_skill_analytics',
    'get_cost_summary',
    'refresh_all_tracking_views'
  );

-- ============================================
-- 3. Verificar que las vistas materializadas existen
-- ============================================
SELECT 
  'Vistas Materializadas' as categoria,
  COUNT(*) as cantidad
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname IN (
    'v_daily_metrics',
    'v_user_activity_summary',
    'v_skill_usage_stats',
    'v_api_costs_by_model',
    'v_error_summary'
  );

-- ============================================
-- 4. Verificar RLS está habilitado
-- ============================================
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'sr_page_events',
    'sr_user_sessions',
    'sr_api_costs',
    'sr_performance_metrics',
    'sr_errors'
  )
ORDER BY tablename;

-- ============================================
-- 5. Verificar políticas RLS
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'sr_page_events',
    'sr_user_sessions',
    'sr_api_costs',
    'sr_performance_metrics',
    'sr_errors'
  )
ORDER BY tablename, policyname;

-- ============================================
-- 6. Verificar triggers
-- ============================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'sr_page_events',
    'sr_user_sessions'
  )
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 7. Verificar índices
-- ============================================
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'sr_page_events',
    'sr_user_sessions',
    'sr_api_costs',
    'sr_performance_metrics',
    'sr_errors'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 8. Resumen de datos recientes (última hora)
-- ============================================
SELECT 
  'Eventos (última hora)' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT session_id) as sesiones_unicas,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  MAX(created_at) as ultimo_evento
FROM sr_page_events
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Sesiones (última hora)' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT session_id) as sesiones_unicas,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  MAX(started_at) as ultimo_evento
FROM sr_user_sessions
WHERE started_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Skills Usados (última hora)' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT skill_id) as skills_unicos,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  MAX(created_at) as ultimo_evento
FROM sr_skill_usage
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Costos API (última hora)' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT provider) as proveedores,
  COUNT(DISTINCT model) as modelos,
  MAX(created_at) as ultimo_evento
FROM sr_api_costs
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Métricas Performance (última hora)' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT metric_name) as metricas_unicas,
  COUNT(DISTINCT session_id) as sesiones_unicas,
  MAX(created_at) as ultimo_evento
FROM sr_performance_metrics
WHERE created_at > NOW() - INTERVAL '1 hour'

UNION ALL

SELECT 
  'Errores (última hora)' as tipo,
  COUNT(*) as total,
  COUNT(DISTINCT error_type) as tipos_unicos,
  COUNT(*) FILTER (WHERE resolved = FALSE) as sin_resolver,
  MAX(created_at) as ultimo_evento
FROM sr_errors
WHERE created_at > NOW() - INTERVAL '1 hour';

-- ============================================
-- 9. Probar función calculate_api_cost
-- ============================================
SELECT 
  'Prueba calculate_api_cost' as test,
  calculate_api_cost('anthropic', 'claude-sonnet-4-20250514', 1000, 500) as costo_calculado,
  CASE 
    WHEN calculate_api_cost('anthropic', 'claude-sonnet-4-20250514', 1000, 500) > 0 
    THEN '✅ Función funciona'
    ELSE '❌ Función no funciona'
  END as resultado;

-- ============================================
-- 10. Verificar campos agregados a tablas existentes
-- ============================================
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'sr_skill_usage' AND column_name IN ('session_id', 'cost_usd', 'api_provider', 'model_used'))
    OR
    (table_name = 'sr_users' AND column_name IN ('total_sessions', 'last_active_at', 'total_api_cost'))
  )
ORDER BY table_name, column_name;
