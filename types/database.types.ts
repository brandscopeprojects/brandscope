// Generated from the live Supabase schema. Do not edit by hand.
// Regenerate via Supabase MCP generate_typescript_types after schema changes.

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_outcomes: {
        Row: {
          action_taken: string
          action_taken_at: string | null
          brand_id: string
          created_at: string | null
          id: string
          logged_by: string | null
          notes: string | null
          outcome_metric: string | null
          outcome_unit: string | null
          outcome_value: number | null
          recommendation_id: string
          result: string | null
          updated_at: string | null
        }
        Insert: {
          action_taken: string
          action_taken_at?: string | null
          brand_id: string
          created_at?: string | null
          id?: string
          logged_by?: string | null
          notes?: string | null
          outcome_metric?: string | null
          outcome_unit?: string | null
          outcome_value?: number | null
          recommendation_id: string
          result?: string | null
          updated_at?: string | null
        }
        Update: {
          action_taken?: string
          action_taken_at?: string | null
          brand_id?: string
          created_at?: string | null
          id?: string
          logged_by?: string | null
          notes?: string | null
          outcome_metric?: string | null
          outcome_unit?: string | null
          outcome_value?: number | null
          recommendation_id?: string
          result?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_outcomes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_outcomes_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_outcomes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          opportunity_count: number | null
          scan_job_id: string | null
          scan_week: string
          total_recommendations: number | null
          updated_at: string | null
          urgent_count: number | null
          watch_count: number | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          opportunity_count?: number | null
          scan_job_id?: string | null
          scan_week: string
          total_recommendations?: number | null
          updated_at?: string | null
          urgent_count?: number | null
          watch_count?: number | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          opportunity_count?: number | null
          scan_job_id?: string | null
          scan_week?: string
          total_recommendations?: number | null
          updated_at?: string | null
          urgent_count?: number | null
          watch_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_scan_job_id_fkey"
            columns: ["scan_job_id"]
            isOneToOne: false
            referencedRelation: "scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      active_sessions: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_activity_at: string | null
          location: string | null
          login_at: string | null
          organisation_id: string | null
          profile_id: string
          role: string | null
          user_agent: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity_at?: string | null
          location?: string | null
          login_at?: string | null
          organisation_id?: string | null
          profile_id: string
          role?: string | null
          user_agent?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_activity_at?: string | null
          location?: string | null
          login_at?: string | null
          organisation_id?: string | null
          profile_id?: string
          role?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_sessions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_job_logs: {
        Row: {
          agent_name: string
          brand_id: string | null
          cost_usd: number | null
          created_at: string | null
          data_quality_score: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_snapshot: Json | null
          input_tokens: number | null
          langfuse_trace_id: string | null
          model_used: string | null
          output_snapshot: Json | null
          output_tokens: number | null
          prompt_version: string | null
          retry_count: number | null
          scan_job_id: string | null
          status: string
          task_type: string | null
          total_tokens: number | null
        }
        Insert: {
          agent_name: string
          brand_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          data_quality_score?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_snapshot?: Json | null
          input_tokens?: number | null
          langfuse_trace_id?: string | null
          model_used?: string | null
          output_snapshot?: Json | null
          output_tokens?: number | null
          prompt_version?: string | null
          retry_count?: number | null
          scan_job_id?: string | null
          status: string
          task_type?: string | null
          total_tokens?: number | null
        }
        Update: {
          agent_name?: string
          brand_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          data_quality_score?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_snapshot?: Json | null
          input_tokens?: number | null
          langfuse_trace_id?: string | null
          model_used?: string | null
          output_snapshot?: Json | null
          output_tokens?: number | null
          prompt_version?: string | null
          retry_count?: number | null
          scan_job_id?: string | null
          status?: string
          task_type?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_job_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_job_logs_scan_job_id_fkey"
            columns: ["scan_job_id"]
            isOneToOne: false
            referencedRelation: "scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_skills: {
        Row: {
          agent_id: string
          config: Json | null
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          config?: Json | null
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          config?: Json | null
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_skills_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          config: Json | null
          created_at: string | null
          current_version: string | null
          description: string | null
          display_name: string
          id: string
          last_updated_at: string | null
          model: string
          name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          current_version?: string | null
          description?: string | null
          display_name: string
          id?: string
          last_updated_at?: string | null
          model: string
          name: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          current_version?: string | null
          description?: string | null
          display_name?: string
          id?: string
          last_updated_at?: string | null
          model?: string
          name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      alert_configs: {
        Row: {
          bonus_change_enabled: boolean | null
          bonus_change_threshold_pct: number | null
          brand_id: string
          competitor_dark_enabled: boolean | null
          competitor_dark_on_ads_days: number | null
          created_at: string | null
          credit_balance_low_enabled: boolean | null
          data_source_failure_enabled: boolean | null
          email_address: string | null
          email_enabled: boolean | null
          feature_failure_enabled: boolean | null
          id: string
          new_ad_campaign_enabled: boolean | null
          new_market_entry_enabled: boolean | null
          scan_completion_enabled: boolean | null
          slack_enabled: boolean | null
          slack_webhook_url: string | null
          traffic_drop_enabled: boolean | null
          traffic_drop_threshold_pct: number | null
          updated_at: string | null
          webhook_enabled: boolean | null
          webhook_url: string | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          bonus_change_enabled?: boolean | null
          bonus_change_threshold_pct?: number | null
          brand_id: string
          competitor_dark_enabled?: boolean | null
          competitor_dark_on_ads_days?: number | null
          created_at?: string | null
          credit_balance_low_enabled?: boolean | null
          data_source_failure_enabled?: boolean | null
          email_address?: string | null
          email_enabled?: boolean | null
          feature_failure_enabled?: boolean | null
          id?: string
          new_ad_campaign_enabled?: boolean | null
          new_market_entry_enabled?: boolean | null
          scan_completion_enabled?: boolean | null
          slack_enabled?: boolean | null
          slack_webhook_url?: string | null
          traffic_drop_enabled?: boolean | null
          traffic_drop_threshold_pct?: number | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_url?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          bonus_change_enabled?: boolean | null
          bonus_change_threshold_pct?: number | null
          brand_id?: string
          competitor_dark_enabled?: boolean | null
          competitor_dark_on_ads_days?: number | null
          created_at?: string | null
          credit_balance_low_enabled?: boolean | null
          data_source_failure_enabled?: boolean | null
          email_address?: string | null
          email_enabled?: boolean | null
          feature_failure_enabled?: boolean | null
          id?: string
          new_ad_campaign_enabled?: boolean | null
          new_market_entry_enabled?: boolean | null
          scan_completion_enabled?: boolean | null
          slack_enabled?: boolean | null
          slack_webhook_url?: string | null
          traffic_drop_enabled?: boolean | null
          traffic_drop_threshold_pct?: number | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_url?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_configs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_history: {
        Row: {
          alert_type: string
          brand_id: string
          created_at: string | null
          delivered_via: string[] | null
          id: string
          message: string
          payload: Json | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          alert_type: string
          brand_id: string
          created_at?: string | null
          delivered_via?: string[] | null
          id?: string
          message: string
          payload?: Json | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          alert_type?: string
          brand_id?: string
          created_at?: string | null
          delivered_via?: string[] | null
          id?: string
          message?: string
          payload?: Json | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      api_health_logs: {
        Row: {
          api_name: string
          checked_at: string | null
          credit_balance: number | null
          credit_currency: string | null
          error_message: string | null
          error_rate_24h: number | null
          id: string
          latency_ms: number | null
          status: string
        }
        Insert: {
          api_name: string
          checked_at?: string | null
          credit_balance?: number | null
          credit_currency?: string | null
          error_message?: string | null
          error_rate_24h?: number | null
          id?: string
          latency_ms?: number | null
          status: string
        }
        Update: {
          api_name?: string
          checked_at?: string | null
          credit_balance?: number | null
          credit_currency?: string | null
          error_message?: string | null
          error_rate_24h?: number | null
          id?: string
          latency_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          organisation_id: string | null
          profile_id: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organisation_id?: string | null
          profile_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          organisation_id?: string | null
          profile_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_benchmarks: {
        Row: {
          app_rating: number | null
          brand_id: string
          created_at: string | null
          ctr_pct: number | null
          id: string
          market_avg_app_rating: number | null
          market_avg_ctr_pct: number | null
          market_avg_new_depositors: number | null
          market_avg_revenue_kobo: number | null
          new_depositors: number | null
          revenue_kobo: number | null
          scan_week: string
        }
        Insert: {
          app_rating?: number | null
          brand_id: string
          created_at?: string | null
          ctr_pct?: number | null
          id?: string
          market_avg_app_rating?: number | null
          market_avg_ctr_pct?: number | null
          market_avg_new_depositors?: number | null
          market_avg_revenue_kobo?: number | null
          new_depositors?: number | null
          revenue_kobo?: number | null
          scan_week: string
        }
        Update: {
          app_rating?: number | null
          brand_id?: string
          created_at?: string | null
          ctr_pct?: number | null
          id?: string
          market_avg_app_rating?: number | null
          market_avg_ctr_pct?: number | null
          market_avg_new_depositors?: number | null
          market_avg_revenue_kobo?: number | null
          new_depositors?: number | null
          revenue_kobo?: number | null
          scan_week?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_benchmarks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_competitors: {
        Row: {
          added_at: string | null
          brand_id: string
          competitor_id: string
          created_at: string | null
          id: string
          priority: number
          track_ads: boolean | null
          track_hiring: boolean | null
          track_product: boolean | null
          track_promotions: boolean | null
          track_regulatory: boolean | null
          track_seo: boolean | null
          track_social: boolean | null
          track_tech_stack: boolean | null
          updated_at: string | null
        }
        Insert: {
          added_at?: string | null
          brand_id: string
          competitor_id: string
          created_at?: string | null
          id?: string
          priority?: number
          track_ads?: boolean | null
          track_hiring?: boolean | null
          track_product?: boolean | null
          track_promotions?: boolean | null
          track_regulatory?: boolean | null
          track_seo?: boolean | null
          track_social?: boolean | null
          track_tech_stack?: boolean | null
          updated_at?: string | null
        }
        Update: {
          added_at?: string | null
          brand_id?: string
          competitor_id?: string
          created_at?: string | null
          id?: string
          priority?: number
          track_ads?: boolean | null
          track_hiring?: boolean | null
          track_product?: boolean | null
          track_promotions?: boolean | null
          track_regulatory?: boolean | null
          track_seo?: boolean | null
          track_social?: boolean | null
          track_tech_stack?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_competitors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_competitors_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_preferences: {
        Row: {
          brand_id: string
          created_at: string | null
          customer_intel_enabled: boolean | null
          geo_aeo_enabled: boolean | null
          hiring_signals_enabled: boolean | null
          id: string
          product_intel_enabled: boolean | null
          promotions_enabled: boolean | null
          regulatory_enabled: boolean | null
          social_ads_enabled: boolean | null
          traffic_seo_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          customer_intel_enabled?: boolean | null
          geo_aeo_enabled?: boolean | null
          hiring_signals_enabled?: boolean | null
          id?: string
          product_intel_enabled?: boolean | null
          promotions_enabled?: boolean | null
          regulatory_enabled?: boolean | null
          social_ads_enabled?: boolean | null
          traffic_seo_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          customer_intel_enabled?: boolean | null
          geo_aeo_enabled?: boolean | null
          hiring_signals_enabled?: boolean | null
          id?: string
          product_intel_enabled?: boolean | null
          promotions_enabled?: boolean | null
          regulatory_enabled?: boolean | null
          social_ads_enabled?: boolean | null
          traffic_seo_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_preferences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          domain: string
          id: string
          industry: string
          is_active: boolean | null
          logo_url: string | null
          market: string[]
          name: string
          onboarding_completed_at: string | null
          organisation_id: string
          positioning_statement: string | null
          primary_colour: string | null
          scan_frequency: string | null
          slug: string
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          domain: string
          id?: string
          industry?: string
          is_active?: boolean | null
          logo_url?: string | null
          market?: string[]
          name: string
          onboarding_completed_at?: string | null
          organisation_id: string
          positioning_statement?: string | null
          primary_colour?: string | null
          scan_frequency?: string | null
          slug: string
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          domain?: string
          id?: string
          industry?: string
          is_active?: boolean | null
          logo_url?: string | null
          market?: string[]
          name?: string
          onboarding_completed_at?: string | null
          organisation_id?: string
          positioning_statement?: string | null
          primary_colour?: string | null
          scan_frequency?: string | null
          slug?: string
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          last_message_at: string | null
          message_count: number | null
          profile_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          profile_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          message_count?: number | null
          profile_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          cost_usd: number | null
          created_at: string | null
          id: string
          inline_data: Json | null
          model_used: string | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          inline_data?: Json | null
          model_used?: string | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          inline_data?: Json | null
          model_used?: string | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_events: {
        Row: {
          brand_id: string | null
          created_at: string | null
          event_type: string
          from_plan: string | null
          id: string
          mrr_delta_kobo: number | null
          occurred_at: string
          organisation_id: string
          reason: string | null
          to_plan: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          event_type: string
          from_plan?: string | null
          id?: string
          mrr_delta_kobo?: number | null
          occurred_at?: string
          organisation_id: string
          reason?: string | null
          to_plan?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          event_type?: string
          from_plan?: string | null
          id?: string
          mrr_delta_kobo?: number | null
          occurred_at?: string
          organisation_id?: string
          reason?: string | null
          to_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "churn_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churn_events_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_changes: {
        Row: {
          change_type: string
          competitor_id: string
          created_at: string | null
          detail: Json | null
          detected_at: string
          evidence_hash: string | null
          id: string
          impact_level: string | null
          processed: boolean
          processed_at: string | null
          source_url: string | null
          summary: string
        }
        Insert: {
          change_type: string
          competitor_id: string
          created_at?: string | null
          detail?: Json | null
          detected_at?: string
          evidence_hash?: string | null
          id?: string
          impact_level?: string | null
          processed?: boolean
          processed_at?: string | null
          source_url?: string | null
          summary: string
        }
        Update: {
          change_type?: string
          competitor_id?: string
          created_at?: string | null
          detail?: Json | null
          detected_at?: string
          evidence_hash?: string | null
          id?: string
          impact_level?: string | null
          processed?: boolean
          processed_at?: string | null
          source_url?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_changes_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_profiles: {
        Row: {
          active_ads_count: number | null
          aggression_score: number | null
          competitor_id: string
          created_at: string | null
          domain_authority: number | null
          estimated_monthly_traffic: number | null
          id: string
          organic_traffic_pct: number | null
          paid_traffic_pct: number | null
          raw_data: Json | null
          reach_score: number | null
          scan_week: string
          social_followers_total: number | null
          sov_pct: number | null
          tech_stack_count: number | null
          threat_score: number | null
          updated_at: string | null
        }
        Insert: {
          active_ads_count?: number | null
          aggression_score?: number | null
          competitor_id: string
          created_at?: string | null
          domain_authority?: number | null
          estimated_monthly_traffic?: number | null
          id?: string
          organic_traffic_pct?: number | null
          paid_traffic_pct?: number | null
          raw_data?: Json | null
          reach_score?: number | null
          scan_week: string
          social_followers_total?: number | null
          sov_pct?: number | null
          tech_stack_count?: number | null
          threat_score?: number | null
          updated_at?: string | null
        }
        Update: {
          active_ads_count?: number | null
          aggression_score?: number | null
          competitor_id?: string
          created_at?: string | null
          domain_authority?: number | null
          estimated_monthly_traffic?: number | null
          id?: string
          organic_traffic_pct?: number | null
          paid_traffic_pct?: number | null
          raw_data?: Json | null
          reach_score?: number | null
          scan_week?: string
          social_followers_total?: number | null
          sov_pct?: number | null
          tech_stack_count?: number | null
          threat_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_profiles_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string | null
          domain: string
          first_seen_at: string | null
          id: string
          industry: string | null
          last_scanned_at: string | null
          logo_url: string | null
          name: string
          primary_market: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          first_seen_at?: string | null
          id?: string
          industry?: string | null
          last_scanned_at?: string | null
          logo_url?: string | null
          name: string
          primary_market?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          first_seen_at?: string | null
          id?: string
          industry?: string | null
          last_scanned_at?: string | null
          logo_url?: string | null
          name?: string
          primary_market?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cron_job_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          job_name: string
          metadata: Json | null
          schedule: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          job_name: string
          metadata?: Json | null
          schedule: string
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          job_name?: string
          metadata?: Json | null
          schedule?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      customer_intel_cache: {
        Row: {
          app_rating: number | null
          app_review_count: number | null
          brand_id: string
          competitor_id: string
          complaint_themes: Json | null
          created_at: string | null
          demographics: Json | null
          geographic_distribution: Json | null
          id: string
          raw_data: Json | null
          scan_week: string
          sentiment_score: number | null
          traffic_sources: Json | null
        }
        Insert: {
          app_rating?: number | null
          app_review_count?: number | null
          brand_id: string
          competitor_id: string
          complaint_themes?: Json | null
          created_at?: string | null
          demographics?: Json | null
          geographic_distribution?: Json | null
          id?: string
          raw_data?: Json | null
          scan_week: string
          sentiment_score?: number | null
          traffic_sources?: Json | null
        }
        Update: {
          app_rating?: number | null
          app_review_count?: number | null
          brand_id?: string
          competitor_id?: string
          complaint_themes?: Json | null
          created_at?: string | null
          demographics?: Json | null
          geographic_distribution?: Json | null
          id?: string
          raw_data?: Json | null
          scan_week?: string
          sentiment_score?: number | null
          traffic_sources?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_intel_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_intel_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_queue: {
        Row: {
          brand_id: string | null
          created_at: string | null
          failure_reason: string | null
          id: string
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          payload: Json
          retry_count: number
          scan_job_id: string | null
          status: string
          task_type: string
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload: Json
          retry_count?: number
          scan_job_id?: string | null
          status?: string
          task_type: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          retry_count?: number
          scan_job_id?: string | null
          status?: string
          task_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dead_letter_queue_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_scan_job_id_fkey"
            columns: ["scan_job_id"]
            isOneToOne: false
            referencedRelation: "scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          char_end: number | null
          char_start: number | null
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          page_number: number | null
          section_title: string | null
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          section_title?: string | null
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          section_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "regulatory_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_logins: {
        Row: {
          attempted_at: string | null
          attempted_email: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          location: string | null
          reason: string | null
          status: string
        }
        Insert: {
          attempted_at?: string | null
          attempted_email?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          location?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          attempted_at?: string | null
          attempted_email?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          location?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      feature_health_logs: {
        Row: {
          brand_id: string
          created_at: string | null
          feature_category: string
          feature_name: string
          feature_tier: string
          id: string
          resolution_suggested: string | null
          root_cause: string | null
          scan_job_id: string
          scan_week: string
          status: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          feature_category: string
          feature_name: string
          feature_tier?: string
          id?: string
          resolution_suggested?: string | null
          root_cause?: string | null
          scan_job_id: string
          scan_week: string
          status: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          feature_category?: string
          feature_name?: string
          feature_tier?: string
          id?: string
          resolution_suggested?: string | null
          root_cause?: string | null
          scan_job_id?: string
          scan_week?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_health_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_health_logs_scan_job_id_fkey"
            columns: ["scan_job_id"]
            isOneToOne: false
            referencedRelation: "scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_assets: {
        Row: {
          asset_type: string
          brand_id: string
          content: Json
          created_at: string | null
          deleted_at: string | null
          generation_cost_usd: number | null
          id: string
          is_pinned: boolean | null
          is_pre_generated: boolean | null
          model_used: string | null
          moderation_checked_at: string | null
          moderation_flagged: boolean
          moderation_result: Json | null
          prompt_version: string | null
          recommendation_id: string | null
          scan_week: string | null
          share_expires_at: string | null
          share_token: string | null
          title: string
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          asset_type: string
          brand_id: string
          content: Json
          created_at?: string | null
          deleted_at?: string | null
          generation_cost_usd?: number | null
          id?: string
          is_pinned?: boolean | null
          is_pre_generated?: boolean | null
          model_used?: string | null
          moderation_checked_at?: string | null
          moderation_flagged?: boolean
          moderation_result?: Json | null
          prompt_version?: string | null
          recommendation_id?: string | null
          scan_week?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          title: string
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          asset_type?: string
          brand_id?: string
          content?: Json
          created_at?: string | null
          deleted_at?: string | null
          generation_cost_usd?: number | null
          id?: string
          is_pinned?: boolean | null
          is_pre_generated?: boolean | null
          model_used?: string | null
          moderation_checked_at?: string | null
          moderation_flagged?: boolean
          moderation_result?: Json | null
          prompt_version?: string | null
          recommendation_id?: string | null
          scan_week?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_assets_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_cache: {
        Row: {
          ai_visibility_score: number | null
          brand_id: string
          chatgpt_checked_at: string | null
          chatgpt_mentioned: boolean | null
          chatgpt_position: number | null
          chatgpt_response_sample: string | null
          chatgpt_sentiment: string | null
          claude_checked_at: string | null
          claude_mentioned: boolean | null
          claude_position: number | null
          claude_response_sample: string | null
          claude_sentiment: string | null
          competitor_ai_scores: Json | null
          created_at: string | null
          featured_snippets: Json | null
          gemini_checked_at: string | null
          gemini_mentioned: boolean | null
          gemini_position: number | null
          gemini_response_sample: string | null
          gemini_sentiment: string | null
          grok_checked_at: string | null
          grok_mentioned: boolean | null
          grok_position: number | null
          grok_sentiment: string | null
          id: string
          paa_appearances: Json | null
          perplexity_checked_at: string | null
          perplexity_mentioned: boolean | null
          perplexity_position: number | null
          perplexity_response_sample: string | null
          perplexity_sentiment: string | null
          raw_data: Json | null
          scan_week: string
          score_change_wow: number | null
          top_ai_mentions: Json | null
        }
        Insert: {
          ai_visibility_score?: number | null
          brand_id: string
          chatgpt_checked_at?: string | null
          chatgpt_mentioned?: boolean | null
          chatgpt_position?: number | null
          chatgpt_response_sample?: string | null
          chatgpt_sentiment?: string | null
          claude_checked_at?: string | null
          claude_mentioned?: boolean | null
          claude_position?: number | null
          claude_response_sample?: string | null
          claude_sentiment?: string | null
          competitor_ai_scores?: Json | null
          created_at?: string | null
          featured_snippets?: Json | null
          gemini_checked_at?: string | null
          gemini_mentioned?: boolean | null
          gemini_position?: number | null
          gemini_response_sample?: string | null
          gemini_sentiment?: string | null
          grok_checked_at?: string | null
          grok_mentioned?: boolean | null
          grok_position?: number | null
          grok_sentiment?: string | null
          id?: string
          paa_appearances?: Json | null
          perplexity_checked_at?: string | null
          perplexity_mentioned?: boolean | null
          perplexity_position?: number | null
          perplexity_response_sample?: string | null
          perplexity_sentiment?: string | null
          raw_data?: Json | null
          scan_week: string
          score_change_wow?: number | null
          top_ai_mentions?: Json | null
        }
        Update: {
          ai_visibility_score?: number | null
          brand_id?: string
          chatgpt_checked_at?: string | null
          chatgpt_mentioned?: boolean | null
          chatgpt_position?: number | null
          chatgpt_response_sample?: string | null
          chatgpt_sentiment?: string | null
          claude_checked_at?: string | null
          claude_mentioned?: boolean | null
          claude_position?: number | null
          claude_response_sample?: string | null
          claude_sentiment?: string | null
          competitor_ai_scores?: Json | null
          created_at?: string | null
          featured_snippets?: Json | null
          gemini_checked_at?: string | null
          gemini_mentioned?: boolean | null
          gemini_position?: number | null
          gemini_response_sample?: string | null
          gemini_sentiment?: string | null
          grok_checked_at?: string | null
          grok_mentioned?: boolean | null
          grok_position?: number | null
          grok_sentiment?: string | null
          id?: string
          paa_appearances?: Json | null
          perplexity_checked_at?: string | null
          perplexity_mentioned?: boolean | null
          perplexity_position?: number | null
          perplexity_response_sample?: string | null
          perplexity_sentiment?: string | null
          raw_data?: Json | null
          scan_week?: string
          score_change_wow?: number | null
          top_ai_mentions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "geo_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_query_templates: {
        Row: {
          context_injection: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_brand_specific: boolean | null
          market: string | null
          query_category: string
          query_text: string
          updated_at: string | null
        }
        Insert: {
          context_injection?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_brand_specific?: boolean | null
          market?: string | null
          query_category: string
          query_text: string
          updated_at?: string | null
        }
        Update: {
          context_injection?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_brand_specific?: boolean | null
          market?: string | null
          query_category?: string
          query_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hiring_signals_cache: {
        Row: {
          brand_id: string
          competitor_id: string
          created_at: string | null
          geographic_expansion: Json | null
          id: string
          interpreted_signals: Json | null
          raw_data: Json | null
          roles: Json | null
          scan_week: string
          signal_types: string[] | null
        }
        Insert: {
          brand_id: string
          competitor_id: string
          created_at?: string | null
          geographic_expansion?: Json | null
          id?: string
          interpreted_signals?: Json | null
          raw_data?: Json | null
          roles?: Json | null
          scan_week: string
          signal_types?: string[] | null
        }
        Update: {
          brand_id?: string
          competitor_id?: string
          created_at?: string | null
          geographic_expansion?: Json | null
          id?: string
          interpreted_signals?: Json | null
          raw_data?: Json | null
          roles?: Json | null
          scan_week?: string
          signal_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "hiring_signals_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hiring_signals_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_logs: {
        Row: {
          created_at: string | null
          detail: Json | null
          document_id: string | null
          error_message: string | null
          id: string
          status: string
          step: string
          step_timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          status: string
          step: string
          step_timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          status?: string
          step?: string
          step_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "regulatory_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      model_router_config: {
        Row: {
          circuit_breaker_threshold_pct: number | null
          created_at: string | null
          daily_spend_cap_usd: number | null
          fallback_model: string | null
          id: string
          is_active: boolean | null
          max_tokens: number | null
          primary_model: string
          requests_per_min: number | null
          task_type: string
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          circuit_breaker_threshold_pct?: number | null
          created_at?: string | null
          daily_spend_cap_usd?: number | null
          fallback_model?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          primary_model: string
          requests_per_min?: number | null
          task_type: string
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          circuit_breaker_threshold_pct?: number | null
          created_at?: string | null
          daily_spend_cap_usd?: number | null
          fallback_model?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          primary_model?: string
          requests_per_min?: number | null
          task_type?: string
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organisation_members: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          organisation_id: string
          profile_id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organisation_id: string
          profile_id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organisation_id?: string
          profile_id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          mrr_kobo: number | null
          name: string
          plan: string
          plan_renews_at: string | null
          plan_started_at: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          mrr_kobo?: number | null
          name: string
          plan?: string
          plan_renews_at?: string | null
          plan_started_at?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          mrr_kobo?: number | null
          name?: string
          plan?: string
          plan_renews_at?: string | null
          plan_started_at?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount_kobo: number
          created_at: string | null
          currency: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          invoice_url: string | null
          organisation_id: string
          paid_at: string | null
          payment_provider_reference: string | null
          r2_invoice_path: string | null
          status: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string | null
          currency?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_url?: string | null
          organisation_id: string
          paid_at?: string | null
          payment_provider_reference?: string | null
          r2_invoice_path?: string | null
          status: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string | null
          currency?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_url?: string | null
          organisation_id?: string
          paid_at?: string | null
          payment_provider_reference?: string | null
          r2_invoice_path?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_memory: {
        Row: {
          brand_id: string
          confidence_score: number | null
          created_at: string | null
          description: string
          first_observed_week: string | null
          id: string
          is_active: boolean | null
          last_confirmed_week: string | null
          memory_type: string
          scan_weeks_observed: number | null
          supporting_evidence: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          confidence_score?: number | null
          created_at?: string | null
          description: string
          first_observed_week?: string | null
          id?: string
          is_active?: boolean | null
          last_confirmed_week?: string | null
          memory_type: string
          scan_weeks_observed?: number | null
          supporting_evidence?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          confidence_score?: number | null
          created_at?: string | null
          description?: string
          first_observed_week?: string | null
          id?: string
          is_active?: boolean | null
          last_confirmed_week?: string | null
          memory_type?: string
          scan_weeks_observed?: number | null
          supporting_evidence?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_memory_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intel_cache: {
        Row: {
          aviator_bonus_structure: Json | null
          aviator_promo_active: boolean | null
          brand_id: string
          casino_status: string | null
          competitor_id: string
          crash_games_status: string | null
          created_at: string | null
          id: string
          lottery_status: string | null
          new_products_detected: string[] | null
          odds_competitiveness_score: number | null
          raw_data: Json | null
          scan_week: string
          sports_betting_status: string | null
        }
        Insert: {
          aviator_bonus_structure?: Json | null
          aviator_promo_active?: boolean | null
          brand_id: string
          casino_status?: string | null
          competitor_id: string
          crash_games_status?: string | null
          created_at?: string | null
          id?: string
          lottery_status?: string | null
          new_products_detected?: string[] | null
          odds_competitiveness_score?: number | null
          raw_data?: Json | null
          scan_week: string
          sports_betting_status?: string | null
        }
        Update: {
          aviator_bonus_structure?: Json | null
          aviator_promo_active?: boolean | null
          brand_id?: string
          casino_status?: string | null
          competitor_id?: string
          crash_games_status?: string | null
          created_at?: string | null
          id?: string
          lottery_status?: string | null
          new_products_detected?: string[] | null
          odds_competitiveness_score?: number | null
          raw_data?: Json | null
          scan_week?: string
          sports_betting_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_intel_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_intel_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      promotions_cache: {
        Row: {
          bonus_amount_kobo: number | null
          brand_id: string
          competitor_id: string
          created_at: string | null
          evidence_hash: string | null
          id: string
          is_new: boolean | null
          promo_title: string | null
          promo_type: string | null
          promo_url: string | null
          raw_data: Json | null
          scan_week: string
          scraped_at: string | null
          source_url: string | null
          wagering_requirement: number | null
          wow_bonus_change_pct: number | null
          wow_wagering_change_pct: number | null
        }
        Insert: {
          bonus_amount_kobo?: number | null
          brand_id: string
          competitor_id: string
          created_at?: string | null
          evidence_hash?: string | null
          id?: string
          is_new?: boolean | null
          promo_title?: string | null
          promo_type?: string | null
          promo_url?: string | null
          raw_data?: Json | null
          scan_week: string
          scraped_at?: string | null
          source_url?: string | null
          wagering_requirement?: number | null
          wow_bonus_change_pct?: number | null
          wow_wagering_change_pct?: number | null
        }
        Update: {
          bonus_amount_kobo?: number | null
          brand_id?: string
          competitor_id?: string
          created_at?: string | null
          evidence_hash?: string | null
          id?: string
          is_new?: boolean | null
          promo_title?: string | null
          promo_type?: string | null
          promo_url?: string | null
          raw_data?: Json | null
          scan_week?: string
          scraped_at?: string | null
          source_url?: string | null
          wagering_requirement?: number | null
          wow_bonus_change_pct?: number | null
          wow_wagering_change_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          agent_name: string
          created_at: string | null
          deployed_at: string | null
          deployed_by: string | null
          id: string
          notes: string | null
          plain_english_config: string | null
          prompt_text: string
          rollback_from: string | null
          status: string | null
          system_prompt: string | null
          version: string
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          deployed_at?: string | null
          deployed_by?: string | null
          id?: string
          notes?: string | null
          plain_english_config?: string | null
          prompt_text: string
          rollback_from?: string | null
          status?: string | null
          system_prompt?: string | null
          version: string
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          deployed_at?: string | null
          deployed_by?: string | null
          id?: string
          notes?: string | null
          plain_english_config?: string | null
          prompt_text?: string
          rollback_from?: string | null
          status?: string | null
          system_prompt?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_deployed_by_fkey"
            columns: ["deployed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_config: {
        Row: {
          allowed: boolean
          created_at: string | null
          id: string
          permission_key: string
          role: string
          updated_at: string | null
        }
        Insert: {
          allowed?: boolean
          created_at?: string | null
          id?: string
          permission_key: string
          role: string
          updated_at?: string | null
        }
        Update: {
          allowed?: boolean
          created_at?: string | null
          id?: string
          permission_key?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          action_plan_id: string
          assumption_flags: string[] | null
          brand_alignment_score: number | null
          brand_id: string
          category: string
          competitor_id: string | null
          compliance_score: number | null
          confidence_level: string
          confidence_score: number
          created_at: string | null
          evidence: Json | null
          evidence_traceability_score: number | null
          full_analysis: string | null
          headline: string
          id: string
          is_direct_evidence: boolean | null
          is_on_demand: boolean
          logic_quality_score: number | null
          rank: number
          scan_week: string
          snoozed_until: string | null
          status: string | null
          status_changed_at: string | null
          status_changed_by: string | null
          trigger_reason: string
          updated_at: string | null
          urgency: string
        }
        Insert: {
          action_plan_id: string
          assumption_flags?: string[] | null
          brand_alignment_score?: number | null
          brand_id: string
          category: string
          competitor_id?: string | null
          compliance_score?: number | null
          confidence_level: string
          confidence_score: number
          created_at?: string | null
          evidence?: Json | null
          evidence_traceability_score?: number | null
          full_analysis?: string | null
          headline: string
          id?: string
          is_direct_evidence?: boolean | null
          is_on_demand?: boolean
          logic_quality_score?: number | null
          rank?: number
          scan_week: string
          snoozed_until?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          trigger_reason: string
          updated_at?: string | null
          urgency?: string
        }
        Update: {
          action_plan_id?: string
          assumption_flags?: string[] | null
          brand_alignment_score?: number | null
          brand_id?: string
          category?: string
          competitor_id?: string | null
          compliance_score?: number | null
          confidence_level?: string
          confidence_score?: number
          created_at?: string | null
          evidence?: Json | null
          evidence_traceability_score?: number | null
          full_analysis?: string | null
          headline?: string
          id?: string
          is_direct_evidence?: boolean | null
          is_on_demand?: boolean
          logic_quality_score?: number | null
          rank?: number
          scan_week?: string
          snoozed_until?: string | null
          status?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          trigger_reason?: string
          updated_at?: string | null
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_status_changed_by_fkey"
            columns: ["status_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_cache: {
        Row: {
          age_verification_status: string | null
          bonus_terms_status: string | null
          brand_id: string
          competitor_id: string
          compliance_score: number | null
          created_at: string | null
          data_privacy_status: string | null
          id: string
          licence_display_status: string | null
          market: string
          raw_data: Json | null
          responsible_gambling_status: string | null
          scan_week: string
          violations: Json | null
          withdrawal_terms_status: string | null
        }
        Insert: {
          age_verification_status?: string | null
          bonus_terms_status?: string | null
          brand_id: string
          competitor_id: string
          compliance_score?: number | null
          created_at?: string | null
          data_privacy_status?: string | null
          id?: string
          licence_display_status?: string | null
          market: string
          raw_data?: Json | null
          responsible_gambling_status?: string | null
          scan_week: string
          violations?: Json | null
          withdrawal_terms_status?: string | null
        }
        Update: {
          age_verification_status?: string | null
          bonus_terms_status?: string | null
          brand_id?: string
          competitor_id?: string
          compliance_score?: number | null
          created_at?: string | null
          data_privacy_status?: string | null
          id?: string
          licence_display_status?: string | null
          market?: string
          raw_data?: Json | null
          responsible_gambling_status?: string | null
          scan_week?: string
          violations?: Json | null
          withdrawal_terms_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_documents: {
        Row: {
          chunk_count: number | null
          country: string
          created_at: string | null
          document_name: string
          document_type: string
          effective_date: string | null
          embedding_status: string | null
          file_hash: string
          file_size_bytes: number | null
          id: string
          is_active: boolean | null
          last_verified_at: string | null
          needs_review: boolean | null
          page_count: number | null
          r2_path: string
          regulatory_body: string
          review_notes: string | null
          source_url: string
          superseded_by: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          chunk_count?: number | null
          country: string
          created_at?: string | null
          document_name: string
          document_type: string
          effective_date?: string | null
          embedding_status?: string | null
          file_hash: string
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          needs_review?: boolean | null
          page_count?: number | null
          r2_path: string
          regulatory_body: string
          review_notes?: string | null
          source_url: string
          superseded_by?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          chunk_count?: number | null
          country?: string
          created_at?: string | null
          document_name?: string
          document_type?: string
          effective_date?: string | null
          embedding_status?: string | null
          file_hash?: string
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean | null
          last_verified_at?: string | null
          needs_review?: boolean | null
          page_count?: number | null
          r2_path?: string
          regulatory_body?: string
          review_notes?: string | null
          source_url?: string
          superseded_by?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "regulatory_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          brand_id: string
          created_at: string | null
          day_of_week: string | null
          format: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          recipients: string[]
          report_type: string
          time_of_day: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          day_of_week?: string | null
          format?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          recipients?: string[]
          report_type: string
          time_of_day?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          day_of_week?: string | null
          format?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          recipients?: string[]
          report_type?: string
          time_of_day?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          brand_id: string
          created_at: string | null
          deleted_at: string | null
          generated_by: string | null
          id: string
          page_count: number | null
          r2_path: string | null
          report_type: string
          scan_week: string | null
          share_expires_at: string | null
          share_token: string | null
          title: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          deleted_at?: string | null
          generated_by?: string | null
          id?: string
          page_count?: number | null
          r2_path?: string | null
          report_type: string
          scan_week?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          title: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          deleted_at?: string | null
          generated_by?: string | null
          id?: string
          page_count?: number | null
          r2_path?: string | null
          report_type?: string
          scan_week?: string | null
          share_expires_at?: string | null
          share_token?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_metrics: {
        Row: {
          active_brands: number | null
          api_cost_kobo: number | null
          arpb_kobo: number | null
          churned_brands: number | null
          created_at: string | null
          gross_margin_pct: number | null
          id: string
          infra_cost_kobo: number | null
          mrr_kobo: number | null
          new_brands: number | null
          period_week: string
          revenue_kobo: number | null
        }
        Insert: {
          active_brands?: number | null
          api_cost_kobo?: number | null
          arpb_kobo?: number | null
          churned_brands?: number | null
          created_at?: string | null
          gross_margin_pct?: number | null
          id?: string
          infra_cost_kobo?: number | null
          mrr_kobo?: number | null
          new_brands?: number | null
          period_week: string
          revenue_kobo?: number | null
        }
        Update: {
          active_brands?: number | null
          api_cost_kobo?: number | null
          arpb_kobo?: number | null
          churned_brands?: number | null
          created_at?: string | null
          gross_margin_pct?: number | null
          id?: string
          infra_cost_kobo?: number | null
          mrr_kobo?: number | null
          new_brands?: number | null
          period_week?: string
          revenue_kobo?: number | null
        }
        Relationships: []
      }
      scan_jobs: {
        Row: {
          brand_id: string
          completed_at: string | null
          completed_steps: string[] | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          failed_modules: string[] | null
          id: string
          partial_modules: string[] | null
          progress_percentage: number | null
          scan_week: string
          started_at: string | null
          status: string
          total_cost_usd: number | null
          triggered_by: string | null
          updated_at: string | null
        }
        Insert: {
          brand_id: string
          completed_at?: string | null
          completed_steps?: string[] | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          failed_modules?: string[] | null
          id?: string
          partial_modules?: string[] | null
          progress_percentage?: number | null
          scan_week: string
          started_at?: string | null
          status?: string
          total_cost_usd?: number | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string
          completed_at?: string | null
          completed_steps?: string[] | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          failed_modules?: string[] | null
          id?: string
          partial_modules?: string[] | null
          progress_percentage?: number | null
          scan_week?: string
          started_at?: string | null
          status?: string
          total_cost_usd?: number | null
          triggered_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_cache: {
        Row: {
          brand_id: string
          competitor_id: string
          content_gaps: Json | null
          created_at: string | null
          domain_authority: number | null
          estimated_traffic: number | null
          google_ads_data: Json | null
          id: string
          keyword_gaps: Json | null
          organic_traffic: number | null
          paid_traffic: number | null
          raw_data: Json | null
          scan_week: string
          serp_positions: Json | null
        }
        Insert: {
          brand_id: string
          competitor_id: string
          content_gaps?: Json | null
          created_at?: string | null
          domain_authority?: number | null
          estimated_traffic?: number | null
          google_ads_data?: Json | null
          id?: string
          keyword_gaps?: Json | null
          organic_traffic?: number | null
          paid_traffic?: number | null
          raw_data?: Json | null
          scan_week: string
          serp_positions?: Json | null
        }
        Update: {
          brand_id?: string
          competitor_id?: string
          content_gaps?: Json | null
          created_at?: string | null
          domain_authority?: number | null
          estimated_traffic?: number | null
          google_ads_data?: Json | null
          id?: string
          keyword_gaps?: Json | null
          organic_traffic?: number | null
          paid_traffic?: number | null
          raw_data?: Json | null
          scan_week?: string
          serp_positions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      social_cache: {
        Row: {
          active_ads_count: number | null
          ads_data: Json | null
          avg_engagement_rate: number | null
          brand_id: string
          competitor_id: string
          created_at: string | null
          dominant_content_theme: string | null
          facebook_followers: number | null
          id: string
          instagram_followers: number | null
          raw_data: Json | null
          scan_week: string
          scraped_at: string | null
          tiktok_followers: number | null
          twitter_followers: number | null
          weekly_posts: number | null
          youtube_followers: number | null
        }
        Insert: {
          active_ads_count?: number | null
          ads_data?: Json | null
          avg_engagement_rate?: number | null
          brand_id: string
          competitor_id: string
          created_at?: string | null
          dominant_content_theme?: string | null
          facebook_followers?: number | null
          id?: string
          instagram_followers?: number | null
          raw_data?: Json | null
          scan_week: string
          scraped_at?: string | null
          tiktok_followers?: number | null
          twitter_followers?: number | null
          weekly_posts?: number | null
          youtube_followers?: number | null
        }
        Update: {
          active_ads_count?: number | null
          ads_data?: Json | null
          avg_engagement_rate?: number | null
          brand_id?: string
          competitor_id?: string
          created_at?: string | null
          dominant_content_theme?: string | null
          facebook_followers?: number | null
          id?: string
          instagram_followers?: number | null
          raw_data?: Json | null
          scan_week?: string
          scraped_at?: string | null
          tiktok_followers?: number | null
          twitter_followers?: number | null
          weekly_posts?: number | null
          youtube_followers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mrr_kobo: number | null
          organisation_id: string
          payment_provider: string | null
          payment_provider_subscription_id: string | null
          plan: string
          status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mrr_kobo?: number | null
          organisation_id: string
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan?: string
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mrr_kobo?: number | null
          organisation_id?: string
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan?: string
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health: {
        Row: {
          checked_at: string | null
          created_at: string | null
          detail: string | null
          id: string
          service_name: string
          status: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          service_name: string
          status: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      tech_stack_cache: {
        Row: {
          ad_networks: string[] | null
          analytics_tools: string[] | null
          cdn_providers: string[] | null
          changes_detected: Json | null
          competitor_id: string
          created_at: string | null
          crm_tools: string[] | null
          id: string
          payment_gateways: string[] | null
          raw_response: Json | null
          scan_week: string
          scanned_at: string | null
          technologies: Json
        }
        Insert: {
          ad_networks?: string[] | null
          analytics_tools?: string[] | null
          cdn_providers?: string[] | null
          changes_detected?: Json | null
          competitor_id: string
          created_at?: string | null
          crm_tools?: string[] | null
          id?: string
          payment_gateways?: string[] | null
          raw_response?: Json | null
          scan_week: string
          scanned_at?: string | null
          technologies?: Json
        }
        Update: {
          ad_networks?: string[] | null
          analytics_tools?: string[] | null
          cdn_providers?: string[] | null
          changes_detected?: Json | null
          competitor_id?: string
          created_at?: string | null
          crm_tools?: string[] | null
          id?: string
          payment_gateways?: string[] | null
          raw_response?: Json | null
          scan_week?: string
          scanned_at?: string | null
          technologies?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tech_stack_cache_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          api_calls_limit: number | null
          api_calls_used: number | null
          assets_generated: number | null
          assets_limit: number | null
          created_at: string | null
          id: string
          organisation_id: string
          period_end: string
          period_start: string
          reports_downloaded: number | null
          reports_limit: number | null
          updated_at: string | null
        }
        Insert: {
          api_calls_limit?: number | null
          api_calls_used?: number | null
          assets_generated?: number | null
          assets_limit?: number | null
          created_at?: string | null
          id?: string
          organisation_id: string
          period_end: string
          period_start: string
          reports_downloaded?: number | null
          reports_limit?: number | null
          updated_at?: string | null
        }
        Update: {
          api_calls_limit?: number | null
          api_calls_used?: number | null
          assets_generated?: number | null
          assets_limit?: number | null
          created_at?: string | null
          id?: string
          organisation_id?: string
          period_end?: string
          period_start?: string
          reports_downloaded?: number | null
          reports_limit?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_cache: {
        Row: {
          active_ads_count: number | null
          ads_data: Json | null
          aggression_score: number | null
          ai_visibility_score: number | null
          ai_visibility_trend: number | null
          brand_id: string
          cached_at: string | null
          competitor_states: Json | null
          competitors_tracked: number | null
          created_at: string | null
          customer_data: Json | null
          expires_at: string | null
          geo_aeo_data: Json | null
          hiring_data: Json | null
          id: string
          product_data: Json | null
          promo_changes_this_week: number | null
          promotions_data: Json | null
          radar_data: Json | null
          reach_score: number | null
          regulatory_data: Json | null
          scan_job_id: string | null
          scan_week: string
          social_data: Json | null
          sov_pct: number | null
          tech_stack_data: Json | null
          threat_level: string | null
          threat_reasons: string[] | null
          threat_score: number | null
          traffic_seo_data: Json | null
          updated_at: string | null
        }
        Insert: {
          active_ads_count?: number | null
          ads_data?: Json | null
          aggression_score?: number | null
          ai_visibility_score?: number | null
          ai_visibility_trend?: number | null
          brand_id: string
          cached_at?: string | null
          competitor_states?: Json | null
          competitors_tracked?: number | null
          created_at?: string | null
          customer_data?: Json | null
          expires_at?: string | null
          geo_aeo_data?: Json | null
          hiring_data?: Json | null
          id?: string
          product_data?: Json | null
          promo_changes_this_week?: number | null
          promotions_data?: Json | null
          radar_data?: Json | null
          reach_score?: number | null
          regulatory_data?: Json | null
          scan_job_id?: string | null
          scan_week: string
          social_data?: Json | null
          sov_pct?: number | null
          tech_stack_data?: Json | null
          threat_level?: string | null
          threat_reasons?: string[] | null
          threat_score?: number | null
          traffic_seo_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          active_ads_count?: number | null
          ads_data?: Json | null
          aggression_score?: number | null
          ai_visibility_score?: number | null
          ai_visibility_trend?: number | null
          brand_id?: string
          cached_at?: string | null
          competitor_states?: Json | null
          competitors_tracked?: number | null
          created_at?: string | null
          customer_data?: Json | null
          expires_at?: string | null
          geo_aeo_data?: Json | null
          hiring_data?: Json | null
          id?: string
          product_data?: Json | null
          promo_changes_this_week?: number | null
          promotions_data?: Json | null
          radar_data?: Json | null
          reach_score?: number | null
          regulatory_data?: Json | null
          scan_job_id?: string | null
          scan_week?: string
          social_data?: Json | null
          sov_pct?: number | null
          tech_stack_data?: Json | null
          threat_level?: string | null
          threat_reasons?: string[] | null
          threat_score?: number | null
          traffic_seo_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_cache_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_cache_scan_job_id_fkey"
            columns: ["scan_job_id"]
            isOneToOne: false
            referencedRelation: "scan_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_brand_ids: { Args: never; Returns: string[] }
      get_user_organisation_id: { Args: never; Returns: string }
      provision_brand: {
        Args: {
          p_brand_name: string
          p_domain: string
          p_industry?: string
          p_markets: string[]
          p_org_name: string
          p_tier?: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
