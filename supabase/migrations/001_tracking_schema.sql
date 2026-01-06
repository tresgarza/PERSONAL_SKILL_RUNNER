-- Migration: Tracking and Analytics Schema
-- Description: Creates tables and indexes for comprehensive user tracking and analytics

-- ============================================
-- 1. sr_page_events - Eventos granulares de la página
-- ============================================
CREATE TABLE IF NOT EXISTS sr_page_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'navigation', 'form_submit', 'download', 'view', 'scroll', 'hover', 'focus', 'blur', 'custom')),
  event_name TEXT NOT NULL,
  page_path TEXT NOT NULL,
  element_id TEXT,
  element_type TEXT,
  element_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sr_page_events
CREATE INDEX IF NOT EXISTS idx_page_events_user_id ON sr_page_events(user_id);
CREATE INDEX IF NOT EXISTS idx_page_events_session_id ON sr_page_events(session_id);
CREATE INDEX IF NOT EXISTS idx_page_events_event_type ON sr_page_events(event_type);
CREATE INDEX IF NOT EXISTS idx_page_events_timestamp ON sr_page_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_page_path ON sr_page_events(page_path);
CREATE INDEX IF NOT EXISTS idx_page_events_user_session ON sr_page_events(user_id, session_id);

-- ============================================
-- 2. sr_user_sessions - Sesiones de usuario
-- ============================================
CREATE TABLE IF NOT EXISTS sr_user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT UNIQUE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  page_views INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  referrer TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  browser TEXT,
  os TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sr_user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON sr_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON sr_user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON sr_user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_started ON sr_user_sessions(user_id, started_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_sr_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sr_user_sessions_updated_at
  BEFORE UPDATE ON sr_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sr_user_sessions_updated_at();

-- ============================================
-- 3. sr_api_costs - Costos de API por interacción
-- ============================================
CREATE TABLE IF NOT EXISTS sr_api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id UUID REFERENCES sr_skill_usage(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google', 'other')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  pricing_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sr_api_costs
CREATE INDEX IF NOT EXISTS idx_api_costs_usage_id ON sr_api_costs(usage_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_provider ON sr_api_costs(provider);
CREATE INDEX IF NOT EXISTS idx_api_costs_model ON sr_api_costs(model);
CREATE INDEX IF NOT EXISTS idx_api_costs_created_at ON sr_api_costs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_provider_model ON sr_api_costs(provider, model);

-- ============================================
-- 4. sr_performance_metrics - Métricas de rendimiento
-- ============================================
CREATE TABLE IF NOT EXISTS sr_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  page_path TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('page_load', 'api_response', 'skill_execution', 'custom')),
  metric_name TEXT NOT NULL,
  value DECIMAL(12, 4) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ms',
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sr_performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_user_id ON sr_performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_session_id ON sr_performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metric_type ON sr_performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metric_name ON sr_performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON sr_performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_performance_page_path ON sr_performance_metrics(page_path);

-- ============================================
-- 5. sr_errors - Errores y excepciones
-- ============================================
CREATE TABLE IF NOT EXISTS sr_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  error_type TEXT NOT NULL CHECK (error_type IN ('javascript', 'api', 'skill_execution', 'network', 'validation', 'other')),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  page_path TEXT NOT NULL,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para sr_errors
CREATE INDEX IF NOT EXISTS idx_errors_user_id ON sr_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_errors_session_id ON sr_errors(session_id);
CREATE INDEX IF NOT EXISTS idx_errors_error_type ON sr_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_errors_resolved ON sr_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_errors_created_at ON sr_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_errors_unresolved ON sr_errors(resolved, created_at DESC) WHERE resolved = FALSE;

-- ============================================
-- Modificar tablas existentes
-- ============================================

-- Agregar campos a sr_skill_usage
ALTER TABLE sr_skill_usage
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_provider TEXT,
  ADD COLUMN IF NOT EXISTS model_used TEXT;

-- Índices adicionales para sr_skill_usage
CREATE INDEX IF NOT EXISTS idx_skill_usage_session_id ON sr_skill_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_cost ON sr_skill_usage(cost_usd DESC);

-- Agregar campos a sr_users
ALTER TABLE sr_users
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_api_cost DECIMAL(10, 2) DEFAULT 0;

-- ============================================
-- Funciones auxiliares
-- ============================================

-- Función para actualizar contadores de sesión
CREATE OR REPLACE FUNCTION update_session_counters()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sr_user_sessions
  SET 
    events_count = events_count + 1,
    updated_at = NOW()
  WHERE session_id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_counters
  AFTER INSERT ON sr_page_events
  FOR EACH ROW
  EXECUTE FUNCTION update_session_counters();

-- Función para actualizar last_active_at del usuario
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE sr_users
    SET last_active_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_last_active_events
  AFTER INSERT ON sr_page_events
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active();

CREATE TRIGGER trigger_update_user_last_active_sessions
  AFTER INSERT OR UPDATE ON sr_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_last_active();

-- Función para calcular duración de sesión al cerrarla
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_session_duration
  BEFORE UPDATE ON sr_user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_session_duration();
