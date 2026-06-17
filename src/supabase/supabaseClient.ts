import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface SupabaseEnv {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
}

const env = import.meta.env as unknown as SupabaseEnv;

const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function getSupabaseClient(): SupabaseClient {
    if (!supabase) {
        throw new Error("Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }

    return supabase;
}
