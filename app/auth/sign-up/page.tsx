import { SignUpForm } from "@/components/sign-up-form";
import Link from "next/link";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center p-6 md:p-10 overflow-hidden bg-background">
      {/* 极光光斑 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="animate-aurora absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-emerald-500/25 blur-[110px] dark:bg-emerald-500/20" />
        <div className="animate-aurora absolute top-1/3 -right-32 h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-[110px] dark:bg-cyan-500/15 [animation-delay:-5s]" />
        <div className="animate-aurora absolute -bottom-32 left-1/3 h-[380px] w-[380px] rounded-full bg-violet-500/15 blur-[110px] dark:bg-violet-500/12 [animation-delay:-9s]" />
        <div className="bg-grid bg-grid-fade absolute inset-0" />
      </div>

      {/* 品牌区 */}
      <div className="mb-8 flex flex-col items-center gap-4 z-10 animate-rise">
        <Link
          href="/auth/login"
          className="glow-primary flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-2xl font-bold text-white shadow-lg rotate-[-4deg] hover:rotate-0 transition-transform duration-300"
        >
          <span className="font-serif">谱</span>
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-widest">
            <span className="text-gradient">家族族谱</span>
          </h1>
          <p className="mt-2 text-[13px] tracking-[0.35em] text-muted-foreground">
            CREATE ACCOUNT
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm z-10 animate-rise [animation-delay:100ms] [&_Card]:glass-card [&_Card]:rounded-2xl [&_Card]:border-foreground/10">
        <SignUpForm />
      </div>

      <p className="mt-8 z-10 text-xs tracking-[0.3em] text-muted-foreground/60 animate-rise [animation-delay:200ms]">
        一脉相承 · 血浓于水
      </p>
    </div>
  );
}
