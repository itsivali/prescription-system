import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Heart, AlertCircle, Loader2, ShieldCheck, Clock, Activity, Lock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Client-side brute-force protection: exponential backoff after failed attempts
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 3_000; // 3s after first lockout, doubles each time

function sanitizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 254);
}

export function LoginPage() {
  const { login, oauthLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Client-side rate limiting state
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockRemaining, setLockRemaining] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const startLockoutTimer = useCallback((until: number) => {
    if (lockTimerRef.current) clearInterval(lockTimerRef.current);
    lockTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, until - Date.now());
      setLockRemaining(remaining);
      if (remaining <= 0 && lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
      }
    }, 200);
  }, []);

  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const isLockedOut = lockedUntil > Date.now();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLockedOut || loading) return;

    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(cleanEmail, password);
      setFailCount(0);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const newCount = failCount + 1;
      setFailCount(newCount);

      if (newCount >= MAX_ATTEMPTS) {
        const lockoutMs = BASE_LOCKOUT_MS * Math.pow(2, newCount - MAX_ATTEMPTS);
        const until = Date.now() + lockoutMs;
        setLockedUntil(until);
        setLockRemaining(lockoutMs);
        startLockoutTimer(until);
        setError(`Too many failed attempts. Try again in ${Math.ceil(lockoutMs / 1000)}s.`);
      } else {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Invalid email or password. Please try again.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] relative overflow-hidden bg-gradient-to-br from-[#0d7377] via-[#0a6165] to-[#064e52]">
        {/* Warm decorative shapes */}
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute bottom-24 -right-12 h-56 w-56 rounded-full bg-amber-400/8" />
        <div className="absolute top-1/3 left-1/5 h-40 w-40 rounded-full bg-white/4" />

        <div className="relative z-10 flex flex-col justify-between p-10 text-white">
          {/* Top logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">MedFlow</p>
              <p className="text-[11px] text-white/60">Hospital Management</p>
            </div>
          </div>

          {/* Center content */}
          <div className="max-w-sm space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight tracking-tight">
                Streamline your<br />clinical workflow
              </h1>
              <p className="text-sm text-white/70 leading-relaxed">
                A unified platform for prescriptions, dispensation, patient management, and billing.
              </p>
            </div>

            <div className="space-y-2.5">
              <FeatureItem
                icon={<ShieldCheck className="h-4 w-4" />}
                title="HIPAA Compliant"
                description="End-to-end encryption with audit trails"
              />
              <FeatureItem
                icon={<Clock className="h-4 w-4" />}
                title="Real-Time Dispensation"
                description="QR-based prescription fulfillment"
              />
              <FeatureItem
                icon={<Activity className="h-4 w-4" />}
                title="Role-Based Access"
                description="Granular permissions for all staff"
              />
            </div>
          </div>

          <p className="text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} MedFlow Health Systems
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[380px] animate-fade-in">
          {/* Mobile logo */}
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d7377] text-white">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">MedFlow</p>
              <p className="text-[11px] text-muted-foreground">Hospital Management</p>
            </div>
          </div>

          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your dashboard
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="flex gap-2.5">
            <OAuthButton
              provider="google"
              onClick={() => oauthLogin('google')}
              icon={
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              }
            />
            <OAuthButton
              provider="microsoft"
              onClick={() => oauthLogin('microsoft')}
              icon={
                <svg className="h-4.5 w-4.5" viewBox="0 0 23 23">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
                </svg>
              }
            />
            <OAuthButton
              provider="apple"
              onClick={() => oauthLogin('apple')}
              icon={
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              }
            />
          </div>

          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              or
            </span>
            <Separator className="flex-1" />
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="off">
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-[13px] text-destructive animate-slide-up">
                {isLockedOut ? (
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                placeholder="name@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail(sanitizeEmail(email))}
                required
                maxLength={254}
                autoFocus
                autoComplete="username"
                spellCheck={false}
                className="h-10 bg-white/80 text-[13px] placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] font-medium">
                  Password
                </Label>
                <button
                  type="button"
                  className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={256}
                autoComplete="current-password"
                className="h-10 bg-white/80 text-[13px] placeholder:text-muted-foreground/50"
              />
            </div>

            <Button
              type="submit"
              className="h-10 w-full text-[13px] font-semibold shadow-sm mt-1"
              disabled={loading || isLockedOut}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Signing in...
                </>
              ) : isLockedOut ? (
                <>
                  <Lock className="mr-2 h-3.5 w-3.5" />
                  Locked ({Math.ceil(lockRemaining / 1000)}s)
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 rounded-lg border border-border/60 bg-white/60 p-3.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Demo Accounts
            </p>
            <div className="space-y-1.5 text-[12px] text-muted-foreground">
              <DemoCredential role="Admin" email="admin@hospital.local" password="AdminPass123!" onFill={(e, p) => { setEmail(e); setPassword(p); }} />
              <DemoCredential role="Pharmacist" email="pharm@hospital.local" password="PharmPass123!" onFill={(e, p) => { setEmail(e); setPassword(p); }} />
              <DemoCredential role="Doctor" email="ada@hospital.local" password="DoctorPass123!" onFill={(e, p) => { setEmail(e); setPassword(p); }} />
              <DemoCredential role="Doctor" email="linus@hospital.local" password="DoctorPass123!" onFill={(e, p) => { setEmail(e); setPassword(p); }} />
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
            By continuing, you agree to the{' '}
            <span className="text-muted-foreground cursor-pointer hover:underline">Terms</span>{' '}
            and{' '}
            <span className="text-muted-foreground cursor-pointer hover:underline">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/8 px-3.5 py-3 backdrop-blur-sm">
      <div className="text-amber-200/80">{icon}</div>
      <div>
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="text-[11px] text-white/50">{description}</p>
      </div>
    </div>
  );
}

function OAuthButton({
  provider: _provider,
  onClick,
  icon,
}: {
  provider: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border/80 bg-white/90 text-sm text-foreground shadow-sm transition-all hover:bg-white hover:shadow-md active:scale-[0.98]"
    >
      {icon}
    </button>
  );
}

function DemoCredential({
  role,
  email,
  password,
  onFill,
}: {
  role: string;
  email: string;
  password: string;
  onFill: (email: string, password: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onFill(email, password)}
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-stone-100"
    >
      <span>
        <span className="font-medium text-foreground">{role}</span>
        <span className="mx-1.5 text-muted-foreground/40">—</span>
        <span>{email}</span>
      </span>
      <span className="text-[11px] text-primary font-medium">Use</span>
    </button>
  );
}
