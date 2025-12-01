# Supabase OAuth Configuration Guide

This document outlines the necessary configuration changes in your Supabase production project to enable Google and Facebook OAuth authentication.

## Overview

The CommunityLibrary application now supports two authentication methods:
1. **Email/Password** - Traditional authentication (already configured)
2. **Google OAuth** - Sign in with Google account (requires configuration)

## Prerequisites

Before configuring Supabase, you need to:

1. **Google OAuth Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create OAuth 2.0 credentials (Client ID and Secret)
   - Set authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`

## Supabase Dashboard Configuration

### Step 1: Access Authentication Settings

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your production project
3. Navigate to **Authentication** → **Providers** in the left sidebar

### Step 2: Configure Google Provider

1. In the Providers list, find **Google** and click to expand
2. Toggle **Enable Sign in with Google** to **ON**
3. Enter your Google OAuth credentials:
   - **Client ID**: Your Google OAuth 2.0 Client ID
   - **Client Secret**: Your Google OAuth 2.0 Client Secret
4. Click **Save**

**Additional Google Configuration**:
- In Google Cloud Console, under OAuth Consent Screen:
  - Add your Supabase domain: `<project-ref>.supabase.co` to Authorized domains
  - Configure scopes: `openid`, `email`, `profile`
- Under Credentials → OAuth 2.0 Client IDs:
  - Add `https://<project-ref>.supabase.co/auth/v1/callback` to Authorized redirect URIs
  - For local development: `http://localhost:5173/auth/callback` (or your dev port)

### Step 3: Configure Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Add your application URLs to the **Redirect URLs** allowlist:
   ```
   http://localhost:5173/auth/callback  (for local development)
   https://your-production-domain.com/auth/callback  (for production)
   https://your-vercel-deployment.vercel.app/auth/callback  (if using Vercel)
   ```
3. Set **Site URL** to your primary application URL
4. Click **Save**

## Environment Variables

Ensure your application has the correct Supabase environment variables:

### Frontend (.env or Vercel Environment Variables)
```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### Backend (API environment variables)
```bash
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Database Considerations

### User Table Structure

The OAuth flow creates users with the following considerations:

1. **OAuth users** are created with their actual email address (no UUID suffix)
2. **auth_id** field stores the Supabase Auth user ID
3. **email** field stores the user's actual email
4. **family_id** can be null initially - users can join/create families after OAuth login

### Migration Path for Existing Users

If you have existing users with the old email structure:
- Email/password users continue to work with unique auth emails
- OAuth users use actual emails directly
- The system supports both authentication methods simultaneously

## Testing OAuth Integration

### Local Development Testing

1. **Start your dev environment**:
   ```bash
   npm run dev
   ```

2. **Test Google OAuth**:
   - Navigate to `/login`
   - Click "התחבר עם Google" (Sign in with Google)
   - Complete Google consent flow
   - Should redirect to `/auth/callback` then to home page

3. **Test Password Reset**:
   - Navigate to `/login`
   - Enter email and click "המשך" (Continue)
   - Enter password and click "שכחת סיסמה?" (Forgot password?)
   - Enter email and request reset link
   - Check email and follow link to `/reset-password`

### Production Testing Checklist

- [ ] Google OAuth redirects correctly
- [ ] Users can log in with existing email/password accounts
- [ ] New OAuth users are created in database
- [ ] Password reset emails are sent successfully
- [ ] OAuth users can access protected routes
- [ ] User sessions persist correctly

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" error**:
   - Verify redirect URIs match exactly in both Supabase and OAuth provider
   - Check for trailing slashes (should not have them)
   - Ensure protocol is correct (http vs https)

2. **"invalid_client" error**:
   - Verify Client ID and Secret are correct
   - Check that credentials are from correct OAuth provider project

3. **User created in Auth but not in database**:
   - Check API logs for `/auth/oauth-complete` endpoint errors
   - Verify database permissions allow user creation
   - Check that RLS policies don't block user insertion

4. **Password reset email not received**:
   - Check Supabase email settings
   - Verify SMTP configuration
   - Check spam folder
   - Ensure redirect URL is in allowlist

## Security Considerations

1. **Client Secrets**: Never expose Client Secrets in frontend code
2. **Redirect URLs**: Only whitelist trusted domains
3. **HTTPS**: Always use HTTPS in production
4. **Email Verification**: Consider enabling email verification for OAuth users
5. **Session Duration**: Configure appropriate session timeout in Supabase Auth settings

## Support and Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase OAuth Setup Guide](https://supabase.com/docs/guides/auth/social-login)

## API Changes Summary

### New Endpoints

1. **POST /api/auth/oauth-complete**
   - Creates user profile for OAuth sign-ins
   - Parameters: `id`, `email`, `fullName`, `provider`
   - Returns: `{ user, family_id }`

### Modified Behavior

1. **User Registration**:
   - Single-page form (no stepper)
   - Family phone/whatsapp auto-filled from user's details
   - OAuth bypasses registration form

2. **User Login**:
   - Added OAuth button (Google)
   - Added "Forgot Password" link
   - Password reset via email

### Frontend Routes

- `/auth/callback` - OAuth callback handler
- `/reset-password` - Password reset form

## Deployment Checklist

Before deploying to production:

1. [ ] Configure Google OAuth in Google Cloud Console
2. [ ] Add OAuth credentials to Supabase Dashboard
3. [ ] Configure redirect URLs in Supabase
5. [ ] Update environment variables in Vercel/hosting platform
6. [ ] Test all authentication flows in staging environment
7. [ ] Verify email delivery for password resets
8. [ ] Test on multiple devices and browsers
9. [ ] Monitor error logs after deployment
10. [ ] Update user documentation/help pages

## Rollback Plan

If issues arise after deployment:

1. Disable OAuth providers in Supabase Dashboard (toggle to OFF)
2. Users can still authenticate with email/password
3. Fix issues and re-enable OAuth providers
4. No data loss - OAuth user records persist
