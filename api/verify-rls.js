import { supabase } from './db/adapter.js';

async function verifyRLS() {
  console.log('Checking RLS policies on families table...\n');
  
  // Check if the INSERT policy exists
  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT 
          policyname,
          permissive,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'families'
      `
    });
  
  if (error) {
    console.error('Error querying policies:', error);
    
    // Alternative approach - try to get table info
    const { data: tableData, error: tableError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('*')
      .eq('tablename', 'families')
      .eq('schemaname', 'public');
    
    if (tableError) {
      console.error('Cannot access table info:', tableError);
    } else {
      console.log('Families table exists:', tableData);
    }
    
    // Try listing all policies using a different method
    console.log('\nTrying alternative query method...');
    const query = `
      SELECT * FROM pg_policies WHERE tablename = 'families';
    `;
    
    // Use raw PostgreSQL client if possible
    console.log('Manual check needed - please run this SQL in Supabase dashboard:');
    console.log(query);
  } else {
    console.log('Families table RLS policies:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check for the required policy
    const hasInsertPolicy = data?.some(p => 
      p.policyname === 'Anyone can create family during registration' &&
      p.cmd === 'INSERT'
    );
    
    if (hasInsertPolicy) {
      console.log('\n✓ INSERT policy exists');
    } else {
      console.log('\n✗ INSERT policy missing - migration 007 may not be applied');
      console.log('Apply it by running the SQL in database/migrations/007_add_families_rls_policy.sql');
    }
  }
  
  process.exit(0);
}

verifyRLS();
