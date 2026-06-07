-- =====================================================================
-- Titra Health Mobile — BASELINE PUBLIC SCHEMA
-- Generated: <GENERATED_PLACEHOLDER>
-- Source: production project deywjhyaztodwbeahzqs ("Titra Health Mobile")
-- Method: READ-ONLY catalog introspection (information_schema / pg_catalog).
--         Zero writes were made to the database to produce this file.
--
-- Order: enums -> tables (no FKs) -> foreign keys -> indexes ->
--        RLS enable -> policies -> functions -> triggers.
-- Idempotent where reasonable (IF NOT EXISTS / OR REPLACE / DO blocks).
--
-- NOTE: profiles.id references auth.users(id); several tables reference
--       profiles(id) and a few reference auth.users(id) directly. The
--       auth schema/tables are assumed to already exist (Supabase-managed).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.activity_source AS ENUM ('manual', 'apple_health', 'fitbit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.article_category AS ENUM ('nutrition', 'medication', 'lifestyle', 'mindset', 'exercise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_role AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.food_source AS ENUM ('manual', 'barcode', 'photo_ai', 'mfp_sync', 'search_db');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_provider AS ENUM ('apple_health', 'fitbit', 'myfitnesspal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.medication_type AS ENUM ('semaglutide', 'tirzepatide', 'liraglutide', 'dulaglutide', 'oral_semaglutide', 'orforglipron');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.phase_type AS ENUM ('shot', 'peak', 'balance', 'reset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.side_effect_type AS ENUM (
    'nausea', 'vomiting', 'fatigue', 'constipation', 'diarrhea', 'headache',
    'injection_site', 'appetite_loss', 'other', 'hair_loss', 'dehydration',
    'dizziness', 'muscle_loss', 'heartburn', 'food_noise', 'sulfur_burps', 'bloating'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 2. TABLES (no foreign keys; PK / UNIQUE / CHECK inline)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  steps integer NOT NULL DEFAULT 0,
  active_calories integer NOT NULL DEFAULT 0,
  exercise_minutes integer NOT NULL DEFAULT 0,
  source public.activity_source NOT NULL DEFAULT 'manual'::public.activity_source,
  exercise_type text,
  duration_min integer,
  intensity text,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_intensity_check CHECK ((intensity = ANY (ARRAY['low'::text, 'moderate'::text, 'high'::text])))
);

CREATE TABLE IF NOT EXISTS public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  body_markdown text NOT NULL,
  category public.article_category NOT NULL,
  phase_focus text NOT NULL DEFAULT 'all'::text,
  reading_time_minutes integer NOT NULL DEFAULT 3,
  published_at date NOT NULL DEFAULT CURRENT_DATE,
  featured_image_url text,
  is_daily_featured boolean NOT NULL DEFAULT false,
  CONSTRAINT articles_pkey PRIMARY KEY (id),
  CONSTRAINT articles_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);
-- NOTE: audit_log.user_id intentionally has NO foreign key (account-deletion
-- cascade trap — audit rows must survive profile/user deletion).

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempt_type text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_rate_limits_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.chat_role NOT NULL,
  content text NOT NULL,
  context_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.clinicians (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  display_name text NOT NULL,
  practice_name text,
  npi text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinicians_pkey PRIMARY KEY (id),
  CONSTRAINT clinicians_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  icon_name text NOT NULL,
  icon_set text NOT NULL DEFAULT 'Ionicons'::text,
  accent_color text NOT NULL DEFAULT '#FF742A'::text,
  category text NOT NULL,
  lesson_count integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  phase_unlock text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_slug_key UNIQUE (slug),
  CONSTRAINT courses_category_check CHECK ((category = ANY (ARRAY['medical'::text, 'nutrition'::text, 'mental_health'::text, 'lifestyle'::text])))
);

CREATE TABLE IF NOT EXISTS public.daily_article_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  article_id uuid NOT NULL,
  phase public.phase_type NOT NULL,
  CONSTRAINT daily_article_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT daily_article_schedule_date_key UNIQUE (date)
);

