-- Migration: Tracking Functions and Views
-- Description: Creates SQL functions and materialized views for analytics

-- ============================================
-- Functions
-- ============================================

-- Function: calculate_api_cost
-- Calcula el costo de API basado en el proveedor y modelo
CREATE OR REPLACE FUNCTION calculate_api_cost(
  p_provider TEXT,
  p_model TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
)
RETURNS DECIMAL(10, 6) AS $$
DECLARE
  v_cost DECIMAL(10, 6) := 0;
  v_input_price_per_1k DECIMAL(10, 6);
  v_output_price_per_1k DECIMAL(10, 6);
BEGIN
  -- Precios de Anthropic (actualizados a enero 2025)
  IF p_provider = 'anthropic' THEN
    CASE p_model
      WHEN 'claude-3-5-sonnet-20241022' THEN
        v_input_price_per_1k := 0.003;
        v_output_price_per_1k := 0.015;
      WHEN 'claude-3-opus-20240229' THEN
        v_input_price_per_1k := 0.015;
        v_output_price_per_1k := 0.075;
      WHEN 'claude-3-sonnet-20240229' THEN
        v_input_price_per_1k := 0.003;
        v_output_price_per_1k := 0.015;
      WHEN 'claude-3-haiku-20240307' THEN
        v_input_price_per_1k := 0.00025;
        v_output_price_per_1k := 0.00125;
      ELSE
        -- Default para modelos desconocidos
        v_input_price_per_1k := 0.003;
        v_output_price_per_1k := 0.015;
    END CASE;
  ELSIF p_provider = 'openai' THEN
    CASE p_model
      WHEN 'gpt-4-turbo-preview' THEN
        v_input_price_per_1k := 0.01;
        v_output_price_per_1k := 0.03;
      WHEN 'gpt-4' THEN
        v_input_price_per_1k := 0.03;
        v_output_price_per_1k := 0.06;
      WHEN 'gpt-3.5-turbo' THEN
        v_input_price_per_1k := 0.0005;
        v_output_price_per_1k := 0.0015;
      ELSE
        v_input_price_per_1k := 0.01;
        v_output_price_per_1k := 0.03;
    END CASE;
  ELSE
    -- Para otros proveedores, retornar 0 o un valor por defecto
    RETURN 0;
  END IF;
  
  -- Calcular costo total
  v_cost := (p_input_tokens::DECIMAL / 1000.0 * v_input_price_per_1k) + 
            (p_output_tokens::DECIMAL / 1000.0 * v_output_price_per_1k);
  
  RETURN ROUND(v_cost, 6);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: get_user_journey
