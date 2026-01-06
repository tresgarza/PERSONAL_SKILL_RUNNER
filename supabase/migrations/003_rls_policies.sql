-- Migration: Row Level Security Policies
-- Description: Configures RLS policies for all tracking tables

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE sr_page_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sr_errors ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Policies for sr_page_events
-- ============================================

-- Users can insert their own events
CREATE POLICY "Users can insert their own page events"
  ON sr_page_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own events
CREATE POLICY "Users can view their own page events"
  ON sr_page_events
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all events
CREATE POLICY "Admins can view all page events"
  ON sr_page_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- Policies for sr_user_sessions
-- ============================================

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions"
  ON sr_user_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON sr_user_sessions
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
  ON sr_user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
  ON sr_user_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- Policies for sr_api_costs
-- ============================================

-- Users can view costs for their own skill usage
CREATE POLICY "Users can view their own API costs"
  ON sr_api_costs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sr_skill_usage su
      WHERE su.id = sr_api_costs.usage_id
      AND su.user_id = auth.uid()
    )
    OR usage_id IS NULL
  );

-- System can insert costs (via service role)
-- Note: This will be handled via service role key, not RLS
CREATE POLICY "Service role can insert API costs"
  ON sr_api_costs
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all costs
CREATE POLICY "Admins can view all API costs"
  ON sr_api_costs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- Policies for sr_performance_metrics
-- ============================================

-- Users can insert their own metrics
CREATE POLICY "Users can insert their own performance metrics"
  ON sr_performance_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own metrics
CREATE POLICY "Users can view their own performance metrics"
  ON sr_performance_metrics
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all metrics
CREATE POLICY "Admins can view all performance metrics"
  ON sr_performance_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- Policies for sr_errors
-- ============================================

-- Users can insert their own errors
CREATE POLICY "Users can insert their own errors"
  ON sr_errors
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own errors
CREATE POLICY "Users can view their own errors"
  ON sr_errors
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all errors
CREATE POLICY "Admins can view all errors"
  ON sr_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update errors (mark as resolved)
CREATE POLICY "Admins can update errors"
  ON sr_errors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sr_users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );
