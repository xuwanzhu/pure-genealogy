"use client";

import { logoutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();

  const logout = async () => {
    await logoutAction();
    router.push("/auth/login");
    router.refresh();
  };

  return <Button onClick={logout} className={cn(className)}>登出</Button>;
}
