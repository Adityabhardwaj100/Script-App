import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/* During SSR / build the env vars may be empty — create a no-op stub so the
   build succeeds. All real calls happen client-side inside useEffect/async. */
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key-for-build');
