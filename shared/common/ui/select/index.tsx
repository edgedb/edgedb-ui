import {useRef, useState, useEffect, useMemo} from "react";

import Fuzzysort from "fuzzysort";

import {highlightString} from "@edgedb/common/utils/fuzzysortHighlight";
import cn from "@edgedb/common/utils/classNames";

import styles from "./select.module.scss";

export interface SelectItem<T = any> {
  id: T;
  label: string | JSX.Element;
  fullLabel?: string;
}

export type SelectItems<T = any> = {
  items: SelectItem<T>[];
  groups?: ({
    label: string | JSX.Element;
  } & SelectItems<T>)[];
};

export type SelectProps<T = any> = {
  className?: string;
  title?: string | JSX.Element;
  rightAlign?: boolean;
  mainAction?: () => void;
  actions?: {label: string | JSX.Element; action: () => void}[];
  searchable?: boolean;
} & (
  | {
      items: null;
    }
  | {
      items: SelectItems<T> | SelectItem<T>[];
      selectedItemId: T;
      onChange: (item: SelectItem<T>) => void;
    }
);

type FlattenedItem = {type: "item"; item: SelectItem; depth: number};
type FlattenedItems = (
  | FlattenedItem
  | {
      type: "group";
      label: string | JSX.Element;
      depth: number;
    }
)[];

