import {InstanceState} from "@edgedb/studio/state/instance";

interface Migration {
  id: string;
  name: string;
  parentId: string | null;
}

interface MigrationsData {
  branch: string;
  migrations: Migration[];
}

function _getBranchGraphDataFromCache(
  instanceId: string
): MigrationsData[] | null {
  const data = localStorage.getItem(`edgedb-branch-graph-${instanceId}`);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // ignore
    }
  }
  return null;
}

function _storeBranchGraphDataInCache(
  instanceId: string,
  data: MigrationsData[]
) {
  localStorage.setItem(
    `edgedb-branch-graph-${instanceId}`,
    JSON.stringify(data)
  );
}

function sortMigrations(migrations: Migration[]): Migration[] {
  if (migrations.length === 0) {
    return [];
  }
  const migrationMap = new Map(migrations.map((m) => [m.parentId, m]));

  const root = migrations.find((m) => m.parentId === null);
  if (!root) {
    throw new Error("could not find root migration");
  }
  const sorted: Migration[] = [root];
  let next = migrationMap.get(root.id);
  while (next) {
    sorted.push(next);
    next = migrationMap.get(next.id);
  }
  if (sorted.length != migrations.length) {
    throw new Error("could not sort all migrations into order");
  }
  return sorted;
}

export interface GraphItem {
  name: string;
  parent: GraphItem | null;
  children: GraphItem[];
  branches: string[] | null;
}

export async function fetchMigrationsData(
  instanceId: string,
  instanceState: InstanceState
): Promise<MigrationsData[] | null> {
  if (instanceState.databases === null) {
    return null;
  }

  const databases = new Set(instanceState.databases);

  let migrationsData = _getBranchGraphDataFromCache(instanceId);

  if (
    !migrationsData ||
    migrationsData.length != databases.size ||
    !migrationsData.every(({branch}) => databases.has(branch))
  ) {
    migrationsData = await Promise.all(
      instanceState.databases.map(async (dbName) => {
        const conn = instanceState.getConnection(dbName);
        return {
          branch: dbName,
          migrations: sortMigrations(
            ((
              await conn.query(`
              select schema::Migration {
                id,
                name,
                parentId := assert_single(.parents.id)
              }`)
            ).result as Migration[]) ?? []
          ),
        };
      })
    );
    _storeBranchGraphDataInCache(instanceId, migrationsData);
  }

  return migrationsData;
}

export interface GraphData {
  graphRoots: Set<GraphItem>;
  emptyBranches: string[];
}

export function buildBranchGraph(migrationsData: MigrationsData[]): GraphData {
  migrationsData.sort((a, b) => a.branch.localeCompare(b.branch));

  const graphRoots = new Set<GraphItem>();
  const emptyBranches: string[] = [];
  const graphItems = new Map<string, GraphItem>();

  for (const {branch, migrations} of migrationsData) {
    if (migrations.length === 0) {
      emptyBranches.push(branch);
      continue;
    }

    let child: GraphItem | null = null;
    for (const migration of migrations.reverse()) {
      let item = graphItems.get(migration.name);
      if (item) {
        if (child) {
          child.parent = item;
          item.children.push(child);
        } else {
          if (item.branches) item.branches.push(branch);
          else item.branches = [branch];
        }
        child = null;
        break;
      }

      item = {
        name: migration.name,
        parent: null,
        branches: child ? null : [branch],
        children: [],
      };
      graphItems.set(item.name, item);
      if (child) {
        child.parent = item;
        item.children.push(child);
      }
      child = item;
    }
    if (child) {
      graphRoots.add(child);
    }
  }

  return {graphRoots, emptyBranches};
}

export function findGraphItemBranch(item: GraphItem) {
  let currentItem = item;
  const stack: GraphItem[] = [];
  while (!currentItem.branches || currentItem.branches.length === 0) {
    stack.push(...currentItem.children);
    if (!stack.length) {
      throw new Error("could not find branch for graph item");
    }
    currentItem = stack.shift()!;
  }
  return currentItem.branches[0];
}

export interface LayoutNode {
  col: number;
  row: number;
  items: GraphItem[];
  branchIndex?: number;
  parentNode: LayoutNode | null;
  childrenNodes: LayoutNode[];
}

interface StackNode {
  col: number;
  row: number;
  item: GraphItem;
  parentNode: LayoutNode | null;
}

