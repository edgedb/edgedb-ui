import {useRef, useState, useEffect} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./select.module.scss";

export type SelectProps = {
  className?: string;
  title?: string | JSX.Element;
  rightAlign?: boolean;
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
  title,
  rightAlign,
  mainAction,
  actions,
  ...dropdown
}: SelectProps) {
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  const hasDropdown = !!dropdown.items || !!actions;

  useEffect(() => {
    if (dropdownOpen) {
      const listener = (e: MouseEvent) => {
        if (!dropdownRef.current?.contains(e.target as Node)) {
          setDropdownOpen(false);
        }
      };
      window.addEventListener("click", listener, {capture: true});

      setMaxHeight(
        window.innerHeight - selectRef.current.getBoundingClientRect().top - 32
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
      onClick={mainAction ?? (() => setDropdownOpen(!dropdownOpen))}
    >
      {title ?? dropdown.items?.[dropdown.selectedItemIndex]?.label}
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
              [styles.rightAlign]: !!rightAlign,
            })}
            style={{maxHeight: maxHeight ?? maxHeight + "px"}}
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
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M3.29297 0.292969C3.68359 -0.0976562 4.31641 -0.0976562 4.70703 0.292969L7.70703 3.29297C7.93652 3.52246 8.03125 3.83594 7.99121 4.13477C7.96289 4.34424 7.86816 4.54639 7.70703 4.70703C7.53613 4.87842 7.31836 4.97461 7.09473 4.99561C6.80859 5.02246 6.5127 4.92627 6.29297 4.70703L4 2.41455L1.70703 4.70703C1.31641 5.09766 0.683594 5.09766 0.292969 4.70703C-0.0976562 4.31689 -0.0976562 3.68359 0.292969 3.29297L3.29297 0.292969ZM4.70703 11.707L7.70703 8.70703C8.09766 8.31641 8.09766 7.68311 7.70703 7.29297C7.31641 6.90234 6.68359 6.90234 6.29297 7.29297L4 9.58545L1.70703 7.29297C1.31641 6.90234 0.683594 6.90234 0.292969 7.29297C0.117188 7.46875 0.0205078 7.69434 0.00292969 7.9248C-0.0185547 8.20508 0.078125 8.49268 0.292969 8.70703L3.29297 11.707C3.68359 12.0977 4.31641 12.0977 4.70703 11.707Z"
        fill="currentColor"
      />
    </svg>
  );
}
