import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from './supabase-config';
const { url, key } = readSupabaseConfig(import.meta.env);
export const supabase = createClient(url, key);
