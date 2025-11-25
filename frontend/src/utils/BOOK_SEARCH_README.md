# Book Search System

## Overview

The book search system is a modular, extensible utility for searching books across multiple data sources (APIs). It's designed to make it easy to add, remove, or modify search sources without changing the core application code.

## Architecture

### Key Components

1. **`BookSearchSource` Interface** - Contract that all search sources must implement
2. **Search Source Classes** - Individual implementations for each API
3. **`searchBooks()` Function** - Main search orchestrator
4. **Search Strategies** - Different ways to combine results from multiple sources

## Usage

### Basic Search

```typescript
import { searchBooks } from '@/utils/bookSearch';

const results = await searchBooks('Harry Potter', {
  strategy: 'sequential',  // Try sources one by one
  maxResults: 10,
});
```

### Search Strategies

#### 1. Sequential (Default)
Tries each source in priority order, stops when results are found.

```typescript
const results = await searchBooks(query, { strategy: 'sequential' });
```

**Use when:** You want fast results and prefer higher-priority sources.

#### 2. Parallel
Searches all sources simultaneously and combines results.

```typescript
const results = await searchBooks(query, { strategy: 'parallel' });
```

**Use when:** You want comprehensive results from all sources.

#### 3. First Match
Races all sources and returns results from whoever responds first.

```typescript
const results = await searchBooks(query, { strategy: 'first-match' });
```

**Use when:** Speed is critical and any source is acceptable.

### Search Specific Sources

```typescript
import { searchBySource } from '@/utils/bookSearch';

// Search only Google Books
const googleResults = await searchBySource('google', 'Harry Potter');
```

### Get Available Sources

```typescript
import { getAvailableSources } from '@/utils/bookSearch';

const sources = getAvailableSources();
// [
//   { name: 'inl', displayName: 'הספרייה הלאומית' },
//   { name: 'google', displayName: 'Google Books' }
// ]
```

## Adding a New Search Source

### Step 1: Create a Class

Create a class that implements the `BookSearchSource` interface:

```typescript
class MyNewSource implements BookSearchSource {
  name = 'mynewsource';           // Unique identifier
  displayName = 'My New Source';  // Display name for UI
  priority = 3;                   // Lower = higher priority

  async search(query: string): Promise<BookSearchResult[]> {
    try {
      // 1. Fetch from your API
      const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      // 2. Transform to BookSearchResult format
      return data.books.map(book => ({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        year_published: book.year,
        publisher: book.publisher,
        pages: book.pageCount,
        summary: book.description,
        cover_image_url: book.coverUrl,
        source: this.displayName,
      }));
    } catch (err) {
      console.error('My New Source search failed:', err);
      return []; // Always return empty array on error
    }
  }
}
```

### Step 2: Register the Source

Add your new source to the `SEARCH_SOURCES` array in `bookSearch.ts`:

```typescript
const SEARCH_SOURCES: BookSearchSource[] = [
  new IsraelNationalLibrarySource(),
  new GoogleBooksSource(),
  new MyNewSource(), // Add your source here
].sort((a, b) => a.priority - b.priority);
```

That's it! Your source will now be automatically included in searches.

## Current Sources

### 1. Israel National Library (Priority 1)
- **API:** https://api.nli.org.il/primo/v1/search
- **Best for:** Hebrew books, Israeli publications
- **Language:** Hebrew
- **Coverage:** Comprehensive Israeli library catalog

### 2. Google Books (Priority 2)
- **API:** https://www.googleapis.com/books/v1/volumes
- **Best for:** International books, when INL has no results
- **Language:** Hebrew restricted
- **Coverage:** Massive international catalog

### 3. Open Library (Disabled)
- **API:** https://openlibrary.org/search.json
- **Status:** Implemented but commented out
- **To enable:** Uncomment in `SEARCH_SOURCES` array

## BookSearchResult Interface

All search sources must return results in this format:

```typescript
interface BookSearchResult {
  title: string;              // Book title
  author: string;             // Author name(s)
  isbn: string;               // ISBN-10 or ISBN-13
  year_published: number;     // Publication year (0 if unknown)
  publisher: string;          // Publisher name
  pages: number;              // Page count (0 if unknown)
  summary: string;            // Book description
  cover_image_url: string;    // URL to cover image
  source: string;             // Display name of source
}
```

## Best Practices

### Error Handling
- Always wrap API calls in try-catch
- Return empty array `[]` on errors, never throw
- Log errors for debugging but don't crash

### Timeouts
- Add timeouts to prevent hanging requests
- Use `AbortSignal.timeout(5000)` for 5-second timeout
- Example:
  ```typescript
  fetch(url, { signal: AbortSignal.timeout(5000) })
  ```

### Data Transformation
- Handle missing/null data gracefully
- Provide sensible defaults (empty string, 0)
- Normalize author arrays to comma-separated strings
- Extract ISBN from various formats (ISBN-10, ISBN-13)

### Priority System
- Lower priority number = searched first
- Priority 1: Primary sources (INL for Hebrew content)
- Priority 2: Secondary sources (Google Books)
- Priority 3+: Specialized or backup sources

## Examples

### Adding a WorldCat Search Source

```typescript
class WorldCatSource implements BookSearchSource {
  name = 'worldcat';
  displayName = 'WorldCat';
  priority = 4;

  async search(query: string): Promise<BookSearchResult[]> {
    try {
      const apiKey = import.meta.env.VITE_WORLDCAT_API_KEY;
      const response = await fetch(
        `http://www.worldcat.org/webservices/catalog/search/worldcat/opensearch?q=${encodeURIComponent(query)}&wskey=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      const xml = await response.text();
      // Parse XML and transform to BookSearchResult[]
      // ... implementation details ...
      
      return results;
    } catch (err) {
      console.error('WorldCat search failed:', err);
      return [];
    }
  }
}
```

### Searching Multiple Specific Sources

```typescript
const results = await searchBooks('Harry Potter', {
  strategy: 'parallel',
  sources: ['inl', 'google'], // Only these sources
  maxResults: 20,
});
```

## Troubleshooting

### No Results Found
- Check if API endpoints are accessible (CORS issues?)
- Verify API keys if required
- Test with simple queries first
- Check browser console for errors

### Slow Searches
- Reduce timeout durations
- Use 'first-match' strategy
- Limit number of sources
- Add caching layer (future enhancement)

### Duplicate Results
- System automatically deduplicates by ISBN or title+author
- Check if different sources return same books with different ISBNs

## Future Enhancements

Potential improvements to consider:

1. **Caching** - Cache search results to reduce API calls
2. **Rate Limiting** - Implement rate limiting for API requests
3. **Image Proxy** - Proxy cover images through your server
4. **User Preferences** - Let users choose preferred sources
5. **Analytics** - Track which sources provide best results
6. **Fuzzy Matching** - Better duplicate detection
7. **Pagination** - Support paginated results from APIs

## Testing

To test a new source:

```typescript
import { searchBySource } from '@/utils/bookSearch';

// Test your source in isolation
const results = await searchBySource('mynewsource', 'test query');
console.log('Results:', results);
```

## Support

For issues or questions:
- Check browser console for detailed error messages
- Verify API endpoints are accessible
- Ensure data transformations handle edge cases
- Test with various query types (title, author, ISBN)
