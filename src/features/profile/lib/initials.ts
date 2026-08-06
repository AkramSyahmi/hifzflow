/**
 * Initials for the avatar fallback, derived from name or email.
 *
 * Pure and dependency-free so it can be imported from Client Components.
 * Anything in this feature that touches Supabase lives behind `server.ts`.
 */
export function initialsFrom(
  displayName: string | null,
  email: string | undefined
): string {
  const source = displayName?.trim() || email?.split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();

  const first = parts[0] ?? '';
  const second = parts[1] ?? '';
  return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
}
