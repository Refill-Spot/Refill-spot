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
          username: string;
          role: "user" | "admin";
          is_admin: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role?: "user" | "admin";
          is_admin?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: "user" | "admin";
          is_admin?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      stores: {
        Row: {
          id: number;
          name: string;
          address: string;
          description: string | null;
          position_lat: number;
          position_lng: number;
          position_x: number;
          position_y: number;
          distance: string | null;
          naver_rating: number | null;
          kakao_rating: number | null;
          open_hours: string | null;
          price: string | null;
          refill_items: string[] | null;
          image_urls: string[] | null;
          created_at: string;
          updated_at: string;
          geom: unknown;
        };
        Insert: {
          id?: number;
          name: string;
          address: string;
          description?: string | null;
          position_lat: number;
          position_lng: number;
          position_x: number;
          position_y: number;
          distance?: string | null;
          naver_rating?: number | null;
          kakao_rating?: number | null;
          open_hours?: string | null;
          price?: string | null;
          refill_items?: string[] | null;
          image_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
          geom?: unknown;
        };
        Update: {
          id?: number;
          name?: string;
          address?: string;
          description?: string | null;
          position_lat?: number;
          position_lng?: number;
          position_x?: number;
          position_y?: number;
          distance?: string | null;
          naver_rating?: number | null;
          kakao_rating?: number | null;
          open_hours?: string | null;
          price?: string | null;
          refill_items?: string[] | null;
          image_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
          geom?: unknown;
        };
      };
      categories: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      store_categories: {
        Row: {
          store_id: number;
          category_id: number;
        };
        Insert: {
          store_id: number;
          category_id: number;
        };
        Update: {
          store_id?: number;
          category_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "store_categories_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_categories_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      reviews: {
        Row: {
          id: number;
          user_id: string;
          store_id: number;
          rating: number;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          store_id: number;
          rating: number;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          store_id?: number;
          rating?: number;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
      favorites: {
        Row: {
          id: number;
          user_id: string;
          store_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          store_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          store_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
      contacts: {
        Row: {
          id: number;
          type: "store_registration" | "inquiry" | "feedback";
          name: string;
          email: string;
          phone: string | null;
          store_name: string | null;
          store_address: string | null;
          message: string;
          status: "pending" | "in_progress" | "completed" | "closed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          type: "store_registration" | "inquiry" | "feedback";
          name: string;
          email: string;
          phone?: string | null;
          store_name?: string | null;
          store_address?: string | null;
          message: string;
          status?: "pending" | "in_progress" | "completed" | "closed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          type?: "store_registration" | "inquiry" | "feedback";
          name?: string;
          email?: string;
          phone?: string | null;
          store_name?: string | null;
          store_address?: string | null;
          message?: string;
          status?: "pending" | "in_progress" | "completed" | "closed";
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
