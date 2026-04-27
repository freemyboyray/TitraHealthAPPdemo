export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          active_calories: number
          date: string
          duration_min: number | null
          exercise_minutes: number
          exercise_type: string | null
          id: string
          intensity: string | null
          source: Database["public"]["Enums"]["activity_source"]
          steps: number
          user_id: string
        }
        Insert: {
          active_calories?: number
          date: string
          duration_min?: number | null
          exercise_minutes?: number
          exercise_type?: string | null
          id?: string
          intensity?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          steps?: number
          user_id: string
        }
        Update: {
          active_calories?: number
          date?: string
          duration_min?: number | null
          exercise_minutes?: number
          exercise_type?: string | null
          id?: string
          intensity?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          steps?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          body_markdown: string
          category: Database["public"]["Enums"]["article_category"]
          featured_image_url: string | null
          id: string
          is_daily_featured: boolean
          phase_focus: string
          published_at: string
          reading_time_minutes: number
          slug: string
          subtitle: string | null
          title: string
        }
        Insert: {
          body_markdown: string
          category: Database["public"]["Enums"]["article_category"]
          featured_image_url?: string | null
          id?: string
          is_daily_featured?: boolean
          phase_focus?: string
          published_at?: string
          reading_time_minutes?: number
          slug: string
          subtitle?: string | null
          title: string
        }
        Update: {
          body_markdown?: string
          category?: Database["public"]["Enums"]["article_category"]
          featured_image_url?: string | null
          id?: string
          is_daily_featured?: boolean
          phase_focus?: string
          published_at?: string
          reading_time_minutes?: number
          slug?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          context_snapshot: Json | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string
        }
        Insert: {
          content: string
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string
        }
        Update: {
          content?: string
          context_snapshot?: Json | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["chat_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          accent_color: string
          category: string
          created_at: string
          estimated_minutes: number
          icon_name: string
          icon_set: string
          id: string
          is_published: boolean
          lesson_count: number
          phase_unlock: string | null
          slug: string
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          accent_color?: string
          category: string
          created_at?: string
          estimated_minutes?: number
          icon_name: string
          icon_set?: string
          id?: string
          is_published?: boolean
          lesson_count?: number
          phase_unlock?: string | null
          slug: string
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          accent_color?: string
          category?: string
          created_at?: string
          estimated_minutes?: number
          icon_name?: string
          icon_set?: string
          id?: string
          is_published?: boolean
          lesson_count?: number
          phase_unlock?: string | null
          slug?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      daily_article_schedule: {
        Row: {
          article_id: string
          date: string
          id: string
          phase: Database["public"]["Enums"]["phase_type"]
        }
        Insert: {
          article_id: string
          date: string
          id?: string
          phase: Database["public"]["Enums"]["phase_type"]
        }
        Update: {
          article_id?: string
          date?: string
          id?: string
          phase?: Database["public"]["Enums"]["phase_type"]
        }
        Relationships: [
          {
            foreignKeyName: "daily_article_schedule_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_entries: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          id: string
          input_method: string
          logged_at: string
          name: string
          protein_g: number
          serving_size: string | null
          user_id: string | null
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          input_method: string
          logged_at?: string
          name: string
          protein_g?: number
          serving_size?: string | null
          user_id?: string | null
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          input_method?: string
          logged_at?: string
          name?: string
          protein_g?: number
          serving_size?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          barcode: string | null
          calories: number
          carbs_g: number
          fat_g: number
          fiber_g: number
          food_name: string
          id: string
          logged_at: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          protein_g: number
          raw_ai_response: Json | null
          source: Database["public"]["Enums"]["food_source"]
          user_id: string
        }
        Insert: {
          barcode?: string | null
          calories?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          food_name: string
          id?: string
          logged_at?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          protein_g?: number
          raw_ai_response?: Json | null
          source?: Database["public"]["Enums"]["food_source"]
          user_id: string
        }
        Update: {
          barcode?: string | null
          calories?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          food_name?: string
          id?: string
          logged_at?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          protein_g?: number
          raw_ai_response?: Json | null
          source?: Database["public"]["Enums"]["food_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_noise_logs: {
        Row: {
          id: string
          logged_at: string
          phase_at_log: Database["public"]["Enums"]["phase_type"] | null
          program_week: number | null
          q1: number
          q2: number
          q3: number
          q4: number
          q5: number
          score: number
          user_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          phase_at_log?: Database["public"]["Enums"]["phase_type"] | null
          program_week?: number | null
          q1: number
          q2: number
          q3: number
          q4: number
          q5: number
          score: number
          user_id: string
        }
        Update: {
          id?: string
          logged_at?: string
          phase_at_log?: Database["public"]["Enums"]["phase_type"] | null
          program_week?: number | null
          q1?: number
          q2?: number
          q3?: number
          q4?: number
          q5?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_noise_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_logs: {
        Row: {
          batch_number: string | null
          created_at: string
          dose_mg: number
          id: string
          injection_date: string
          injection_time: string | null
          medication_name: string | null
          notes: string | null
          site: string | null
          user_id: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          dose_mg: number
          id?: string
          injection_date: string
          injection_time?: string | null
          medication_name?: string | null
          notes?: string | null
          site?: string | null
          user_id: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          dose_mg?: number
          id?: string
          injection_date?: string
          injection_time?: string | null
          medication_name?: string | null
          notes?: string | null
          site?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "injection_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string
          enabled: boolean
          expires_at: string | null
          id: string
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content_json: Json
          entry_type: string
          id: string
          logged_at: string
          mood_after: number | null
          mood_before: number | null
          prompt_id: string | null
          user_id: string
        }
        Insert: {
          content_json: Json
          entry_type?: string
          id?: string
          logged_at?: string
          mood_after?: number | null
          mood_before?: number | null
          prompt_id?: string | null
          user_id: string
        }
        Update: {
          content_json?: Json
          entry_type?: string
          id?: string
          logged_at?: string
          mood_after?: number | null
          mood_before?: number | null
          prompt_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string
          course_id: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body_markdown: string | null
          content_json: Json | null
          content_type: string
          course_id: string
          estimated_minutes: number
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          body_markdown?: string | null
          content_json?: Json | null
          content_type?: string
          course_id: string
          estimated_minutes?: number
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          body_markdown?: string | null
          content_json?: Json | null
          content_type?: string
          course_id?: string
          estimated_minutes?: number
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_changes: {
        Row: {
          change_type: string
          changed_at: string
          dose_start_date: string | null
          first_dose_date: string | null
          id: string
          last_dose_date: string | null
          new_brand: string
          new_dose_mg: number
          new_frequency_days: number
          new_glp1_type: string
          prev_brand: string | null
          prev_dose_mg: number | null
          prev_frequency_days: number | null
          prev_glp1_type: string | null
          user_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          dose_start_date?: string | null
          first_dose_date?: string | null
          id?: string
          last_dose_date?: string | null
          new_brand: string
          new_dose_mg: number
          new_frequency_days: number
          new_glp1_type: string
          prev_brand?: string | null
          prev_dose_mg?: number | null
          prev_frequency_days?: number | null
          prev_glp1_type?: string | null
          user_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          dose_start_date?: string | null
          first_dose_date?: string | null
          id?: string
          last_dose_date?: string | null
          new_brand?: string
          new_dose_mg?: number
          new_frequency_days?: number
          new_glp1_type?: string
          prev_brand?: string | null
          prev_dose_mg?: number | null
          prev_frequency_days?: number | null
          prev_glp1_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mindfulness_sessions: {
        Row: {
          context: string | null
          duration_seconds: number
          id: string
          logged_at: string
          session_type: string
          user_id: string
        }
        Insert: {
          context?: string | null
          duration_seconds: number
          id?: string
          logged_at?: string
          session_type: string
          user_id: string
        }
        Update: {
          context?: string | null
          duration_seconds?: number
          id?: string
          logged_at?: string
          session_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mindfulness_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          apple_health_enabled: boolean | null
          avatar_url: string | null
          craving_days: Json | null
          created_at: string
          current_weight_lbs: number | null
          dismissed_flags: Json | null
          dob: string | null
          dose_mg: number | null
          dose_start_date: string | null
          dose_time: string | null
          glp1_status: string | null
          goal_weight_lbs: number | null
          height_inches: number | null
          id: string
          initial_dose_mg: number | null
          initial_side_effects: Json | null
          injection_day_of_week: number | null
          injection_frequency_days: number
          injection_time: string | null
          last_injection_date: string | null
          medication_brand: string | null
          medication_custom_name: string | null
          medication_type: Database["public"]["Enums"]["medication_type"] | null
          peer_comparison_opted_in: boolean
          peer_comparison_opted_in_at: string | null
          pending_dose_mg: number | null
          pending_dose_time: string | null
          pending_first_dose_date: string | null
          pending_frequency_days: number | null
          pending_glp1_type: string | null
          pending_last_dose_old: string | null
          pending_medication_brand: string | null
          pending_route: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          program_start_date: string | null
          route_of_administration: string | null
          sex: string | null
          start_weight_lbs: number | null
          target_weekly_loss_lbs: number | null
          tos_accepted_at: string | null
          tos_version: string | null
          unit_system: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          activity_level?: string | null
          apple_health_enabled?: boolean | null
          avatar_url?: string | null
          craving_days?: Json | null
          created_at?: string
          current_weight_lbs?: number | null
          dismissed_flags?: Json | null
          dob?: string | null
          dose_mg?: number | null
          dose_start_date?: string | null
          dose_time?: string | null
          glp1_status?: string | null
          goal_weight_lbs?: number | null
          height_inches?: number | null
          id: string
          initial_dose_mg?: number | null
          initial_side_effects?: Json | null
          injection_day_of_week?: number | null
          injection_frequency_days?: number
          injection_time?: string | null
          last_injection_date?: string | null
          medication_brand?: string | null
          medication_custom_name?: string | null
          medication_type?:
            | Database["public"]["Enums"]["medication_type"]
            | null
          peer_comparison_opted_in?: boolean
          peer_comparison_opted_in_at?: string | null
          pending_dose_mg?: number | null
          pending_dose_time?: string | null
          pending_first_dose_date?: string | null
          pending_frequency_days?: number | null
          pending_glp1_type?: string | null
          pending_last_dose_old?: string | null
          pending_medication_brand?: string | null
          pending_route?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          program_start_date?: string | null
          route_of_administration?: string | null
          sex?: string | null
          start_weight_lbs?: number | null
          target_weekly_loss_lbs?: number | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          unit_system?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          activity_level?: string | null
          apple_health_enabled?: boolean | null
          avatar_url?: string | null
          craving_days?: Json | null
          created_at?: string
          current_weight_lbs?: number | null
          dismissed_flags?: Json | null
          dob?: string | null
          dose_mg?: number | null
          dose_start_date?: string | null
          dose_time?: string | null
          glp1_status?: string | null
          goal_weight_lbs?: number | null
          height_inches?: number | null
          id?: string
          initial_dose_mg?: number | null
          initial_side_effects?: Json | null
          injection_day_of_week?: number | null
          injection_frequency_days?: number
          injection_time?: string | null
          last_injection_date?: string | null
          medication_brand?: string | null
          medication_custom_name?: string | null
          medication_type?:
            | Database["public"]["Enums"]["medication_type"]
            | null
          peer_comparison_opted_in?: boolean
          peer_comparison_opted_in_at?: string | null
          pending_dose_mg?: number | null
          pending_dose_time?: string | null
          pending_first_dose_date?: string | null
          pending_frequency_days?: number | null
          pending_glp1_type?: string | null
          pending_last_dose_old?: string | null
          pending_medication_brand?: string | null
          pending_route?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          program_start_date?: string | null
          route_of_administration?: string | null
          sex?: string | null
          start_weight_lbs?: number | null
          target_weekly_loss_lbs?: number | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          unit_system?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      side_effect_logs: {
        Row: {
          effect_type: Database["public"]["Enums"]["side_effect_type"]
          id: string
          logged_at: string
          notes: string | null
          phase_at_log: Database["public"]["Enums"]["phase_type"]
          severity: number
          user_id: string
        }
        Insert: {
          effect_type: Database["public"]["Enums"]["side_effect_type"]
          id?: string
          logged_at?: string
          notes?: string | null
          phase_at_log: Database["public"]["Enums"]["phase_type"]
          severity: number
          user_id: string
        }
        Update: {
          effect_type?: Database["public"]["Enums"]["side_effect_type"]
          id?: string
          logged_at?: string
          notes?: string | null
          phase_at_log?: Database["public"]["Enums"]["phase_type"]
          severity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "side_effect_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_foods: {
        Row: {
          brand: string | null
          calories_per_100g: number
          carbs_per_100g: number
          created_at: string | null
          fat_per_100g: number
          fiber_per_100g: number
          id: string
          name: string
          protein_per_100g: number
          serving_size_g: number | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string | null
          fat_per_100g?: number
          fiber_per_100g?: number
          id?: string
          name: string
          protein_per_100g?: number
          serving_size_g?: number | null
          user_id: string
        }
        Update: {
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string | null
          fat_per_100g?: number
          fiber_per_100g?: number
          id?: string
          name?: string
          protein_per_100g?: number
          serving_size_g?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_foods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_food_preferences: {
        Row: {
          barcode: string | null
          calories: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          food_name: string
          id: string
          is_favorite: boolean | null
          last_logged_at: string | null
          log_count: number | null
          protein_g: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          calories?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          food_name: string
          id?: string
          is_favorite?: boolean | null
          last_logged_at?: string | null
          log_count?: number | null
          protein_g?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          calories?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string
          id?: string
          is_favorite?: boolean | null
          last_logged_at?: string | null
          log_count?: number | null
          protein_g?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_food_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          active_calories_target: number
          daily_calories_target: number
          daily_fiber_g_target: number
          daily_protein_g_target: number
          daily_steps_target: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_calories_target?: number
          daily_calories_target?: number
          daily_fiber_g_target?: number
          daily_protein_g_target?: number
          daily_steps_target?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_calories_target?: number
          daily_calories_target?: number
          daily_fiber_g_target?: number
          daily_protein_g_target?: number
          daily_steps_target?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_meal_items: {
        Row: {
          calories: number
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          food_name: string
          id: string
          protein_g: number | null
          saved_meal_id: string
          serving_g: number | null
        }
        Insert: {
          calories?: number
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          food_name: string
          id?: string
          protein_g?: number | null
          saved_meal_id: string
          serving_g?: number | null
        }
        Update: {
          calories?: number
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string
          id?: string
          protein_g?: number | null
          saved_meal_id?: string
          serving_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_meal_items_saved_meal_id_fkey"
            columns: ["saved_meal_id"]
            isOneToOne: false
            referencedRelation: "user_saved_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_meals: {
        Row: {
          created_at: string | null
          id: string
          last_used_at: string | null
          name: string
          total_calories: number | null
          total_carbs_g: number | null
          total_fat_g: number | null
          total_protein_g: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          total_calories?: number | null
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_protein_g?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          total_calories?: number | null
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_protein_g?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checkins: {
        Row: {
          answers: Json
          checkin_type: string
          id: string
          logged_at: string
          phase_at_log: string | null
          program_week: number | null
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json
          checkin_type: string
          id?: string
          logged_at?: string
          phase_at_log?: string | null
          program_week?: number | null
          score: number
          user_id: string
        }
        Update: {
          answers?: Json
          checkin_type?: string
          id?: string
          logged_at?: string
          phase_at_log?: string | null
          program_week?: number | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          id: string
          logged_at: string
          notes: string | null
          user_id: string
          weight_lbs: number
        }
        Insert: {
          id?: string
          logged_at?: string
          notes?: string | null
          user_id: string
          weight_lbs: number
        }
        Update: {
          id?: string
          logged_at?: string
          notes?: string | null
          user_id?: string
          weight_lbs?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      peer_weight_loss_summary: {
        Row: {
          cohort_size: number | null
          dose_tier: number | null
          medication_name: string | null
          p25: number | null
          p50: number | null
          p75: number | null
          treatment_week_bucket: number | null
        }
        Relationships: []
      }
      user_weight_loss_metrics: {
        Row: {
          dose_tier: number | null
          medication_name: string | null
          treatment_week_bucket: number | null
          weight_loss_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_source: "manual" | "apple_health" | "fitbit"
      article_category:
        | "nutrition"
        | "medication"
        | "lifestyle"
        | "mindset"
        | "exercise"
      chat_role: "user" | "assistant"
      food_source: "manual" | "barcode" | "photo_ai" | "mfp_sync" | "search_db"
      integration_provider: "apple_health" | "fitbit" | "myfitnesspal"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      medication_type:
        | "semaglutide"
        | "tirzepatide"
        | "liraglutide"
        | "dulaglutide"
        | "oral_semaglutide"
        | "orforglipron"
      phase_type: "shot" | "peak" | "balance" | "reset"
      side_effect_type:
        | "nausea"
        | "vomiting"
        | "fatigue"
        | "constipation"
        | "diarrhea"
        | "headache"
        | "injection_site"
        | "appetite_loss"
        | "other"
        | "hair_loss"
        | "dehydration"
        | "dizziness"
        | "muscle_loss"
        | "heartburn"
        | "food_noise"
        | "sulfur_burps"
        | "bloating"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_source: ["manual", "apple_health", "fitbit"],
      article_category: [
        "nutrition",
        "medication",
        "lifestyle",
        "mindset",
        "exercise",
      ],
      chat_role: ["user", "assistant"],
      food_source: ["manual", "barcode", "photo_ai", "mfp_sync", "search_db"],
      integration_provider: ["apple_health", "fitbit", "myfitnesspal"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      medication_type: [
        "semaglutide",
        "tirzepatide",
        "liraglutide",
        "dulaglutide",
        "oral_semaglutide",
        "orforglipron",
      ],
      phase_type: ["shot", "peak", "balance", "reset"],
      side_effect_type: [
        "nausea",
        "vomiting",
        "fatigue",
        "constipation",
        "diarrhea",
        "headache",
        "injection_site",
        "appetite_loss",
        "other",
        "hair_loss",
        "dehydration",
        "dizziness",
        "muscle_loss",
        "heartburn",
        "food_noise",
        "sulfur_burps",
        "bloating",
      ],
    },
  },
} as const
