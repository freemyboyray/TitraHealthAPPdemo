-- Beverage hydration credited per food log. Drinks (chai, coffee, juice…) add
-- fluid to the daily hydration total; storing it on the row makes that credit
-- durable and reversible — deleting/editing the log re-derives daily water,
-- exactly like protein/fiber are summed from food_logs. NULL = not a beverage.
ALTER TABLE food_logs ADD COLUMN IF NOT EXISTS hydration_ml INTEGER;
