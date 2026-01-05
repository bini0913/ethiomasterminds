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
      achievements: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          rarity: string | null
          requirement_type: string
          requirement_value: number
          reward_coins: number | null
          reward_xp: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          rarity?: string | null
          requirement_type: string
          requirement_value?: number
          reward_coins?: number | null
          reward_xp?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          rarity?: string | null
          requirement_type?: string
          requirement_value?: number
          reward_coins?: number | null
          reward_xp?: number | null
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
      avatar_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          preview: string
          price_coins: number | null
          price_gems: number | null
          rarity: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          preview: string
          price_coins?: number | null
          price_gems?: number | null
          rarity?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preview?: string
          price_coins?: number | null
          price_gems?: number | null
          rarity?: string | null
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
      daily_missions: {
        Row: {
          created_at: string
          description: string
          icon: string | null
          id: string
          is_active: boolean | null
          mission_type: string
          reward_coins: number | null
          reward_xp: number | null
          target_value: number
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          mission_type: string
          reward_coins?: number | null
          reward_xp?: number | null
          target_value?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          mission_type?: string
          reward_coins?: number | null
          reward_xp?: number | null
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lobby_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      multiplayer_rooms: {
        Row: {
          created_at: string
          current_question: number | null
          difficulty: string | null
          finished_at: string | null
          game_mode: string | null
          host_id: string
          id: string
          max_players: number
          name: string
          password: string | null
          question_count: number | null
          started_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          current_question?: number | null
          difficulty?: string | null
          finished_at?: string | null
          game_mode?: string | null
          host_id: string
          id?: string
          max_players?: number
          name: string
          password?: string | null
          question_count?: number | null
          started_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          current_question?: number | null
          difficulty?: string | null
          finished_at?: string | null
          game_mode?: string | null
          host_id?: string
          id?: string
          max_players?: number
          name?: string
          password?: string | null
          question_count?: number | null
          started_at?: string | null
          status?: string
          subject?: string | null
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
      room_players: {
        Row: {
          id: string
          is_ready: boolean | null
          joined_at: string
          room_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string
          room_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          id?: string
          is_ready?: boolean | null
          joined_at?: string
          room_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          id: string
          rank: number | null
          registered_at: string
          score: number | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          rank?: number | null
          registered_at?: string
          score?: number | null
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          rank?: number | null
          registered_at?: string
          score?: number | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          difficulty: string | null
          end_time: string
          entry_fee_coins: number | null
          entry_fee_gems: number | null
          id: string
          max_participants: number | null
          name: string
          prize_coins: number | null
          prize_description: string | null
          prize_gems: number | null
          start_time: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          difficulty?: string | null
          end_time: string
          entry_fee_coins?: number | null
          entry_fee_gems?: number | null
          id?: string
          max_participants?: number | null
          name: string
          prize_coins?: number | null
          prize_description?: string | null
          prize_gems?: number | null
          start_time: string
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty?: string | null
          end_time?: string
          entry_fee_coins?: number | null
          entry_fee_gems?: number | null
          id?: string
          max_participants?: number | null
          name?: string
          prize_coins?: number | null
          prize_description?: string | null
          prize_gems?: number | null
          start_time?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          completed: boolean | null
          id: string
          progress: number
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          completed?: boolean | null
          id?: string
          progress?: number
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          completed?: boolean | null
          id?: string
          progress?: number
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_currency: {
        Row: {
          coins: number
          created_at: string
          gems: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          gems?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          gems?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          equipped: boolean | null
          id: string
          item_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          equipped?: boolean | null
          id?: string
          item_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          equipped?: boolean | null
          id?: string
          item_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          claimed: boolean | null
          completed: boolean | null
          id: string
          mission_date: string
          mission_id: string
          progress: number
          user_id: string
        }
        Insert: {
          claimed?: boolean | null
          completed?: boolean | null
          id?: string
          mission_date?: string
          mission_id: string
          progress?: number
          user_id: string
        }
        Update: {
          claimed?: boolean | null
          completed?: boolean | null
          id?: string
          mission_date?: string
          mission_id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "daily_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          id: string
          last_seen: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          last_seen?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          last_seen?: string
          status?: string
          user_id?: string
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
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      find_student_by_username: {
        Args: { search_username: string }
        Returns: {
          avatar: string
          id: string
          level: number
          name: string
          username: string
          xp: number
        }[]
      }
      get_class_students: {
        Args: { class_uuid: string }
        Returns: {
          avatar: string
          id: string
          joined_at: string
          level: number
          name: string
          username: string
          xp: number
        }[]
      }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      get_public_leaderboard: {
        Args: { limit_count?: number; timeframe?: string }
        Returns: {
          avatar: string
          id: string
          level: number
          name: string
          rank: string
          username: string
          xp: number
        }[]
      }
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
      is_student_in_class: {
        Args: { p_class_id: string; p_student_id: string }
        Returns: boolean
      }
      is_teacher_of_class: {
        Args: { p_class_id: string; p_teacher_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { p_student_id: string; p_teacher_id: string }
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
