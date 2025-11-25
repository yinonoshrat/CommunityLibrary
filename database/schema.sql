-- Community Library Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Families table
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    whatsapp VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    auth_email VARCHAR(255) NOT NULL UNIQUE, -- The unique email used in Supabase Auth
    whatsapp VARCHAR(20),
    is_family_admin BOOLEAN DEFAULT FALSE,
    remember_me BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books table
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(500) NOT NULL,
    title_hebrew VARCHAR(500),
    author VARCHAR(255),
    author_hebrew VARCHAR(255),
    isbn VARCHAR(20),
    publisher VARCHAR(255),
    publish_year INTEGER,
    genre VARCHAR(100),
    age_range VARCHAR(50),
    pages INTEGER,
    description TEXT,
    cover_image_url TEXT,
    series VARCHAR(255),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'unavailable')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loans table
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
    borrower_family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    owner_family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'returned')),
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    return_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviews table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

-- Likes table
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(book_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_users_family_id ON users(family_id);
CREATE INDEX idx_books_family_id ON books(family_id);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_loans_book_id ON loans(book_id);
CREATE INDEX idx_loans_borrower_family_id ON loans(borrower_family_id);
CREATE INDEX idx_loans_owner_family_id ON loans(owner_family_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_reviews_book_id ON reviews(book_id);
CREATE INDEX idx_likes_book_id ON likes(book_id);

-- Row Level Security (RLS) Policies
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Users can read all families
CREATE POLICY "Users can view all families" ON families FOR SELECT USING (true);

-- Users can update their own family
CREATE POLICY "Family admins can update family" ON families FOR UPDATE 
    USING (id IN (SELECT family_id FROM users WHERE id = auth.uid() AND is_family_admin = true));

-- Users can read all users
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users FOR UPDATE 
    USING (id = auth.uid());

-- Anyone can create user during registration (before auth session exists)
CREATE POLICY "Anyone can create user during registration" ON users 
FOR INSERT 
WITH CHECK (true);

-- Users can read all books
CREATE POLICY "Users can view all books" ON books FOR SELECT USING (true);

-- Users can manage their family's books
CREATE POLICY "Family members can manage family books" ON books FOR ALL 
    USING (family_id IN (SELECT family_id FROM users WHERE id = auth.uid()));

-- Users can view all loans
CREATE POLICY "Users can view loans" ON loans FOR SELECT USING (true);

-- Users can create loan requests
CREATE POLICY "Users can create loan requests" ON loans FOR INSERT 
    WITH CHECK (borrower_family_id IN (SELECT family_id FROM users WHERE id = auth.uid()));

-- Family admins can manage loans for their books
CREATE POLICY "Family admins can manage loans" ON loans FOR UPDATE 
    USING (owner_family_id IN (SELECT family_id FROM users WHERE id = auth.uid() AND is_family_admin = true));

-- Users can view all reviews
CREATE POLICY "Users can view all reviews" ON reviews FOR SELECT USING (true);

-- Users can manage their own reviews
CREATE POLICY "Users can manage own reviews" ON reviews FOR ALL 
    USING (user_id = auth.uid());

-- Users can view all likes
CREATE POLICY "Users can view all likes" ON likes FOR SELECT USING (true);

-- Users can manage their own likes
CREATE POLICY "Users can manage own likes" ON likes FOR ALL 
    USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
