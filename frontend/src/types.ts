// Shared type definitions for the Community Library application

export interface Book {
  id: string;
  title?: string;
  title_hebrew?: string;
  author?: string;
  author_hebrew?: string;
  series?: string;
  series_number?: number;
  isbn?: string;
  publish_year?: number;
  publisher?: string;
  genre?: string;
  age_range?: string;
  pages?: number;
  description?: string;
  cover_image_url?: string;
  status: 'available' | 'on_loan' | 'borrowed';
  family_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  whatsapp?: string;
  family_id: string;
  is_family_admin: boolean;
  created_at?: string;
}

export interface Family {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  created_at?: string;
}

export interface Loan {
  id: string;
  family_book_id: string;
  borrower_family_id: string;
  owner_family_id: string;
  requester_id?: string;
  status: 'active' | 'returned';
  request_date: string;
  actual_return_date?: string;
  notes?: string;
  return_notes?: string;
  family_books?: {
    id: string;
    book_catalog: {
      title?: string;
      title_hebrew?: string;
      author?: string;
      author_hebrew?: string;
      cover_image_url?: string;
    };
  };
  books?: {
    title?: string;
    title_hebrew?: string;
    author?: string;
    author_hebrew?: string;
    cover_image_url?: string;
  };
  borrower_family?: {
    name: string;
    phone: string;
    whatsapp?: string;
  };
  owner_family?: {
    name: string;
    phone: string;
    whatsapp?: string;
  };
  requester?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

export interface BookLoanSummary {
  id: string;
  status: string;
  familyBookId: string;
  borrowerFamilyId?: string;
  ownerFamilyId?: string;
  requestDate?: string;
  approvedDate?: string;
  dueDate?: string;
  returnDate?: string;
  notes?: string | null;
  borrowerFamily?: FamilyContact | null;
  ownerFamily?: FamilyContact | null;
}

export interface FamilyContact {
  id?: string;
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
}

export interface BookOwner {
  familyBookId: string;
  status: string;
  condition?: string | null;
  notes?: string | null;
  familyId: string;
  family: FamilyContact | null;
  loan?: BookLoanSummary | null;
  isViewerOwner: boolean;
}

export interface CatalogBookViewerContext {
  owns: boolean;
  borrowed: boolean;
  ownedCopies: Array<{
    familyBookId: string;
    status: string;
    loan?: BookLoanSummary | null;
  }>;
  borrowedLoan?: BookLoanSummary | null;
}

export interface CatalogBook {
  catalogId: string;
  title?: string;
  titleHebrew?: string;
  author?: string;
  authorHebrew?: string;
  isbn?: string;
  publisher?: string;
  publishYear?: number;
  genre?: string;
  ageRange?: string;
  pages?: number;
  description?: string;
  coverImageUrl?: string;
  series?: string;
  seriesNumber?: number;
  stats: {
    totalCopies: number;
    availableCopies: number;
    onLoanCopies: number;
    totalLikes: number;
    userLiked: boolean;
  };
  likesCount: number;
  owners: BookOwner[];
  viewerContext: CatalogBookViewerContext;
}
