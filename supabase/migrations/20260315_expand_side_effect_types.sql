-- Expand side_effect_type enum to cover all GLP-1 side effects tracked in the app.
-- New values activate the side-effect adjustment engine for these specific effects.
-- Previously these were all stored as 'other' — existing logs are unaffected.

ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'dehydration';
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'dizziness';
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'muscle_loss';
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'heartburn';
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'food_noise';
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'sulfur_burps';
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'bloating';