CREATE TABLE IF NOT EXISTS public.demo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  current_uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT demo_codes_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.doctor_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  provider_name text,
  max_uses integer NOT NULL DEFAULT 100000,
  current_uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doctor_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  screenshot text,
  app_version text,
  build_number text,
  os_name text,
  os_version text,
  device_model text,
  status text NOT NULL DEFAULT 'new'::text,
  dev_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_category_check CHECK ((category = ANY (ARRAY['bug'::text, 'feature'::text, 'general'::text]))),
  CONSTRAINT feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'in_progress'::text, 'resolved'::text, 'wont_fix'::text])))
);

CREATE TABLE IF NOT EXISTS public.food_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  calories numeric(7,1) NOT NULL DEFAULT 0,
  protein_g numeric(6,1) NOT NULL DEFAULT 0,
  carbs_g numeric(6,1) NOT NULL DEFAULT 0,
  fat_g numeric(6,1) NOT NULL DEFAULT 0,
  fiber_g numeric(6,1) NOT NULL DEFAULT 0,
  serving_size text,
  input_method text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT food_entries_pkey PRIMARY KEY (id),
  CONSTRAINT food_entries_input_method_check CHECK ((input_method = ANY (ARRAY['search'::text, 'barcode'::text, 'photo'::text, 'describe'::text, 'ai'::text])))
);

CREATE TABLE IF NOT EXISTS public.food_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  meal_type public.meal_type NOT NULL,
  food_name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric(7,2) NOT NULL DEFAULT 0,
  carbs_g numeric(7,2) NOT NULL DEFAULT 0,
  fat_g numeric(7,2) NOT NULL DEFAULT 0,
  fiber_g numeric(7,2) NOT NULL DEFAULT 0,
  source public.food_source NOT NULL DEFAULT 'manual'::public.food_source,
  barcode text,
  raw_ai_response jsonb,
  saturated_fat_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  cholesterol_mg numeric,
  image_url text,
  allergens jsonb,
  preferences jsonb,
  fatsecret_food_id bigint,
  fatsecret_category_name text,
  trans_fat_g numeric,
  polyunsaturated_fat_g numeric,
  monounsaturated_fat_g numeric,
  potassium_mg numeric,
  added_sugars_g numeric,
  vitamin_a_mcg numeric,
  vitamin_c_mg numeric,
  vitamin_d_mcg numeric,
  calcium_mg numeric,
  iron_mg numeric,
  hydration_ml integer,
  CONSTRAINT food_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.food_noise_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score smallint NOT NULL,
  q1 smallint NOT NULL,
  q2 smallint NOT NULL,
  q3 smallint NOT NULL,
  q4 smallint NOT NULL,
  q5 smallint NOT NULL,
  program_week smallint,
  phase_at_log public.phase_type,
  logged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT food_noise_logs_pkey PRIMARY KEY (id),
  CONSTRAINT food_noise_logs_q1_check CHECK (((q1 >= 0) AND (q1 <= 4))),
  CONSTRAINT food_noise_logs_q2_check CHECK (((q2 >= 0) AND (q2 <= 4))),
  CONSTRAINT food_noise_logs_q3_check CHECK (((q3 >= 0) AND (q3 <= 4))),
  CONSTRAINT food_noise_logs_q4_check CHECK (((q4 >= 0) AND (q4 <= 4))),
  CONSTRAINT food_noise_logs_q5_check CHECK (((q5 >= 0) AND (q5 <= 4))),
  CONSTRAINT food_noise_logs_score_check CHECK (((score >= 0) AND (score <= 20)))
);

CREATE TABLE IF NOT EXISTS public.injection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  injection_date date NOT NULL,
  injection_time time,
  dose_mg numeric(5,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  site text,
  medication_name text,
  batch_number text,
  CONSTRAINT injection_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider public.integration_provider NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  last_synced_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT integrations_pkey PRIMARY KEY (id),
  CONSTRAINT integrations_user_id_provider_key UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_type text NOT NULL DEFAULT 'freeform'::text,
  prompt_id text,
  content_json jsonb NOT NULL,
  mood_before integer,
  mood_after integer,
  logged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  course_id uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_progress_user_id_lesson_id_key UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  sort_order integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 3,
  content_type text NOT NULL DEFAULT 'article'::text,
  body_markdown text,
  content_json jsonb,
  is_published boolean NOT NULL DEFAULT false,
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_course_id_slug_key UNIQUE (course_id, slug)
);

