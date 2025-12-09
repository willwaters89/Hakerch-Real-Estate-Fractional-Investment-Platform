require('dotenv').config({ path: './envfile.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Using SUPABASE_SECRET_KEY from envfile.env

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Please check your envfile.env');
  console.log('Current environment variables:', {
    SUPABASE_URL: process.env.SUPABASE_URL ? '***' : 'MISSING',
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ? '***' : 'MISSING',
    PORT: process.env.PORT
  });
  throw new Error('Missing Supabase URL or Key in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

module.exports = supabase;
