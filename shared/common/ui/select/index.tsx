import {useRef, useState, useEffect, useMemo} from "react";

import Fuzzysort from "fuzzysort";

import {highlightString} from "@edgedb/common/utils/fuzzysortHighlight";
import cn from "@edgedb/common/utils/classNames";

import styles from "./select.module.scss";
import {useIsMobile} from "../../hooks/useMobile";
import {CrossIcon, DropdownIcon, SearchIcon, CheckIcon} from "../icons";

export interface SelectItem<T = any> {
  id: T;
  label: string | JSX.Element;
  fullLabel?: string;
  disabled?: boolean;
}

export type SelectItems<T = any> = {
  items: SelectItem<T>[];
  groups?: ({
    label: string | JSX.Element;
  } & SelectItems<T>)[];
};

export type SelectProps<T = any> = {
  className?: string;
  fullScreen?: boolean;
  fullScreenTitle?: string;
  title?: string | JSX.Element;
  rightAlign?: boolean;
  actions?: {label: string | JSX.Element; action: () => void}[];
  searchable?: boolean;
  disabled?: boolean;
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
  fullScreen,
  fullScreenTitle,
  title,
  rightAlign,
  actions,
  searchable,
  disabled,
  ...dropdown
}: SelectProps<T>) {
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const [searchFilter, setSearchFilter] = useState("");

  const hasDropdown = !!dropdown.items || !!actions;

  const isMobile = useIsMobile();
  const isFullscreenMobile = useIsMobile() && !!fullScreen;

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

  const defaultItemPaddingLeft = isMobile ? 24 : 12;

  return (
    <div
      ref={selectRef}
      className={cn(styles.select, className)}
      onClick={!disabled ? () => setDropdownOpen(true) : undefined}
      data-disabled={disabled}
    >
      {title ?? selectedItem?.fullLabel ?? selectedItem?.label}
      {hasDropdown ? (
        <>
          <div className={styles.tabDropdownButton}>
            <DropdownIcon />
          </div>

          <div
            ref={dropdownRef}
            className={cn(styles.tabDropdown, {
              [styles.tabDropdownOpen]: dropdownOpen,
              [styles.rightAlign]: !!rightAlign,
              [styles.fullScreen]: isFullscreenMobile,
            })}
            style={isMobile ? {} : {maxHeight}}
            onClick={(e) => e.stopPropagation()}
          >
            {isFullscreenMobile && (
              <>
                <p className={styles.dropdownTitle}>{fullScreenTitle}</p>
                <button
                  className={styles.closeDropdown}
                  onClick={() => setDropdownOpen(false)}
                >
                  <CrossIcon />
                </button>
              </>
            )}
            {!!searchable &&
              (isFullscreenMobile ? (
                <div className={styles.searchFullScreen}>
                  <SearchIcon />
                  <input
                    ref={searchRef}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              ) : (
                <input
                  ref={searchRef}
                  className={styles.searchInput}
                  placeholder="Search..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              ))}
            {dropdown.items
              ? filteredItems
                ? filteredItems.map((result) => (
                    <div
                      key={result.target}
                      className={cn(styles.dropdownItem, {
                        [styles.dropdownItemSelected]:
                          dropdown.selectedItemId === result.obj.item.item.id,
                        [styles.disabled]: !!result.obj.item.item.disabled,
                        [styles.fullScreen]: isFullscreenMobile,
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
                      className={cn(
                        styles.dropdownItem,
                        item.type === "item"
                          ? {
                              [styles.dropdownItemSelected]:
                                dropdown.selectedItemId === item.item.id,
                              [styles.disabled]: !!item.item.disabled,
                              [styles.fullScreen]: isFullscreenMobile,
                            }
                          : styles.groupHeader
                      )}
                      style={{
                        paddingLeft: `${
                          defaultItemPaddingLeft + 10 * item.depth
                        }px`,
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
                      {item.type === "item" ? (
                        <div className={styles.itemContent}>
                          <span>{item.item.label}</span>
                          {dropdown.selectedItemId === item.item.id && (
                            <CheckIcon />
                          )}
                        </div>
                      ) : (
                        item.label
                      )}
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
