import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/constants';

export const LOCALE_COOKIE = 'hifzflow.locale';

/**
 * Locale resolution.
 *
 * Deliberately not routed. The alternative — a `[locale]` segment on every URL
 * — restructures the whole route tree and buys SEO benefits that matter for
 * marketing pages, not for an authenticated tool. The cost of routing would be
 * paid on every future route; the cost of the cookie is one read.
 *
 * The cookie is the source of truth at request time because it is available
 * before any database round trip. The profile holds the durable preference and
 * is written alongside the cookie whenever the language changes, so a new
 * device picks up the right language on first load.
 */
function isSupported(value: string | undefined): value is Locale {
  return (
    value !== undefined &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isSupported(fromCookie) ? fromCookie : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
