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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      claim_reports: {
        Row: {
          claim_id: number
          created_at: string
          id: number
          note: string | null
          reported_by: string | null
        }
        Insert: {
          claim_id: number
          created_at?: string
          id?: number
          note?: string | null
          reported_by?: string | null
        }
        Update: {
          claim_id?: number
          created_at?: string
          id?: number
          note?: string | null
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_reports_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_reports_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "reported_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          created_at: string
          id: number
          payload: Json
          person_id: number | null
          reopened_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          staff_id: number | null
          status: Database["public"]["Enums"]["claim_status"]
          type: Database["public"]["Enums"]["claim_type"]
        }
        Insert: {
          created_at?: string
          id?: number
          payload?: Json
          person_id?: number | null
          reopened_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: number | null
          status?: Database["public"]["Enums"]["claim_status"]
          type: Database["public"]["Enums"]["claim_type"]
        }
        Update: {
          created_at?: string
          id?: number
          payload?: Json
          person_id?: number | null
          reopened_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_id?: number | null
          status?: Database["public"]["Enums"]["claim_status"]
          type?: Database["public"]["Enums"]["claim_type"]
        }
        Relationships: [
          {
            foreignKeyName: "claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          academic_year: string
          id: number
          level: Database["public"]["Enums"]["program_level"] | null
          person_id: number
          rebbe_id: number | null
        }
        Insert: {
          academic_year: string
          id?: number
          level?: Database["public"]["Enums"]["program_level"] | null
          person_id: number
          rebbe_id?: number | null
        }
        Update: {
          academic_year?: string
          id?: number
          level?: Database["public"]["Enums"]["program_level"] | null
          person_id?: number
          rebbe_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "enrollments_rebbe_id_fkey"
            columns: ["rebbe_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          event_id: number
          guests: number
          id: number
          note: string | null
          person_id: number | null
          rsvped_at: string | null
          source: string
        }
        Insert: {
          event_id: number
          guests?: number
          id?: number
          note?: string | null
          person_id?: number | null
          rsvped_at?: string | null
          source?: string
        }
        Update: {
          event_id?: number
          guests?: number
          id?: number
          note?: string | null
          person_id?: number | null
          rsvped_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string | null
          id: number
          location: string | null
          name: string
          on_feed: boolean
          rsvp_open: boolean
          rsvp_token: string | null
          starts_on: string | null
          type: Database["public"]["Enums"]["event_type"]
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: number
          location?: string | null
          name: string
          on_feed?: boolean
          rsvp_open?: boolean
          rsvp_token?: string | null
          starts_on?: string | null
          type?: Database["public"]["Enums"]["event_type"]
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: number
          location?: string | null
          name?: string
          on_feed?: boolean
          rsvp_open?: boolean
          rsvp_token?: string | null
          starts_on?: string | null
          type?: Database["public"]["Enums"]["event_type"]
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_contacts: {
        Row: {
          email: string | null
          id: number
          name: string | null
          person_id: number
          phone: string | null
          relation: Database["public"]["Enums"]["family_relation"]
        }
        Insert: {
          email?: string | null
          id?: number
          name?: string | null
          person_id: number
          phone?: string | null
          relation: Database["public"]["Enums"]["family_relation"]
        }
        Update: {
          email?: string | null
          id?: number
          name?: string | null
          person_id?: number
          phone?: string | null
          relation?: Database["public"]["Enums"]["family_relation"]
        }
        Relationships: [
          {
            foreignKeyName: "family_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
      interactions: {
        Row: {
          campaign: string | null
          channel: string | null
          created_at: string
          id: number
          note: string | null
          occurred_on: string
          person_id: number
          recorded_by: string | null
          source: string
          staff_id: number | null
        }
        Insert: {
          campaign?: string | null
          channel?: string | null
          created_at?: string
          id?: number
          note?: string | null
          occurred_on: string
          person_id: number
          recorded_by?: string | null
          source?: string
          staff_id?: number | null
        }
        Update: {
          campaign?: string | null
          channel?: string | null
          created_at?: string
          id?: number
          note?: string | null
          occurred_on?: string
          person_id?: number
          recorded_by?: string | null
          source?: string
          staff_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "interactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          address: string
          attempts: number
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at: string
          error: string | null
          id: number
          outbox_id: number
          recipient_id: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          address: string
          attempts?: number
          channel: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          error?: string | null
          id?: number
          outbox_id: number
          recipient_id?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          address?: string
          attempts?: number
          channel?: Database["public"]["Enums"]["notify_channel"]
          created_at?: string
          error?: string | null
          id?: number
          outbox_id?: number
          recipient_id?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "notification_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: number
          kind: string
          last_error: string | null
          payload: Json
          person_id: number | null
          sent_at: string | null
          subject_id: number
          subject_table: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: number
          kind: string
          last_error?: string | null
          payload?: Json
          person_id?: number | null
          sent_at?: string | null
          subject_id: number
          subject_table: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: number
          kind?: string
          last_error?: string | null
          payload?: Json
          person_id?: number | null
          sent_at?: string | null
          subject_id?: number
          subject_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: number
          name: string | null
          profile_id: string | null
          staff_id: number | null
          wants_email: boolean
          wants_push: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: number
          name?: string | null
          profile_id?: string | null
          staff_id?: number | null
          wants_email?: boolean
          wants_push?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: number
          name?: string | null
          profile_id?: string | null
          staff_id?: number | null
          wants_email?: boolean
          wants_push?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          aish_impact: string | null
          city: string | null
          college: string | null
          contact_updated_on: string | null
          country: string | null
          created_at: string
          do_not_contact: boolean
          do_not_contact_reason: string | null
          email: string | null
          expected_graduation_year: number | null
          first_name: string
          grad_school: string | null
          graduated_year: number | null
          high_school: string | null
          hometown: string | null
          id: number
          last_name: string
          learning_post_gesher: string | null
          marital_status: string | null
          nickname: string | null
          notes: string | null
          occupation: string | null
          phone: string | null
          spotlight: boolean
          spouse_name: string | null
          state: string | null
          street_address: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          aish_impact?: string | null
          city?: string | null
          college?: string | null
          contact_updated_on?: string | null
          country?: string | null
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          expected_graduation_year?: number | null
          first_name: string
          grad_school?: string | null
          graduated_year?: number | null
          high_school?: string | null
          hometown?: string | null
          id?: number
          last_name: string
          learning_post_gesher?: string | null
          marital_status?: string | null
          nickname?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          spotlight?: boolean
          spouse_name?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          aish_impact?: string | null
          city?: string | null
          college?: string | null
          contact_updated_on?: string | null
          country?: string | null
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          expected_graduation_year?: number | null
          first_name?: string
          grad_school?: string | null
          graduated_year?: number | null
          high_school?: string | null
          hometown?: string | null
          id?: number
          last_name?: string
          learning_post_gesher?: string | null
          marital_status?: string | null
          nickname?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          spotlight?: boolean
          spouse_name?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      person_aliases: {
        Row: {
          alias: string
          person_id: number
        }
        Insert: {
          alias: string
          person_id: number
        }
        Update: {
          alias?: string
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_aliases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_aliases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
      person_edits: {
        Row: {
          created_at: string
          field: string
          id: number
          new_value: string | null
          old_value: string | null
          person_id: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          field: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          person_id: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          field?: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          person_id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_edits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_edits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_edits_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_edits_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_edits_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          staff_id: number | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: number | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simchas: {
        Row: {
          announced_at: string | null
          announced_by: string | null
          created_at: string
          created_by: string | null
          id: number
          note: string | null
          occurred_on: string | null
          parent_simcha_id: number | null
          person_id: number | null
          spouse_name: string | null
          staff_id: number | null
          type: Database["public"]["Enums"]["simcha_type"]
          wedding_on: string | null
        }
        Insert: {
          announced_at?: string | null
          announced_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          note?: string | null
          occurred_on?: string | null
          parent_simcha_id?: number | null
          person_id?: number | null
          spouse_name?: string | null
          staff_id?: number | null
          type: Database["public"]["Enums"]["simcha_type"]
          wedding_on?: string | null
        }
        Update: {
          announced_at?: string | null
          announced_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          note?: string | null
          occurred_on?: string | null
          parent_simcha_id?: number | null
          person_id?: number | null
          spouse_name?: string | null
          staff_id?: number | null
          type?: Database["public"]["Enums"]["simcha_type"]
          wedding_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simchas_announced_by_fkey"
            columns: ["announced_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_announced_by_fkey"
            columns: ["announced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_parent_simcha_id_fkey"
            columns: ["parent_simcha_id"]
            isOneToOne: false
            referencedRelation: "engagements_awaiting_date"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "simchas_parent_simcha_id_fkey"
            columns: ["parent_simcha_id"]
            isOneToOne: false
            referencedRelation: "simchas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "simchas_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: number
          name: string
          phone: string | null
          surname: string
          title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: number
          name: string
          phone?: string | null
          surname: string
          title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: number
          name?: string
          phone?: string | null
          surname?: string
          title?: string | null
        }
        Relationships: []
      }
      staff_connections: {
        Row: {
          created_at: string
          note: string | null
          person_id: number
          staff_id: number
        }
        Insert: {
          created_at?: string
          note?: string | null
          person_id: number
          staff_id: number
        }
        Update: {
          created_at?: string
          note?: string | null
          person_id?: number
          staff_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_connections_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_connections_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "staff_connections_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          bed_note: string | null
          created_at: string
          expected: boolean
          has_bed: boolean | null
          id: number
          kind: string
          nights: number | null
          note: string | null
          overnight: boolean
          person_id: number
          recorded_by: string | null
          until_date: string | null
          visited_on: string
        }
        Insert: {
          bed_note?: string | null
          created_at?: string
          expected?: boolean
          has_bed?: boolean | null
          id?: number
          kind?: string
          nights?: number | null
          note?: string | null
          overnight?: boolean
          person_id: number
          recorded_by?: string | null
          until_date?: string | null
          visited_on: string
        }
        Update: {
          bed_note?: string | null
          created_at?: string
          expected?: boolean
          has_bed?: boolean | null
          id?: number
          kind?: string
          nights?: number | null
          note?: string | null
          overnight?: boolean
          person_id?: number
          recorded_by?: string | null
          until_date?: string | null
          visited_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "visits_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_queue: {
        Row: {
          id: number | null
          kind: string | null
          on_date: string | null
          person_id: number | null
          report_count: number | null
          since: string | null
          staff_id: number | null
          status: string | null
          subject_name: string | null
          subtype: string | null
        }
        Relationships: []
      }
      engagements_awaiting_date: {
        Row: {
          days_since: number | null
          engaged_on: string | null
          engagement_id: number | null
          person_id: number | null
          staff_id: number | null
          subject_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simchas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simchas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "simchas_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      event_roster: {
        Row: {
          display_name: string | null
          email: string | null
          event_id: number | null
          guests: number | null
          id: number | null
          note: string | null
          person_id: number | null
          phone: string | null
          rsvped_at: string | null
          source: string | null
          unmatched: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
      event_summary: {
        Row: {
          coming: number | null
          description: string | null
          ends_on: string | null
          heads: number | null
          id: number | null
          location: string | null
          name: string | null
          on_feed: boolean | null
          rsvp_open: boolean | null
          rsvp_token: string | null
          starts_on: string | null
          type: string | null
          unmatched: number | null
          via_link: number | null
          year: number | null
        }
        Relationships: []
      }
      feed: {
        Row: {
          created_at: string | null
          detail: string | null
          id: number | null
          kind: string | null
          note: string | null
          on_date: string | null
          person_id: number | null
          staff_id: number | null
          subject_name: string | null
          subtype: string | null
        }
        Relationships: []
      }
      pending_users: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          id: string | null
          signed_up_at: string | null
        }
        Relationships: []
      }
      person_last_contact: {
        Row: {
          contact_count: number | null
          last_contacted_on: string | null
          person_id: number | null
        }
        Relationships: []
      }
      reported_claims: {
        Row: {
          id: number | null
          on_date: string | null
          person_id: number | null
          report_count: number | null
          since: string | null
          staff_id: number | null
          status: string | null
          subject_name: string | null
          subtype: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "claims_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_nights: {
        Row: {
          arrives: string | null
          bed_note: string | null
          expected: boolean | null
          has_bed: boolean | null
          leaves: string | null
          name: string | null
          night: string | null
          person_id: number | null
          visit_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
      stays_needing_beds: {
        Row: {
          arrives: string | null
          days_until: number | null
          leaves: string | null
          name: string | null
          nights_here: number | null
          person_id: number | null
          visit_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_last_contact"
            referencedColumns: ["person_id"]
          },
        ]
      }
    }
    Functions: {
      admin_emails: { Args: never; Returns: string[] }
      apply_person_edit: {
        Args: { p_approve: boolean; p_edit_id: number }
        Returns: undefined
      }
      attach_rsvp: {
        Args: { p_attendance_id: number; p_person_id: number }
        Returns: undefined
      }
      current_staff_id: { Args: never; Returns: number }
      editable_person_fields: { Args: never; Returns: string[] }
      fan_out_notification: { Args: { p_outbox_id: number }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      reset_rsvp_token: { Args: { p_event_id: number }; Returns: string }
      rsvp_event: {
        Args: { p_token: string }
        Returns: {
          description: string
          ends_on: string
          event_name: string
          location: string
          starts_on: string
        }[]
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user: string
        }
        Returns: undefined
      }
      submit_rsvp: {
        Args: {
          p_email: string
          p_guests?: number
          p_name?: string
          p_token: string
        }
        Returns: string
      }
    }
    Enums: {
      claim_status: "pending" | "approved" | "rejected"
      claim_type:
        | "engagement"
        | "wedding"
        | "birth"
        | "graduation"
        | "contact_update"
        | "other"
        | "child_engagement"
        | "child_wedding"
        | "grandchild_birth"
        | "bar_mitzvah"
        | "wedding_scheduled"
        | "child_bar_mitzvah"
        | "child_wedding_scheduled"
      delivery_status: "pending" | "sent" | "failed" | "skipped"
      event_type: "shabbaton" | "dinner" | "other"
      family_relation: "father" | "mother" | "other"
      notify_channel: "email" | "push" | "sms"
      program_level:
        | "Shana Alef"
        | "Shana Bet"
        | "Shana Gimel"
        | "Shana Daled"
        | "Madrich"
      simcha_type:
        | "engagement"
        | "wedding"
        | "birth"
        | "other"
        | "child_engagement"
        | "child_wedding"
        | "grandchild_birth"
        | "bar_mitzvah"
        | "wedding_scheduled"
        | "child_bar_mitzvah"
        | "child_wedding_scheduled"
      user_role: "admin" | "staff" | "viewer" | "pending"
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
      claim_status: ["pending", "approved", "rejected"],
      claim_type: [
        "engagement",
        "wedding",
        "birth",
        "graduation",
        "contact_update",
        "other",
        "child_engagement",
        "child_wedding",
        "grandchild_birth",
        "bar_mitzvah",
        "wedding_scheduled",
        "child_bar_mitzvah",
        "child_wedding_scheduled",
      ],
      delivery_status: ["pending", "sent", "failed", "skipped"],
      event_type: ["shabbaton", "dinner", "other"],
      family_relation: ["father", "mother", "other"],
      notify_channel: ["email", "push", "sms"],
      program_level: [
        "Shana Alef",
        "Shana Bet",
        "Shana Gimel",
        "Shana Daled",
        "Madrich",
      ],
      simcha_type: [
        "engagement",
        "wedding",
        "birth",
        "other",
        "child_engagement",
        "child_wedding",
        "grandchild_birth",
        "bar_mitzvah",
        "wedding_scheduled",
        "child_bar_mitzvah",
        "child_wedding_scheduled",
      ],
      user_role: ["admin", "staff", "viewer", "pending"],
    },
  },
} as const
