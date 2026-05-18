const BLOCKED_AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function getSafeReturnUrl(returnUrl: string | null | undefined, fallback: string): string {
  if (!returnUrl) {
    return fallback;
  }

  const normalized = returnUrl.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return fallback;
  }

  if (BLOCKED_AUTH_PATHS.some((blockedPath) => normalized === blockedPath || normalized.startsWith(`${blockedPath}?`))) {
    return fallback;
  }

  return normalized;
}