CREATE TABLE IF NOT EXISTS public.medication_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL,
  prev_brand text,
  prev_glp1_type text,
  prev_dose_mg real,
  prev_frequency_days integer,
  new_brand text NOT NULL,
  new_glp1_type text NOT NULL,
  new_dose_mg real NOT NULL,
  new_frequency_days integer NOT NULL,
  last_dose_date date,
  first_dose_date date,
  dose_start_date date,
  CONSTRAINT medication_changes_pkey PRIMARY KEY (id),
  CONSTRAINT medication_changes_change_type_check CHECK ((change_type = ANY (ARRAY['drug_type'::text, 'freq_change'::text, 'brand_swap'::text, 'dose_only'::text])))
);

CREATE TABLE IF NOT EXISTS public.mindfulness_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_type text NOT NULL,
  duration_seconds integer NOT NULL,
  context text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mindfulness_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.openai_error_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  is_vision boolean,
  json_mode boolean,
  openai_status integer,
  openai_message text,
  image_prefix text,
  CONSTRAINT openai_error_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text,
  avatar_url text,
  medication_type public.medication_type,
  dose_mg numeric(5,2),
  injection_day_of_week smallint,
  injection_frequency_days smallint NOT NULL DEFAULT 7,
  injection_time time,
  program_start_date date,
  start_weight_lbs numeric(6,2),
  goal_weight_lbs numeric(6,2),
  height_inches smallint,
  dob date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_flags jsonb DEFAULT '[]'::jsonb,
  sex text,
  apple_health_enabled boolean DEFAULT false,
  target_weekly_loss_lbs numeric,
  activity_level text DEFAULT 'light'::text,
  craving_days jsonb DEFAULT '[]'::jsonb,
  initial_side_effects jsonb DEFAULT '[]'::jsonb,
  medication_brand text,
  route_of_administration text,
  glp1_status text,
  unit_system text DEFAULT 'imperial'::text,
  initial_dose_mg numeric,
  dose_start_date date,
  last_injection_date text,
  dose_time text,
  peer_comparison_opted_in boolean NOT NULL DEFAULT false,
  peer_comparison_opted_in_at timestamptz,
  pending_medication_brand text,
  pending_glp1_type text,
  pending_route text,
  pending_dose_mg real,
  pending_frequency_days integer,
  pending_dose_time text,
  pending_first_dose_date date,
  pending_last_dose_old date,
  rtm_enabled boolean NOT NULL DEFAULT false,
  rtm_clinician_id uuid,
  rtm_linked_at timestamptz,
  rtm_consent_text text,
  tos_accepted_at timestamptz,
  tos_version text,
  privacy_accepted_at timestamptz,
  privacy_version text,
  current_weight_lbs real,
  treatment_status text DEFAULT 'on'::text,
  is_premium boolean DEFAULT false,
  trial_ends_at timestamptz,
  medication_custom_name text,
  medication_notes text,
  medication_photo_url text,
  ai_accepted_at timestamptz,
  ai_version text,
  medication_start_date date,
  doctor_code text,
  provider_name text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_injection_day_of_week_check CHECK (((injection_day_of_week >= 0) AND (injection_day_of_week <= 6)))
);

CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  photo_url text NOT NULL,
  weight_lbs numeric NOT NULL,
  milestone_lbs integer,
  is_starting boolean DEFAULT false,
  note text,
  taken_at timestamptz DEFAULT now(),
  CONSTRAINT progress_photos_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.side_effect_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  effect_type public.side_effect_type NOT NULL,
  severity smallint NOT NULL,
  notes text,
  phase_at_log public.phase_type NOT NULL,
  medication_name text,
  dose_mg numeric,
  CONSTRAINT side_effect_logs_pkey PRIMARY KEY (id),
  CONSTRAINT side_effect_logs_severity_check CHECK (((severity >= 1) AND (severity <= 10)))
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'none'::text,
  plan text NOT NULL DEFAULT 'monthly'::text,
  provider text NOT NULL,
  provider_subscription_id text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_user_id_key UNIQUE (user_id),
  CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['monthly'::text, 'annual'::text]))),
  CONSTRAINT subscriptions_provider_check CHECK ((provider = ANY (ARRAY['app_store'::text, 'play_store'::text, 'stripe'::text, 'demo'::text]))),
  CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'expired'::text, 'none'::text])))
);

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  feature_key text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT usage_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT usage_tracking_user_id_date_feature_key_key UNIQUE (user_id, date, feature_key),
  CONSTRAINT usage_tracking_feature_key_check CHECK ((feature_key = ANY (ARRAY['ai_chat'::text, 'photo_analysis'::text, 'voice_log'::text, 'food_parse'::text])))
);

