import { db, supabase, supabaseAuth } from './db/adapter.js';

const authClient = supabaseAuth ?? supabase;

async function testRegistrationFlow() {
  console.log('Testing registration flow...\n');
  
  // Test data
  const email = 'test@example.com';
  const password = 'TestPass123!';
  const fullName = 'Test User';
  const phone = '1234567890';
  const familyName = 'Test Family ' + Date.now();
  
  console.log('Environment check:');
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING');
  console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Present' : 'MISSING');
  console.log('- Using authClient:', authClient === supabase ? 'service role' : 'anon key');
  console.log();
  
  try {
    // Step 1: Create auth user
    console.log('Step 1: Creating auth user...');
    const uniqueAuthEmail = `test.${Date.now()}@example.com`;
    
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email: uniqueAuthEmail,
      password,
    });
    
    if (authError) {
      console.error('✗ Auth signup failed:', authError.message);
      return;
    }
    
    if (!authData.user) {
      console.error('✗ No user returned from signup');
      return;
    }
    
    console.log('✓ Auth user created:', authData.user.id);
    
    // Step 2: Create family
    console.log('\nStep 2: Creating family...');
    console.log('Using supabase client from adapter (should have service role)');
    console.log('Family data:', { name: familyName, phone, email });
    
    const { data: newFamily, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName,
        phone: phone,
        whatsapp: phone,
        email: email
      })
      .select()
      .single();
    
    if (familyError) {
      console.error('✗ Family creation failed:', familyError.message);
      console.error('Full error:', JSON.stringify(familyError, null, 2));
      
      // Clean up auth user
      console.log('\nCleaning up auth user...');
      await supabase.auth.admin.deleteUser(authData.user.id);
      return;
    }
    
    console.log('✓ Family created:', newFamily.id);
    
    // Step 3: Create user profile
    console.log('\nStep 3: Creating user profile...');
    const user = await db.users.create({
      id: authData.user.id,
      email: email,
      auth_email: uniqueAuthEmail,
      full_name: fullName,
      phone: phone,
      whatsapp: phone,
      family_id: newFamily.id,
      is_family_admin: true
    });
    
    console.log('✓ User profile created:', user.id);
    
    // Cleanup
    console.log('\nCleaning up test data...');
    await supabase.from('users').delete().eq('id', user.id);
    await supabase.from('families').delete().eq('id', newFamily.id);
    await supabase.auth.admin.deleteUser(authData.user.id);
    console.log('✓ Cleanup complete');
    
    console.log('\n✓✓✓ Registration flow test PASSED ✓✓✓');
    
  } catch (error) {
    console.error('\n✗✗✗ Registration flow test FAILED ✗✗✗');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testRegistrationFlow();
