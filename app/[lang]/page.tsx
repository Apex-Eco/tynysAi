import { getDictionary } from '@/lib/i18n/dictionaries';
import { i18n, type Locale } from '@/lib/i18n/config';
import { getSession } from '@/lib/auth';
import { HomePage } from './home-page-client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default async function Page({ params }: { params: { lang: Locale } }) {
  const requestedLang = params.lang as string;
  const locale = (i18n.locales as readonly string[]).includes(requestedLang)
    ? (requestedLang as Locale)
    : null;

  if (!locale) {
    redirect(`/${i18n.defaultLocale}`);
  }

  // Check if user is authenticated — gracefully degrade if DB is unreachable
  let session = null;
  try {
    session = await getSession();
  } catch (error) {
    console.error('Failed to fetch session (DB may be unavailable):', error);
  }

  if (session?.user) {
    redirect(`/${locale}/dashboard`);
  }

  let dict;
  try {
    dict = await getDictionary(locale);
  } catch (error) {
    console.error(`Failed to load dictionary for ${locale}, falling back to default locale`, error);
    dict = await getDictionary(i18n.defaultLocale);
  }

  return <HomePage dict={dict} lang={locale} session={session} />;
}
