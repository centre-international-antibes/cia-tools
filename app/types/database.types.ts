export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          diff: Json
          entity: string
          entity_id: string | null
          id: string
          occurred_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          diff?: Json
          entity: string
          entity_id?: string | null
          id?: string
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          diff?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          created_at: string
          eligibility: Json
          email: string
          first_name: string
          group_key: string | null
          id: string
          language: string
          last_name: string
          list_id: string
          raw: Json
        }
        Insert: {
          created_at?: string
          eligibility?: Json
          email: string
          first_name?: string
          group_key?: string | null
          id?: string
          language?: string
          last_name?: string
          list_id: string
          raw?: Json
        }
        Update: {
          created_at?: string
          eligibility?: Json
          email?: string
          first_name?: string
          group_key?: string | null
          id?: string
          language?: string
          last_name?: string
          list_id?: string
          raw?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "campaign_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_lists: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          name: string
          row_count: number
          source_file_path: string
          source_file_sha256: string
          source_filename: string
          updated_at: string
          uploaded_by: string
          warnings: Json
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          name: string
          row_count?: number
          source_file_path: string
          source_file_sha256: string
          source_filename: string
          updated_at?: string
          uploaded_by: string
          warnings?: Json
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          name?: string
          row_count?: number
          source_file_path?: string
          source_file_sha256?: string
          source_filename?: string
          updated_at?: string
          uploaded_by?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_lists_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          attempts: number
          brevo_message_id: string | null
          campaign_id: string
          contact_id: string
          created_at: string
          email: string
          error: string | null
          id: string
          last_event_at: string | null
          params: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          updated_at: string
          variant: string | null
        }
        Insert: {
          attempts?: number
          brevo_message_id?: string | null
          campaign_id: string
          contact_id: string
          created_at?: string
          email: string
          error?: string | null
          id?: string
          last_event_at?: string | null
          params?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          updated_at?: string
          variant?: string | null
        }
        Update: {
          attempts?: number
          brevo_message_id?: string | null
          campaign_id?: string
          contact_id?: string
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          last_event_at?: string | null
          params?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          client_request_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          failed_count: number
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          list_id: string
          name: string
          notes: string
          params_default: Json
          scheduled_for: string | null
          sent_at: string | null
          sent_by: string | null
          sent_count: number
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          template_overrides: Json
          template_version_id: string | null
          total_recipients: number
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          list_id: string
          name: string
          notes?: string
          params_default?: Json
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          template_overrides?: Json
          template_version_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          list_id?: string
          name?: string
          notes?: string
          params_default?: Json
          scheduled_for?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_count?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          template_overrides?: Json
          template_version_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "campaign_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "email_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          id: string
          occurred_at: string
          payload: Json
          payload_hash: string
          received_at: string
          recipient_id: string
          type: Database["public"]["Enums"]["email_event_type"]
        }
        Insert: {
          id?: string
          occurred_at?: string
          payload?: Json
          payload_hash: string
          received_at?: string
          recipient_id: string
          type: Database["public"]["Enums"]["email_event_type"]
        }
        Update: {
          id?: string
          occurred_at?: string
          payload?: Json
          payload_hash?: string
          received_at?: string
          recipient_id?: string
          type?: Database["public"]["Enums"]["email_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "email_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_versions: {
        Row: {
          compiled_html: string
          created_at: string
          created_by: string
          id: string
          mjml: string
          plaintext: string
          subject: string
          template_id: string
          variables_schema: Json
          version: number
        }
        Insert: {
          compiled_html: string
          created_at?: string
          created_by: string
          id?: string
          mjml: string
          plaintext: string
          subject: string
          template_id: string
          variables_schema?: Json
          version: number
        }
        Update: {
          compiled_html?: string
          created_at?: string
          created_by?: string
          id?: string
          mjml?: string
          plaintext?: string
          subject?: string
          template_id?: string
          variables_schema?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          current_version_id: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          language: string
          name: string
          updated_at: string
          variant: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          current_version_id?: string | null
          description?: string
          id?: string
          kind: Database["public"]["Enums"]["campaign_kind"]
          language?: string
          name: string
          updated_at?: string
          variant?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["campaign_kind"]
          language?: string
          name?: string
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_templates_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "email_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount_cents: number
          campaign_id: string | null
          contact_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          paid_at: string | null
          payzen_order_id: string
          payzen_payment_url: string | null
          raw: Json
          status: Database["public"]["Enums"]["payment_link_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          campaign_id?: string | null
          contact_id: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payzen_order_id: string
          payzen_payment_url?: string | null
          raw?: Json
          status?: Database["public"]["Enums"]["payment_link_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          campaign_id?: string | null
          contact_id?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payzen_order_id?: string
          payzen_payment_url?: string | null
          raw?: Json
          status?: Database["public"]["Enums"]["payment_link_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminder_cycles: {
        Row: {
          amount_cents: number
          client_id: string | null
          closed_at: string | null
          created_at: string
          currency: string
          email: string
          first_list_id: string | null
          id: string
          last_campaign_id: string | null
          last_list_id: string | null
          notes: string
          paid_cents: number
          payment_link_id: string | null
          proforma: string
          stage: number
          status: string
          total_cents: number | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          email: string
          first_list_id?: string | null
          id?: string
          last_campaign_id?: string | null
          last_list_id?: string | null
          notes?: string
          paid_cents?: number
          payment_link_id?: string | null
          proforma: string
          stage?: number
          status?: string
          total_cents?: number | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          client_id?: string | null
          closed_at?: string | null
          created_at?: string
          currency?: string
          email?: string
          first_list_id?: string | null
          id?: string
          last_campaign_id?: string | null
          last_list_id?: string | null
          notes?: string
          paid_cents?: number
          payment_link_id?: string | null
          proforma?: string
          stage?: number
          status?: string
          total_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_cycles_first_list_id_fkey"
            columns: ["first_list_id"]
            isOneToOne: false
            referencedRelation: "campaign_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_cycles_last_campaign_id_fkey"
            columns: ["last_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_cycles_last_list_id_fkey"
            columns: ["last_list_id"]
            isOneToOne: false
            referencedRelation: "campaign_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_cycles_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      test_sends: {
        Row: {
          brevo_message_id: string | null
          campaign_id: string | null
          created_at: string
          error: string | null
          id: string
          params: Json
          recipient_email: string
          sample_contact_id: string | null
          sent_by: string
          status: string
          template_version_id: string
        }
        Insert: {
          brevo_message_id?: string | null
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          params?: Json
          recipient_email: string
          sample_contact_id?: string | null
          sent_by: string
          status?: string
          template_version_id: string
        }
        Update: {
          brevo_message_id?: string | null
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          params?: Json
          recipient_email?: string
          sample_contact_id?: string | null
          sent_by?: string
          status?: string
          template_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_sends_sample_contact_id_fkey"
            columns: ["sample_contact_id"]
            isOneToOne: false
            referencedRelation: "campaign_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_sends_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "email_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_campaign_scope: { Args: never; Returns: boolean }
      has_scope: { Args: { scope_name: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      scope_for_kind: {
        Args: { k: Database["public"]["Enums"]["campaign_kind"] }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_kind:
        | "ats"
        | "ats_late_arrival"
        | "thanks_direct"
        | "test_fr"
        | "housing_confirmation"
        | "course_location"
        | "welcome_pack"
        | "payment_reminder"
      campaign_status:
        | "draft"
        | "queued"
        | "sending"
        | "sent"
        | "partially_failed"
        | "failed"
        | "aborted"
      email_event_type:
        | "request"
        | "delivered"
        | "opened"
        | "click"
        | "soft_bounce"
        | "hard_bounce"
        | "invalid_email"
        | "deferred"
        | "complaint"
        | "unsubscribed"
        | "blocked"
        | "error"
      payment_link_status: "pending" | "created" | "paid" | "expired" | "failed"
      recipient_status:
        | "pending"
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "soft_bounce"
        | "hard_bounce"
        | "complained"
        | "failed"
        | "skipped"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      campaign_kind: [
        "ats",
        "ats_late_arrival",
        "thanks_direct",
        "test_fr",
        "housing_confirmation",
        "course_location",
        "welcome_pack",
        "payment_reminder",
      ],
      campaign_status: [
        "draft",
        "queued",
        "sending",
        "sent",
        "partially_failed",
        "failed",
        "aborted",
      ],
      email_event_type: [
        "request",
        "delivered",
        "opened",
        "click",
        "soft_bounce",
        "hard_bounce",
        "invalid_email",
        "deferred",
        "complaint",
        "unsubscribed",
        "blocked",
        "error",
      ],
      payment_link_status: ["pending", "created", "paid", "expired", "failed"],
      recipient_status: [
        "pending",
        "queued",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "soft_bounce",
        "hard_bounce",
        "complained",
        "failed",
        "skipped",
      ],
    },
  },
} as const

