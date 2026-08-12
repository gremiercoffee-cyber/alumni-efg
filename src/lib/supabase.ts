import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in the values from the Supabase dashboard.',
  );
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On the web the default localStorage is right; AsyncStorage is a shim there
    // and loses the session on reload.
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Google sign-in comes back as a redirect with the tokens in the URL, so on
    // the web the client has to read them. Native uses a deep link instead.
    detectSessionInUrl: isWeb,
  },
});

/** Row types, so screens can import these instead of restating shapes. */
export type Tables = Database['public']['Tables'];
export type Person = Tables['people']['Row'];
export type Enrollment = Tables['enrollments']['Row'];
export type Staff = Tables['staff']['Row'];
export type Profile = Tables['profiles']['Row'];
export type Claim = Tables['claims']['Row'];
export type Simcha = Tables['simchas']['Row'];
export type Visit = Tables['visits']['Row'];
