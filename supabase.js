const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// No Render, garante que tens estas duas variáveis nas "Environment Variables"
const supabaseUrl = 'https://fdbmhgcfhdnnpwuodxzh.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY; // Usa a Service Role Key aqui

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
