# Email Templates — OMD Systems Finance Platform

Templates for Supabase Auth → Authentication → Email Templates.
Paste full HTML into the "Body" field for each email type.

---

## 1. Magic Link / OTP

**Subject:** `OMD Finance — Your sign-in code`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0D0F;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D0F;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#111114;border:1px solid #374151;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #374151;">
  <div style="font-size:20px;font-weight:700;letter-spacing:4px;color:#00D4FF;">OMD SYSTEMS</div>
  <div style="font-size:11px;letter-spacing:2px;color:#4B5563;margin-top:4px;">FINANCE PLATFORM</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
  <p style="margin:0 0 8px;font-size:15px;color:#E5E7EB;">Your sign-in code:</p>
  <div style="margin:24px 0;text-align:center;">
    <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:8px;color:#00D4FF;background-color:#0D0D0F;border:1px solid #374151;border-radius:8px;padding:16px 32px;">{{ .Token }}</span>
  </div>
  <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #374151;text-align:center;">
  <p style="margin:0;font-size:11px;color:#4B5563;">&copy; OMD Systems. This is an automated message, please do not reply.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
```

---

## 2. Invite User

**Subject:** `You're invited to OMD Finance Platform`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0D0F;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D0F;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#111114;border:1px solid #374151;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #374151;">
  <div style="font-size:20px;font-weight:700;letter-spacing:4px;color:#00D4FF;">OMD SYSTEMS</div>
  <div style="font-size:11px;letter-spacing:2px;color:#4B5563;margin-top:4px;">FINANCE PLATFORM</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
  <p style="margin:0 0 16px;font-size:15px;color:#E5E7EB;">You've been invited to join the OMD Systems Finance Platform.</p>
  <p style="margin:0 0 24px;font-size:13px;color:#9CA3AF;">Click the button below to accept the invitation and set up your account.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;background-color:#00D4FF;color:#0D0D0F;font-size:14px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.5px;">Accept Invitation</a>
  </div>
  <p style="margin:24px 0 0;font-size:12px;color:#4B5563;word-break:break-all;">Or copy this link: {{ .ConfirmationURL }}</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #374151;text-align:center;">
  <p style="margin:0;font-size:11px;color:#4B5563;">&copy; OMD Systems. This is an automated message, please do not reply.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
```

---

## 3. Reset Password

**Subject:** `OMD Finance — Reset your password`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0D0F;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D0F;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#111114;border:1px solid #374151;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #374151;">
  <div style="font-size:20px;font-weight:700;letter-spacing:4px;color:#00D4FF;">OMD SYSTEMS</div>
  <div style="font-size:11px;letter-spacing:2px;color:#4B5563;margin-top:4px;">FINANCE PLATFORM</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
  <p style="margin:0 0 16px;font-size:15px;color:#E5E7EB;">We received a request to reset your password.</p>
  <p style="margin:0 0 24px;font-size:13px;color:#9CA3AF;">Click the button below to set a new password. This link is valid for 24 hours.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;background-color:#00D4FF;color:#0D0D0F;font-size:14px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.5px;">Reset Password</a>
  </div>
  <p style="margin:24px 0 0;font-size:12px;color:#4B5563;word-break:break-all;">Or copy this link: {{ .ConfirmationURL }}</p>
  <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #374151;text-align:center;">
  <p style="margin:0;font-size:11px;color:#4B5563;">&copy; OMD Systems. This is an automated message, please do not reply.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
```

---

## 4. Change Email

**Subject:** `OMD Finance — Confirm your new email`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0D0F;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D0F;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#111114;border:1px solid #374151;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #374151;">
  <div style="font-size:20px;font-weight:700;letter-spacing:4px;color:#00D4FF;">OMD SYSTEMS</div>
  <div style="font-size:11px;letter-spacing:2px;color:#4B5563;margin-top:4px;">FINANCE PLATFORM</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
  <p style="margin:0 0 16px;font-size:15px;color:#E5E7EB;">You requested to change the email address for your account.</p>
  <p style="margin:0 0 24px;font-size:13px;color:#9CA3AF;">Click the button below to confirm your new email address.</p>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;background-color:#00D4FF;color:#0D0D0F;font-size:14px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.5px;">Confirm Email</a>
  </div>
  <p style="margin:24px 0 0;font-size:12px;color:#4B5563;word-break:break-all;">Or copy this link: {{ .ConfirmationURL }}</p>
  <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;">If you didn't request this change, please contact your administrator immediately.</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #374151;text-align:center;">
  <p style="margin:0;font-size:11px;color:#4B5563;">&copy; OMD Systems. This is an automated message, please do not reply.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
```

---

## 5. Confirm Signup

**Subject:** `OMD Finance — Confirm your account`

**Body:**

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0D0F;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D0F;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#111114;border:1px solid #374151;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #374151;">
  <div style="font-size:20px;font-weight:700;letter-spacing:4px;color:#00D4FF;">OMD SYSTEMS</div>
  <div style="font-size:11px;letter-spacing:2px;color:#4B5563;margin-top:4px;">FINANCE PLATFORM</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
  <p style="margin:0 0 16px;font-size:15px;color:#E5E7EB;">Welcome! Enter the confirmation code below to complete your registration:</p>
  <div style="margin:24px 0;text-align:center;">
    <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:8px;color:#00D4FF;background-color:#0D0D0F;border:1px solid #374151;border-radius:8px;padding:16px 32px;">{{ .Token }}</span>
  </div>
  <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;">This code is valid for 24 hours. If you didn't sign up, you can safely ignore this email.</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #374151;text-align:center;">
  <p style="margin:0;font-size:11px;color:#4B5563;">&copy; OMD Systems. This is an automated message, please do not reply.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
```

---

## How to apply in Supabase

1. **Supabase Dashboard → Authentication → Email Templates**
2. For each type (Magic Link, Invite, Reset Password, Change Email, Confirm Signup):
   - Paste the **Subject** into the Subject field
   - Paste the **HTML** (contents of the ```html``` block) into the Body field
3. Save

### Supabase template variables
| Variable | Description | Used in |
|---|---|---|
| `{{ .Token }}` | OTP code (6 digits) | Magic Link, Confirm Signup |
| `{{ .ConfirmationURL }}` | Confirmation link | Invite, Reset Password, Change Email |
| `{{ .SiteURL }}` | App URL | (available, not used) |
