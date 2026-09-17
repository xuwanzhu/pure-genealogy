"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FamilyMemberNode } from "../graph/actions";
import { MemberSelect } from "./member-select";
import { findShortestPath, getRelationshipSummary } from "./tour-utils";
import { AlertCircle, ArrowRight, Route } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface TourDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMemberNode[];
  onStartTour: (path: FamilyMemberNode[]) => void;
}

export function TourDialog({
  isOpen,
  onOpenChange,
  members,
  onStartTour,
}: TourDialogProps) {
  const [startId, setStartId] = useState<number | null>(null);
  const [endId, setEndId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 两人都选定后实时预览路径与关系
  const preview = useMemo(() => {
    if (!startId || !endId || startId === endId) return null;
    const path = findShortestPath(members, startId, endId);
    if (!path || path.length === 0) return null;
    return {
      path,
      summary: getRelationshipSummary(path),
    };
  }, [members, startId, endId]);

  const handleStart = () => {
    setError(null);
    if (!startId || !endId) {
      setError("请选择开始和结束节点");
      return;
    }
    if (startId === endId) {
      setError("出发人和终点人不能相同");
      return;
    }

    const path = findShortestPath(members, startId, endId);
    if (!path || path.length === 0) {
      setError("无法找到两点之间的路径");
      return;
    }

    onStartTour(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            自动巡游配置
          </DialogTitle>
          <DialogDescription>
            选择两位族人，系统将计算血缘路径，高亮展示并带您巡游全程。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>出发族人</Label>
            <MemberSelect
              members={members}
              value={startId}
              onChange={setStartId}
              placeholder="选择出发成员..."
            />
          </div>
          <div className="grid gap-2">
            <Label>终点族人</Label>
            <MemberSelect
              members={members}
              value={endId}
              onChange={setEndId}
              placeholder="选择终点成员..."
            />
          </div>

          {/* 实时路径预览 */}
          {preview && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2.5">
              {preview.summary && (
                <p className="text-sm font-medium text-primary">
                  {preview.summary}
                </p>
              )}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {preview.path.map((member, i) => (
                  <div key={member.id} className="flex items-center gap-1 shrink-0">
                    {i > 0 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                    )}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                        i === 0 || i === preview.path.length - 1
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-foreground/70"
                      )}
                    >
                      {member.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                共 {preview.path.length} 站 · 翡翠绿路径将自动高亮
              </p>
            </div>
          )}

          {startId && endId && startId !== endId && !preview && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>两人之间没有血缘路径</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleStart} disabled={!startId || !endId}>
            开始巡游
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
