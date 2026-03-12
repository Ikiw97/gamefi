// ==========================================
// supabase.js - Supabase Client Initialization
// ==========================================

// Supabase Public Credentials (anon key only – safe for client-side)
const SUPABASE_URL = 'https://xtiryhqorgvqksqnggnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXJ5aHFvcmd2cWtzcW5nZ25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTA4MjAsImV4cCI6MjA4ODc2NjgyMH0.tUc12OP0qKqn95HOF53_UO080VN_58Zr0dZZ6yZFndk';

// Inisialisasi Supabase Client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


