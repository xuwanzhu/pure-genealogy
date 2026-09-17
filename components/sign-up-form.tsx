"use client";

import { cn } from "@/lib/utils";
import { createFamilyAction, joinFamilyAction } from "@/app/auth/actions";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Home, KeyRound } from "lucide-react";

type SignUpMode = "create" | "join";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [mode, setMode] = useState<SignUpMode>("create");
  const [surname, setSurname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("两次密码输入不一致");
      setIsLoading(false);
      return;
    }

    try {
      const result =
        mode === "create"
          ? await createFamilyAction(surname, phone, password, repeatPassword, realName)
          : await joinFamilyAction(inviteCode, phone, password, repeatPassword, realName);
      if (!result.success) {
        setError(result.error || "注册失败");
        return;
      }
      // 注册成功并自动登录，直接进入族谱页面
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
          <CardTitle className="text-2xl">注册</CardTitle>
          <CardDescription>
            创建新家族，或凭邀请码加入已有家族
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 模式切换 */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer",
                mode === "create"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Home className="h-4 w-4" />
              创建新家族
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer",
                mode === "join"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <KeyRound className="h-4 w-4" />
              加入已有家族
            </button>
          </div>

          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              {mode === "create" ? (
                <div className="grid gap-2">
                  <Label htmlFor="surname">姓氏</Label>
                  <Input
                    id="surname"
                    placeholder="如：王"
                    required
                    maxLength={2}
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    创建后您将成为该家族的管理员，可邀请族人加入
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="invite-code">家族邀请码</Label>
                  <Input
                    id="invite-code"
                    placeholder="8 位数字邀请码"
                    required
                    maxLength={8}
                    value={inviteCode}
                    onChange={(e) =>
                      setInviteCode(e.target.value.toUpperCase())
                    }
                    className="font-mono tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground">
                    请向家族管理员索取邀请码，加入后为只读成员
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="real-name">您的姓名</Label>
                <Input
                  id="real-name"
                  placeholder="如：王大山"
                  required
                  maxLength={20}
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  注册后将自动以本人身份加入族谱
                </p>
              </div>
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">重复密码</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  minLength={6}
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? "正在注册..."
                  : mode === "create"
                  ? "创建家族"
                  : "加入家族"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              已经有账户了？{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                登录
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