export function Select<T extends any>({
  className,
  title,
  rightAlign,
  mainAction,
  actions,
  searchable,
  ...dropdown
}: SelectProps<T>) {
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  const [searchFilter, setSearchFilter] = useState("");

  const hasDropdown = !!dropdown.items || !!actions;

  const flattenedItems = useMemo(() => {
    if (!dropdown.items) {
      return null;
    }
    if (Array.isArray(dropdown.items)) {
      return dropdown.items.map((item) => ({
        type: "item",
        item,
        depth: 0,
      })) as FlattenedItems;
    }
    const list: FlattenedItems = dropdown.items.items.map((item) => ({
      type: "item",
      item,
      depth: 0,
    }));
    const flatten = (groups: SelectItems["groups"], depth: number) => {
      for (const group of groups ?? []) {
        list.push({type: "group", label: group.label, depth});
        list.push(
          ...(group.items.map((item) => ({
            type: "item",
            item,
            depth: depth + 1,
          })) as FlattenedItems)
        );
        flatten(group.groups, depth + 1);
      }
    };
    flatten(dropdown.items.groups, 0);
    return list;
  }, [dropdown.items]);

  const searchIndex = useMemo(() => {
    return searchable && flattenedItems
      ? (
          flattenedItems.filter(
            (item) => item.type === "item"
          ) as FlattenedItem[]
        ).map((item) => ({
          item,
          indexed: Fuzzysort.prepare(
            item.item.fullLabel ??
              (typeof item.item.label === "string" ? item.item.label : "")
          ),
        }))
      : null;
  }, [flattenedItems]);

  const filteredItems = useMemo(() => {
    return searchIndex && searchFilter
      ? Fuzzysort.go(searchFilter, searchIndex, {key: "indexed"})
      : null;
  }, [searchFilter, searchIndex]);

  const selectedItemIndex = dropdown.items
    ? flattenedItems!.findIndex(
        (item) =>
          item.type === "item" && item.item.id === dropdown.selectedItemId
      )
    : null;
  const selectedItem =
    selectedItemIndex != null && selectedItemIndex != -1
      ? ((flattenedItems?.[selectedItemIndex] as any)?.item as SelectItem)
      : null;

  useEffect(() => {
    if (dropdownOpen) {
      setSearchFilter("");

      searchRef.current?.focus();

      const listener = (e: MouseEvent) => {
        if (!dropdownRef.current?.contains(e.target as Node)) {
          setDropdownOpen(false);
        }
      };
      window.addEventListener("click", listener, {capture: true});

      setMaxHeight(
        window.innerHeight -
          selectRef.current!.getBoundingClientRect().top -
          32
      );

      return () => {
        window.removeEventListener("click", listener, {capture: true});
      };
    }
  }, [dropdownOpen]);

  return (
    <div
      ref={selectRef}
      className={cn(styles.select, className, {
        [styles.fullButton]: !mainAction && hasDropdown,
        [styles.hasAction]: mainAction != null,
      })}
      onClick={mainAction ?? (() => setDropdownOpen(true))}
    >
      {title ?? selectedItem?.fullLabel ?? selectedItem?.label}
      {hasDropdown ? (
        <>
          <div
            className={styles.tabDropdownButton}
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <DropdownIcon />
          </div>

          <div
            ref={dropdownRef}
            className={cn(styles.tabDropdown, {
              [styles.tabDropdownOpen]: dropdownOpen,
              [styles.rightAlign]: !!rightAlign,
            })}
            style={{maxHeight: maxHeight ?? maxHeight + "px"}}
            onClick={(e) => e.stopPropagation()}
          >
            {searchable ? (
              <input
                ref={searchRef}
                className={styles.searchInput}
                placeholder="Search..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            ) : null}
            {dropdown.items
              ? filteredItems
                ? filteredItems.map((result) => (
                    <div
                      key={result.target}
                      className={cn(styles.dropdownItem, {
                        [styles.dropdownItemSelected]:
                          dropdown.selectedItemId === result.obj.item.item.id,
                      })}
                      onClick={() => {
                        setDropdownOpen(false);
                        dropdown.onChange(result.obj.item.item);
                      }}
                    >
                      {highlightString(
                        result.target,
                        Fuzzysort.indexes(result) as number[],
                        styles.searchHighlight
                      )}
                    </div>
                  ))
                : flattenedItems!.map((item, i) => (
                    <div
                      key={i}
                      className={cn(styles.dropdownItem, {
                        [styles.groupHeader]: item.type === "group",
                        [styles.dropdownItemSelected]:
                          item.type === "item" &&
                          dropdown.selectedItemId === item.item.id,
                      })}
                      style={{
                        paddingLeft: `${12 + 10 * item.depth}px`,
                      }}
                      onClick={
                        item.type === "item"
                          ? () => {
                              setDropdownOpen(false);
                              dropdown.onChange(item.item);
                            }
                          : undefined
                      }
                    >
                      {item.type === "item" ? item.item.label : item.label}
                    </div>
                  ))
              : null}
            <div className={styles.dropdownActionsGroup}>
              {actions?.map((item, i) => (
                <div
                  key={i}
                  className={styles.dropdownItem}
                  onClick={() => {
                    setDropdownOpen(false);
                    item.action();
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DropdownIcon() {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.29297 0.292969C3.68359 -0.0976562 4.31641 -0.0976562 4.70703 0.292969L7.70703 3.29297C7.93652 3.52246 8.03125 3.83594 7.99121 4.13477C7.96289 4.34424 7.86816 4.54639 7.70703 4.70703C7.53613 4.87842 7.31836 4.97461 7.09473 4.99561C6.80859 5.02246 6.5127 4.92627 6.29297 4.70703L4 2.41455L1.70703 4.70703C1.31641 5.09766 0.683594 5.09766 0.292969 4.70703C-0.0976562 4.31689 -0.0976562 3.68359 0.292969 3.29297L3.29297 0.292969ZM4.70703 11.707L7.70703 8.70703C8.09766 8.31641 8.09766 7.68311 7.70703 7.29297C7.31641 6.90234 6.68359 6.90234 6.29297 7.29297L4 9.58545L1.70703 7.29297C1.31641 6.90234 0.683594 6.90234 0.292969 7.29297C0.117188 7.46875 0.0205078 7.69434 0.00292969 7.9248C-0.0185547 8.20508 0.078125 8.49268 0.292969 8.70703L3.29297 11.707C3.68359 12.0977 4.31641 12.0977 4.70703 11.707Z"
        fill="currentColor"
      />
    </svg>
  );
}
