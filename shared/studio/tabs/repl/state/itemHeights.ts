import {observable, runInAction} from "mobx";

export class ItemHeights {
  private _history = new Heights();
  private _current = new Heights();

  private _totalHeight = observable.box(0);

  get totalHeight() {
    return this._totalHeight.get();
  }

  private _updateTotalHeight() {
    runInAction(() =>
      this._totalHeight.set(
        this._history._root.total + this._current._root.total
      )
    );
  }

  addItem(height: number) {
    this._current.append(height);
    this._updateTotalHeight();
  }

  addHistoryItems(heights: number[]) {
    for (let i = heights.length - 1; i >= 0; i--) {
      this._history.append(heights[i]);
    }
    this._updateTotalHeight();
  }

  updateItemHeight(index: number, height: number) {
    if (index < this._history._length) {
      this._history.updateHeight(this._history._length - index - 1, height);
    } else {
      this._current.updateHeight(index - this._history._length, height);
    }
    this._updateTotalHeight();
  }

  getIndexAtHeight(height: number) {
    if (height < this._history._root.total) {
      return (
        this._history._length -
        this._history.getIndexAtHeight(this._history._root.total - height) -
        1
      );
    } else {
      return (
        this._current.getIndexAtHeight(height - this._history._root.total) +
        this._history._length
      );
    }
  }

  getHeightAtIndex(index: number) {
    if (index < this._history._length) {
      return index
        ? this._history._root.total -
            this._history.getHeightAtIndex(this._history._length - index)
        : 0;
    } else {
      return (
        this._history._root.total +
        this._current.getHeightAtIndex(index - this._history._length)
      );
    }
  }
}

interface LeafGroup {
  isLeaf: true;
  parent: Group;
  total: number;
  heights: number[];
}

interface Group {
  isLeaf: false;
  parent: Group | null;
  total: number;
  groups: (Group | LeafGroup)[];
}

class Heights {
  _root: Group;
  _lastGroup: LeafGroup;
  _depth = 1;
  _length = 0;

  constructor() {
    this._root = {
      isLeaf: false,
      parent: null,
      total: 0,
      groups: [],
    };
    this._lastGroup = {
      isLeaf: true,
      parent: this._root,
      total: 0,
      heights: [],
    };
    this._root.groups.push(this._lastGroup);
  }

  append(height: number) {
    this._length += 1;
    if (this._lastGroup.heights.length === 8) {
      this._addGroupAfter(this._lastGroup);
    }
    this._lastGroup.heights.push(height);
    let group: Group | LeafGroup | null = this._lastGroup;
    while (group) {
      group.total += height;
      group = group.parent;
    }
  }

  updateHeight(index: number, height: number) {
    let i = index;
    let s = 1 << (3 * this._depth);
    let g: Group | LeafGroup = this._root;

    while (!g.isLeaf) {
      let gi = Math.trunc(i / s);
      g = g.groups[gi];
      i -= s * gi;
      s = s >> 3;
    }

    const diff = height - g.heights[i];
    g.heights[i] = height;
    let parent: Group | LeafGroup | null = g;
    while (parent) {
      parent.total += diff;
      parent = parent.parent;
    }
  }

  getHeightAtIndex(index: number) {
    let i = index;
    let s = 1 << (3 * this._depth);
    let g: Group | LeafGroup = this._root;

    let height = 0;
    while (!g.isLeaf) {
      let gi = Math.trunc(i / s);
      for (let j = 0; j < gi; j++) {
        height += g.groups[j].total;
      }
      g = g.groups[gi];
      i -= s * gi;
      s = s >> 3;
    }

    for (let j = 0; j < i; j++) {
      height += g.heights[j];
    }

    return height;
  }

  getIndexAtHeight(height: number) {
    if (height >= this._root.total) {
      return this._length - 1;
    }

    let i = 0;
    let total = 0;
    let s = 1 << (3 * this._depth);
    let g: Group | LeafGroup = this._root;

    while (!g.isLeaf) {
      for (const child of g.groups) {
        if (height < total + child.total) {
          g = child;
          break;
        }
        total += child.total;
        i += s;
      }
      s = s >> 3;
    }
    for (const h of g.heights) {
      if (height < total + h) {
        return i;
      }
      total += h;
      i++;
    }
    return i;
  }

  private _addGroupAfter(group: LeafGroup) {
    let newGroup: LeafGroup | Group = {
      isLeaf: true,
      parent: null as any,
      total: 0,
      heights: [],
    };
    this._lastGroup = newGroup;
    let parent: Group | null = group.parent;
    while (parent) {
      if (parent.groups.length === 8) {
        newGroup = {
          isLeaf: false,
          parent: null,
          total: 0,
          groups: [newGroup],
        };
        newGroup.groups[0].parent = newGroup;
        parent = parent.parent;
      } else {
        parent.groups.push(newGroup);
        newGroup.parent = parent;
        return;
      }
    }
    this._root = {
      isLeaf: false,
      parent: null,
      total: this._root.total,
      groups: [this._root, newGroup],
    };
    this._root.groups[0].parent = this._root;
    this._root.groups[1].parent = this._root;
    this._depth += 1;
  }
}
