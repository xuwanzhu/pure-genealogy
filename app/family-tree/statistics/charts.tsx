"use client";

import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { StatisticsData } from "./actions";

// 图表加载骨架屏
function ChartsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI 骨架 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border bg-card/60 p-5 animate-pulse"
          >
            <div className="flex items-start justify-between">
              <div className="w-full">
                <div className="h-9 w-16 rounded bg-muted" />
                <div className="mt-3 h-3.5 w-16 rounded bg-muted" />
              </div>
              <div className="h-11 w-11 rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* 家族剪影骨架 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card/50 px-4 py-3 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-muted" />
            <div className="flex-1">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="mt-1.5 h-3.5 w-24 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* 环形图骨架 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="rounded-2xl">
            <div className="px-6 pt-5">
              <div className="h-5 w-24 rounded bg-muted animate-pulse" />
              <div className="mt-1.5 h-3.5 w-36 rounded bg-muted animate-pulse" />
            </div>
            <CardContent>
              <div className="mx-auto mt-2 h-[240px] w-[240px] rounded-full bg-muted/60 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 柱状图骨架 */}
      <Card className="rounded-2xl">
        <div className="px-6 pt-5">
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
        <CardContent>
          <div className="h-[300px] flex items-end justify-around gap-6 p-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <div
                key={j}
                className="w-full max-w-[52px] rounded-t-lg bg-muted/60 animate-pulse"
                style={{ height: `${30 + j * 12}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 动态导入 recharts 组件，减少初始 bundle 体积
const StatisticsChartsInner = dynamic(
  () => import("./charts-inner").then((mod) => mod.StatisticsChartsInner),
  {
    ssr: false,
    loading: () => <ChartsSkeleton />,
  }
);

interface StatisticsChartsProps {
  data: StatisticsData;
}

export function StatisticsCharts({ data }: StatisticsChartsProps) {
  return <StatisticsChartsInner data={data} />;
}
