/**
 * Database types.
 *
 * Hand-maintained until the schema stabilises, then regenerated with:
 *   pnpm supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 *
 * Keeping this file accurate is what makes every query in the app type-safe
 * end to end, so it is updated in the same commit as the migration it mirrors.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          locale: string;
          onboarded_at: string | null;
          reminder_enabled: boolean;
          reminder_time: string;
          reminder_days: number[];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          locale?: string;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          locale?: string;
          onboarded_at?: string | null;
          deleted_at?: string | null;
          reminder_enabled?: boolean;
          reminder_time?: string;
          reminder_days?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      mushaf_editions: {
        Row: {
          id: number;
          slug: string;
          name: string;
          riwayah: string;
          page_count: number;
          is_default: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      surahs: {
        Row: {
          number: number;
          name_arabic: string;
          name_transliterated: string;
          name_english: string;
          ayah_count: number;
          ruku_count: number;
          revelation_order: number;
          revelation_place: 'meccan' | 'medinan';
          first_ayah_id: number;
          last_ayah_id: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ayahs: {
        Row: {
          id: number;
          surah_number: number;
          ayah_number: number;
          juz: number;
          hizb: number;
          rub: number;
          manzil: number;
          has_sajdah: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'ayahs_surah_number_fkey';
            columns: ['surah_number'];
            isOneToOne: false;
            referencedRelation: 'surahs';
            referencedColumns: ['number'];
          },
        ];
      };
      mushaf_pages: {
        Row: {
          edition_id: number;
          page_number: number;
          /** int4range literal, for example "[1,8)". Parse with parseRange(). */
          ayah_range: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      memorisation_segments: {
        Row: {
          id: string;
          user_id: string;
          /** int4range literal, for example "[1,8)". Parse with parseRange(). */
          ayah_range: string;
          status: 'learning' | 'memorised';
          confidence: number | null;
          memorised_on: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          ayah_range: string;
          status?: 'learning' | 'memorised';
          confidence?: number | null;
          memorised_on?: string | null;
          notes?: string | null;
        };
        Update: {
          ayah_range?: string;
          status?: 'learning' | 'memorised';
          confidence?: number | null;
          memorised_on?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      custom_unit_sets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      review_plans: {
        Row: {
          id: string;
          user_id: string;
          edition_id: number;
          mode: 'daily_quantity' | 'cycle_length';
          daily_pages: number;
          cycle_days: number;
          sabqi_window_days: number;
          sabqi_daily_pages: number;
          include_weak: boolean;
          weak_threshold: number;
          manzil_cursor: number;
          rest_days: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          edition_id: number;
          mode?: 'daily_quantity' | 'cycle_length';
          daily_pages?: number;
          cycle_days?: number;
          sabqi_window_days?: number;
          sabqi_daily_pages?: number;
          include_weak?: boolean;
          weak_threshold?: number;
          rest_days?: number[];
        };
        Update: {
          mode?: 'daily_quantity' | 'cycle_length';
          daily_pages?: number;
          cycle_days?: number;
          sabqi_window_days?: number;
          sabqi_daily_pages?: number;
          include_weak?: boolean;
          weak_threshold?: number;
          manzil_cursor?: number;
          rest_days?: number[];
        };
        Relationships: [];
      };
      review_sessions: {
        Row: {
          id: string;
          user_id: string;
          ayah_range: string;
          reviewed_on: string;
          confidence: number;
          tier: 'sabaq' | 'sabqi' | 'manzil' | 'weak';
          duration_seconds: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          ayah_range: string;
          reviewed_on?: string;
          confidence: number;
          tier: 'sabaq' | 'sabqi' | 'manzil' | 'weak';
          duration_seconds?: number | null;
          notes?: string | null;
        };
        Update: { confidence?: number; notes?: string | null };
        Relationships: [];
      };
      review_queues: {
        Row: {
          id: string;
          user_id: string;
          queue_date: string;
          is_rest_day: boolean;
          page_budget: number;
          generated_at: string;
        };
        Insert: { user_id: string; queue_date: string };
        Update: never;
        Relationships: [];
      };
      review_queue_items: {
        Row: {
          id: string;
          queue_id: string;
          page_number: number;
          tier: 'sabqi' | 'manzil' | 'weak';
          position: number;
          completed_at: string | null;
          confidence: number | null;
          session_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          scope_type: 'quran' | 'juz' | 'surah' | 'pages' | 'ayahs';
          scope_from: number | null;
          scope_to: number | null;
          ayah_range: string;
          started_on: string;
          target_date: string;
          baseline_ayahs: number;
          status: 'active' | 'completed' | 'abandoned';
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          user_id: string;
          name: string;
          scope_type: 'quran' | 'juz' | 'surah' | 'pages' | 'ayahs';
          scope_from?: number | null;
          scope_to?: number | null;
          ayah_range: string;
          target_date: string;
          baseline_ayahs?: number;
        };
        Update: {
          name?: string;
          target_date?: string;
          status?: 'active' | 'completed' | 'abandoned';
          completed_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      custom_units: {
        Row: {
          id: string;
          set_id: string;
          ordinal: number;
          label: string;
          ayah_range: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          ordinal: number;
          label: string;
          ayah_range: string;
        };
        Update: {
          ordinal?: number;
          label?: string;
          ayah_range?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'custom_units_set_id_fkey';
            columns: ['set_id'];
            isOneToOne: false;
            referencedRelation: 'custom_unit_sets';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_memorised_ayahs: {
        Row: { user_id: string; ayah_id: number };
        Relationships: [];
      };
      v_surah_progress: {
        Row: {
          user_id: string;
          surah_number: number;
          name_transliterated: string;
          ayah_count: number;
          memorised_ayahs: number;
          percent_complete: number;
        };
        Relationships: [];
      };
      v_juz_progress: {
        Row: {
          user_id: string;
          juz: number;
          memorised_ayahs: number;
          ayah_count: number;
          percent_complete: number;
        };
        Relationships: [];
      };
      v_page_progress: {
        Row: {
          user_id: string;
          edition_id: number;
          page_number: number;
          memorised_ayahs: number;
          ayah_count: number;
          percent_complete: number;
        };
        Relationships: [];
      };
      v_page_review_state: {
        Row: {
          user_id: string;
          edition_id: number;
          page_number: number;
          juz: number;
          memorised_on: string | null;
          last_reviewed_on: string | null;
          last_confidence: number | null;
          review_count: number;
          tier: 'sabqi' | 'manzil';
          is_weak: boolean;
          days_since_review: number | null;
        };
        Relationships: [];
      };
      v_review_queue: {
        Row: {
          user_id: string;
          queue_date: string;
          is_rest_day: boolean;
          page_budget: number;
          item_id: string;
          page_number: number;
          tier: 'sabqi' | 'manzil' | 'weak';
          position: number;
          completed_at: string | null;
          confidence: number | null;
          juz: number;
          ayah_count: number;
          opening_surah: string;
        };
        Relationships: [];
      };
      v_review_streak: {
        Row: {
          user_id: string;
          longest_streak: number;
          current_streak: number;
          last_active_on: string | null;
        };
        Relationships: [];
      };
      v_daily_activity: {
        Row: {
          user_id: string;
          day: string;
          review_count: number;
          ayahs_reviewed: number;
          ayahs_memorised: number;
        };
        Relationships: [];
      };
      v_activity_summary: {
        Row: {
          user_id: string;
          days_active_30: number;
          days_active_90: number;
          days_active_total: number;
          total_reviews: number;
          first_activity_on: string | null;
          last_activity_on: string | null;
        };
        Relationships: [];
      };
      v_goal_progress: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          scope_type: 'quran' | 'juz' | 'surah' | 'pages' | 'ayahs';
          scope_from: number | null;
          scope_to: number | null;
          ayah_range: string;
          started_on: string;
          target_date: string;
          status: 'active' | 'completed' | 'abandoned';
          completed_at: string | null;
          scope_ayahs: number;
          scope_pages: number;
          baseline_ayahs: number;
          memorised_ayahs: number;
          remaining_ayahs: number;
          percent_complete: number;
          days_total: number;
          days_elapsed: number;
          days_remaining: number;
          required_ayahs_per_day: number | null;
          recent_ayahs_per_day: number;
          average_ayahs_per_day: number | null;
          projected_completion_date: string | null;
          state:
            | 'complete'
            | 'abandoned'
            | 'overdue'
            | 'stalled'
            | 'on_track'
            | 'behind';
        };
        Relationships: [];
      };
      v_page_strength: {
        Row: {
          user_id: string;
          edition_id: number;
          page_number: number;
          juz: number;
          tier: 'sabqi' | 'manzil';
          review_count: number;
          average_confidence: number | null;
          lowest_confidence: number | null;
          last_confidence: number | null;
          last_reviewed_on: string | null;
          days_since_review: number | null;
          is_measured: boolean;
          strength: number | null;
        };
        Relationships: [];
      };
      v_review_totals: {
        Row: {
          user_id: string;
          total_reviews: number;
          review_days: number;
          average_confidence: number | null;
          sabqi_reviews: number;
          manzil_reviews: number;
          weak_reviews: number;
          ayahs_reviewed: number;
          first_review_on: string | null;
          last_review_on: string | null;
        };
        Relationships: [];
      };
      v_memorisation_summary: {
        Row: {
          user_id: string;
          memorised_ayahs: number;
          percent_of_quran: number;
          surahs_touched: number;
          juz_touched: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      ayah_range: {
        Args: { first_ayah: number; last_ayah: number };
        Returns: string;
      };
      ayah_range_length: {
        Args: { r: string };
        Returns: number;
      };
      record_memorisation: {
        Args: {
          p_first_ayah: number;
          p_last_ayah: number;
          p_status?: string;
          p_confidence?: number | null;
          p_memorised_on?: string | null;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['memorisation_segments']['Row'][];
      };
      remove_memorisation: {
        Args: { p_first_ayah: number; p_last_ayah: number };
        Returns: number;
      };
      record_pages: {
        Args: {
          p_edition_id: number;
          p_first_page: number;
          p_last_page: number;
          p_status?: string;
          p_confidence?: number | null;
          p_memorised_on?: string | null;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['memorisation_segments']['Row'][];
      };
      remove_pages: {
        Args: {
          p_edition_id: number;
          p_first_page: number;
          p_last_page: number;
        };
        Returns: number;
      };
      record_surah: {
        Args: {
          p_surah_number: number;
          p_status?: string;
          p_confidence?: number | null;
          p_memorised_on?: string | null;
          p_notes?: string | null;
        };
        Returns: Database['public']['Tables']['memorisation_segments']['Row'][];
      };
      remove_surah: {
        Args: { p_surah_number: number };
        Returns: number;
      };
      ensure_review_queue: {
        Args: { p_date?: string };
        Returns: string | null;
      };
      complete_queue_item: {
        Args: {
          p_item_id: string;
          p_confidence: number;
          p_notes?: string | null;
          p_duration_seconds?: number | null;
        };
        Returns: string;
      };
      effective_daily_pages: {
        Args: { p_plan_id: string };
        Returns: number;
      };
      activity_calendar: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          review_count: number;
          ayahs_reviewed: number;
          ayahs_memorised: number;
        }[];
      };
      goal_scope_range: {
        Args: {
          p_scope_type: string;
          p_scope_from: number | null;
          p_scope_to?: number | null;
          p_edition_id?: number;
        };
        Returns: string;
      };
      review_trend: {
        Args: { p_from: string; p_to: string };
        Returns: {
          week_start: string;
          total_reviews: number;
          sabqi_reviews: number;
          manzil_reviews: number;
          weak_reviews: number;
          average_confidence: number | null;
        }[];
      };
      memorisation_growth: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          ayahs_added: number;
          cumulative_ayahs: number;
        }[];
      };
      export_my_data: {
        Args: Record<string, never>;
        Returns: Json;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      consume_rate_limit: {
        Args: {
          p_bucket: string;
          p_max_attempts: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      prune_rate_limits: {
        Args: { p_older_than_hours?: number };
        Returns: number;
      };
      page_status: {
        Args: { p_edition_id: number };
        Returns: {
          page_number: number;
          juz: number;
          ayah_count: number;
          memorised_ayahs: number;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
