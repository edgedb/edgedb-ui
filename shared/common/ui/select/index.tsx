import {useRef, useState, useEffect} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./select.module.scss";

export type SelectProps = {
  className?: string;
  titleClassName?: string;
  title?: string | JSX.Element;
  mainAction?: () => void;
  actions?: {label: string | JSX.Element; action: () => void}[];
} & (
  | {
      items: null;
    }
  | {
      items: {label: string | JSX.Element; action: () => void}[];
      selectedItemIndex: number;
    }
);

export function Select({
  className,
  titleClassName,
  title,
  mainAction,
  actions,
  ...dropdown
}: SelectProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasDropdown = !!dropdown.items || !!actions;

  useEffect(() => {
    if (dropdownOpen) {
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
    <div
      className={cn(styles.select, className, {
        [styles.fullButton]: !mainAction && hasDropdown,
      })}
    >
      <div
        className={cn(styles.selectLabel, titleClassName, {
          [styles.hasAction]: mainAction != null,
        })}
        onClick={mainAction ?? (() => setDropdownOpen(!dropdownOpen))}
      >
        {title ?? dropdown.items?.[dropdown.selectedItemIndex]?.label}
      </div>
      {hasDropdown ? (
        <>
          <div
            className={styles.tabDropdownButton}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <DropdownIcon />
          </div>

          <div
            ref={dropdownRef}
            className={cn(styles.tabDropdown, {
              [styles.tabDropdownOpen]: dropdownOpen,
            })}
          >
            {dropdown.items?.map((item, i) => (
              <div
                key={i}
                className={cn(styles.dropdownItem, {
                  [styles.dropdownItemSelected]:
                    dropdown.selectedItemIndex === i,
                })}
                onClick={() => {
                  setDropdownOpen(false);
                  item.action();
                }}
              >
                {item.label}
              </div>
            ))}
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
      width="11"
      height="18"
      viewBox="0 0 11 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 11.6591L5.5 16.1591L10 11.6591"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 6.34088L5.5 1.84088L10 6.34088"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
