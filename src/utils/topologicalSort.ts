import type { Node, Edge } from '@xyflow/react';

/**
 * 在仅包含 executableTypes 的节点子图上做 Kahn 拓扑排序。
 *
 * 依赖边的识别规则(重要):
 *   - 两端都是 executable 节点的边: 直接作为依赖
 *   - 跨「非 executable 中继节点」的边: 通过 BFS 跳过中继建立「传递依赖」
 *     即: A(exe) → X(中继) → ... → B(exe), 视为 A → B 依赖
 *     这保证「llm → output(中继) → llm」 「llm → relay → llm」 等链路
 *     上下游依然严格刷索(上游未完成, 下游不会先启动)
 *
 * 若存在环或孤岛, 环节点会按照原始顺序追加到末尾(尽力而为)。
 */
export function topologicalSort(
  nodes: Node[],
  edges: Edge[],
  executableTypes: Set<string>
): string[] {
  const exeNodes = nodes.filter((n) => n.type && executableTypes.has(n.type));
  const exeIds = new Set(exeNodes.map((n) => n.id));

  // 全图正向邻接表(包含非 executable 节点)
  const fullAdj = new Map<string, string[]>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    if (!fullAdj.has(e.source)) fullAdj.set(e.source, []);
    fullAdj.get(e.source)!.push(e.target);
  }

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  exeIds.forEach((id) => {
    inDegree.set(id, 0);
    adj.set(id, []);
  });

  // 对每个 executable 源节点做 BFS:
  //   - 遇到下一个 executable 节点: 建立「传递依赖」, 不再穿越它
  //   - 遇到非 executable 节点: 继续穿透向下扩展(中继桥接)
  const seenEdge = new Set<string>(); // src->tgt 去重
  for (const src of exeIds) {
    const stack: string[] = [...(fullAdj.get(src) || [])];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      if (exeIds.has(cur)) {
        if (cur === src) continue; // 避免自环
        const k = `${src}->${cur}`;
        if (!seenEdge.has(k)) {
          seenEdge.add(k);
          adj.get(src)!.push(cur);
          inDegree.set(cur, (inDegree.get(cur) || 0) + 1);
        }
        // 不穿过下一个 executable 节点
      } else {
        // 非 executable 中继, 继续向下扩展
        for (const nxt of fullAdj.get(cur) || []) stack.push(nxt);
      }
    }
  }

  // 用原始顺序作为入队 tie-breaker, 保证视觉上稳定
  const queue: string[] = [];
  for (const n of exeNodes) {
    if ((inDegree.get(n.id) || 0) === 0) queue.push(n.id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const next of adj.get(id) || []) {
      const d = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (result.length < exeIds.size) {
    // 环或异常, 把剩下未排序的按原始顺序补上
    const got = new Set(result);
    for (const n of exeNodes) {
      if (!got.has(n.id)) result.push(n.id);
    }
  }

  return result;
}
