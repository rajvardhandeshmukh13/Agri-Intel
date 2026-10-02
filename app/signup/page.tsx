// app/signup/page.tsx
// Farmer Sign Up Page supporting Supabase Authentication with seamless demo/guest fallback.

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useTranslation } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const router = useRouter();
  const { signUp, enterDemoMode, isCloudAuth } = useAuth();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    const res = await signUp(email, password, name);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      // Proceed directly to farm setup onboarding
      router.push('/onboarding');
    }
  };

  const handleDemoLogin = () => {
    enterDemoMode();
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: 'Outfit, sans-serif' }}>
            AgriIntel
          </h1>
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {t('auth.signupTitle')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('auth.signupSubtitle')}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  {t('auth.nameLabel')}
                </label>
                <input
                  type="text"
                  id="signup-name"
                  placeholder="e.g. Ramesh Patil"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  {t('auth.emailLabel')}
                </label>
                <input
                  type="email"
                  id="signup-email"
                  required
                  placeholder="farmer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  type="password"
                  id="signup-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              <Button
                type="submit"
                id="signup-submit-btn"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-2.5 rounded-xl text-sm"
              >
                {loading ? t('common.loading') : t('auth.createAccount')}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">Or</span>
              </div>
            </div>

            {/* Instant Demo Access Button */}
            <button
              type="button"
              id="signup-demo-btn"
              onClick={handleDemoLogin}
              className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-amber-50/60 hover:bg-amber-100/60 text-amber-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>⚡</span> {t('auth.exploreDemoBtn')}
            </button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            {t('auth.login')}
          </Link>
        </p>

        {/* Cloud status disclosure */}
        <p className="text-center text-[11px] text-muted-foreground/80">
          {isCloudAuth ? '🔒 Cloud Auth Ready' : '📋 Offline/Demo mode active: Instant local session'}
        </p>
      </div>
    </div>
  );
}
