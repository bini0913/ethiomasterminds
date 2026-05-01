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
      ai_content: {
        Row: {
          action: string
          book_id: string
          created_at: string
          id: string
          response: string
          source_excerpt: string
          source_hash: string
          user_id: string
        }
        Insert: {
          action: string
          book_id: string
          created_at?: string
          id?: string
          response?: string
          source_excerpt?: string
          source_hash: string
          user_id: string
        }
        Update: {
          action?: string
          book_id?: string
          created_at?: string
          id?: string
          response?: string
          source_excerpt?: string
          source_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_questions: {
        Row: {
          answer: string
          book_id: string
          created_at: string
          difficulty: string
          id: string
          page_number: number
          question: string
          source_excerpt: string
          user_id: string
        }
        Insert: {
          answer: string
          book_id: string
          created_at?: string
          difficulty?: string
          id?: string
          page_number?: number
          question: string
          source_excerpt?: string
          user_id: string
        }
        Update: {
          answer?: string
          book_id?: string
          created_at?: string
          difficulty?: string
          id?: string
          page_number?: number
          question?: string
          source_excerpt?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_questions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tutor_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json | null
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics: {
        Row: {
          accuracy: number | null
          average_time_per_question: number | null
          created_at: string | null
          id: string
          last_updated: string | null
          speed: number | null
          strong_topics: Json | null
          subject: string
          total_correct: number | null
          total_questions_attempted: number | null
          user_id: string
          weak_topics: Json | null
        }
        Insert: {
          accuracy?: number | null
          average_time_per_question?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          speed?: number | null
          strong_topics?: Json | null
          subject: string
          total_correct?: number | null
          total_questions_attempted?: number | null
          user_id: string
          weak_topics?: Json | null
        }
        Update: {
          accuracy?: number | null
          average_time_per_question?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          speed?: number | null
          strong_topics?: Json | null
          subject?: string
          total_correct?: number | null
          total_questions_attempted?: number | null
          user_id?: string
          weak_topics?: Json | null
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
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
      book_permissions: {
        Row: {
          book_id: string
          can_read: boolean
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          can_read?: boolean
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          can_read?: boolean
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_permissions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_uploads: {
        Row: {
          book_id: string
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          status: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          status?: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          status?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_uploads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          group_type: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          group_type?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          group_type?: string
          id?: string
          name?: string
          updated_at?: string
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
      flashcards: {
        Row: {
          answer: string
          created_at: string
          created_by: string
          difficulty: string
          grade_level: number
          id: string
          question: string
          subject: string
          topic: string
        }
        Insert: {
          answer: string
          created_at?: string
          created_by?: string
          difficulty?: string
          grade_level?: number
          id?: string
          question: string
          subject: string
          topic: string
        }
        Update: {
          answer?: string
          created_at?: string
          created_by?: string
          difficulty?: string
          grade_level?: number
          id?: string
          question?: string
          subject?: string
          topic?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
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
      group_messages: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          group_id: string
          id: string
          message_type: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          group_id: string
          id?: string
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          book_id: string
          created_at: string
          highlight_color: string
          id: string
          note: string | null
          page_number: number
          selected_text: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          highlight_color?: string
          id?: string
          note?: string | null
          page_number?: number
          selected_text: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          highlight_color?: string
          id?: string
          note?: string | null
          page_number?: number
          selected_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_dna: {
        Row: {
          created_at: string
          id: string
          last_analyzed_at: string | null
          learning_style: string | null
          predicted_path: Json | null
          strengths: Json | null
          topic_mastery: Json | null
          updated_at: string
          user_id: string
          weaknesses: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_analyzed_at?: string | null
          learning_style?: string | null
          predicted_path?: Json | null
          strengths?: Json | null
          topic_mastery?: Json | null
          updated_at?: string
          user_id: string
          weaknesses?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          last_analyzed_at?: string | null
          learning_style?: string | null
          predicted_path?: Json | null
          strengths?: Json | null
          topic_mastery?: Json | null
          updated_at?: string
          user_id?: string
          weaknesses?: Json | null
        }
        Relationships: []
      }
      library_bookmarks: {
        Row: {
          book_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_bookmarks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string
          created_at: string
          description: string
          download_count: number
          grade_level: number | null
          id: string
          pdf_path: string
          status: string
          subject: string
          thumbnail_path: string | null
          title: string
          type: string
          updated_at: string
          uploader_id: string
          uploader_role: string
        }
        Insert: {
          author: string
          created_at?: string
          description?: string
          download_count?: number
          grade_level?: number | null
          id?: string
          pdf_path: string
          status?: string
          subject: string
          thumbnail_path?: string | null
          title: string
          type?: string
          updated_at?: string
          uploader_id: string
          uploader_role?: string
        }
        Update: {
          author?: string
          created_at?: string
          description?: string
          download_count?: number
          grade_level?: number | null
          id?: string
          pdf_path?: string
          status?: string
          subject?: string
          thumbnail_path?: string | null
          title?: string
          type?: string
          updated_at?: string
          uploader_id?: string
          uploader_role?: string
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
      multiplayer_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          receiver_id: string
          responded_at: string | null
          room_id: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          receiver_id: string
          responded_at?: string | null
          room_id?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          receiver_id?: string
          responded_at?: string | null
          room_id?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplayer_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
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
      parent_links: {
        Row: {
          created_at: string
          id: string
          link_code: string
          linked_at: string | null
          parent_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_code: string
          linked_at?: string | null
          parent_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link_code?: string
          linked_at?: string | null
          parent_id?: string
          status?: string
          student_id?: string
        }
        Relationships: []
      }
      parent_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          notification_type: string
          parent_id: string
          read: boolean | null
          student_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          notification_type: string
          parent_id: string
          read?: boolean | null
          student_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          notification_type?: string
          parent_id?: string
          read?: boolean | null
          student_id?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          avatar_config: Json | null
          badges: string[] | null
          created_at: string
          education_level: string | null
          gender: string | null
          grade: string | null
          id: string
          language: string | null
          level: number
          name: string
          rank: string | null
          season_xp: number
          updated_at: string
          username: string | null
          xp: number
        }
        Insert: {
          avatar?: string | null
          avatar_config?: Json | null
          badges?: string[] | null
          created_at?: string
          education_level?: string | null
          gender?: string | null
          grade?: string | null
          id: string
          language?: string | null
          level?: number
          name: string
          rank?: string | null
          season_xp?: number
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Update: {
          avatar?: string | null
          avatar_config?: Json | null
          badges?: string[] | null
          created_at?: string
          education_level?: string | null
          gender?: string | null
          grade?: string | null
          id?: string
          language?: string | null
          level?: number
          name?: string
          rank?: string | null
          season_xp?: number
          updated_at?: string
          username?: string | null
          xp?: number
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          attempt_number: number
          confidence_level: number | null
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          quiz_id: string
          selected_answer: string
          time_taken_seconds: number
          user_id: string
        }
        Insert: {
          attempt_number?: number
          confidence_level?: number | null
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          quiz_id: string
          selected_answer: string
          time_taken_seconds: number
          user_id: string
        }
        Update: {
          attempt_number?: number
          confidence_level?: number | null
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          quiz_id?: string
          selected_answer?: string
          time_taken_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
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
      reading_progress: {
        Row: {
          book_id: string
          completion_percent: number
          id: string
          last_page: number
          time_spent_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          completion_percent?: number
          id?: string
          last_page?: number
          time_spent_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          completion_percent?: number
          id?: string
          last_page?: number
          time_spent_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_id: string
          reported_type: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_id: string
          reported_type: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reported_type?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      revision_schedule: {
        Row: {
          created_at: string
          difficulty_rating: number | null
          id: string
          last_reviewed_at: string | null
          question_id: string
          scheduled_for: string
          status: string
          times_reviewed: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty_rating?: number | null
          id?: string
          last_reviewed_at?: string | null
          question_id: string
          scheduled_for: string
          status?: string
          times_reviewed?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty_rating?: number | null
          id?: string
          last_reviewed_at?: string | null
          question_id?: string
          scheduled_for?: string
          status?: string
          times_reviewed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_schedule_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      room_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_correct: boolean
          points: number
          question_id: string
          room_id: string
          time_used: number
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_correct?: boolean
          points?: number
          question_id: string
          room_id: string
          time_used?: number
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          points?: number
          question_id?: string
          room_id?: string
          time_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
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
      room_questions: {
        Row: {
          id: string
          order_index: number
          question_id: string
          room_id: string
        }
        Insert: {
          id?: string
          order_index?: number
          question_id: string
          room_id: string
        }
        Update: {
          id?: string
          order_index?: number
          question_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_state: {
        Row: {
          current_question_id: string | null
          question_ends_at: string | null
          question_index: number
          question_started_at: string | null
          room_id: string
          status: string
          updated_at: string
        }
        Insert: {
          current_question_id?: string | null
          question_ends_at?: string | null
          question_index?: number
          question_started_at?: string | null
          room_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          current_question_id?: string | null
          question_ends_at?: string | null
          question_index?: number
          question_started_at?: string | null
          room_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      season_history: {
        Row: {
          conversion_rate: number
          ended_at: string
          ended_by: string | null
          id: string
          reason: string | null
          results: Json
          season_name: string
          season_number: number
          started_at: string
          top_user_id: string | null
          top_user_name: string | null
          total_users: number
          total_xp: number
        }
        Insert: {
          conversion_rate?: number
          ended_at?: string
          ended_by?: string | null
          id?: string
          reason?: string | null
          results?: Json
          season_name: string
          season_number: number
          started_at: string
          top_user_id?: string | null
          top_user_name?: string | null
          total_users?: number
          total_xp?: number
        }
        Update: {
          conversion_rate?: number
          ended_at?: string
          ended_by?: string | null
          id?: string
          reason?: string | null
          results?: Json
          season_name?: string
          season_number?: number
          started_at?: string
          top_user_id?: string | null
          top_user_name?: string | null
          total_users?: number
          total_xp?: number
        }
        Relationships: []
      }
      season_runtime_state: {
        Row: {
          current_season_name: string
          id: number
          season_number: number
          started_at: string
        }
        Insert: {
          current_season_name?: string
          id?: number
          season_number?: number
          started_at?: string
        }
        Update: {
          current_season_name?: string
          id?: number
          season_number?: number
          started_at?: string
        }
        Relationships: []
      }
      social_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          metadata: Json | null
          post_type: string
          shared_post_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          metadata?: Json | null
          post_type?: string
          shared_post_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          metadata?: Json | null
          post_type?: string
          shared_post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_shared_post_id_fkey"
            columns: ["shared_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      study_competitions: {
        Row: {
          created_at: string
          created_by: string
          end_time: string | null
          id: string
          name: string
          start_time: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_time?: string | null
          id?: string
          name: string
          start_time?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_time?: string | null
          id?: string
          name?: string
          start_time?: string
          status?: string
        }
        Relationships: []
      }
      study_live_status: {
        Row: {
          current_session_start: string | null
          is_studying: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          current_session_start?: string | null
          is_studying?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          current_session_start?: string | null
          is_studying?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_participants: {
        Row: {
          competition_id: string
          id: string
          joined_at: string
          total_study_time: number
          user_id: string
        }
        Insert: {
          competition_id: string
          id?: string
          joined_at?: string
          total_study_time?: number
          user_id: string
        }
        Update: {
          competition_id?: string
          id?: string
          joined_at?: string
          total_study_time?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "study_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          notes: string | null
          priority: string
          scheduled_date: string
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          scheduled_date: string
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          scheduled_date?: string
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          competition_id: string | null
          created_at: string
          duration: number | null
          end_time: string | null
          id: string
          mode: string | null
          planned_duration: number | null
          start_time: string
          status: string
          user_id: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string
          duration?: number | null
          end_time?: string | null
          id?: string
          mode?: string | null
          planned_duration?: number | null
          start_time?: string
          status?: string
          user_id: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string
          duration?: number | null
          end_time?: string | null
          id?: string
          mode?: string | null
          planned_duration?: number | null
          start_time?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "study_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_settings: {
        Row: {
          auto_start_break: boolean
          default_break_time: number
          default_study_time: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_start_break?: boolean
          default_break_time?: number
          default_study_time?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_start_break?: boolean
          default_break_time?: number
          default_study_time?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_tasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          task_title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          task_title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          task_title?: string
          user_id?: string
        }
        Relationships: []
      }
      topic_progress: {
        Row: {
          accuracy_percentage: number
          completion_percentage: number
          created_at: string
          id: string
          last_practiced: string | null
          questions_attempted: number
          questions_correct: number
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_percentage?: number
          completion_percentage?: number
          created_at?: string
          id?: string
          last_practiced?: string | null
          questions_attempted?: number
          questions_correct?: number
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_percentage?: number
          completion_percentage?: number
          created_at?: string
          id?: string
          last_practiced?: string | null
          questions_attempted?: number
          questions_correct?: number
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_flashcard_progress: {
        Row: {
          created_at: string
          ease_factor: number
          flashcard_id: string
          id: string
          interval_days: number
          last_reviewed_at: string | null
          next_review_date: string
          repetition_count: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ease_factor?: number
          flashcard_id: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          next_review_date?: string
          repetition_count?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ease_factor?: number
          flashcard_id?: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          next_review_date?: string
          repetition_count?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flashcard_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
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
      _resolve_user_identifier: {
        Args: { p_identifier: string }
        Returns: string
      }
      add_xp: { Args: { p_amount: number; p_user_id: string }; Returns: Json }
      admin_adjust_coins: {
        Args: { p_amount: number; p_user_identifier: string }
        Returns: Json
      }
      admin_adjust_xp: {
        Args: { p_amount: number; p_user_identifier: string }
        Returns: Json
      }
      admin_end_season: {
        Args: {
          p_confirm_text?: string
          p_conversion_rate?: number
          p_reason?: string
        }
        Returns: Json
      }
      admin_force_start_new_season: {
        Args: { p_reason?: string }
        Returns: Json
      }
      admin_get_current_season_stats: { Args: never; Returns: Json }
      admin_get_season_rewards_preview: {
        Args: { p_conversion_rate?: number; p_limit?: number }
        Returns: {
          name: string
          projected_coins: number
          projected_rank: number
          projected_title: string
          season_xp: number
          user_id: string
        }[]
      }
      admin_reset_user_progress: {
        Args: { p_reset_mode?: string; p_user_identifier: string }
        Returns: Json
      }
      admin_set_user_level: {
        Args: { p_level: number; p_user_identifier: string }
        Returns: Json
      }
      admin_update_user_xp: {
        Args: {
          p_action?: string
          p_user_identifier: string
          p_xp_amount: number
        }
        Returns: Json
      }
      assign_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      calculate_rank: { Args: { p_xp: number }; Returns: string }
      check_achievements: { Args: { p_user_id: string }; Returns: Json }
      complete_study_session: {
        Args: {
          p_duration_override?: number
          p_mark_task_complete?: boolean
          p_session_id: string
          p_task_id?: string
        }
        Returns: Json
      }
      create_multiplayer_invite: {
        Args: {
          p_difficulty?: string
          p_max_players?: number
          p_receiver_id: string
          p_room_id?: string
          p_subject?: string
        }
        Returns: Json
      }
      finalize_match: { Args: { p_room_id: string }; Returns: Json }
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
      get_dashboard_data: { Args: { p_user_id: string }; Returns: Json }
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
      get_user_stats: { Args: { p_user_id: string }; Returns: Json }
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
      multiplayer_next_question: { Args: { p_room_id: string }; Returns: Json }
      multiplayer_start_game: { Args: { p_room_id: string }; Returns: boolean }
      multiplayer_submit_answer: {
        Args: {
          p_answer: string
          p_question_id: string
          p_room_id: string
          p_time_used: number
        }
        Returns: Json
      }
      respond_multiplayer_invite: {
        Args: { p_invite_id: string; p_response: string }
        Returns: Json
      }
      update_analytics: {
        Args: {
          p_avg_time: number
          p_correct: number
          p_subject: string
          p_total: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_user_streak: { Args: { p_user_id: string }; Returns: Json }
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
