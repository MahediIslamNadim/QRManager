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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          invited_name: string | null
          restaurant_name: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          invited_name?: string | null
          restaurant_name?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          invited_name?: string | null
          restaurant_name?: string | null
          status?: string
        }
        Relationships: []
      }
      branch_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          group_id: string
          id: string
          invited_by: string | null
          invited_email: string
          restaurant_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          invited_by?: string | null
          invited_email: string
          restaurant_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          invited_by?: string | null
          invited_email?: string
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_menu_overrides: {
        Row: {
          created_at: string
          custom_price: number | null
          id: string
          is_available: boolean
          restaurant_id: string
          shared_menu_item_id: string
        }
        Insert: {
          created_at?: string
          custom_price?: number | null
          id?: string
          is_available?: boolean
          restaurant_id: string
          shared_menu_item_id: string
        }
        Update: {
          created_at?: string
          custom_price?: number | null
          id?: string
          is_available?: boolean
          restaurant_id?: string
          shared_menu_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_menu_overrides_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_menu_overrides_shared_menu_item_id_fkey"
            columns: ["shared_menu_item_id"]
            isOneToOne: false
            referencedRelation: "group_shared_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      dedicated_managers: {
        Row: {
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          photo_url: string | null
          specialty: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          photo_url?: string | null
          specialty?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          specialty?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      enterprise_notice_targets: {
        Row: {
          created_at: string
          delivered_email_at: string | null
          delivered_in_app_at: string | null
          delivery_status: string
          email_error: string | null
          id: string
          notice_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          delivered_email_at?: string | null
          delivered_in_app_at?: string | null
          delivery_status?: string
          email_error?: string | null
          id?: string
          notice_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          delivered_email_at?: string | null
          delivered_in_app_at?: string | null
          delivery_status?: string
          email_error?: string | null
          id?: string
          notice_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_notice_targets_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "enterprise_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enterprise_notice_targets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_notices: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          message: string
          send_email: boolean
          title: string
          updated_at: string
        }
        Insert: {
          audience: string
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          message: string
          send_email?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          message?: string
          send_email?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enterprise_notices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admin_actions: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          group_id: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          group_id: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          group_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "group_admin_actions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_notice_targets: {
        Row: {
          created_at: string
          delivered_email_at: string | null
          delivered_in_app_at: string | null
          delivery_status: string
          email_error: string | null
          id: string
          notice_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          delivered_email_at?: string | null
          delivered_in_app_at?: string | null
          delivery_status?: string
          email_error?: string | null
          id?: string
          notice_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          delivered_email_at?: string | null
          delivered_in_app_at?: string | null
          delivery_status?: string
          email_error?: string | null
          id?: string
          notice_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_notice_targets_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "group_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_notice_targets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_notices: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          message: string
          send_email: boolean
          source_enterprise_notice_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          message: string
          send_email?: boolean
          source_enterprise_notice_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          message?: string
          send_email?: boolean
          source_enterprise_notice_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_notices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_notices_source_enterprise_notice_id_fkey"
            columns: ["source_enterprise_notice_id"]
            isOneToOne: false
            referencedRelation: "enterprise_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      group_restaurants: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_head_office: boolean
          linked_at: string
          linked_by: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_head_office?: boolean
          linked_at?: string
          linked_by?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_head_office?: boolean
          linked_at?: string
          linked_by?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_restaurants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_shared_menus: {
        Row: {
          category: string
          created_at: string
          description: string | null
          group_id: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_shared_menus_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_messages: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          restaurant_id: string
          sender_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          restaurant_id: string
          sender_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          restaurant_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          restaurant_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_metrics: {
        Row: {
          avg_rating: number | null
          cart_add_count: number | null
          click_count: number | null
          id: string
          last_ordered_at: string | null
          menu_item_id: string | null
          order_count: number | null
          restaurant_id: string | null
          revenue_generated: number | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          avg_rating?: number | null
          cart_add_count?: number | null
          click_count?: number | null
          id?: string
          last_ordered_at?: string | null
          menu_item_id?: string | null
          order_count?: number | null
          restaurant_id?: string | null
          revenue_generated?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          avg_rating?: number | null
          cart_add_count?: number | null
          click_count?: number | null
          id?: string
          last_ordered_at?: string | null
          menu_item_id?: string | null
          order_count?: number | null
          restaurant_id?: string | null
          revenue_generated?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_metrics_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_metrics_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          category: string
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          prep_time_minutes: number | null
          price: number
          restaurant_id: string
          shared_menu_item_id: string | null
          sort_order: number
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          prep_time_minutes?: number | null
          price?: number
          restaurant_id: string
          shared_menu_item_id?: string | null
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          prep_time_minutes?: number | null
          price?: number
          restaurant_id?: string
          shared_menu_item_id?: string | null
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_shared_menu_item_id_fkey"
            columns: ["shared_menu_item_id"]
            isOneToOne: false
            referencedRelation: "group_shared_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          restaurant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          restaurant_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          restaurant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          order_id: string
          price: number
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_device_id: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_to_staff_id: string | null
          paid_to_staff_name: string | null
          payment_method: string | null
          payment_status: string | null
          rating: number | null
          rating_comment: string | null
          restaurant_id: string
          seat_id: string | null
          status: string
          table_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_device_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_to_staff_id?: string | null
          paid_to_staff_name?: string | null
          payment_method?: string | null
          payment_status?: string | null
          rating?: number | null
          rating_comment?: string | null
          restaurant_id: string
          seat_id?: string | null
          status?: string
          table_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_device_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_to_staff_id?: string | null
          paid_to_staff_name?: string | null
          payment_method?: string | null
          payment_status?: string | null
          rating?: number | null
          rating_comment?: string | null
          restaurant_id?: string
          seat_id?: string | null
          status?: string
          table_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "table_seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          billing_cycle: string
          created_at: string
          id: string
          payment_method: string
          phone_number: string | null
          plan: string
          restaurant_id: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          billing_cycle?: string
          created_at?: string
          id?: string
          payment_method?: string
          phone_number?: string | null
          plan?: string
          restaurant_id: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          billing_cycle?: string
          created_at?: string
          id?: string
          payment_method?: string
          phone_number?: string | null
          plan?: string
          restaurant_id?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_analytics: {
        Row: {
          clicked_item: string | null
          created_at: string | null
          id: string
          ordered_item: string | null
          recommended_items: string[] | null
          restaurant_id: string | null
          session_id: string
          strategy: string | null
          timestamp: string | null
        }
        Insert: {
          clicked_item?: string | null
          created_at?: string | null
          id?: string
          ordered_item?: string | null
          recommended_items?: string[] | null
          restaurant_id?: string | null
          session_id: string
          strategy?: string | null
          timestamp?: string | null
        }
        Update: {
          clicked_item?: string | null
          created_at?: string | null
          id?: string
          ordered_item?: string | null
          recommended_items?: string[] | null
          restaurant_id?: string | null
          session_id?: string
          strategy?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_analytics_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          current_customers: number
          id: string
          is_open: boolean | null
          name: string
          qr_code: string | null
          restaurant_id: string
          seats: number
          status: string
        }
        Insert: {
          created_at?: string
          current_customers?: number
          id?: string
          is_open?: boolean | null
          name: string
          qr_code?: string | null
          restaurant_id: string
          seats?: number
          status?: string
        }
        Update: {
          created_at?: string
          current_customers?: number
          id?: string
          is_open?: boolean | null
          name?: string
          qr_code?: string | null
          restaurant_id?: string
          seats?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          billing_cycle: string | null
          branch_code: string | null
          brand_font: string | null
          brand_primary: string | null
          brand_secondary: string | null
          created_at: string
          dedicated_manager_id: string | null
          group_id: string | null
          id: string
          is_branch: boolean
          logo_url: string | null
          name: string
          next_billing_date: string | null
          notification_email: string | null
          notify_daily_report: boolean | null
          notify_email: boolean
          notify_new_order: boolean | null
          owner_id: string | null
          phone: string | null
          plan: string
          short_code: string | null
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          tier: string | null
          trial_end_date: string | null
          trial_ends_at: string | null
          trial_start_date: string | null
          updated_at: string
          whatsapp_api_key: string | null
        }
        Insert: {
          address?: string | null
          billing_cycle?: string | null
          branch_code?: string | null
          brand_font?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          created_at?: string
          dedicated_manager_id?: string | null
          group_id?: string | null
          id?: string
          is_branch?: boolean
          logo_url?: string | null
          name: string
          next_billing_date?: string | null
          notification_email?: string | null
          notify_daily_report?: boolean | null
          notify_email?: boolean
          notify_new_order?: boolean | null
          owner_id?: string | null
          phone?: string | null
          plan?: string
          short_code?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          tier?: string | null
          trial_end_date?: string | null
          trial_ends_at?: string | null
          trial_start_date?: string | null
          updated_at?: string
          whatsapp_api_key?: string | null
        }
        Update: {
          address?: string | null
          billing_cycle?: string | null
          branch_code?: string | null
          brand_font?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          created_at?: string
          dedicated_manager_id?: string | null
          group_id?: string | null
          id?: string
          is_branch?: boolean
          logo_url?: string | null
          name?: string
          next_billing_date?: string | null
          notification_email?: string | null
          notify_daily_report?: boolean | null
          notify_email?: boolean
          notify_new_order?: boolean | null
          owner_id?: string | null
          phone?: string | null
          plan?: string
          short_code?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          tier?: string | null
          trial_end_date?: string | null
          trial_ends_at?: string | null
          trial_start_date?: string | null
          updated_at?: string
          whatsapp_api_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_dedicated_manager_id_fkey"
            columns: ["dedicated_manager_id"]
            isOneToOne: false
            referencedRelation: "dedicated_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "restaurant_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          menu_item_id: string | null
          rating: number
          restaurant_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          rating: number
          restaurant_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          rating?: number
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          note: string | null
          request_type: string
          restaurant_id: string
          seat_id: string | null
          status: string
          table_id: string | null
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          note?: string | null
          request_type: string
          restaurant_id: string
          seat_id?: string | null
          status?: string
          table_id?: string | null
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          note?: string | null
          request_type?: string
          restaurant_id?: string
          seat_id?: string | null
          status?: string
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "table_seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      ssl_transactions: {
        Row: {
          amount: number
          bank_tran_id: string | null
          billing_cycle: string
          card_type: string | null
          created_at: string
          error_message: string | null
          id: string
          plan: string
          restaurant_id: string
          ssl_status: string | null
          status: string
          store_amount: number | null
          tran_id: string
          updated_at: string
          user_id: string
          val_id: string | null
        }
        Insert: {
          amount: number
          bank_tran_id?: string | null
          billing_cycle?: string
          card_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          plan: string
          restaurant_id: string
          ssl_status?: string | null
          status?: string
          store_amount?: number | null
          tran_id: string
          updated_at?: string
          user_id: string
          val_id?: string | null
        }
        Update: {
          amount?: number
          bank_tran_id?: string | null
          billing_cycle?: string
          card_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          plan?: string
          restaurant_id?: string
          ssl_status?: string | null
          status?: string
          store_amount?: number | null
          tran_id?: string
          updated_at?: string
          user_id?: string
          val_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssl_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_restaurants: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string | null
          end_date: string
          id: string
          notes: string | null
          payment_method: string | null
          restaurant_id: string | null
          start_date: string
          status: string | null
          tier: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          billing_cycle: string
          created_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          restaurant_id?: string | null
          start_date?: string
          status?: string | null
          tier: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          restaurant_id?: string | null
          start_date?: string
          status?: string | null
          tier?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          priority: string
          restaurant_id: string
          status: string
          subject: string
          updated_at: string | null
        }
        Insert: {
          admin_reply?: string | null
          category?: string
          created_at?: string | null
          description: string
          id?: string
          priority?: string
          restaurant_id: string
          status?: string
          subject: string
          updated_at?: string | null
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          priority?: string
          restaurant_id?: string
          status?: string
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_seats: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          seat_number: number
          status: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          seat_number: number
          status?: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          seat_number?: number
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_seats_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          restaurant_id: string
          seat_id: string | null
          table_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          restaurant_id: string
          seat_id?: string | null
          table_id: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          restaurant_id?: string
          seat_id?: string | null
          table_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "table_seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_behavior: {
        Row: {
          cart_items: string[] | null
          created_at: string | null
          id: string
          ordered_items: string[] | null
          restaurant_id: string | null
          session_id: string
          time_of_day: string | null
          timestamp: string | null
          user_id: string | null
          viewed_items: string[] | null
        }
        Insert: {
          cart_items?: string[] | null
          created_at?: string | null
          id?: string
          ordered_items?: string[] | null
          restaurant_id?: string | null
          session_id: string
          time_of_day?: string | null
          timestamp?: string | null
          user_id?: string | null
          viewed_items?: string[] | null
        }
        Update: {
          cart_items?: string[] | null
          created_at?: string | null
          id?: string
          ordered_items?: string[] | null
          restaurant_id?: string | null
          session_id?: string
          time_of_day?: string | null
          timestamp?: string | null
          user_id?: string | null
          viewed_items?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_behavior_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          restaurant_id?: string | null
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
      can_manage_enterprise_group: {
        Args: { p_group_id: string; p_user_id?: string }
        Returns: boolean
      }
      complete_admin_signup:
        | {
            Args: {
              p_address?: string
              p_phone?: string
              p_plan?: string
              p_restaurant_name: string
              p_trial_days?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_address?: string
              p_billing_cycle?: string
              p_phone?: string
              p_restaurant_name: string
              p_tier?: string
              p_trial_days?: number
            }
            Returns: Json
          }
      create_enterprise_restaurant: {
        Args: {
          p_admin_email?: string
          p_admin_full_name?: string
          p_admin_phone?: string
          p_admin_user_id: string
          p_group_id: string
          p_restaurant_address?: string
          p_restaurant_name: string
          p_restaurant_phone?: string
        }
        Returns: string
      }
      create_service_request: {
        Args: {
          p_notes?: string
          p_restaurant_id: string
          p_seat_id: string
          p_table_id: string
          p_token: string
          p_type: string
        }
        Returns: Json
      }
      ensure_enterprise_group: {
        Args: { p_group_name?: string; p_restaurant_id: string }
        Returns: string
      }
      get_enterprise_analytics: {
        Args: { p_group_id: string; p_restaurant_id?: string }
        Returns: Json
      }
      get_enterprise_dashboard_summary: {
        Args: { p_group_id: string }
        Returns: Json
      }
      get_enterprise_restaurant_list: {
        Args: { p_group_id: string }
        Returns: {
          address: string
          branch_code: string
          created_at: string
          menu_items_count: number
          name: string
          phone: string
          restaurant_id: string
          staff_count: number
          status: string
          subscription_status: string
          today_orders: number
          today_revenue: number
          total_orders: number
          total_revenue: number
        }[]
      }
      get_enterprise_top_selling: {
        Args: { p_group_id: string }
        Returns: {
          item_name: string
          quantity: number
          restaurant_id: string
          restaurant_name: string
          revenue: number
        }[]
      }
      get_group_analytics: { Args: { p_group_id: string }; Returns: Json }
      get_group_restaurants: {
        Args: { p_group_id: string }
        Returns: {
          address: string
          branch_code: string
          created_at: string
          group_restaurant_id: string
          is_head_office: boolean
          link_status: string
          name: string
          owner_id: string
          phone: string
          restaurant_id: string
          status: string
          updated_at: string
        }[]
      }
      get_restaurant_staff: {
        Args: { _restaurant_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          restaurant_id: string
          role: string
          user_id: string
        }[]
      }
      get_trending_items: {
        Args: { p_limit?: number; p_restaurant_id: string }
        Returns: {
          category: string
          menu_item_id: string
          name: string
          order_count_24h: number
          price: number
          trend_score: number
        }[]
      }
      get_trial_days_remaining: {
        Args: { restaurant_uuid: string }
        Returns: number
      }
      get_user_groups: {
        Args: { _user_id?: string }
        Returns: {
          created_at: string
          description: string
          id: string
          logo_url: string
          name: string
          owner_id: string
          updated_at: string
        }[]
      }
      get_user_recommendations: {
        Args: { p_limit?: number; p_restaurant_id: string; p_user_id: string }
        Returns: {
          category: string
          menu_item_id: string
          name: string
          price: number
          recommendation_score: number
        }[]
      }
      get_user_restaurant_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: { Args: { check_user_id?: string }; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
        | { Args: { check_role: string }; Returns: boolean }
      insert_notification_order: {
        Args: {
          p_notes: string
          p_restaurant_id: string
          p_seat_id: string
          p_table_id: string
          p_token: string
        }
        Returns: Json
      }
      insert_order_with_token:
        | {
            Args: {
              p_items: Json
              p_notes: string
              p_restaurant_id: string
              p_seat_id: string
              p_table_id: string
              p_token: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_customer_device_id?: string
              p_items: Json
              p_notes: string
              p_restaurant_id: string
              p_seat_id: string
              p_table_id: string
              p_token: string
            }
            Returns: Json
          }
      is_group_owner: { Args: { p_group_id: string }; Returns: boolean }
      is_restaurant_admin: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_restaurant_staff: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_trial_expired: { Args: { restaurant_uuid: string }; Returns: boolean }
      notify_restaurant_admins: {
        Args: {
          p_message: string
          p_restaurant_id: string
          p_title: string
          p_type?: string
        }
        Returns: undefined
      }
      release_seat_with_token: {
        Args: { p_seat_id: string; p_token: string }
        Returns: boolean
      }
      resolve_manager_role: { Args: never; Returns: string }
      save_order_edit: {
        Args: { p_items: Json; p_order_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      send_group_notice: {
        Args: {
          p_group_id: string
          p_message: string
          p_restaurant_ids?: string[]
          p_send_email?: boolean
          p_target_mode?: string
          p_title: string
        }
        Returns: Json
      }
      submit_order_rating:
        | {
            Args: {
              p_comment: string
              p_order_id: string
              p_rating: number
              p_token: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_comment?: string
              p_order_id: string
              p_rating: number
              p_token?: string
            }
            Returns: boolean
          }
      sync_shared_menu_item_to_branches: {
        Args: { p_shared_menu_item_id: string }
        Returns: undefined
      }
      sync_shared_menu_to_branch: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      validate_and_create_session:
        | {
            Args: {
              p_restaurant_id: string
              p_table_id: string
              p_token?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_restaurant_id: string
              p_seat_id?: string
              p_table_id: string
              p_token?: string
            }
            Returns: Json
          }
      validate_table_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "waiter"
        | "kitchen"
        | "dedicated_manager"
        | "group_owner"
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
      app_role: [
        "super_admin",
        "admin",
        "waiter",
        "kitchen",
        "dedicated_manager",
        "group_owner",
      ],
    },
  },
} as const

