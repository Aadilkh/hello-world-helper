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
      capabilities: {
        Row: {
          created_at: string
          description: string
          domain: string
          evidence: Json
          id: string
          instructions: string
          is_core: boolean
          keywords: string[]
          name: string
          sha256: string | null
          status: string
          validated: boolean
        }
        Insert: {
          created_at?: string
          description?: string
          domain?: string
          evidence?: Json
          id?: string
          instructions?: string
          is_core?: boolean
          keywords?: string[]
          name: string
          sha256?: string | null
          status?: string
          validated?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          domain?: string
          evidence?: Json
          id?: string
          instructions?: string
          is_core?: boolean
          keywords?: string[]
          name?: string
          sha256?: string | null
          status?: string
          validated?: boolean
        }
        Relationships: []
      }
      upgrade_runs: {
        Row: {
          capability_id: string | null
          created_at: string
          id: string
          requirement: string
          status: string
          steps: Json
        }
        Insert: {
          capability_id?: string | null
          created_at?: string
          id?: string
          requirement: string
          status: string
          steps?: Json
        }
        Update: {
          capability_id?: string | null
          created_at?: string
          id?: string
          requirement?: string
          status?: string
          steps?: Json
        }
        Relationships: []
      }
      video_clips: {
        Row: {
          created_at: string
          duration_seconds: number
          error: string | null
          id: string
          job_id: string | null
          progress: number
          project_id: string
          prompt: string
          resolution: string
          scene_index: number
          started_at: string | null
          status: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          error?: string | null
          id?: string
          job_id?: string | null
          progress?: number
          project_id: string
          prompt: string
          resolution?: string
          scene_index: number
          started_at?: string | null
          status?: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          error?: string | null
          id?: string
          job_id?: string | null
          progress?: number
          project_id?: string
          prompt?: string
          resolution?: string
          scene_index?: number
          started_at?: string | null
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      video_projects: {
        Row: {
          aspect_ratio: string
          audience: string | null
          command: string | null
          created_at: string
          hook: string | null
          id: string
          idea: string
          language: string
          monetization: Json
          niche: string | null
          platform: string
          quality: string
          ref_image_paths: string[]
          research: Json
          scenes: Json
          title: string | null
          voice_note: string | null
        }
        Insert: {
          aspect_ratio?: string
          audience?: string | null
          command?: string | null
          created_at?: string
          hook?: string | null
          id?: string
          idea: string
          language?: string
          monetization?: Json
          niche?: string | null
          platform?: string
          quality?: string
          ref_image_paths?: string[]
          research?: Json
          scenes?: Json
          title?: string | null
          voice_note?: string | null
        }
        Update: {
          aspect_ratio?: string
          audience?: string | null
          command?: string | null
          created_at?: string
          hook?: string | null
          id?: string
          idea?: string
          language?: string
          monetization?: Json
          niche?: string | null
          platform?: string
          quality?: string
          ref_image_paths?: string[]
          research?: Json
          scenes?: Json
          title?: string | null
          voice_note?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
