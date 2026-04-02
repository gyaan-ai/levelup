/**
 * redirectTo for Supabase resetPasswordForEmail — must be called from the **browser**
 * so PKCE code_verifier is stored in this device. Server-side reset breaks the recovery link.
 *
 * Use NEXT_PUBLIC_APP_URL in production so the email link matches the live domain.
 */
export function getPasswordRecoveryRedirectTo(): string {
  const explicit =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '')
      : '';
  if (explicit) return `${explicit}/reset-password`;
  if (typeof window !== 'undefined') return `${window.location.origin}/reset-password`;
  return '/reset-password';
}
