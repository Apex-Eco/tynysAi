"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { AuthPageShell } from "@/components/auth-page-shell";

// Client-side translations
type SignInTranslations = {
  welcomeBack: string;
  signInToDashboard: string;
  emailAddress: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  signIn: string;
  signingIn: string;
  newToTynys: string;
  createAccount: string;
  termsAgreement: string;
  invalidCredentials: string;
  errorOccurred: string;
};

const translations: Record<string, SignInTranslations> = {
  en: {
    welcomeBack: "Welcome Back",
    signInToDashboard: "Sign in to access your IoT dashboard",
    emailAddress: "Email Address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    signIn: "Sign In",
    signingIn: "Signing in...",
    newToTynys: "New to Tynys?",
    createAccount: "Create an Account",
    termsAgreement: "By signing in, you agree to our Terms of Service and Privacy Policy",
    invalidCredentials: "Invalid email or password. Please try again.",
    errorOccurred: "An error occurred. Please try again."
  },
  ru: {
    welcomeBack: "С возвращением",
    signInToDashboard: "Войдите для доступа к панели управления IoT",
    emailAddress: "Адрес электронной почты",
    emailPlaceholder: "you@example.com",
    password: "Пароль",
    passwordPlaceholder: "••••••••",
    signIn: "Войти",
    signingIn: "Вход...",
    newToTynys: "Новичок в Tynys?",
    createAccount: "Создать аккаунт",
    termsAgreement: "Входя, вы соглашаетесь с нашими Условиями обслуживания и Политикой конфиденциальности",
    invalidCredentials: "Неверный email или пароль. Попробуйте снова.",
    errorOccurred: "Произошла ошибка. Попробуйте снова."
  },
  kz: {
    welcomeBack: "Қайта келуіңізбен",
    signInToDashboard: "IoT басқару панеліне кіру үшін жүйеге кіріңіз",
    emailAddress: "Электрондық пошта мекенжайы",
    emailPlaceholder: "you@example.com",
    password: "Құпия сөз",
    passwordPlaceholder: "••••••••",
    signIn: "Кіру",
    signingIn: "Кіру...",
    newToTynys: "Tynys-та жаңасыз ба?",
    createAccount: "Тіркелгі жасау",
    termsAgreement: "Жүйеге кіру арқылы сіз біздің Қызмет көрсету шарттары мен Құпиялылық саясатымызға келісесіз",
    invalidCredentials: "Email немесе құпия сөз қате. Қайталап көріңіз.",
    errorOccurred: "Қате пайда болды. Қайталап көріңіз."
  }
};

export default function SignInPage() {
  const router = useRouter();
  const params = useParams();
  const lang = (params.lang as string) || 'en';
  const t = translations[lang] || translations.en;
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t.invalidCredentials);
      } else {
        router.push(`/${lang}/dashboard`);
        router.refresh();
      }
    } catch {
      setError(t.errorOccurred);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <Card className="w-full max-w-md border border-white/20 bg-background/60 text-foreground shadow-2xl backdrop-blur-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image 
              src="/tynys-logo.webp" 
              alt="Tynys Logo" 
              width={40} 
              height={40}
              className="drop-shadow-lg"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-400 bg-clip-text text-transparent">
              TynysAi
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {t.welcomeBack}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t.signInToDashboard}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                {t.emailAddress}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                {t.password}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  {t.signingIn}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t.signIn}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-center text-muted-foreground mb-3">
                {t.newToTynys}
              </p>
              <Link href={`/${lang}/sign-up`}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border hover:border-teal-500 dark:hover:border-teal-400 transition-all duration-300"
                >
                  <span className="flex items-center gap-2">
                    {t.createAccount}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Button>
              </Link>
            </div>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {t.termsAgreement}
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

