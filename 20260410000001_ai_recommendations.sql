-- Migration: Advanced AI Recommendation System
-- Date: April 10, 2026
-- Purpose: Track user behavior and recommendation performance

-- Table 1: User Behavior Tracking (Like Facebook/YouTube)
CREATE TABLE IF NOT EXISTS user_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_items TEXT[] DEFAULT '{}',
  ordered_items TEXT[] DEFAULT '{}',
  cart_items TEXT[] DEFAULT '{}',
  time_of_day TEXT CHECK (time_of_day IN ('breakfast', 'lunch', 'dinner', 'snack')),
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_behavior_restaurant ON user_behavior(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_session ON user_behavior(session_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_user ON user_behavior(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_timestamp ON user_behavior(timestamp);

-- Table 2: Recommendation Analytics (A/B Testing)
CREATE TABLE IF NOT EXISTS recommendation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  recommended_items TEXT[] DEFAULT '{}',
  clicked_item TEXT,
  ordered_item TEXT,
  strategy TEXT, -- 'balanced', 'popular', 'personalized', 'similar'
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_restaurant ON recommendation_analytics(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_session ON recommendation_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_analytics_timestamp ON recommendation_analytics(timestamp);

-- Table 3: Menu Item Performance Metrics
CREATE TABLE IF NOT EXISTS menu_item_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  cart_add_count INTEGER DEFAULT 0,
  revenue_generated NUMERIC DEFAULT 0,
  avg_rating NUMERIC DEFAULT 0,
  last_ordered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, menu_item_id)
);

-- Index for metrics
CREATE INDEX IF NOT EXISTS idx_menu_item_metrics_restaurant ON menu_item_metrics(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_metrics_item ON menu_item_metrics(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_metrics_order_count ON menu_item_metrics(order_count DESC);

-- Function: Update menu item metrics automatically
CREATE OR REPLACE FUNCTION update_menu_item_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update metrics when new order_item is created
  INSERT INTO menu_item_metrics (
    restaurant_id,
    menu_item_id,
    order_count,
    revenue_generated,
    last_ordered_at
  )
  SELECT 
    o.restaurant_id,
    NEW.menu_item_id,
    1,
    NEW.price * NEW.quantity,
    NEW.created_at
  FROM orders o
  WHERE o.id = NEW.order_id
  ON CONFLICT (restaurant_id, menu_item_id)
  DO UPDATE SET
    order_count = menu_item_metrics.order_count + 1,
    revenue_generated = menu_item_metrics.revenue_generated + (NEW.price * NEW.quantity),
    last_ordered_at = NEW.created_at,
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update metrics when order is placed
DROP TRIGGER IF EXISTS trigger_update_menu_metrics ON order_items;
CREATE TRIGGER trigger_update_menu_metrics
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_item_metrics();

-- Function: Get trending items (last 24 hours)
CREATE OR REPLACE FUNCTION get_trending_items(
  p_restaurant_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  menu_item_id UUID,
  name TEXT,
  category TEXT,
  price NUMERIC,
  trend_score NUMERIC,
  order_count_24h BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.id,
    mi.name,
    mi.category,
    mi.price,
    (COUNT(oi.id)::NUMERIC * 100 / NULLIF(
      (SELECT COUNT(*) FROM order_items oi2 
       JOIN orders o2 ON oi2.order_id = o2.id 
       WHERE o2.restaurant_id = p_restaurant_id 
       AND o2.created_at >= now() - INTERVAL '24 hours'), 
      0
    )) as trend_score,
    COUNT(oi.id) as order_count_24h
  FROM menu_items mi
  LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
  LEFT JOIN orders o ON oi.order_id = o.id
  WHERE mi.restaurant_id = p_restaurant_id
    AND o.created_at >= now() - INTERVAL '24 hours'
  GROUP BY mi.id, mi.name, mi.category, mi.price
  ORDER BY order_count_24h DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get personalized recommendations for user
CREATE OR REPLACE FUNCTION get_user_recommendations(
  p_restaurant_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  menu_item_id UUID,
  name TEXT,
  category TEXT,
  price NUMERIC,
  recommendation_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_categories AS (
    -- Get user's favorite categories
    SELECT 
      mi.category,
      COUNT(*) as order_count
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.user_id = p_user_id
    GROUP BY mi.category
  ),
  ordered_items AS (
    -- Items user has already ordered
    SELECT DISTINCT oi.menu_item_id
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.user_id = p_user_id
  )
  SELECT 
    mi.id,
    mi.name,
    mi.category,
    mi.price,
    (COALESCE(uc.order_count, 0) * 50 + COALESCE(mim.order_count, 0)) as recommendation_score
  FROM menu_items mi
  LEFT JOIN user_categories uc ON mi.category = uc.category
  LEFT JOIN menu_item_metrics mim ON mi.id = mim.menu_item_id
  WHERE mi.restaurant_id = p_restaurant_id
    AND mi.is_available = true
    AND mi.id NOT IN (SELECT menu_item_id FROM ordered_items)
  ORDER BY recommendation_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Advanced AI Recommendation System migration completed!' AS result;
