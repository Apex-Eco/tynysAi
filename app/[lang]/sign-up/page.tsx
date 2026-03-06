"use client";

import { useState, useEffect } from "react";
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
import { Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthPageShell } from "@/components/auth-page-shell";

// Client-side translations
type SignUpTranslations = {
  createAccount: string;
  getStarted: string;
  fullName: string;
  namePlaceholder: string;
  emailAddress: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  confirmPassword: string;
  minimumChars: string;
  creatingAccount: string;
  accountCreated: string;
  alreadyHaveAccount: string;
  signIn: string;
  termsAgreement: string;
  passwordsDoNotMatch: string;
  passwordTooShort: string;
  accountCreatedSuccess: string;
  failedToCreate: string;
  errorOccurred: string;
};

const translations: Record<string, SignUpTranslations> = {
  en: {
    createAccount: "Create Account",
    getStarted: "Get started with your IoT monitoring dashboard",
    fullName: "Full Name",
    namePlaceholder: "John Doe",
    emailAddress: "Email Address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Confirm Password",
    minimumChars: "Minimum 8 characters",
    creatingAccount: "Creating Account...",
    accountCreated: "Account Created!",
    alreadyHaveAccount: "Already have an account?",
    signIn: "Sign In",
    termsAgreement: "By creating an account, you agree to our Terms of Service and Privacy Policy",
    passwordsDoNotMatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 8 characters long.",
    accountCreatedSuccess: "Account created successfully! Redirecting to sign in...",
    failedToCreate: "Failed to create account. Please try again.",
    errorOccurred: "An error occurred. Please try again."
  },
  ru: {
    createAccount: "Создать аккаунт",
    getStarted: "Начните работу с панелью мониторинга IoT",
    fullName: "Полное имя",
    namePlaceholder: "Иван Иванов",
    emailAddress: "Адрес электронной почты",
    emailPlaceholder: "you@example.com",
    password: "Пароль",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Подтвердите пароль",
    minimumChars: "Минимум 8 символов",
    creatingAccount: "Создание аккаунта...",
    accountCreated: "Аккаунт создан!",
    alreadyHaveAccount: "Уже есть аккаунт?",
    signIn: "Войти",
    termsAgreement: "Создавая аккаунт, вы соглашаетесь с нашими Условиями обслуживания и Политикой конфиденциальности",
    passwordsDoNotMatch: "Пароли не совпадают.",
    passwordTooShort: "Пароль должен содержать не менее 8 символов.",
    accountCreatedSuccess: "Аккаунт успешно создан! Перенаправление на вход...",
    failedToCreate: "Не удалось создать аккаунт. Попробуйте снова.",
    errorOccurred: "Произошла ошибка. Попробуйте снова."
  },
  kz: {
    createAccount: "Тіркелгі жасау",
    getStarted: "IoT мониторинг басқару панелімен жұмысты бастаңыз",
    fullName: "Толық аты",
    namePlaceholder: "Иван Иванов",
    emailAddress: "Электрондық пошта мекенжайы",
    emailPlaceholder: "you@example.com",
    password: "Құпия сөз",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Құпия сөзді растау",
    minimumChars: "Кемінде 8 таңба",
    creatingAccount: "Тіркелгі жасалуда...",
    accountCreated: "Тіркелгі жасалды!",
    alreadyHaveAccount: "Тіркелгі бар ма?",
    signIn: "Кіру",
    termsAgreement: "Тіркелгі жасау арқылы сіз біздің Қызмет көрсету шарттары мен Құпиялылық саясатымызға келісесіз",
    passwordsDoNotMatch: "Құпия сөздер сәйкес келмейді.",
    passwordTooShort: "Құпия сөзде кемінде 8 таңба болуы керек.",
    accountCreatedSuccess: "Тіркелгі сәтті жасалды! Кіруге бағыттау...",
    failedToCreate: "Тіркелгі жасау сәтсіз аяқталды. Қайталап көріңіз.",
    errorOccurred: "Қате пайда болды. Қайталап көріңіз."
  }
};

export default function SignUpPage() {
  const router = useRouter();
  const params = useParams();
  const lang = (params.lang as string) || 'en';
  const t = translations[lang] || translations.en;
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Handle chunk loading errors
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      if (event.error?.name === "ChunkLoadError" || event.message?.includes("chunk")) {
        console.error("Chunk load error detected:", event.error);
        // Optionally show a user-friendly message
        setError("Failed to load page resources. Please refresh the page.");
      }
    };

    window.addEventListener("error", handleChunkError);
    return () => window.removeEventListener("error", handleChunkError);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    // Validation
    if (password !== confirmPassword) {
      setError(t.passwordsDoNotMatch);
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t.passwordTooShort);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t.failedToCreate);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/${lang}/sign-in`);
        }, 2000);
      }
    } catch {
      setError(t.errorOccurred);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ErrorBoundary>
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
            {t.createAccount}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t.getStarted}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {t.accountCreatedSuccess}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                {t.fullName}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="pl-10 placeholder:text-muted-foreground"
                  disabled={isLoading || success}
                />
              </div>
            </div>

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
                  disabled={isLoading || success}
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
                  minLength={8}
                  className="pl-10 placeholder:text-muted-foreground"
                  disabled={isLoading || success}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t.minimumChars}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                {t.confirmPassword}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t.passwordPlaceholder}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pl-10 placeholder:text-muted-foreground"
                  disabled={isLoading || success}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading || success}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  {t.creatingAccount}
                </span>
              ) : success ? (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {t.accountCreated}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t.createAccount}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-center text-muted-foreground mb-3">
                {t.alreadyHaveAccount}
              </p>
              <Link href={`/${lang}/sign-in`}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border hover:border-teal-500 dark:hover:border-teal-400 transition-all duration-300"
                >
                  <span className="flex items-center gap-2">
                    {t.signIn}
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
    </ErrorBoundary>
  );
}

