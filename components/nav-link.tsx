"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  // 精确匹配,避免 /family-tree/graph-3d 同时命中 /family-tree/graph
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-200",
        isActive
          ? "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 dark:hover:bg-foreground/10"
      )}
    >
      {children}
    </Link>
  );
}
