-- 1. User's custom foods (user-created items not in USDA/OFF)
CREATE TABLE user_custom_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  calories_per_100g NUMERIC NOT NULL DEFAULT 0,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  fiber_per_100g NUMERIC NOT NULL DEFAULT 0,
  serving_size_g NUMERIC DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Saved meal templates
CREATE TABLE user_saved_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_calories NUMERIC DEFAULT 0,
  total_protein_g NUMERIC DEFAULT 0,
  total_carbs_g NUMERIC DEFAULT 0,
  total_fat_g NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- 3. Items within a saved meal (denormalized macros)
CREATE TABLE user_saved_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_meal_id UUID NOT NULL REFERENCES user_saved_meals(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC DEFAULT 0,
  carbs_g NUMERIC DEFAULT 0,
  fat_g NUMERIC DEFAULT 0,
  fiber_g NUMERIC DEFAULT 0,
  serving_g NUMERIC DEFAULT 100
);

-- 4. Recent/favorites tracking (upsert on every log)
CREATE TABLE user_food_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  log_count INT DEFAULT 1,
  last_logged_at TIMESTAMPTZ DEFAULT NOW(),
  calories NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  source TEXT,
  barcode TEXT,
  UNIQUE(user_id, food_name)
);

-- RLS
ALTER TABLE user_custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_food_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_custom_foods" ON user_custom_foods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_saved_meals" ON user_saved_meals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_meal_items" ON user_saved_meal_items FOR ALL
  USING (EXISTS (SELECT 1 FROM user_saved_meals WHERE id = saved_meal_id AND user_id = auth.uid()));
CREATE POLICY "users_own_food_prefs" ON user_food_preferences FOR ALL USING (auth.uid() = user_id);
