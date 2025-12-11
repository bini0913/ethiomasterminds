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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          code_type: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_used: boolean | null
          used_by: string | null
        }
        Insert: {
          code: string
          code_type: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          used_by?: string | null
        }
        Update: {
          code?: string
          code_type?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          used_by?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          target_id: string | null
          target_type: string
          title: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          target_id?: string | null
          target_type: string
          title: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          target_id?: string | null
          target_type?: string
          title?: string
        }
        Relationships: []
      }
      class_students: {
        Row: {
          class_id: string
          id: string
          joined_at: string | null
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string | null
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_code: string
          created_at: string | null
          description: string | null
          grade: string | null
          id: string
          name: string
          subject: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          class_code: string
          created_at?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          name: string
          subject?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          class_code?: string
          created_at?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          name?: string
          subject?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      npc_settings: {
        Row: {
          accuracy_percent: number | null
          answer_speed_ms: number | null
          difficulty: string
          id: string
          intelligence_scaling: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accuracy_percent?: number | null
          answer_speed_ms?: number | null
          difficulty?: string
          id?: string
          intelligence_scaling?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accuracy_percent?: number | null
          answer_speed_ms?: number | null
          difficulty?: string
          id?: string
          intelligence_scaling?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          badges: string[] | null
          created_at: string
          education_level: string | null
          gender: string | null
          grade: string | null
          id: string
          level: number
          name: string
          rank: string | null
          updated_at: string
          username: string | null
          xp: number
        }
        Insert: {
          avatar?: string | null
          badges?: string[] | null
          created_at?: string
          education_level?: string | null
          gender?: string | null
          grade?: string | null
          id: string
          level?: number
          name: string
          rank?: string | null
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Update: {
          avatar?: string | null
          badges?: string[] | null
          created_at?: string
          education_level?: string | null
          gender?: string | null
          grade?: string | null
          id?: string
          level?: number
          name?: string
          rank?: string | null
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          explanation: string | null
          id: string
          options: Json | null
          order_index: number | null
          points: number | null
          question_text: string
          question_type: string | null
          quiz_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text: string
          question_type?: string | null
          quiz_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number | null
          points?: number | null
          question_text?: string
          question_type?: string | null
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_assignments: {
        Row: {
          assigned_by: string
          class_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          is_mandatory: boolean | null
          quiz_id: string
          student_id: string | null
        }
        Insert: {
          assigned_by: string
          class_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_mandatory?: boolean | null
          quiz_id: string
          student_id?: string | null
        }
        Update: {
          assigned_by?: string
          class_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_mandatory?: boolean | null
          quiz_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignments_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          answers: Json | null
          completed_at: string | null
          correct_answers: number
          id: string
          quiz_id: string
          score: number
          student_id: string
          time_taken: number | null
          total_questions: number
          xp_earned: number | null
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          correct_answers: number
          id?: string
          quiz_id: string
          score: number
          student_id: string
          time_taken?: number | null
          total_questions: number
          xp_earned?: number | null
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          correct_answers?: number
          id?: string
          quiz_id?: string
          score?: number
          student_id?: string
          time_taken?: number | null
          total_questions?: number
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string
          description: string | null
          difficulty: string | null
          grade: string | null
          id: string
          is_approved: boolean | null
          is_public: boolean | null
          subject: string
          time_limit: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          difficulty?: string | null
          grade?: string | null
          id?: string
          is_approved?: boolean | null
          is_public?: boolean | null
          subject: string
          time_limit?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          difficulty?: string | null
          grade?: string | null
          id?: string
          is_approved?: boolean | null
          is_public?: boolean | null
          subject?: string
          time_limit?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin" | "manager"
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
      app_role: ["student", "teacher", "admin", "manager"],
    },
  },
} as const
