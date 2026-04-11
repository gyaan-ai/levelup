/**
 * redirectTo for Supabase resetPasswordForEmail — must be called from the **browser**
 * so PKCE code_verifier is stored in this origin. Server-side reset breaks the recovery link.
 *
 * **Important:** The verifier is keyed by `window.location.origin`. If we send a different
 * origin via NEXT_PUBLIC_APP_URL (e.g. apex) while the user requested reset on `www` (or
 * the reverse), the email link opens on the wrong origin and `exchangeCodeForSession`
 * fails with "code verifier" even in the "same" browser.
 *
 * So when the forgot-password form runs in the browser, always use the current origin.
 * Use NEXT_PUBLIC_APP_URL only when `window` is unavailable (e.g. tests).
 */
export function getPasswordRecoveryRedirectTo(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/reset-password`;
  }
  const explicit =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '')
      : '';
  if (explicit) return `${explicit}/reset-password`;
  return '/reset-password';
}
