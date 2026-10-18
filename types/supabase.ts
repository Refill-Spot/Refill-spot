import type {
  ManagedImageBucket,
  ManagedImageDeletionAcknowledgement,
  ManagedImageDeletionClaim,
  ManagedImageExtension,
  ManagedImageFinalization,
  ManagedImageReservation,
} from "@/lib/image-lifecycle";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Maintained from application queries and init-postgis.sql, not generated or
// verified against live database metadata; only known contracts are declared.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          role: "user" | "admin";
          is_admin: boolean;
          avatar_url: string | null;
          bio: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          role?: "user" | "admin";
          is_admin?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          role?: "user" | "admin";
          is_admin?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          id: number;
          name: string;
          address: string;
          position_lat: number;
          position_lng: number;
          position_x: number;
          position_y: number;
          naver_rating: number | null;
          kakao_rating: number | null;
          open_hours: string | null;
          refill_items: Json | null;
          created_at: string;
          updated_at: string;
          geom: unknown;
          image_urls: string[] | null;
          phone_number: string | null;
          break_time: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          address: string;
          position_lat: number;
          position_lng: number;
          position_x: number;
          position_y: number;
          naver_rating?: number | null;
          kakao_rating?: number | null;
          open_hours?: string | null;
          refill_items?: Json[] | null;
          created_at?: string;
          updated_at?: string;
          geom?: unknown;
          image_urls?: string[] | null;
          phone_number?: string | null;
          break_time?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          address?: string;
          position_lat?: number;
          position_lng?: number;
          position_x?: number;
          position_y?: number;
          naver_rating?: number | null;
          kakao_rating?: number | null;
          open_hours?: string | null;
          refill_items?: Json[] | null;
          image_urls?: string[] | null;
          created_at?: string;
          updated_at?: string;
          geom?: unknown;
          phone_number?: string | null;
          break_time?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
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
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: number;
          user_id: string;
          store_id: number;
          rating: number;
          content: string;
          image_urls: string[] | null;
          keywords: string[] | null;
          atmosphere: string[] | null;
          detailed_ratings: Json | null;
          menus: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          store_id: number;
          rating: number;
          content: string;
          image_urls?: string[] | null;
          keywords?: string[] | null;
          atmosphere?: string[] | null;
          detailed_ratings?: Json | null;
          menus?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          store_id?: number;
          rating?: number;
          content?: string;
          image_urls?: string[] | null;
          keywords?: string[] | null;
          atmosphere?: string[] | null;
          detailed_ratings?: Json | null;
          menus?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          // Current queries require this join; its physical FK is unverified.
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      review_likes: {
        Row: {
          id: number;
          user_id: string;
          review_id: number;
        };
        Insert: {
          id?: number;
          user_id: string;
          review_id: number;
        };
        Update: {
          id?: number;
          user_id?: string;
          review_id?: number;
        };
        Relationships: [];
      };
      review_reports: {
        Row: {
          id: number;
          user_id: string;
          review_id: number;
          reason: string;
          description: string | null;
          status: "pending" | "reviewed" | "dismissed";
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          review_id: number;
          reason: string;
          description?: string | null;
          status?: "pending" | "reviewed" | "dismissed";
          created_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          review_id?: number;
          reason?: string;
          description?: string | null;
          status?: "pending" | "reviewed" | "dismissed";
          created_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
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
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
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
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          is_important: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
          published_at: string | null;
          author_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          is_important?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          author_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          is_important?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          author_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [key in never]: never };
    Functions: {
      reserve_managed_image: {
        Args: {
          p_bucket_id: ManagedImageBucket;
          p_extension: ManagedImageExtension;
        };
        Returns: ManagedImageReservation[];
      };
      finalize_managed_image: {
        Args: { p_asset_id: string };
        Returns: ManagedImageFinalization[];
      };
      claim_managed_image_deletions: {
        Args: { p_limit?: number };
        Returns: ManagedImageDeletionClaim[];
      };
      acknowledge_managed_image_deletion: {
        Args: {
          p_asset_id: string;
          p_lease_token: string;
          p_deleted: boolean;
          p_error?: string | null;
        };
        Returns: ManagedImageDeletionAcknowledgement[];
      };
      // These recommendation contracts come from app/api/stores/route.ts.
      get_stores_within_radius: {
        Args: {
          user_lat: number;
          user_lng: number;
          radius_km: number;
        };
        Returns: RecommendedStoreRow[];
      };
      get_default_recommended_stores: {
        Args: { [key in never]: never };
        Returns: RecommendedStoreRow[];
      };
      // Argument names, defaults and result columns are in init-postgis.sql.
      stores_within_radius: {
        Args: {
          lat: number;
          lng: number;
          radius_meters: number;
        };
        Returns: StoreWithinRadiusRow[];
      };
      stores_filter: {
        Args: {
          lat: number;
          lng: number;
          max_distance: number;
          min_rating: number | null;
          categories_filter?: string[] | null;
        };
        Returns: StoreWithinRadiusRow[];
      };
      delete_review_as_admin: {
        Args: {
          review_id: number;
          admin_user_id: string;
        };
        // The caller only checks errors; no return type is evidenced by DDL.
        Returns: unknown;
      };
    };
    Enums: { [key in never]: never };
    CompositeTypes: { [key in never]: never };
  };
}

type StoreWithinRadiusRow = Omit<
  Database["public"]["Tables"]["stores"]["Row"],
  "refill_items"
> & {
  refill_items: Json[] | null;
  distance: number | null;
};

type RecommendedStoreRow = Database["public"]["Tables"]["stores"]["Row"] & {
  categories: Json | null;
  distance_km: number | null;
};
