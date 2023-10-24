import {Fragment, PropsWithChildren, useEffect, useRef} from "react";

import cn from "@edgedb/common/utils/classNames";
import Spinner from "@edgedb/common/ui/spinner";
import {DropdownIcon} from "@edgedb/common/ui/icons";
import styles from "./headerNav.module.scss";
import {useTooltips} from "@edgedb/common/hooks/useTooltips";

export interface HeaderNavProps {
  icon: JSX.Element;
  title: string | undefined;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  dropdownOffset?: number;
}

export function HeaderNav({
  icon,
  title,
  dropdownOpen,
  setDropdownOpen,
  dropdownOffset = 0,
  children,
}: PropsWithChildren<HeaderNavProps>) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [_, setShowTooltips] = useTooltips();

  useEffect(() => {
    if (dropdownOpen) {
      setShowTooltips(false);

      dropdownRef.current?.focus();

      const listener = (e: MouseEvent) => {
        if (!dropdownRef.current?.contains(e.target as Node)) {
          setDropdownOpen(false);
        }
      };
      window.addEventListener("click", listener, {capture: true});

      return () => {
        window.removeEventListener("click", listener, {capture: true});
      };
    } else {
      setShowTooltips(true);
    }
  }, [dropdownOpen]);

  return (
    <div className={styles.headerNavMenu}>
      <div
        className={cn(styles.headerNavButton, {[styles.active]: dropdownOpen})}
        onClick={() => setDropdownOpen(true)}
      >
        {icon}
        <div className={styles.title}>{title}</div>
        <DropdownIcon />
      </div>

      <div
        ref={dropdownRef}
        className={cn(styles.dropdown, {[styles.open]: dropdownOpen})}
        style={
          {
            "--dropdownOffset": dropdownOffset,
          } as object
        }
      >
        {children}
      </div>
    </div>
  );
}

export interface HeaderNavColProps<LinkProps> {
  Link: (
    props: PropsWithChildren<{
      className?: string;
      onClick?: () => void;
      onMouseEnter?: () => void;
    }> &
      LinkProps
  ) => JSX.Element;
  showCursor?: boolean;
  closeDropdown: () => void;
  itemGroups:
    | {
        header: string;
        items:
          | {
              key: string;
              label: string;
              linkProps: LinkProps;
              avatarUrl?: string;
              selected: boolean;
              onHover: () => void;
              onClick?: () => void;
            }[]
          | null
          | string;
        emptyMessage?: string;
      }[];
  action:
    | ({
        label: string;
        disabled?: boolean;
      } & (
        | {linkProps: LinkProps; onClick?: () => void}
        | {linkProps?: undefined; onClick: () => void}
      ))
    | null;
}

export function HeaderNavCol<LinkProps>({
  Link,
  showCursor = false,
  closeDropdown,
  itemGroups,
  action,
}: HeaderNavColProps<LinkProps>) {
  return (
    <div
      className={cn(styles.col, {
        [styles.showCursor]: showCursor,
      })}
    >
      {itemGroups.map((group) =>
        !group.items ? (
          <Fragment key={group.header}>
            <div className={styles.header}>{group.header}</div>
            <Spinner className={styles.dbSpinner} size={20} />
          </Fragment>
        ) : typeof group.items === "string" ? (
          <Fragment key={group.header}>
            <div className={styles.header}>{group.header}</div>
            <div className={styles.dbFetchError}>{group.items}</div>
          </Fragment>
        ) : group.items.length || group.emptyMessage ? (
          <Fragment key={group.header}>
            <div className={styles.header}>{group.header}</div>
            {group.items.length ? (
              group.items.map((item) => (
                <Link
                  key={item.key}
                  className={cn(styles.item, {
                    [styles.selected]: item.selected,
                  })}
                  {...item.linkProps}
                  onMouseEnter={item.onHover}
                  onClick={() => {
                    closeDropdown();
                    item.onClick?.();
                  }}
                >
                  {item.avatarUrl ? (
                    <div
                      className={styles.avatar}
                      style={{
                        backgroundImage: `url(${item.avatarUrl})`,
                      }}
                    />
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              ))
            ) : (
              <div className={styles.noItems}>{group.emptyMessage}</div>
            )}
          </Fragment>
        ) : null
      )}

      <div className={styles.actions}>
        {action ? (
          action.linkProps ? (
            <Link
              className={cn(styles.action, {
                [styles.disabled]: !!action.disabled,
              })}
              {...action.linkProps}
              onClick={() => {
                closeDropdown();
                action.onClick?.();
              }}
            >
              {action.label}
            </Link>
          ) : (
            <div
              className={cn(styles.action, {
                [styles.disabled]: !!action.disabled,
              })}
              onClick={() => {
                closeDropdown();
                action.onClick?.();
              }}
            >
              {action.label}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