CREATE TABLE IF NOT EXISTS public.user_custom_foods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  brand text,
  calories_per_100g numeric NOT NULL DEFAULT 0,
  protein_per_100g numeric NOT NULL DEFAULT 0,
  carbs_per_100g numeric NOT NULL DEFAULT 0,
  fat_per_100g numeric NOT NULL DEFAULT 0,
  fiber_per_100g numeric NOT NULL DEFAULT 0,
  serving_size_g numeric DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_custom_foods_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_food_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  food_name text NOT NULL,
  is_favorite boolean DEFAULT false,
  log_count integer DEFAULT 1,
  last_logged_at timestamptz DEFAULT now(),
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  source text,
  barcode text,
  CONSTRAINT user_food_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_food_preferences_user_id_food_name_key UNIQUE (user_id, food_name)
);

CREATE TABLE IF NOT EXISTS public.user_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  daily_calories_target integer NOT NULL DEFAULT 1800,
  daily_protein_g_target integer NOT NULL DEFAULT 120,
  daily_fiber_g_target integer NOT NULL DEFAULT 25,
  daily_steps_target integer NOT NULL DEFAULT 8000,
  active_calories_target integer NOT NULL DEFAULT 400,
  updated_at timestamptz NOT NULL DEFAULT now(),
  daily_sodium_mg_target numeric,
  daily_sugar_g_target numeric,
  daily_saturated_fat_g_target numeric,
  daily_cholesterol_mg_target numeric,
  CONSTRAINT user_goals_pkey PRIMARY KEY (id),
  CONSTRAINT user_goals_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_medications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_brand text NOT NULL,
  medication_custom_name text,
  glp1_type text NOT NULL,
  route_of_administration text NOT NULL DEFAULT 'injection'::text,
  dose_mg real NOT NULL,
  frequency_days integer NOT NULL DEFAULT 7,
  dose_time text,
  notes text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_medications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_saved_meal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  saved_meal_id uuid NOT NULL,
  food_name text NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein_g numeric DEFAULT 0,
  carbs_g numeric DEFAULT 0,
  fat_g numeric DEFAULT 0,
  fiber_g numeric DEFAULT 0,
  serving_g numeric DEFAULT 100,
  CONSTRAINT user_saved_meal_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_saved_meals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  total_calories numeric DEFAULT 0,
  total_protein_g numeric DEFAULT 0,
  total_carbs_g numeric DEFAULT 0,
  total_fat_g numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT user_saved_meals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  notification_type text,
  subtype text,
  user_id uuid,
  expires_date timestamptz,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  checkin_type text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  score integer NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  program_week integer,
  phase_at_log text,
  CONSTRAINT weekly_checkins_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  window_start date NOT NULL,
  window_end date NOT NULL,
  summary_data jsonb NOT NULL,
  ai_insight text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_summaries_user_id_window_end_key UNIQUE (user_id, window_end)
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  weight_lbs numeric(6,2) NOT NULL,
  notes text,
  body_fat_pct numeric(4,1),
  lean_mass_lbs numeric(6,1),
  muscle_mass_lbs numeric(6,1),
  bone_mass_lbs numeric(5,1),
  body_water_pct numeric(4,1),
  visceral_fat_level smallint,
  bmr_kcal integer,
  waist_inches numeric(5,1),
  source text DEFAULT 'manual'::text,
  CONSTRAINT weight_logs_pkey PRIMARY KEY (id),
  CONSTRAINT weight_logs_visceral_fat_range CHECK (((visceral_fat_level IS NULL) OR ((visceral_fat_level >= 1) AND (visceral_fat_level <= 59))))
);