export interface LayoutData {
  nodes: LayoutNode[];
  maxCol: number;
}

export function layoutBranchGraph(
  graphRoot: GraphItem,
  initialCol = 0
): LayoutData {
  const nodes: LayoutNode[] = [];
  const stack: StackNode[] = [
    {col: initialCol, row: 0, item: graphRoot, parentNode: null},
  ];
  const usedPoints = new Set<string>();
  let lastStackableNode: LayoutNode | null = null;
  let maxCol = initialCol;

  function addNode(node: LayoutNode): LayoutNode {
    nodes.push(node);
    if (node.parentNode) {
      node.parentNode.childrenNodes.push(node);
    }
    usedPoints.add(`${node.col}/${node.row}`);
    maxCol = node.col > maxCol ? node.col : maxCol;
    return node;
  }

  while (stack.length) {
    let {col, row, item, parentNode} = stack.shift()!;

    // check provisional position is good
    while (true) {
      if (
        !usedPoints.has(`${col}/${row}`) &&
        (!item.children.length || !usedPoints.has(`${col + 1}/${row}`))
      ) {
        break;
      }
      row += 1;
    }

    let parent: LayoutNode;
    if (item.branches) {
      // vertically stack branches with same migration
      for (let i = 0; i < item.branches.length; i++) {
        const node = addNode({
          col: col,
          row: row + i,
          items: [item],
          branchIndex: i,
          parentNode,
          childrenNodes: [],
        });
        if (i === 0) {
          parent = node;
        }
      }
      lastStackableNode = null;
    } else {
      // is plain migration item
      if (item.children.length >= 2) {
        // create branch point
        parent = addNode({
          col: col,
          row: row,
          items: [item],
          parentNode,
          childrenNodes: [],
        });
        lastStackableNode = null;
      } else {
        // non branching
        if (nodes.length) {
          if (lastStackableNode) {
            // stack on last node
            lastStackableNode.items.push(item);
            col = lastStackableNode.col;
            row = lastStackableNode.row;
            parent = lastStackableNode;
          } else {
            // create new stackable node
            lastStackableNode = {
              col: col,
              row: row,
              items: [item],
              parentNode,
              childrenNodes: [],
            };
            parent = addNode(lastStackableNode);
          }
        }
        // else haven't reached root branch/branching point yet, so skip
      }
    }

    if (item.children) {
      stack.unshift(
        ...item.children.map((child, i) => ({
          col: col + 1,
          row: row + i,
          item: child,
          parentNode: parent,
        }))
      );
    }
  }

  return {nodes, maxCol};
}

export function joinGraphLayouts(data: GraphData): LayoutNode[] {
  const allNodes: LayoutNode[] = [];
  let startCol = 0;
  for (const graphRoot of data.graphRoots) {
    const {nodes, maxCol} = layoutBranchGraph(graphRoot, startCol);
    allNodes.push(...nodes);
    startCol = maxCol + 1;
  }
  for (const branch of data.emptyBranches) {
    allNodes.push({
      row: 0,
      col: startCol,
      items: [{name: "", parent: null, children: [], branches: [branch]}],
      branchIndex: 0,
      parentNode: null,
      childrenNodes: [],
    });
    startCol += 1;
  }
  return allNodes;
}

export interface MigrationHistoryData {
  items: GraphItem[];
  children: {item: GraphItem; branches: string[]}[];
}

export function getMigrationHistoryFromItem(
  item: GraphItem
): MigrationHistoryData {
  let currentItem = item;
  const items: GraphItem[] = [currentItem];
  while (currentItem.parent) {
    items.push(currentItem.parent);
    currentItem = currentItem.parent;
  }
  currentItem = items[0];
  while (currentItem.children.length === 1) {
    items.unshift(currentItem.children[0]);
    currentItem = currentItem.children[0];
  }
  return {
    items,
    children: items[0].children.map((child) => ({
      item: child,
      branches: getDescendantBranches(child),
    })),
  };
}

function getDescendantBranches(item: GraphItem): string[] {
  const branches: string[] = [];
  const stack: GraphItem[] = [item];
  while (stack.length) {
    const item = stack.pop()!;
    if (item.branches) {
      branches.push(...item.branches);
    }
    stack.push(...item.children);
  }
  return branches;
}
