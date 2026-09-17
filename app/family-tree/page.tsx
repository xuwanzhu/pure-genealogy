import { Suspense } from "react";
import { FamilyMembersLoader } from "./family-members-loader";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"];

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
      <div className="border rounded-2xl overflow-hidden">
        <div className="h-10 bg-muted/50 border-b" />
        {SKELETON_ROWS.map((id) => (
          <div key={id} className="h-12 border-b last:border-0 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  );
}

async function FamilyMembersWrapper({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const search = params.search || "";
  const pageSize = 50;

  return <FamilyMembersLoader page={page} pageSize={pageSize} search={search} />;
}

export default function FamilyTreePage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto py-8 px-4">
      {/* 页头:渐变大标题 + 英文副题 */}
      <div className="mb-8 animate-rise">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
              Members
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient">族谱成员</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground tracking-wide">
            敬录先人名讳，长幼有序，脉络分明
          </p>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <FamilyMembersWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
