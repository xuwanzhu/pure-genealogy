"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { FamilyMemberNode } from "../graph/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RotateCcw,
  Maximize,
  Minimize,
  User,
  X,
  Map,
} from "lucide-react";
import SpriteText from "three-spritetext";
import { useTheme } from "next-themes";
import { MemberDetailDialog } from "../member-detail-dialog";
import { TourDialog } from "./tour-dialog";
import { TourControls } from "./tour-controls";

// 路径高亮颜色
const PATH_COLOR = "#10b981"; // 翡翠绿:路径节点与连线
const CURRENT_COLOR = "#f97316"; // 橙色:当前巡游到的节点
const PATH_LINK_COLOR = "#34d399"; // 路径连线(比节点亮一档)

// 动态导入 ForceGraph3D，禁用 SSR
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-muted/10">
      <div className="text-muted-foreground animate-pulse">加载 3D 视图中...</div>
    </div>
  ),
});

interface ForceGraphProps {
  data: FamilyMemberNode[];
}

interface GraphNode extends FamilyMemberNode {
  x?: number;
  y?: number;
  z?: number;
  group?: number;
  // Index signature to satisfy react-force-graph types
  [key: string]: any;
}

export function FamilyForceGraph({ data }: ForceGraphProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [instanceKey, setInstanceKey] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    setInstanceKey(Math.random().toString(36).substring(7));
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMemberNode | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Tour State
  const [isTourDialogOpen, setIsTourDialogOpen] = useState(false);
  const [tourPath, setTourPath] = useState<FamilyMemberNode[]>([]);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isTourPaused, setIsTourPaused] = useState(false);
  const tourTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 监听容器大小变化
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    // 添加 resize 监听之前先执行一次，确保初始有值
    
    window.addEventListener("resize", updateDimensions);
    // 稍微延迟一下再次检查，防止初始渲染时容器未撑开
    const timer = setTimeout(updateDimensions, 100);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      clearTimeout(timer);
    };
  }, []);

  // 转换数据为 graph 格式
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = data.map((member) => ({
      ...member,
      // 根据代数计算颜色分组，或者其他逻辑
      group: member.generation || 0,
    }));

    const links = data
      .filter((member) => member.father_id)
      .map((member) => ({
        source: member.father_id!,
        target: member.id,
      }));

    // 婚姻连线 (粉色,双向去重)
    const spouseKeys = new Set<string>();
    data.forEach((m) => {
      if (!m.spouse_id || m.spouse_id === m.id) return;
      const key = `${Math.min(m.id, m.spouse_id)}-${Math.max(m.id, m.spouse_id)}`;
      if (spouseKeys.has(key)) return;
      spouseKeys.add(key);
      links.push({ source: m.id, target: m.spouse_id, spouse: true } as any);
    });

    return { nodes, links };
  }, [data]);

  // 巡游路径的节点集合与连线集合 (用于 3D 高亮)
  const pathMemberIds = useMemo(
    () => new Set(tourPath.map((m) => m.id)),
    [tourPath]
  );
  const pathLinkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i < tourPath.length - 1; i++) {
      // 连线方向为 father -> child,两个方向都记录以容错
      keys.add(`${tourPath[i].id}-${tourPath[i + 1].id}`);
      keys.add(`${tourPath[i + 1].id}-${tourPath[i].id}`);
    }
    return keys;
  }, [tourPath]);

  const isPathLink = useCallback(
    (link: any) => {
      if (pathLinkKeys.size === 0) return false;
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      return pathLinkKeys.has(`${s}-${t}`);
    },
    [pathLinkKeys]
  );

  // Tour Logic
  const startTour = (path: FamilyMemberNode[]) => {
    setTourPath(path);
    setCurrentTourStep(0);
    setIsTourActive(true);
    setIsTourPaused(false);
    // Close detail dialog if open
    setIsDetailOpen(false);
  };

  const stopTour = () => {
    setIsTourActive(false);
    setIsTourPaused(false);
    setTourPath([]);
    setCurrentTourStep(0);
    setHighlightedId(null);
    if (tourTimeoutRef.current) {
      clearTimeout(tourTimeoutRef.current);
    }
  };

  const pauseTour = () => {
    setIsTourPaused(true);
    if (tourTimeoutRef.current) {
      clearTimeout(tourTimeoutRef.current);
    }
  };

  const resumeTour = () => {
    setIsTourPaused(false);
  };

  // Effect to handle tour progression
  useEffect(() => {
    if (!isTourActive || isTourPaused || !fgRef.current) return;

    if (currentTourStep >= tourPath.length) {
      stopTour();
      return;
    }

    const targetMember = tourPath[currentTourStep];
    // Find the node in the internal graph data to get current coordinates
    // Note: react-force-graph modifies the objects in graphData.nodes with x,y,z
    const node = graphData.nodes.find(n => n.id === targetMember.id);

    if (node && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
      setHighlightedId(node.id);

      // Calculate distance for camera (巡游时拉远一些,看清路径上下文)
      const distance = 140;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

      fgRef.current.cameraPosition(
        { 
          x: node.x * distRatio, 
          y: node.y * distRatio, 
          z: node.z * distRatio 
        },
        { x: node.x, y: node.y, z: node.z },
        2000 // Transition time (2s)
      );

      // Wait for transition + dwell time
      tourTimeoutRef.current = setTimeout(() => {
        setCurrentTourStep(prev => prev + 1);
      }, 3500); // 2000ms move + 1500ms dwell
    } else {
      // If node not found or coords missing, skip to next
      setCurrentTourStep(prev => prev + 1);
    }

    return () => {
      if (tourTimeoutRef.current) {
        clearTimeout(tourTimeoutRef.current);
      }
    };
  }, [isTourActive, isTourPaused, currentTourStep, tourPath, graphData.nodes]);


  // 搜索功能
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    const foundNode = graphData.nodes.find((node) =>
      node.name.includes(searchQuery.trim())
    );

    if (foundNode && fgRef.current) {
      setHighlightedId(foundNode.id);
      
      // 移动相机视角到该节点
      const distance = 100;
      const distRatio = 1 + distance / Math.hypot(foundNode.x || 0, foundNode.y || 0, foundNode.z || 0);

      fgRef.current.cameraPosition(
        {
          x: (foundNode.x || 0) * distRatio,
          y: (foundNode.y || 0) * distRatio,
          z: (foundNode.z || 0) * distRatio,
        }, // new position
        { x: foundNode.x, y: foundNode.y, z: foundNode.z }, // lookAt
        3000 // ms transition duration
      );
    }
  }, [graphData, searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setHighlightedId(null);
  };

  // 重置视图
  const handleResetView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 1000);
      setHighlightedId(null);
    }
  }, []);

  // 全屏切换
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 获取父亲姓名
  const getFatherName = (fatherId: number | null) => {
    if (!fatherId) return null;
    return data.find((m) => m.id === fatherId)?.name;
  };

  // 主题颜色配置
  const isDark = theme === "dark";
  const bgColor = isDark ? "#1c1917" : "#ffffff"; // background based on Stone theme
  const nodeTextColor = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
  const linkColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";

  if (!mounted) return null;

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full border rounded-lg overflow-hidden bg-background ${
        isFullscreen ? "h-screen border-0 rounded-none" : "h-[calc(100vh-140px)] min-h-[600px]"
      }`}
    >
      {/* 顶部工具栏 */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 max-w-[80%]">
        <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded-md p-1 shadow-sm">
          <Input
            placeholder="搜索姓名..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-8 w-40 md:w-56 border-0 focus-visible:ring-0 bg-transparent"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
          {searchQuery && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button size="icon" variant="secondary" onClick={handleResetView} title="重置视图">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={toggleFullscreen} title={isFullscreen ? "退出全屏" : "全屏"}>
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
        <Button 
          size="icon" 
          variant={isTourActive ? "default" : "secondary"} 
          onClick={() => setIsTourDialogOpen(true)} 
          title="自动巡游"
          className={isTourActive ? "animate-pulse" : ""}
        >
          <Map className="h-4 w-4" />
        </Button>
      </div>

      {/* 3D 图表 */}
      {dimensions.width > 0 && instanceKey && (
        <ForceGraph3D
          key={instanceKey}
          ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor={bgColor}
        nodeLabel="name"
        nodeAutoColorBy="generation" // 按代数着色
        nodeRelSize={6}
        linkOpacity={isTourActive ? 0.15 : 0.3}

        // ── 路径高亮渲染 ──
        // 路径节点放大,其余缩小
        nodeVal={(node: any) =>
          isTourActive
            ? pathMemberIds.has(node.id)
              ? 3.5
              : 0.6
            : 1
        }
        // 路径连线加粗提亮,其余变暗;婚姻连线始终粉色
        linkWidth={(link: any) => {
          if (link.spouse) return 2;
          return isTourActive && isPathLink(link) ? 4 : 1;
        }}
        linkColor={(link: any) => {
          if (link.spouse) return "#ec4899";
          if (isTourActive) {
            return isPathLink(link) ? PATH_LINK_COLOR : linkColor;
          }
          return linkColor;
        }}
        // 路径连线粒子更醒目、流动更快
        linkDirectionalParticles={(link: any) =>
          isTourActive && isPathLink(link) ? 5 : 2
        }
        linkDirectionalParticleWidth={(link: any) =>
          isTourActive && isPathLink(link) ? 4 : 2
        }
        linkDirectionalParticleSpeed={(link: any) =>
          isTourActive && isPathLink(link) ? 0.02 : 0.008
        }
        
        // 节点文字渲染
        nodeThreeObjectExtend={true}
        nodeThreeObject={(node: any) => {
          const isCurrent = node.id === highlightedId;
          const isPath = isTourActive && pathMemberIds.has(node.id);

          const sprite = new SpriteText(node.name);
          if (isCurrent) {
            // 当前巡游节点:橙色 + 放大 + 高亮背景
            sprite.color = CURRENT_COLOR;
            sprite.textHeight = 10;
            sprite.backgroundColor = "rgba(249,115,22,0.18)";
            sprite.borderColor = CURRENT_COLOR;
            sprite.borderWidth = 0.6;
          } else if (isPath) {
            // 路径节点:翡翠绿
            sprite.color = PATH_COLOR;
            sprite.textHeight = 8;
            sprite.backgroundColor = isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.12)";
          } else if (isTourActive) {
            // 巡游时无关节点:压暗
            sprite.color = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
            sprite.textHeight = 5;
          } else {
            sprite.color = node.id === highlightedId ? "#ff0000" : nodeTextColor;
            sprite.textHeight = 6;
          }
          sprite.padding = 2;
          sprite.borderRadius = 4;
          sprite.position.y = 12; // 显示在节点上方
          return sprite;
        }}
        
        // 点击事件
        onNodeClick={(node: any) => {
          if (isTourActive) return; // Disable manual click during tour
          setSelectedMember(node);
          setIsDetailOpen(true);
          
          // 聚焦点击的节点
          const distance = 80;
          const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
          fgRef.current?.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            { x: node.x, y: node.y, z: node.z },
            1500
          );
        }}
      />
      )}

      {/* Tour UI Components */}
      <TourDialog
        isOpen={isTourDialogOpen}
        onOpenChange={setIsTourDialogOpen}
        members={data}
        onStartTour={startTour}
      />

      {isTourActive && (
        <TourControls
          path={tourPath}
          currentStep={currentTourStep}
          isPaused={isTourPaused}
          onPause={pauseTour}
          onResume={resumeTour}
          onStop={stopTour}
          onStepClick={(step) => {
            // 跳转时清除计时器,由 step 变化重新驱动
            if (tourTimeoutRef.current) clearTimeout(tourTimeoutRef.current);
            setIsTourPaused(false);
            setCurrentTourStep(step);
          }}
        />
      )}

      <MemberDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        member={selectedMember}
        fatherName={getFatherName(selectedMember?.father_id || null)}
      />
    </div>
  );
}
