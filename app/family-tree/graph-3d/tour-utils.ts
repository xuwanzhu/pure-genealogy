import { FamilyMemberNode } from "../graph/actions";

/**
 * Finds the shortest path between two members in the family tree using BFS.
 * Treats the graph as undirected (parent <-> child) to allow traversal across branches.
 */
export function findShortestPath(
  members: FamilyMemberNode[],
  startId: number,
  endId: number
): FamilyMemberNode[] | null {
  if (startId === endId) {
    const member = members.find((m) => m.id === startId);
    return member ? [member] : null;
  }

  // 1. Build Adjacency List (Undirected)
  const adj = new Map<number, number[]>();
  const memberMap = new Map<number, FamilyMemberNode>();

  members.forEach((m) => {
    memberMap.set(m.id, m);
    if (!adj.has(m.id)) adj.set(m.id, []);

    // Edge to Father
    if (m.father_id) {
      // Child -> Father
      adj.get(m.id)?.push(m.father_id);
      
      // Father -> Child
      if (!adj.has(m.father_id)) adj.set(m.father_id, []);
      adj.get(m.father_id)?.push(m.id);
    }
  });

  // 2. BFS
  const queue: number[] = [startId];
  const visited = new Set<number>([startId]);
  const parentMap = new Map<number, number>(); // To reconstruct path: child -> parent in search tree

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === endId) {
      // Found target, reconstruct path
      const path: FamilyMemberNode[] = [];
      let traceId: number | undefined = endId;
      
      while (traceId !== undefined) {
        const member = memberMap.get(traceId);
        if (member) path.unshift(member);
        traceId = parentMap.get(traceId);
      }
      return path;
    }

    const neighbors = adj.get(currentId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parentMap.set(neighborId, currentId);
        queue.push(neighborId);
      }
    }
  }

  // No path found
  return null;
}

/**
 * 计算单步关系:next 相对于 prev 是什么(父亲/母亲/儿子/女儿)
 */
export function getStepRelation(
  prev: FamilyMemberNode,
  next: FamilyMemberNode
): string {
  if (next.father_id === prev.id) {
    return next.gender === "女" ? "女儿" : "儿子";
  }
  if (prev.father_id === next.id) {
    return next.gender === "女" ? "母亲" : "父亲";
  }
  return "亲属";
}

/**
 * 计算路径的整体亲属关系:描述 end 相对于 start 是什么。
 * 树中最短路径必为先上行至最近公共祖先、再下行,
 * 统计上行动数 U 与下行动数 D 即可归类。
 */
export function getRelationshipSummary(
  path: FamilyMemberNode[]
): string | null {
  if (path.length < 2) return null;

  const start = path[0];
  const end = path[path.length - 1];

  let up = 0;
  let down = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const prev = path[i];
    const next = path[i + 1];
    if (prev.father_id === next.id) up++;
    else if (next.father_id === prev.id) down++;
  }

  const male = end.gender !== "女";

  let term: string;
  if (up === 0 && down === 0) {
    term = "本人";
  } else if (up === 0) {
    // end 是 start 的后代
    term =
      down === 1
        ? male
          ? "儿子"
          : "女儿"
        : down === 2
        ? male
          ? "孙子"
          : "孙女"
        : down === 3
        ? male
          ? "曾孙"
          : "曾孙女"
        : `${down}世后裔`;
  } else if (down === 0) {
    // end 是 start 的先辈
    term =
      up === 1
        ? male
          ? "父亲"
          : "母亲"
        : up === 2
        ? male
          ? "祖父"
          : "祖母"
        : up === 3
        ? male
          ? "曾祖父"
          : "曾祖母"
        : up === 4
        ? male
          ? "高祖父"
          : "高祖母"
        : `${up}世先祖`;
  } else {
    // 旁系
    if (up === 1 && down === 1) term = male ? "兄弟" : "姐妹";
    else if (up === 2 && down === 1) term = male ? "叔伯" : "姑母";
    else if (up === 1 && down === 2) term = male ? "侄子" : "侄女";
    else if (up === 2 && down === 2) term = male ? "堂兄弟" : "堂姐妹";
    else if (up === 3 && down === 1) term = male ? "叔祖父" : "姑祖母";
    else if (up === 1 && down === 3) term = male ? "侄孙" : "侄孙女";
    else if (up === 3 && down === 2) term = male ? "堂叔" : "堂姑";
    else if (up === 2 && down === 3) term = male ? "堂侄" : "堂侄女";
    else if (up === 3 && down === 3) term = "远房堂亲";
    else term = `旁系亲属(上${up}代·下${down}代)`;
  }

  return `${end.name} 是 ${start.name} 的 ${term}`;
}
