/**
 * App-facing database types for the BuySense Supabase client.
 * Auth/profile definitions match the existing project schema.
 */
export type AppDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppDatabase["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: AppDatabase["public"]["Enums"]["app_role"];
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: AppDatabase["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string | null;
          name: string;
          brand: string;
          category_slug: string | null;
          tagline: string | null;
          description: string | null;
          price: number;
          mrp: number | null;
          images: unknown[] | null;
          specs: Record<string, unknown> | null;
          stock: number;
          featured: boolean;
          is_active: boolean;
          created_at: string | null;
          model: string | null;
          original_price: number | null;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          slug?: string | null;
          name: string;
          brand: string;
          category_slug?: string | null;
          tagline?: string | null;
          description?: string | null;
          price: number;
          mrp?: number | null;
          images?: unknown[] | null;
          specs?: Record<string, unknown> | null;
          stock?: number;
          featured?: boolean;
          is_active?: boolean;
          created_at?: string | null;
          model?: string;
          original_price?: number | null;
          image_url?: string | null;
          processor?: string | null;
          ram?: string | null;
          storage?: string | null;
          graphics?: string | null;
          display?: string | null;
          battery?: string | null;
        };
        Update: {
          slug?: string | null;
          name?: string;
          brand?: string;
          category_slug?: string | null;
          tagline?: string | null;
          description?: string | null;
          price?: number;
          mrp?: number | null;
          images?: unknown[] | null;
          specs?: Record<string, unknown> | null;
          stock?: number;
          featured?: boolean;
          is_active?: boolean;
          model?: string;
          original_price?: number | null;
          image_url?: string | null;
          processor?: string | null;
          ram?: string | null;
          storage?: string | null;
          graphics?: string | null;
          display?: string | null;
          battery?: string | null;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          product_slug: string | null;
          quantity: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id?: string | null;
          product_slug?: string | null;
          quantity?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string | null;
          product_slug?: string | null;
          quantity?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          product_slug: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id?: string | null;
          product_slug?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string | null;
          product_slug?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishlists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          order_status: string;
          payment_status: string;
          payment_method: string;
          subtotal: number;
          discount: number | null;
          delivery_fee: number | null;
          total_amount: number;
          address: string;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          client_ref: string | null;
          address_data: Record<string, unknown> | null;
          phone: string;
          customer_name: string | null;
          customer_email: string | null;
          items: unknown[] | null;
          status_history: unknown[] | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          order_number: string;
          user_id: string;
          order_status: string;
          payment_status: string;
          payment_method: string;
          subtotal: number;
          discount: number;
          delivery_fee: number;
          total_amount: number;
          address: string;
          phone: string;
          created_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      update_my_profile: {
        Args: { p_full_name: string; p_phone: string; p_address: Record<string, unknown> | null };
        Returns: AppDatabase["public"]["Tables"]["profiles"]["Row"];
      };
      place_order: {
        Args: {
          p_items: unknown[];
          p_address: Record<string, unknown>;
          p_customer_name: string;
          p_customer_email: string;
        };
        Returns: AppDatabase["public"]["Tables"]["orders"]["Row"];
      };
      change_order_status: {
        Args: { p_order_id: string; p_status: string };
        Returns: AppDatabase["public"]["Tables"]["orders"]["Row"];
      };
      set_product_stock: { Args: { p_product_id: string; p_stock: number }; Returns: null };
    };
    Enums: { app_role: "admin" | "customer" };
    CompositeTypes: Record<string, never>;
  };
};
