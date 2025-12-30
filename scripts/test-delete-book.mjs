/**
 * Test script to verify book deletion behavior at the database level
 * Run with: node --env-file=.env.development.local scripts/test-delete-book.mjs
 */

// Disable SSL validation for self-signed certs in dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Run with:');
  console.error('node --env-file=.env.development.local scripts/test-delete-book.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDeleteBookFlow() {
  console.log('=== Testing Book Deletion Flow ===\n');
  
  // Step 1: Get a family to work with
  console.log('1. Getting a test family...');
  const { data: families, error: familyError } = await supabase
    .from('families')
    .select('id, name')
    .limit(1);
  
  if (familyError || !families?.length) {
    console.error('Error getting family:', familyError);
    return;
  }
  
  const familyId = families[0].id;
  console.log(`   Using family: ${families[0].name} (${familyId})\n`);
  
  // Step 2: Create a test book in catalog
  console.log('2. Creating a test book in catalog...');
  const testTitle = `DELETE_TEST_${Date.now()}`;
  
  const { data: catalogEntry, error: catalogError } = await supabase
    .from('book_catalog')
    .insert({ title: testTitle, author: 'Test Author' })
    .select()
    .single();
  
  if (catalogError) {
    console.error('Error creating catalog entry:', catalogError);
    return;
  }
  console.log(`   Created catalog entry: ${catalogEntry.id}\n`);
  
  // Step 3: Create family_books entry
  console.log('3. Creating family_books entry...');
  const { data: familyBook, error: fbError } = await supabase
    .from('family_books')
    .insert({ 
      family_id: familyId, 
      book_catalog_id: catalogEntry.id,
      status: 'available'
    })
    .select()
    .single();
  
  if (fbError) {
    console.error('Error creating family_books entry:', fbError);
    return;
  }
  console.log(`   Created family_books entry: ${familyBook.id}\n`);
  
  // Step 4: Verify book appears in books_view
  console.log('4. Querying books_view BEFORE delete...');
  const { data: viewBefore, error: viewBeforeError } = await supabase
    .from('books_view')
    .select('id, title, family_id')
    .eq('id', familyBook.id);
  
  console.log(`   books_view result: ${JSON.stringify(viewBefore)}`);
  console.log(`   Error: ${viewBeforeError}\n`);
  
  // Step 5: Query with filters like the API does
  console.log('5. Querying books_view with family filter BEFORE delete...');
  const { data: filteredBefore, error: filteredBeforeError } = await supabase
    .from('books_view')
    .select('id, title, family_id')
    .eq('family_id', familyId)
    .ilike('title', `%DELETE_TEST%`);
  
  console.log(`   Filtered result: ${JSON.stringify(filteredBefore)}`);
  console.log(`   Error: ${filteredBeforeError}\n`);
  
  // Step 6: Delete the family_books entry
  console.log('6. Deleting family_books entry...');
  const { data: deleteResult, error: deleteError } = await supabase
    .from('family_books')
    .delete()
    .eq('id', familyBook.id)
    .select();
  
  console.log(`   Delete result: ${JSON.stringify(deleteResult)}`);
  console.log(`   Error: ${deleteError}\n`);
  
  // Step 7: Query books_view AFTER delete (no wait)
  console.log('7. Querying books_view IMMEDIATELY after delete...');
  const { data: viewAfter, error: viewAfterError } = await supabase
    .from('books_view')
    .select('id, title, family_id')
    .eq('id', familyBook.id);
  
  console.log(`   books_view result: ${JSON.stringify(viewAfter)}`);
  console.log(`   Error: ${viewAfterError}\n`);
  
  // Step 8: Query with filters AFTER delete
  console.log('8. Querying books_view with family filter AFTER delete...');
  const { data: filteredAfter, error: filteredAfterError } = await supabase
    .from('books_view')
    .select('id, title, family_id')
    .eq('family_id', familyId)
    .ilike('title', `%DELETE_TEST%`);
  
  console.log(`   Filtered result: ${JSON.stringify(filteredAfter)}`);
  console.log(`   Error: ${filteredAfterError}\n`);
  
  // Step 9: Check if family_books entry still exists
  console.log('9. Checking family_books table directly...');
  const { data: directCheck, error: directError } = await supabase
    .from('family_books')
    .select('id')
    .eq('id', familyBook.id);
  
  console.log(`   family_books direct check: ${JSON.stringify(directCheck)}`);
  console.log(`   Error: ${directError}\n`);
  
  // Clean up: Delete test catalog entry
  console.log('10. Cleaning up catalog entry...');
  await supabase
    .from('book_catalog')
    .delete()
    .eq('id', catalogEntry.id);
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Book in view BEFORE delete: ${viewBefore?.length > 0 ? 'YES' : 'NO'}`);
  console.log(`Book in view AFTER delete: ${viewAfter?.length > 0 ? 'YES (BUG!)' : 'NO (correct)'}`);
  console.log(`Book in filtered BEFORE: ${filteredBefore?.length > 0 ? 'YES' : 'NO'}`);
  console.log(`Book in filtered AFTER: ${filteredAfter?.length > 0 ? 'YES (BUG!)' : 'NO (correct)'}`);
  
  if (viewAfter?.length > 0 || filteredAfter?.length > 0) {
    console.log('\n⚠️  BUG CONFIRMED: books_view returns deleted books!');
  } else {
    console.log('\n✅ Database behavior is correct - view does not return deleted books');
    console.log('   The issue must be in application caching or connection pooling');
  }
}

testDeleteBookFlow().catch(console.error);
