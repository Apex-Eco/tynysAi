'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { i18n } from '@/lib/i18n/config';
import { Button } from '@/components/ui/button';
import DashboardFooter from '@/components/Layout/DashboardFooter';

export default function RootPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace(`/${i18n.defaultLocale}/dashboard`);
    }
  }, [status, session, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Provide a clear fallback CTA while client-side redirect resolves
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">You are signed in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Continue to your dashboard.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() => router.replace(`/${i18n.defaultLocale}/dashboard`)}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-6 py-16">
          <div className="flex items-center justify-center min-h-[85vh]">
            <div className="text-center max-w-4xl space-y-8">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-teal-600 dark:text-teal-400"
                  aria-hidden="true"
                  focusable="false"
                >
                  <use href="/icons/air-activity.svg#icon" />
                </svg>
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  IoT Air Quality Monitoring
                </span>
              </div>

              {/* Hero Title */}
              <div className="space-y-6">
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                  <span className="block text-foreground">Real-Time Air Quality</span>
                  <span className="block text-teal-600 dark:text-teal-400">Monitoring for Dynamic</span>
                  <span className="block text-teal-600 dark:text-teal-400">Environments</span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Autonomous IoT sensing powered by the Tynys device. Deployable in buses, metros, and trolleybuses.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Button 
                  size="lg" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-base font-medium shadow-sm transition-colors"
                  onClick={() => router.push(`/${i18n.defaultLocale}`)}
                >
                  Get Started
                  <svg
                    viewBox="0 0 24 24"
                    className="ml-2 w-5 h-5"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <use href="/icons/arrow-forward.svg#icon" />
                  </svg>
                </Button>
                
                <Button 
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-base font-medium border-border hover:bg-muted"
                  onClick={() => router.push(`/${i18n.defaultLocale}/architecture`)}
                >
                  Learn Architecture
                </Button>
              </div>

            </div>
          </div>
        </div>
      </main>
      <DashboardFooter />
    </div>
  );
}
