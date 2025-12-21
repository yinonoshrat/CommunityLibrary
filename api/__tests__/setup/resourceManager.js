import { createClient } from '@supabase/supabase-js'

class TestResourceManager {
  constructor() {
    this.resources = {
      books: new Set(),
      loans: new Set(),
      reviews: new Set(),
      users: new Set(),
      families: new Set(),
      notifications: new Set(),
      likes: new Set(),
      detection_jobs: new Set()
    }
    
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }

  track(type, id) {
    if (this.resources[type]) {
      this.resources[type].add(id)
    } else {
      console.warn(`Unknown resource type: ${type}`)
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test resources...')
    
    // Delete in order of dependency (e.g. loans before books)
    
    // 1. Loans
    if (this.resources.loans.size > 0) {
      const { error } = await this.supabase
        .from('loans')
        .delete()
        .in('id', Array.from(this.resources.loans))
      
      if (error) console.error('Error cleaning loans:', error)
      else console.log(`✓ Cleaned ${this.resources.loans.size} loans`)
      this.resources.loans.clear()
    }

    // 2. Reviews & Likes
    if (this.resources.reviews.size > 0) {
      const { error } = await this.supabase
        .from('reviews')
        .delete()
        .in('id', Array.from(this.resources.reviews))
        
      if (error) console.error('Error cleaning reviews:', error)
      else console.log(`✓ Cleaned ${this.resources.reviews.size} reviews`)
      this.resources.reviews.clear()
    }

    if (this.resources.likes.size > 0) {
        // Likes are usually on books or reviews. 
        // If on books, they cascade delete? If on reviews, they cascade delete?
        // Let's try to delete them explicitly if we tracked them.
        const { error } = await this.supabase
          .from('likes')
          .delete()
          .in('id', Array.from(this.resources.likes))
          
        if (error) console.error('Error cleaning likes:', error)
        else console.log(`✓ Cleaned ${this.resources.likes.size} likes`)
        this.resources.likes.clear()
    }

    // 3. Books
    if (this.resources.books.size > 0) {
      // First delete related notifications
      // (Assuming notifications might reference books, though usually they reference users/loans)
      
      const { error } = await this.supabase
        .from('books')
        .delete()
        .in('id', Array.from(this.resources.books))
        
      if (error) console.error('Error cleaning books:', error)
      else console.log(`✓ Cleaned ${this.resources.books.size} books`)
      this.resources.books.clear()
    }

    // 4. Users (except shared)
    if (this.resources.users.size > 0) {
      // Delete from auth.users (triggers cascade to public.users)
      const { error } = await this.supabase.auth.admin.deleteUser(
        Array.from(this.resources.users)[0] // deleteUser takes one ID? Or loop?
      )
      
      // Admin deleteUser takes one ID. We need to loop.
      for (const userId of this.resources.users) {
          const { error } = await this.supabase.auth.admin.deleteUser(userId)
          if (error) console.error(`Error cleaning user ${userId}:`, error)
      }
      console.log(`✓ Cleaned ${this.resources.users.size} users`)
      this.resources.users.clear()
    }

    // 5. Families (except shared)
    if (this.resources.families.size > 0) {
      const { error } = await this.supabase
        .from('families')
        .delete()
        .in('id', Array.from(this.resources.families))
        
      if (error) console.error('Error cleaning families:', error)
      else console.log(`✓ Cleaned ${this.resources.families.size} families`)
      this.resources.families.clear()
    }

    // 6. Detection Jobs
    if (this.resources.detection_jobs.size > 0) {
      const { error } = await this.supabase
        .from('detection_jobs')
        .delete()
        .in('id', Array.from(this.resources.detection_jobs))
        
      if (error) console.error('Error cleaning detection jobs:', error)
      else console.log(`✓ Cleaned ${this.resources.detection_jobs.size} detection jobs`)
      this.resources.detection_jobs.clear()
    }
  }
}

export const resourceManager = new TestResourceManager()
