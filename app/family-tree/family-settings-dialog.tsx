"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  Users,
  UserPlus,
  Loader2,
  KeySquare,
  Link2,
  Smartphone,
  BadgeCheck,
} from "lucide-react";
import { resetInviteCode, fetchAllMembersForSelect } from "./actions";
import {
  createMemberAccountAction,
  listFamilyAccounts,
  resetMemberPassword,
  setAccountMember,
  type FamilyAccount,
} from "@/app/auth/actions";
import { useRouter } from "next/navigation";

interface FamilySettingsDialogProps {
  familyName: string;
  inviteCode: string;
}

interface MemberOption {
  id: number;
  name: string;
  generation: number | null;
}

/**
 * 家族设置弹窗:邀请码管理 + 账号管理 (代建/重置密码/关联成员)
 */
export function FamilySettingsDialog({
  familyName,
  inviteCode: initialCode,
}: FamilySettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"invite" | "accounts">("invite");

  // ---------- 邀请码 ----------
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // ---------- 代建账号 ----------
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  // ---------- 账号列表 ----------
  const [accounts, setAccounts] = useState<FamilyAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  // 每个账号的行内编辑状态
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkValue, setLinkValue] = useState<string>("");
  const [rowMessage, setRowMessage] = useState<{
    id: number;
    ok: boolean;
    message: string;
  } | null>(null);

  const router = useRouter();

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    const result = await listFamilyAccounts();
    if (result.success) setAccounts(result.accounts);
    setIsLoadingAccounts(false);
  }, []);

  // 打开弹窗时按需加载
  const handleOpenChange = async (o: boolean) => {
    setOpen(o);
    if (o) {
      const result = await listFamilyAccounts();
      if (result.success) setAccounts(result.accounts);
      const members = await fetchAllMembersForSelect();
      setMemberOptions(members);
    } else {
      // 关闭时重置状态
      setTab("invite");
      setResettingId(null);
      setLinkingId(null);
      setRowMessage(null);
      setCreateResult(null);
      router.refresh();
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = async () => {
    if (
      !window.confirm(
        "重置后旧邀请码立即失效,已注册的族人不受影响。确定重置吗?"
      )
    )
      return;
    setIsResetting(true);
    const result = await resetInviteCode();
    setIsResetting(false);
    if (result.success && result.inviteCode) {
      setInviteCode(result.inviteCode);
      router.refresh();
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateResult(null);
    const result = await createMemberAccountAction(
      newPhone,
      newPassword,
      newIsAdmin,
      newName
    );
    setIsCreating(false);
    if (result.success) {
      setCreateResult({
        ok: true,
        message: `账号创建成功!${newName}可用手机号 ${newPhone} 登录`,
      });
      setNewPhone("");
      setNewPassword("");
      setNewName("");
      setNewIsAdmin(false);
      await loadAccounts();
      router.refresh();
    } else {
      setCreateResult({ ok: false, message: result.error || "创建失败" });
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (resetPwd.length < 6) {
      setRowMessage({ id: userId, ok: false, message: "密码至少需要 6 位" });
      return;
    }
    const result = await resetMemberPassword(userId, resetPwd);
    if (result.success) {
      setRowMessage({
        id: userId,
        ok: true,
        message: "密码已重置,该账号已强制下线",
      });
      setResettingId(null);
      setResetPwd("");
    } else {
      setRowMessage({ id: userId, ok: false, message: result.error || "重置失败" });
    }
  };

  const handleLinkMember = async (
    userId: number,
    value: string
  ) => {
    setLinkValue(value);
    if (value === "") return; // 选择占位项,不提交

    let memberId: number | null = null;
    let memberName: string | null = null;
    if (value === "__new__") {
      const name = window.prompt("请输入族人的姓名(族内无此成员时将新建)");
      if (!name || !name.trim()) return;
      memberName = name.trim();
    } else if (value === "__none__") {
      memberId = null;
    } else {
      memberId = parseInt(value, 10);
    }

    const result = await setAccountMember(userId, memberId, memberName);
    if (result.success) {
      setRowMessage({ id: userId, ok: true, message: "关联成员已更新" });
      await loadAccounts();
      router.refresh();
    } else {
      setRowMessage({ id: userId, ok: false, message: result.error || "设置失败" });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleOpenChange(true)}
        title="家族设置 / 邀请码 / 账号管理"
        className="h-9 w-9"
      >
        <KeyRound className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {familyName} · 家族设置
            </DialogTitle>
            <DialogDescription>
              管理邀请码、族人账号与族谱成员的关联
            </DialogDescription>
          </DialogHeader>

          {/* 分区切换 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setTab("invite")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "invite"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeySquare className="mr-1.5 inline h-3.5 w-3.5" />
              邀请码
            </button>
            <button
              onClick={() => setTab("accounts")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "accounts"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="mr-1.5 inline h-3.5 w-3.5" />
              账号管理
            </button>
          </div>

          <div className="space-y-4 py-2">
            {tab === "invite" ? (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    家族邀请码
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] text-primary select-all">
                      {inviteCode}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleCopy}
                      title="复制邀请码"
                      className="h-11 w-11"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-3 rounded-xl bg-muted/60 p-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      把邀请码发给族人,他们注册时填入即可加入家族(只读)。
                      若邀请码泄露,可重置使其失效。
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReset}
                      disabled={isResetting}
                      className="shrink-0"
                    >
                      <RefreshCw
                        className={`mr-1.5 h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`}
                      />
                      {isResetting ? "重置中..." : "重置"}
                    </Button>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <form onSubmit={handleCreateAccount}>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <UserPlus className="h-4 w-4" />
                    代建族人账号
                  </p>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                    为不会注册的长辈创建账号,账号将自动关联到族谱成员
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="new-name" className="text-xs">
                          族人姓名
                        </Label>
                        <Input
                          id="new-name"
                          placeholder="如 刘德福"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="new-phone" className="text-xs">
                          手机号
                        </Label>
                        <Input
                          id="new-phone"
                          type="tel"
                          inputMode="numeric"
                          placeholder="11 位手机号"
                          required
                          maxLength={11}
                          pattern="1[3-9][0-9]{9}"
                          value={newPhone}
                          onChange={(e) =>
                            setNewPhone(e.target.value.replace(/\D/g, ""))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-password" className="text-xs">
                        初始密码
                      </Label>
                      <Input
                        id="new-password"
                        type="text"
                        placeholder="至少 6 位,建议用生日等好记的"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="new-admin"
                        checked={newIsAdmin}
                        onCheckedChange={(v) => setNewIsAdmin(v === true)}
                      />
                      <Label
                        htmlFor="new-admin"
                        className="text-xs font-normal cursor-pointer select-none"
                      >
                        设为管理员(可编辑族谱,默认只读)
                      </Label>
                    </div>
                    {createResult && (
                      <p
                        className={`text-xs ${createResult.ok ? "text-emerald-600" : "text-red-500"}`}
                      >
                        {createResult.message}
                      </p>
                    )}
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isCreating ? "创建中..." : "创建账号"}
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  家族账号列表。可为忘记密码的族人重置密码,或设置账号对应的族谱成员。
                </p>
                {isLoadingAccounts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="rounded-xl border p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">
                              {acc.phone}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                acc.role === "admin"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {acc.role === "admin" ? "管理员" : "只读"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                            <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {acc.memberName
                                ? `族谱成员: ${acc.memberName}`
                                : "未关联族谱成员"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResettingId(
                                resettingId === acc.id ? null : acc.id
                              );
                              setLinkingId(null);
                              setRowMessage(null);
                            }}
                          >
                            <KeySquare className="mr-1 h-3.5 w-3.5" />
                            重置密码
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLinkingId(
                                linkingId === acc.id ? null : acc.id
                              );
                              setResettingId(null);
                              setRowMessage(null);
                            }}
                          >
                            <Link2 className="mr-1 h-3.5 w-3.5" />
                            关联成员
                          </Button>
                        </div>

                        {/* 重置密码行内表单 */}
                        {resettingId === acc.id && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder="新密码 (至少 6 位)"
                              value={resetPwd}
                              onChange={(e) => setResetPwd(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleResetPassword(acc.id)}
                            >
                              确认
                            </Button>
                          </div>
                        )}

                        {/* 关联成员行内表单 */}
                        {linkingId === acc.id && (
                          <Select
                            value={
                              acc.memberId ? String(acc.memberId) : "__none__"
                            }
                            onValueChange={(v) => handleLinkMember(acc.id, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="选择族谱成员" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                未关联 (解除关联)
                              </SelectItem>
                              {memberOptions.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                  {m.name}
                                  {m.generation !== null
                                    ? ` (第${m.generation}世)`
                                    : ""}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__">
                                + 按姓名新建成员...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {rowMessage?.id === acc.id && (
                          <p
                            className={`text-xs ${rowMessage.ok ? "text-emerald-600" : "text-red-500"}`}
                          >
                            {rowMessage.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
