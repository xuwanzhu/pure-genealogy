"use client";

import { FamilyMemberNode } from "../graph/actions";
import { Button } from "@/components/ui/button";
import { Pause, Play, Square, MapPin, ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getRelationshipSummary, getStepRelation } from "./tour-utils";

interface TourControlsProps {
  path: FamilyMemberNode[];
  currentStep: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onStepClick: (step: number) => void;
}

export function TourControls({
  path,
  currentStep,
  isPaused,
  onPause,
  onResume,
  onStop,
  onStepClick,
}: TourControlsProps) {
  const currentMember = path[currentStep];
  const nextMember = path[currentStep + 1] || null;
  const progress = Math.min(
    100,
    (currentStep / Math.max(1, path.length - 1)) * 100
  );
  const summary = getRelationshipSummary(path);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-2xl">
      <Card className="p-4 shadow-2xl border-primary/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex flex-col gap-3">
          {/* 关系结论 */}
          {summary && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm font-medium text-primary">{summary}</p>
            </div>
          )}

          {/* 路径面包屑:已过 ✓ / 当前高亮 / 未到普通,可点击跳转 */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:thin]">
            {path.map((member, i) => {
              const isCurrent = i === currentStep;
              const isPassed = i < currentStep;
              return (
                <div key={member.id} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => onStepClick(i)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-110"
                        : isPassed
                        ? "bg-muted text-muted-foreground/60 hover:bg-muted/80"
                        : "bg-secondary hover:bg-secondary/70 text-foreground/80"
                    )}
                    title={`跳转到 ${member.name}`}
                  >
                    {isPassed && (
                      <Check className="mr-1 inline h-3 w-3" />
                    )}
                    {member.name}
                    {member.generation != null && (
                      <span
                        className={cn(
                          "ml-1 text-[10px]",
                          isCurrent ? "text-primary-foreground/70" : "text-muted-foreground/60"
                        )}
                      >
                        {member.generation}世
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 当前位置 & 下一站 */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">当前位置</span>
              <span className="text-sm font-semibold">{currentMember?.name}</span>
              {nextMember && (
                <span className="text-xs text-muted-foreground">
                  → 下一站{" "}
                  <span className="font-medium text-foreground/80">
                    {nextMember.name}
                  </span>
                  {currentMember && nextMember && (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                      {getStepRelation(currentMember, nextMember)}·
                      {currentMember.father_id === nextMember.id ? "上行" : "下行"}
                    </span>
                  )}
                </span>
              )}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {currentStep + 1} / {path.length} 站
            </span>
          </div>

          {/* 进度条 */}
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 控制按钮 */}
          <div className="flex justify-center gap-3">
            {isPaused ? (
              <Button size="sm" onClick={onResume} className="w-24">
                <Play className="h-4 w-4 mr-1.5" /> 继续
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={onPause} className="w-24">
                <Pause className="h-4 w-4 mr-1.5" /> 暂停
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={onStop} className="w-24">
              <Square className="h-4 w-4 mr-1.5" /> 结束
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