-- Retorna la secuencia completa de eventos del usuario
CREATE OR REPLACE FUNCTION get_user_journey(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  timestamp TIMESTAMPTZ,
  event_type TEXT,
  event_name TEXT,
  page_path TEXT,
  session_id TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.timestamp,
    pe.event_type,
    pe.event_name,
    pe.page_path,
    pe.session_id,
    pe.metadata
  FROM sr_page_events pe
  WHERE pe.user_id = p_user_id
    AND (p_start_date IS NULL OR pe.timestamp >= p_start_date)
    AND (p_end_date IS NULL OR pe.timestamp <= p_end_date)
  ORDER BY pe.timestamp ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: get_skill_analytics
-- Métricas agregadas por skill
CREATE OR REPLACE FUNCTION get_skill_analytics(
  p_skill_id TEXT DEFAULT NULL,
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  skill_id TEXT,
  total_uses BIGINT,
  successful_uses BIGINT,
  failed_uses BIGINT,
  avg_execution_time DECIMAL,
  total_cost DECIMAL,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.skill_id,
    COUNT(*)::BIGINT as total_uses,
    COUNT(*) FILTER (WHERE su.status = 'completed')::BIGINT as successful_uses,
    COUNT(*) FILTER (WHERE su.status = 'failed')::BIGINT as failed_uses,
    AVG(su.execution_time_ms)::DECIMAL as avg_execution_time,
    COALESCE(SUM(ac.cost_usd), 0)::DECIMAL as total_cost,
    COUNT(DISTINCT su.user_id)::BIGINT as unique_users
  FROM sr_skill_usage su
  LEFT JOIN sr_api_costs ac ON ac.usage_id = su.id
  WHERE (p_skill_id IS NULL OR su.skill_id = p_skill_id)
    AND su.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
  GROUP BY su.skill_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: get_cost_summary
-- Resumen de costos agrupado
CREATE OR REPLACE FUNCTION get_cost_summary(
  p_period_days INTEGER DEFAULT 30,
  p_group_by TEXT DEFAULT 'day' -- 'day', 'week', 'month', 'provider', 'model'
)
RETURNS TABLE (
  period_start TIMESTAMPTZ,
  provider TEXT,
  model TEXT,
  total_tokens BIGINT,
  total_cost DECIMAL,
  usage_count BIGINT
) AS $$
BEGIN
  IF p_group_by = 'day' THEN
    RETURN QUERY
    SELECT 
      DATE_TRUNC('day', ac.created_at) as period_start,
      ac.provider,
      ac.model,
      SUM(ac.total_tokens)::BIGINT as total_tokens,
      SUM(ac.cost_usd)::DECIMAL as total_cost,
      COUNT(*)::BIGINT as usage_count
    FROM sr_api_costs ac
    WHERE ac.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('day', ac.created_at), ac.provider, ac.model
    ORDER BY period_start DESC, total_cost DESC;
    
  ELSIF p_group_by = 'week' THEN
    RETURN QUERY
    SELECT 
      DATE_TRUNC('week', ac.created_at) as period_start,
      ac.provider,
      ac.model,
      SUM(ac.total_tokens)::BIGINT as total_tokens,
      SUM(ac.cost_usd)::DECIMAL as total_cost,
      COUNT(*)::BIGINT as usage_count
    FROM sr_api_costs ac
    WHERE ac.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('week', ac.created_at), ac.provider, ac.model
    ORDER BY period_start DESC, total_cost DESC;
    
  ELSIF p_group_by = 'month' THEN
    RETURN QUERY
    SELECT 
      DATE_TRUNC('month', ac.created_at) as period_start,
      ac.provider,
      ac.model,
      SUM(ac.total_tokens)::BIGINT as total_tokens,
      SUM(ac.cost_usd)::DECIMAL as total_cost,
      COUNT(*)::BIGINT as usage_count
    FROM sr_api_costs ac
    WHERE ac.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('month', ac.created_at), ac.provider, ac.model
    ORDER BY period_start DESC, total_cost DESC;
    
  ELSIF p_group_by = 'provider' THEN
    RETURN QUERY
    SELECT 
      NOW() as period_start,
      ac.provider,
      ''::TEXT as model,
      SUM(ac.total_tokens)::BIGINT as total_tokens,
      SUM(ac.cost_usd)::DECIMAL as total_cost,
      COUNT(*)::BIGINT as usage_count
    FROM sr_api_costs ac
    WHERE ac.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY ac.provider
    ORDER BY total_cost DESC;
    
  ELSIF p_group_by = 'model' THEN
    RETURN QUERY
    SELECT 
      NOW() as period_start,
      ac.provider,
      ac.model,
      SUM(ac.total_tokens)::BIGINT as total_tokens,
      SUM(ac.cost_usd)::DECIMAL as total_cost,
      COUNT(*)::BIGINT as usage_count
    FROM sr_api_costs ac
    WHERE ac.created_at >= NOW() - (p_period_days || ' days')::INTERVAL
    GROUP BY ac.provider, ac.model
    ORDER BY total_cost DESC;
    
  ELSE
    RAISE EXCEPTION 'Invalid group_by parameter. Use: day, week, month, provider, or model';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Materialized Views
-- ============================================

-- View: v_daily_metrics - Métricas diarias agregadas
CREATE MATERIALIZED VIEW IF NOT EXISTS v_daily_metrics AS
SELECT 
  DATE_TRUNC('day', pe.timestamp) as date,
  COUNT(DISTINCT pe.user_id) as unique_users,
  COUNT(DISTINCT pe.session_id) as unique_sessions,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE pe.event_type = 'click') as click_events,
  COUNT(*) FILTER (WHERE pe.event_type = 'navigation') as navigation_events,
  COUNT(*) FILTER (WHERE pe.event_type = 'view') as view_events,
  COUNT(DISTINCT pe.page_path) as unique_pages
FROM sr_page_events pe
GROUP BY DATE_TRUNC('day', pe.timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_daily_metrics_date ON v_daily_metrics(date);

-- View: v_user_activity_summary - Resumen de actividad por usuario
CREATE MATERIALIZED VIEW IF NOT EXISTS v_user_activity_summary AS
SELECT 
  u.id as user_id,
  u.email,
  u.full_name,
  COUNT(DISTINCT us.id) as total_sessions,
  COUNT(DISTINCT pe.id) as total_events,
  COUNT(DISTINCT DATE(pe.timestamp)) as active_days,
  MAX(pe.timestamp) as last_activity,
  SUM(ac.cost_usd) as total_api_cost,
  COUNT(DISTINCT su.skill_id) as skills_used
FROM sr_users u
LEFT JOIN sr_user_sessions us ON us.user_id = u.id
LEFT JOIN sr_page_events pe ON pe.user_id = u.id
LEFT JOIN sr_skill_usage su ON su.user_id = u.id
LEFT JOIN sr_api_costs ac ON ac.usage_id = su.id
GROUP BY u.id, u.email, u.full_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_user_activity_summary_user_id ON v_user_activity_summary(user_id);

-- View: v_skill_usage_stats - Estadísticas de uso de skills
CREATE MATERIALIZED VIEW IF NOT EXISTS v_skill_usage_stats AS
SELECT 
  s.id as skill_id,
  s.name as skill_name,
  s.category,
  COUNT(su.id) as total_uses,
  COUNT(DISTINCT su.user_id) as unique_users,
  COUNT(*) FILTER (WHERE su.status = 'completed') as successful_uses,
  COUNT(*) FILTER (WHERE su.status = 'failed') as failed_uses,
  AVG(su.execution_time_ms) as avg_execution_time_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY su.execution_time_ms) as median_execution_time_ms,
  SUM(ac.cost_usd) as total_cost,
  MAX(su.created_at) as last_used
FROM sr_skills s
LEFT JOIN sr_skill_usage su ON su.skill_id = s.id
LEFT JOIN sr_api_costs ac ON ac.usage_id = su.id
GROUP BY s.id, s.name, s.category;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_skill_usage_stats_skill_id ON v_skill_usage_stats(skill_id);

-- View: v_api_costs_by_model - Costos agrupados por modelo
CREATE MATERIALIZED VIEW IF NOT EXISTS v_api_costs_by_model AS
SELECT 
  ac.provider,
  ac.model,
  COUNT(*) as usage_count,
  SUM(ac.input_tokens) as total_input_tokens,
  SUM(ac.output_tokens) as total_output_tokens,
  SUM(ac.total_tokens) as total_tokens,
  SUM(ac.cost_usd) as total_cost,
  AVG(ac.cost_usd) as avg_cost_per_use,
  MIN(ac.created_at) as first_used,
  MAX(ac.created_at) as last_used
FROM sr_api_costs ac
GROUP BY ac.provider, ac.model;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_api_costs_by_model_provider_model ON v_api_costs_by_model(provider, model);

-- View: v_error_summary - Resumen de errores
CREATE MATERIALIZED VIEW IF NOT EXISTS v_error_summary AS
SELECT 
  DATE_TRUNC('day', e.created_at) as date,
  e.error_type,
  COUNT(*) as error_count,
  COUNT(DISTINCT e.user_id) as affected_users,
  COUNT(*) FILTER (WHERE e.resolved = FALSE) as unresolved_count,
  COUNT(DISTINCT e.page_path) as affected_pages
FROM sr_errors e
GROUP BY DATE_TRUNC('day', e.created_at), e.error_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_error_summary_date_type ON v_error_summary(date, error_type);

-- ============================================
-- Refresh Functions
-- ============================================

-- Function para refrescar todas las vistas materializadas
CREATE OR REPLACE FUNCTION refresh_all_tracking_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_daily_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_user_activity_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_skill_usage_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_api_costs_by_model;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_error_summary;
END;
$$ LANGUAGE plpgsql;
