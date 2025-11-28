-- Add RLS policy to allow family creation during registration
-- This policy allows anyone to insert a family record (needed during registration)

-- Create policy to allow anyone to create a family during registration
CREATE POLICY "Anyone can create family during registration" ON families 
FOR INSERT 
WITH CHECK (true);

-- Allow users to view all families (needed for family selection)
CREATE POLICY "Anyone can view families" ON families 
FOR SELECT 
USING (true);

-- Allow family admins to update their own family
CREATE POLICY "Family admins can update their family" ON families 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.family_id = families.id 
    AND users.id = auth.uid() 
    AND users.is_family_admin = true
  )
);

COMMENT ON POLICY "Anyone can create family during registration" ON families IS 
'Allows family creation during user registration';
COMMENT ON POLICY "Anyone can view families" ON families IS 
'Allows all users to view families for selection during registration';
COMMENT ON POLICY "Family admins can update their family" ON families IS 
'Only family admins can update their family information';
