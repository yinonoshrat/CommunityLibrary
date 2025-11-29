import { supabase } from './db/adapter.js';

async function checkPolicies() {
  console.log('Checking families table policies...\n');
  
  // Try to query policies
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Query successful, data:', data);
  }
  
  // Try to insert
  console.log('\nTrying to insert a test family...');
  const { data: insertData, error: insertError } = await supabase
    .from('families')
    .insert({
      name: 'Test Family RLS',
      phone: '123456789',
      whatsapp: '123456789',
      email: 'test@example.com'
    })
    .select();
  
  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Insert successful:', insertData);
    
    // Clean up
    if (insertData && insertData[0]) {
      await supabase
        .from('families')
        .delete()
        .eq('id', insertData[0].id);
      console.log('Test family deleted');
    }
  }
  
  process.exit(0);
}

checkPolicies();
