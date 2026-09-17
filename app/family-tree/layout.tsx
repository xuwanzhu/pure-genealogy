import { Suspense } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { NavLink } from "@/components/nav-link";
import { getSessionUser } from "@/lib/auth";
import { FamilySettingsDialog } from "./family-settings-dialog";

const NAV_ITEMS = [
  { href: "/family-tree", label: "成员" },
  { href: "/family-tree/graph", label: "2D 族谱" },
  { href: "/family-tree/graph-3d", label: "3D 族谱" },
  { href: "/family-tree/timeline", label: "时间轴" },
  { href: "/family-tree/statistics", label: "统计" },
  { href: "/family-tree/biography-book", label: "生平册" },
];

/**
 * 依赖登录态 (cookies) 的品牌信息,
 * 独立成异步组件并包在 <Suspense> 中,避免阻塞整个路由渲染
 * (Next.js: uncached data must be accessed within Suspense)
 */
async function HeaderBrand() {
  const user = await getSessionUser();
  const surname = user?.family_surname || "族";
  const familyName = user?.family_name || "家族族谱";

  return (
    <Link href="/" className="group flex items-center gap-3 shrink-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 font-serif text-lg font-bold text-white shadow-md shadow-emerald-500/25 transition-transform duration-300 group-hover:scale-105 rotate-[-4deg] group-hover:rotate-0">
        {surname}
      </span>
      <span className="hidden sm:block text-[17px] font-semibold tracking-wider">
        <span className="text-gradient">{familyName}</span>
      </span>
    </Link>
  );
}

function HeaderFallback() {
  return (
    <>
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        <div className="hidden sm:block h-5 w-20 rounded bg-muted animate-pulse" />
      </div>
    </>
  );
}

export default function FamilyTreeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 顶部导航:毛玻璃吸顶 */}
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/70 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Suspense fallback={<HeaderFallback />}>
            <HeaderBrand />
          </Suspense>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Suspense fallback={null}>
              <HeaderAdminSettings />
            </Suspense>
            <div className="hidden md:block">
              <Suspense fallback={<div className="h-9 w-32 bg-muted animate-pulse rounded-md" />}>
                <AuthButton />
              </Suspense>
            </div>
            <MobileNav>
              <Suspense fallback={<div className="h-9 w-full bg-muted animate-pulse rounded-md" />}>
                <AuthButton />
              </Suspense>
            </MobileNav>
          </div>
        </div>
      </header>

      {/* 页面内容 */}
      <main className="flex-1">
        {children}
      </main>

      {/* 页脚 */}
      <footer className="border-t border-foreground/10 py-5">
        <p className="text-center text-xs tracking-[0.3em] text-muted-foreground/60">
          树高千丈 · 叶落归根
        </p>
      </footer>
    </div>
  );
}

/** 仅管理员可见的家族设置按钮 (放在右侧操作区) */
async function HeaderAdminSettings() {
  const user = await getSessionUser();
  const familyName = user?.family_name || "家族族谱";
  if (user?.role !== "admin" || !user.invite_code) return null;
  return <FamilySettingsDialog familyName={familyName} inviteCode={user.invite_code} />;
}
