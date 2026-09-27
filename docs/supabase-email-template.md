# Supabase Signup Confirmation Email

In the Supabase development project, open **Authentication → Email Templates → Confirm signup**.

**Subject**

```text
Confirm your Ihssan account
```

**Message body (HTML)**

```html
<div style="font-family: Arial, sans-serif; color: #18342b; max-width: 520px; margin: 0 auto; padding: 28px 20px;">
  <div style="font-size: 22px; font-weight: 700; margin-bottom: 20px;">Ihssan</div>
  <h1 style="font-size: 24px; line-height: 1.3;">Confirm your email</h1>
  <p style="font-size: 15px; line-height: 1.6;">Enter this one-time code in the Ihssan app to confirm your account.</p>
  <div style="background: #e8f0e6; border-radius: 8px; color: #245744; font-size: 30px; font-weight: 700; letter-spacing: 6px; margin: 24px 0; padding: 18px; text-align: center;">
    {{ .Token }}
  </div>
  <p style="font-size: 13px; line-height: 1.6;">This code is for one-time use. Do not forward it or share it with anyone.</p>
  <p style="color: #69776f; font-size: 12px; line-height: 1.6;">If you did not create this account, you can ignore this email.</p>
</div>
```

The app verifies this code with Supabase Auth's `verifyOtp` signup flow. Do not replace `{{ .Token }}` with an access token, refresh token, service-role key, or database password. Keep Supabase email confirmation enabled for the development project; only use the normal account-signup flow.