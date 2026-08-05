import type { CompositeStoreItem } from "../composite/composite-store.ts";

export interface TreeStoreItem extends CompositeStoreItem {
  /**
   * Whether the item is a branch. A branch is a valid folder even before any
   * child is loaded, so a leaf is defined by this flag rather than by observing
   * zero children.
   */
  folder?: boolean;
  /**
   * Every ancestor branch id from the root down to the immediate parent. The
   * complete path, rather than a single parent id, is what lets a deeply nested
   * branch stay hidden during server rendering when one of its ancestors is
   * collapsed.
   */
  folderPath: readonly string[];
  /**
   * Whether the item can be selected. Unselectable items still count toward
   * hierarchy positions and set sizes.
   */
  selectable?: boolean;
}

export interface TreeItemMetadata {
  level: number;
  parentId: string | undefined;
  posInSet: number;
  setSize: number;
}

/**
 * Paths are compared by length and element equality. Ancestry is never inferred
 * from id strings, so prefixes like `a` and `a-1` stay unrelated.
 */
function samePath(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function startsWithPath(path: readonly string[], prefix: readonly string[]) {
  return (
    path.length >= prefix.length &&
    prefix.every((id, index) => id === path[index])
  );
}

function findTreeItem(items: readonly TreeStoreItem[], id: string) {
  return items.find((candidate) => candidate.id === id);
}

export function isTreeItemVisible(
  item: TreeStoreItem,
  expandedIds: readonly string[],
) {
  return item.folderPath.every((id) => expandedIds.includes(id));
}

export function getTreeItemMetadata(
  items: readonly TreeStoreItem[],
  id: string,
): TreeItemMetadata | undefined {
  const item = findTreeItem(items, id);
  if (!item) return;
  const siblings = items.filter((candidate) =>
    samePath(candidate.folderPath, item.folderPath),
  );
  return {
    level: item.folderPath.length + 1,
    parentId: item.folderPath.at(-1),
    posInSet: siblings.findIndex((candidate) => candidate.id === id) + 1,
    setSize: siblings.length,
  };
}

export function getVisibleTreeItems(
  items: readonly TreeStoreItem[],
  expandedIds: readonly string[],
): TreeStoreItem[] {
  return items.filter((item) => isTreeItemVisible(item, expandedIds));
}

export function getTreeParent(
  items: readonly TreeStoreItem[],
  id: string,
): TreeStoreItem | undefined {
  const item = findTreeItem(items, id);
  const parentId = item?.folderPath.at(-1);
  if (parentId === undefined) return;
  return findTreeItem(items, parentId);
}

export function getTreeFirstChild(
  items: readonly TreeStoreItem[],
  expandedIds: readonly string[],
  id: string,
): TreeStoreItem | undefined {
  return items.find(
    (item) =>
      item.folderPath.at(-1) === id &&
      !item.disabled &&
      isTreeItemVisible(item, expandedIds),
  );
}

export function getTreeSiblings(
  items: readonly TreeStoreItem[],
  id: string,
): TreeStoreItem[] {
  const item = findTreeItem(items, id);
  if (!item) return [];
  return items.filter((candidate) =>
    samePath(candidate.folderPath, item.folderPath),
  );
}

export function getTreeDescendants(
  items: readonly TreeStoreItem[],
  id: string,
): TreeStoreItem[] {
  const item = findTreeItem(items, id);
  if (!item) return [];
  // Matching the ancestor's complete path plus its own id, rather than merely
  // looking the id up anywhere in the path, keeps an unrelated repeat of the
  // same id deeper in a malformed path from registering as a descendant.
  const ownHierarchyPath = [...item.folderPath, item.id];
  return items.filter(
    (candidate) =>
      candidate.id !== id &&
      startsWithPath(candidate.folderPath, ownHierarchyPath),
  );
}

export interface TreeValidationWarning {
  id: string;
  reason: string;
}

/**
 * Reports malformed hierarchy in a complete item collection. Pure and
 * allocation-light so it can run whenever the collection changes in
 * development. A missing ancestor is deliberately not a warning: a controlled
 * store may hold a partial remote dataset. Neither is a folder without loaded
 * children, which is a valid lazy branch.
 */
export function validateTreeItems(
  items: readonly TreeStoreItem[],
): TreeValidationWarning[] {
  const warnings: TreeValidationWarning[] = [];
  const seenIds = new Set<string>();
  const itemsById = new Map<string, TreeStoreItem>();

  for (const item of items) {
    if (seenIds.has(item.id)) {
      warnings.push({ id: item.id, reason: "Duplicate id" });
    }
    seenIds.add(item.id);
    if (!itemsById.has(item.id)) {
      itemsById.set(item.id, item);
    }
  }

  for (const item of items) {
    if (item.folderPath.includes(item.id)) {
      warnings.push({
        id: item.id,
        reason: "Item contains its own id in folderPath",
      });
      continue;
    }
    const ancestorsSeen = new Set<string>();
    let repeatsAncestor = false;
    for (const ancestorId of item.folderPath) {
      if (ancestorsSeen.has(ancestorId)) {
        repeatsAncestor = true;
        break;
      }
      ancestorsSeen.add(ancestorId);
    }
    if (repeatsAncestor) {
      warnings.push({
        id: item.id,
        reason: "folderPath repeats an ancestor id",
      });
      continue;
    }
    for (const ancestorId of item.folderPath) {
      const ancestor = itemsById.get(ancestorId);
      if (!ancestor) continue;
      if (ancestor.folder) continue;
      warnings.push({
        id: item.id,
        reason: `Ancestor "${ancestorId}" is not marked as a folder`,
      });
    }
  }

  return warnings;
}

export function getTreeRange(
  items: readonly TreeStoreItem[],
  expandedIds: readonly string[],
  fromId: string,
  toId: string,
): TreeStoreItem[] {
  const visibleItems = getVisibleTreeItems(items, expandedIds);
  const toIndex = visibleItems.findIndex((item) => item.id === toId);
  if (toIndex === -1) return [];
  const fromIndex = visibleItems.findIndex((item) => item.id === fromId);
  // A hidden, removed, or unknown anchor collapses the range to its endpoint.
  if (fromIndex === -1) return [visibleItems[toIndex]!];
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return visibleItems.slice(start, end + 1);
}
