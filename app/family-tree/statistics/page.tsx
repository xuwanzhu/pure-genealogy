import React, { Suspense } from "react";
import { StatisticsContent } from "./statistics-content";

export const metadata = {
  title: "家族统计分析",
  description: "家族成员数据统计仪表盘",
};

export default function StatisticsPage() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
              Analytics
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient">家族数据统计</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground tracking-wide">
            观家族之盛，察世代之变
          </p>
        </div>
      </div>
      
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground">正在加载统计数据...</div>}>
        <StatisticsContent />
      </Suspense>
    </div>
  );
}