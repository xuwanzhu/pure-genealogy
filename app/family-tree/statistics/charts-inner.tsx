"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Users,
  Network,
  HeartPulse,
  Heart,
  TrendingUp,
  Gauge,
  Crown,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatisticsData } from "./actions";

/* ---------------- 数字滚动动画 ---------------- */
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const v = useCountUp(value);
  return (
    <>
      {v.toLocaleString("zh-CN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}

/* ---------------- KPI 指标卡 ---------------- */
interface KpiCardProps {
  icon: LucideIcon;
  value: number;
  label: string;
  sub?: string;
  gradient: string; // 图标背景渐变
  delay?: number;
}

function KpiCard({ icon: Icon, value, label, sub, gradient, delay = 0 }: KpiCardProps) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur p-5
                 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40
                 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* 角落光晕 */}
      <div
        className={cn(
          "absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-25",
          gradient
        )}
      />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-4xl font-bold tracking-tight tabular-nums">
            <AnimatedNumber value={value} />
          </div>
          <div className="mt-2 text-sm font-medium text-muted-foreground">{label}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground/70">{sub}</div>}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg bg-gradient-to-br",
            gradient
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 环形图(中心带总数) ---------------- */
interface DonutProps {
  data: { name: string; value: number; fill: string }[];
  centerLabel: string;
  centerValue: number;
}

function Donut({ data, centerLabel, centerValue }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={92}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
            animationDuration={900}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: 13,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
            formatter={(value) => [`${value} 人`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* 中心文字 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">
          <AnimatedNumber value={centerValue} />
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">{centerLabel}</span>
        <span className="text-[11px] text-muted-foreground/60">共 {total} 人</span>
      </div>
    </div>
  );
}

/* ---------------- 图例 ---------------- */
function Legend({ data }: { data: { name: string; value: number; fill: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
      {data.map((d) => (
        <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
          {d.name}
          <span className="font-semibold text-foreground/80">
            {d.value}
            {total > 0 && (
              <span className="ml-0.5 font-normal text-muted-foreground/70">
                ({Math.round((d.value / total) * 100)}%)
              </span>
            )}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ---------------- 家族剪影纪录卡 ---------------- */
interface SnapshotProps {
  icon: LucideIcon;
  title: string;
  value: string;
  hint?: string;
  delay?: number;
}

function Snapshot({ icon: Icon, title, value, hint, delay = 0 }: SnapshotProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-card/50 px-4 py-3
                 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground/70">{hint}</div>}
      </div>
    </div>
  );
}

/* ---------------- 图表卡片外壳 ---------------- */
function ChartCard({
  title,
  desc,
  children,
  className,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-2xl", className)}>
      <div className="px-6 pt-5 pb-1">
        <h3 className="text-base font-semibold tracking-wide">{title}</h3>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

/* ---------------- 字辈用字榜 ---------------- */
function NameCharsRanking({ commonNames }: { commonNames: { name: string; count: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  const max = commonNames[0]?.count || 1;

  if (commonNames.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">暂无数据</p>;
  }

  return (
    <div className="space-y-2.5 py-2">
      {commonNames.slice(0, 8).map((item, i) => (
        <div key={item.name} className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
              i === 0
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : i === 1
                  ? "bg-stone-400/15 text-stone-500 dark:text-stone-300"
                  : i === 2
                    ? "bg-orange-700/15 text-orange-700 dark:text-orange-400"
                    : "bg-muted text-muted-foreground"
            )}
          >
            {i + 1}
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-accent/40 font-serif text-base font-semibold">
            {item.name}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-1000 ease-out"
              style={{
                width: mounted ? `${(item.count / max) * 100}%` : "0%",
                transitionDelay: `${i * 80}ms`,
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
            {item.count}人
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 主组件 ---------------- */
export function StatisticsChartsInner({ data }: { data: StatisticsData }) {
  const maleCount = data.genderStats.find((g) => g.name === "男")?.value || 0;
  const femaleCount = data.genderStats.find((g) => g.name === "女")?.value || 0;
  const aliveCount = data.statusStats.find((s) => s.name === "在世")?.value || 0;

  // 年龄分布: 只保留有数据的分段,避免大片空柱
  const ageChartData = useMemo(
    () => data.ageStats.filter((a) => a.value > 0),
    [data.ageStats]
  );

  return (
    <div className="space-y-6">
      {/* ==== KPI 指标 ==== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          value={data.totalMembers}
          label="族人总数"
          sub={`男 ${maleCount} · 女 ${femaleCount}`}
          gradient="from-emerald-500 to-teal-500"
          delay={0}
        />
        <KpiCard
          icon={Network}
          value={data.generations}
          label="繁衍世代"
          sub={data.peakGeneration ? `${data.peakGeneration.name}人丁最旺(${data.peakGeneration.value}人)` : "世代待补录"}
          gradient="from-cyan-500 to-sky-500"
          delay={80}
        />
        <KpiCard
          icon={HeartPulse}
          value={aliveCount}
          label="在世族人"
          sub={data.avgAge !== null ? `平均 ${data.avgAge} 岁` : "生日待补录"}
          gradient="from-rose-500 to-pink-500"
          delay={160}
        />
        <KpiCard
          icon={Heart}
          value={data.couplePairs}
          label="结缡夫妻"
          sub="双向关联的配偶"
          gradient="from-fuchsia-500 to-purple-500"
          delay={240}
        />
      </div>

      {/* ==== 家族剪影 ==== */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Snapshot
          icon={TrendingUp}
          title="人丁最旺"
          value={data.peakGeneration ? `${data.peakGeneration.name} · ${data.peakGeneration.value} 人` : "—"}
          delay={0}
        />
        <Snapshot
          icon={Gauge}
          title="在世平均年龄"
          value={data.avgAge !== null ? `${data.avgAge} 岁` : "暂无生日数据"}
          delay={70}
        />
        <Snapshot
          icon={Crown}
          title="族中最长者"
          value={data.eldestAlive ? `${data.eldestAlive.name} · ${data.eldestAlive.age} 岁` : "暂无生日数据"}
          delay={140}
        />
        <Snapshot
          icon={Hourglass}
          title="享年之冠"
          value={data.longevityRecord ? `${data.longevityRecord.name} · 享年 ${data.longevityRecord.age} 岁` : "生卒待补录"}
          delay={210}
        />
      </div>

      {/* ==== 两个环形图 ==== */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ChartCard title="性别比例" desc="家族成员男女分布">
          <Donut data={data.genderStats} centerLabel="总人数" centerValue={data.totalMembers} />
          <Legend data={data.genderStats} />
        </ChartCard>
        <ChartCard title="在世状态" desc="成员在世与已故比例">
          <Donut data={data.statusStats} centerLabel="在世族人" centerValue={aliveCount} />
          <Legend data={data.statusStats} />
        </ChartCard>
      </div>

      {/* ==== 世代分布 ==== */}
      <ChartCard title="世代分布" desc="瓜瓞绵延，各世族人多寡">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={data.generationStats}
              margin={{ top: 28, right: 16, left: -12, bottom: 0 }}
              barCategoryGap="28%"
            >
              <defs>
                <linearGradient id="genBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 13,
                }}
                formatter={(value) => [`${value} 人`, "族人"]}
              />
              <Bar dataKey="value" fill="url(#genBar)" radius={[8, 8, 0, 0]} animationDuration={1000}>
                <LabelList
                  dataKey="value"
                  position="top"
                  style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* ==== 年龄分布 + 字辈用字 ==== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="在世族人年龄分布" desc="基于已录入生日的在世成员">
          {ageChartData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={ageChartData} margin={{ top: 24, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ageBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 13,
                    }}
                    formatter={(value) => [`${value} 人`, "族人"]}
                  />
                  <Bar dataKey="value" fill="url(#ageBar)" radius={[6, 6, 0, 0]} animationDuration={1000}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Hourglass className="h-8 w-8 opacity-30" />
              补录在世族人生日后即可查看年龄分布
            </div>
          )}
        </ChartCard>

        <ChartCard title="名字用字榜" desc="族名第二字频次，窥见字辈传承">
          <NameCharsRanking commonNames={data.commonNames} />
        </ChartCard>
      </div>
    </div>
  );
}
