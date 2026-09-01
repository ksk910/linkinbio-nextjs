# Production Verification Checklist

## Quick smoke test

1. Open the production URL and confirm the landing page renders
2. Visit `/api/health` and confirm it responds successfully
3. Create a new account and complete signup/login
4. Edit profile information and save
5. Add a link and confirm it appears on the profile editor
6. Open the public profile and verify the content is visible
7. Verify logout works and the session is cleared

## Expected outcomes

- The app loads without server errors
- Authentication flow works end-to-end
- Profile editing persists correctly
- Public profile rendering works for visitors