-- ---------------------------------------------------------------------
-- 3. FOREIGN KEY CONSTRAINTS
-- ---------------------------------------------------------------------
ALTER TABLE public.activity_logs        ADD CONSTRAINT activity_logs_user_id_fkey            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages        ADD CONSTRAINT chat_messages_user_id_fkey            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.daily_article_schedule ADD CONSTRAINT daily_article_schedule_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;
ALTER TABLE public.feedback             ADD CONSTRAINT feedback_user_id_fkey                 FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.food_entries         ADD CONSTRAINT food_entries_user_id_fkey             FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.food_logs            ADD CONSTRAINT food_logs_user_id_fkey                FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.food_noise_logs      ADD CONSTRAINT food_noise_logs_user_id_fkey          FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.injection_logs       ADD CONSTRAINT injection_logs_user_id_fkey           FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.integrations         ADD CONSTRAINT integrations_user_id_fkey             FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entries      ADD CONSTRAINT journal_entries_user_id_fkey          FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.lesson_progress      ADD CONSTRAINT lesson_progress_course_id_fkey        FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.lesson_progress      ADD CONSTRAINT lesson_progress_lesson_id_fkey        FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;
ALTER TABLE public.lesson_progress      ADD CONSTRAINT lesson_progress_user_id_fkey          FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.lessons              ADD CONSTRAINT lessons_course_id_fkey                FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
ALTER TABLE public.medication_changes   ADD CONSTRAINT medication_changes_user_id_fkey       FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.mindfulness_sessions ADD CONSTRAINT mindfulness_sessions_user_id_fkey     FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profiles             ADD CONSTRAINT profiles_id_fkey                      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles             ADD CONSTRAINT profiles_rtm_clinician_id_fkey        FOREIGN KEY (rtm_clinician_id) REFERENCES public.clinicians(id) ON DELETE SET NULL;
ALTER TABLE public.progress_photos      ADD CONSTRAINT progress_photos_user_id_fkey          FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.side_effect_logs     ADD CONSTRAINT side_effect_logs_user_id_fkey         FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions        ADD CONSTRAINT subscriptions_user_id_fkey            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.usage_tracking       ADD CONSTRAINT usage_tracking_user_id_fkey           FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_custom_foods    ADD CONSTRAINT user_custom_foods_user_id_fkey        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_food_preferences ADD CONSTRAINT user_food_preferences_user_id_fkey   FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_goals           ADD CONSTRAINT user_goals_user_id_fkey               FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_medications     ADD CONSTRAINT user_medications_user_id_fkey         FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_saved_meal_items ADD CONSTRAINT user_saved_meal_items_saved_meal_id_fkey FOREIGN KEY (saved_meal_id) REFERENCES public.user_saved_meals(id) ON DELETE CASCADE;
ALTER TABLE public.user_saved_meals     ADD CONSTRAINT user_saved_meals_user_id_fkey         FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_checkins      ADD CONSTRAINT weekly_checkins_user_id_fkey          FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_summaries     ADD CONSTRAINT weekly_summaries_user_id_fkey         FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.weight_logs          ADD CONSTRAINT weight_logs_user_id_fkey              FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 4. NON-CONSTRAINT INDEXES (PK/UNIQUE indexes omitted; created by constraints)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS activity_logs_user_date ON public.activity_logs USING btree (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.auth_rate_limits USING btree (identifier, attempt_type, attempted_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_user_time ON public.chat_messages USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS clinicians_code_active_idx ON public.clinicians USING btree (code) WHERE (active = true);
CREATE UNIQUE INDEX IF NOT EXISTS doctor_codes_code_lower_idx ON public.doctor_codes USING btree (lower(code));
CREATE INDEX IF NOT EXISTS feedback_status ON public.feedback USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_date ON public.feedback USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS food_logs_user_category_idx ON public.food_logs USING btree (user_id, fatsecret_category_name) WHERE (fatsecret_category_name IS NOT NULL);
CREATE INDEX IF NOT EXISTS food_logs_user_time ON public.food_logs USING btree (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS injection_logs_user_date ON public.injection_logs USING btree (user_id, injection_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user ON public.journal_entries USING btree (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON public.lesson_progress USING btree (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_medication_changes_user_date ON public.medication_changes USING btree (user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user ON public.progress_photos USING btree (user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS side_effect_logs_user_time ON public.side_effect_logs USING btree (user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_id ON public.subscriptions USING btree (provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON public.usage_tracking USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON public.webhook_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS weekly_checkins_user_id_checkin_type_logged_at_idx ON public.weekly_checkins USING btree (user_id, checkin_type, logged_at DESC);
CREATE INDEX IF NOT EXISTS weekly_summaries_user_id_window_end_idx ON public.weekly_summaries USING btree (user_id, window_end DESC);
CREATE INDEX IF NOT EXISTS weight_logs_user_time ON public.weight_logs USING btree (user_id, logged_at DESC);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (enabled on ALL 37 public tables)
-- ---------------------------------------------------------------------
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_article_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_noise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindfulness_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.side_effect_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_food_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- NOTE: the following RLS-enabled tables have NO policies (deny-all to
-- non-service-role; written/read only via service_role / SECURITY DEFINER):
--   auth_rate_limits, demo_codes, doctor_codes, openai_error_log, webhook_events

-- ---------------------------------------------------------------------
-- 6. RLS POLICIES
-- ---------------------------------------------------------------------
CREATE POLICY "Users manage own activity logs" ON public.activity_logs FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users own their activity logs" ON public.activity_logs FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Articles are publicly readable" ON public.articles FOR SELECT TO public USING (true);

CREATE POLICY "Users can view their own audit logs" ON public.audit_log FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users own their chat messages" ON public.chat_messages FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "clinicians_select_authenticated" ON public.clinicians FOR SELECT TO authenticated USING ((active = true));

CREATE POLICY "Courses are publicly readable" ON public.courses FOR SELECT TO public USING (true);

CREATE POLICY "Daily schedule is publicly readable" ON public.daily_article_schedule FOR SELECT TO public USING (true);

CREATE POLICY "Users can submit feedback" ON public.feedback FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view own feedback" ON public.feedback FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users manage own food entries" ON public.food_entries FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users own their food logs" ON public.food_logs FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users manage own food noise logs" ON public.food_noise_logs FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users manage own injection logs" ON public.injection_logs FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users own their injection logs" ON public.injection_logs FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users own their integrations" ON public.integrations FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users own journal entries" ON public.journal_entries FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users own lesson progress" ON public.lesson_progress FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Lessons are publicly readable" ON public.lessons FOR SELECT TO public USING (true);

CREATE POLICY "Users can insert own medication changes" ON public.medication_changes FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read own medication changes" ON public.medication_changes FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users own mindfulness sessions" ON public.mindfulness_sessions FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO public USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));

CREATE POLICY "Users can delete own photos" ON public.progress_photos FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own photos" ON public.progress_photos FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can read own photos" ON public.progress_photos FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users manage own side effect logs" ON public.side_effect_logs FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users own their side effect logs" ON public.side_effect_logs FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Service role manages subscriptions" ON public.subscriptions FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Service role manages usage" ON public.usage_tracking FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Users can view own usage" ON public.usage_tracking FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "users_own_custom_foods" ON public.user_custom_foods FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "users_own_food_prefs" ON public.user_food_preferences FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users own their goals" ON public.user_goals FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users can delete their own medications" ON public.user_medications FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can insert their own medications" ON public.user_medications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can read their own medications" ON public.user_medications FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can update their own medications" ON public.user_medications FOR UPDATE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "users_own_meal_items" ON public.user_saved_meal_items FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM user_saved_meals
  WHERE ((user_saved_meals.id = user_saved_meal_items.saved_meal_id) AND (user_saved_meals.user_id = auth.uid())))));

CREATE POLICY "users_own_saved_meals" ON public.user_saved_meals FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users see own checkins" ON public.weekly_checkins FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users see own weekly_summaries" ON public.weekly_summaries FOR ALL TO public USING ((auth.uid() = user_id));

CREATE POLICY "Users manage own weight logs" ON public.weight_logs FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users own their weight logs" ON public.weight_logs FOR ALL TO public USING ((auth.uid() = user_id));

-- ---------------------------------------------------------------------
-- 7. FUNCTIONS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.auth_methods_for_email(p_email text)
 RETURNS text[]
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select array(
    select jsonb_array_elements_text(s.meta -> 'providers')
    from (
      select raw_app_meta_data as meta
      from auth.users
      where lower(email) = lower(trim(p_email))
      order by created_at
      limit 1
    ) s
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_and_increment_usage(p_user_id uuid, p_feature_key text, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_premium boolean;
  v_current_count integer;
BEGIN
  SELECT
    (s.status = 'active'
     OR s.status = 'trialing'
     OR (s.status = 'canceled' AND s.current_period_end > NOW()))
    OR (p.trial_ends_at IS NOT NULL AND p.trial_ends_at > NOW())
  INTO v_is_premium
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  WHERE p.id = p_user_id;

  v_is_premium := COALESCE(v_is_premium, false);

  IF v_is_premium = true THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', null, 'is_premium', true);
  END IF;

  INSERT INTO usage_tracking (user_id, date, feature_key, count)
  VALUES (p_user_id, CURRENT_DATE, p_feature_key, 1)
  ON CONFLICT (user_id, date, feature_key)
  DO UPDATE SET count = usage_tracking.count + 1
  RETURNING count INTO v_current_count;

  IF v_current_count > p_limit THEN
    UPDATE usage_tracking
    SET count = count - 1
    WHERE user_id = p_user_id AND date = CURRENT_DATE AND feature_key = p_feature_key;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'used', v_current_count - 1,
      'limit', p_limit,
      'is_premium', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_current_count,
    'used', v_current_count,
    'limit', p_limit,
    'is_premium', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_identifier text, p_attempt_type text, p_max_attempts integer DEFAULT 5, p_window_minutes integer DEFAULT 15)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  attempt_count int;
BEGIN
  -- Count recent attempts
  SELECT COUNT(*) INTO attempt_count
  FROM public.auth_rate_limits
  WHERE identifier = p_identifier
    AND attempt_type = p_attempt_type
    AND attempted_at > now() - (p_window_minutes || ' minutes')::interval;

  -- Record this attempt
  INSERT INTO public.auth_rate_limits (identifier, attempt_type)
  VALUES (p_identifier, p_attempt_type);

  -- Clean up old entries (older than 1 hour)
  DELETE FROM public.auth_rate_limits
  WHERE attempted_at < now() - interval '1 hour';

  RETURN attempt_count < p_max_attempts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_premium_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role to update anything (webhooks use this)
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users, prevent changing subscription-related columns
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    RAISE EXCEPTION 'Cannot modify is_premium directly — managed by subscription webhooks';
  END IF;

  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Cannot modify trial_ends_at directly — managed by subscription webhooks';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_usage(p_user_id uuid, p_feature_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE usage_tracking
  SET count = GREATEST(count - 1, 0)
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE
    AND feature_key = p_feature_key;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rtm_engagement_days(p_user_id uuid, p_start date, p_end date)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT d)::INT FROM (
    SELECT (logged_at AT TIME ZONE 'UTC')::date AS d
      FROM public.weight_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
    UNION
    SELECT injection_date::date
      FROM public.injection_logs
      WHERE user_id = p_user_id
        AND injection_date::date BETWEEN p_start AND p_end
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.food_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
        AND (source IS NULL OR source <> 'mfp_sync')
    UNION
    SELECT date::date
      FROM public.activity_logs
      WHERE user_id = p_user_id
        AND date::date BETWEEN p_start AND p_end
        AND (source IS NULL OR source = 'manual')
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.side_effect_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.food_noise_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.weekly_checkins
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
  ) all_logs;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ---------------------------------------------------------------------
-- 8. TRIGGERS
-- ---------------------------------------------------------------------
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protect_premium_columns_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_premium_columns();
CREATE TRIGGER trg_audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_profile_changes();

-- NOTE: public.handle_new_user() is normally invoked by a trigger on
-- auth.users (e.g. on_auth_user_created AFTER INSERT). That trigger lives in
-- the Supabase-managed auth schema and is therefore NOT recreated here.
-- To wire it up on a fresh project:
--   CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- END BASELINE
-- =====================================================================
