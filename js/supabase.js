// ==========================================
// supabase.js - Supabase Client Initialization
// ==========================================

// GANTI DUA BARIS DI BAWAH INI DENGAN KREDENSIAL SUPABASE-MU!
const SUPABASE_URL = 'https://xtiryhqorgvqksqnggnj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXJ5aHFvcmd2cWtzcW5nZ25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE5MDgyMCwiZXhwIjoyMDg4NzY2ODIwfQ.H7CUZTk1glB6-2y2BwknysM8nStPjprBjvmlWaYYL9E';

// Inisialisasi Supabase Client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
