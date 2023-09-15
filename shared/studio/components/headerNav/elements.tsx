import {Fragment, PropsWithChildren, useEffect, useRef} from "react";

import cn from "@edgedb/common/utils/classNames";
import Spinner from "@edgedb/common/ui/spinner";

import styles from "./headerNav.module.scss";

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

  useEffect(() => {
    if (dropdownOpen) {
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
    }
  }, [dropdownOpen]);

  return (
    <div className={styles.headerNavMenu}>
      <div className={styles.headerNav} onClick={() => setDropdownOpen(true)}>
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
                  {item.label}
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
              className={styles.action}
              {...action.linkProps}
              onClick={() => {
                closeDropdown();
                action.onClick?.();
              }}
            >
              {action.label}
            </Link>
          ) : (
            <div className={styles.action} onClick={action.onClick}>
              {action.label}
            </div>
          )
        ) : null}
      </div>
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
