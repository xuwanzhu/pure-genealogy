"use client";

import { cn } from "@/lib/utils";
import { loginAction } from "@/app/auth/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const prefillPhone = process.env.NEXT_PUBLIC_LOGIN_PHONE ?? "";
  const prefillPassword = process.env.NEXT_PUBLIC_LOGIN_PASSWORD ?? "";
  const [phone, setPhone] = useState(prefillPhone);
  const [password, setPassword] = useState(prefillPassword);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginAction(phone, password, remember);
      if (!result.success) {
        setError(result.error || "登录失败");
        return;
      }
      // 登录成功后重定向到族谱关系图页面
      router.push("/family-tree/graph");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>
            请输入您的手机号登录账户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="请输入手机号"
                  required
                  maxLength={11}
                  pattern="1[3-9][0-9]{9}"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">密码</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer select-none"
                >
                  记住我（30 天内免登录）
                </Label>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "登录中..." : "登录"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              还没有账户？{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                注册
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
