const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://fdbmhgcfhdnnpwuodxzh.supabase.co',
  'sb_publishable_JxKPSuw9rtJCOmZBaXCp0w_tdgNK0X6'
);

module.exports = supabase;
