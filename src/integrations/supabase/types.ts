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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      decision_history: {
        Row: {
          created_at: string | null
          criteria_weights: Json | null
          id: string
          ranked_products: Json | null
          selected_criteria: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          criteria_weights?: Json | null
          id?: string
          ranked_products?: Json | null
          selected_criteria?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          criteria_weights?: Json | null
          id?: string
          ranked_products?: Json | null
          selected_criteria?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      laptop_dataset_staging: {
        Row: {
          brand: string | null
          cpu_brand: string | null
          cpu_core_count: number | null
          cpu_e_cores: number | null
          cpu_family: string | null
          cpu_lp_e_cores: number | null
          cpu_model: string | null
          cpu_p_cores: number | null
          cpu_series: string | null
          cpu_suffix: string | null
          cpu_thread_count: number | null
          device_category: string | null
          display_height_px: number | null
          display_size_inch: number | null
          display_width_px: number | null
          gpu_brand: string | null
          gpu_model: string | null
          gpu_series: string | null
          gpu_type: string | null
          gpu_vram_gb: number | null
          model: string | null
          os_name: string | null
          price: number | null
          ram_gb: number | null
          rating: number | null
          storage_gb: number | null
          warranty_years: number | null
        }
        Insert: {
          brand?: string | null
          cpu_brand?: string | null
          cpu_core_count?: number | null
          cpu_e_cores?: number | null
          cpu_family?: string | null
          cpu_lp_e_cores?: number | null
          cpu_model?: string | null
          cpu_p_cores?: number | null
          cpu_series?: string | null
          cpu_suffix?: string | null
          cpu_thread_count?: number | null
          device_category?: string | null
          display_height_px?: number | null
          display_size_inch?: number | null
          display_width_px?: number | null
          gpu_brand?: string | null
          gpu_model?: string | null
          gpu_series?: string | null
          gpu_type?: string | null
          gpu_vram_gb?: number | null
          model?: string | null
          os_name?: string | null
          price?: number | null
          ram_gb?: number | null
          rating?: number | null
          storage_gb?: number | null
          warranty_years?: number | null
        }
        Update: {
          brand?: string | null
          cpu_brand?: string | null
          cpu_core_count?: number | null
          cpu_e_cores?: number | null
          cpu_family?: string | null
          cpu_lp_e_cores?: number | null
          cpu_model?: string | null
          cpu_p_cores?: number | null
          cpu_series?: string | null
          cpu_suffix?: string | null
          cpu_thread_count?: number | null
          device_category?: string | null
          display_height_px?: number | null
          display_size_inch?: number | null
          display_width_px?: number | null
          gpu_brand?: string | null
          gpu_model?: string | null
          gpu_series?: string | null
          gpu_type?: string | null
          gpu_vram_gb?: number | null
          model?: string | null
          os_name?: string | null
          price?: number | null
          ram_gb?: number | null
          rating?: number | null
          storage_gb?: number | null
          warranty_years?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          created_at: string | null
          delivery_fee: number | null
          discount: number | null
          id: string
          order_number: string
          order_status: string
          payment_method: string
          payment_status: string
          phone: string
          subtotal: number
          total_amount: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string | null
          delivery_fee?: number | null
          discount?: number | null
          id?: string
          order_number: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          phone: string
          subtotal: number
          total_amount: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string | null
          delivery_fee?: number | null
          discount?: number | null
          id?: string
          order_number?: string
          order_status?: string
          payment_method?: string
          payment_status?: string
          phone?: string
          subtotal?: number
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          battery: string | null
          brand: string
          category_id: string | null
          created_at: string | null
          description: string | null
          display: string | null
          graphics: string | null
          id: string
          image_url: string | null
          is_active: boolean
          model: string
          original_price: number | null
          price: number
          processor: string | null
          ram: string | null
          rating: number | null
          stock: number
          storage: string | null
          warranty: string | null
        }
        Insert: {
          battery?: string | null
          brand: string
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          graphics?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          model: string
          original_price?: number | null
          price: number
          processor?: string | null
          ram?: string | null
          rating?: number | null
          stock?: number
          storage?: string | null
          warranty?: string | null
        }
        Update: {
          battery?: string | null
          brand?: string
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display?: string | null
          graphics?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          model?: string
          original_price?: number | null
          price?: number
          processor?: string | null
          ram?: string | null
          rating?: number | null
          stock?: number
          storage?: string | null
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
