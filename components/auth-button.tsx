import Link from "next/link";
import { Button } from "./ui/button";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import { ShieldCheck, Eye } from "lucide-react";

export async function AuthButton() {
  const user = await getSessionUser();

  return user ? (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
      <div className="flex items-center gap-2 mb-2 md:mb-0">
        <span className="text-sm font-medium truncate max-w-[160px] md:max-w-none">
          你好, {user.phone}!
        </span>
        <span
          className={
            user.role === "admin"
              ? "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
              : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
          }
          title={user.role === "admin" ? "可增删改族谱数据" : "仅可浏览族谱"}
        >
          {user.role === "admin" ? (
            <>
              <ShieldCheck className="h-3 w-3" />
              管理员
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              只读
            </>
          )}
        </span>
      </div>
      <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
        {user.role === "admin" && (
          <Button asChild size="sm" variant={"outline"} className="w-full md:w-auto">
            <Link href="/family-tree">数据维护</Link>
          </Button>
        )}
        <LogoutButton className="w-full md:w-auto" />
      </div>
    </div>
  ) : (
    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
      <Button asChild size="sm" variant={"outline"} className="w-full md:w-auto">
        <Link href="/auth/login">登录</Link>
      </Button>
      <Button asChild size="sm" variant={"default"} className="w-full md:w-auto">
        <Link href="/auth/sign-up">注册</Link>
      </Button>
    </div>
  );
}
