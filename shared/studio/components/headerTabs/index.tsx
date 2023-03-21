"use client";

import {useState} from "react";
import {createPortal} from "react-dom";

import cn from "@edgedb/common/utils/classNames";

import {Select, SelectProps} from "@edgedb/common/ui/select";

import styles from "./headerTab.module.scss";

interface _HeaderTabProps {
  icon: JSX.Element;
  depth: number;
}

export type HeaderTabProps = _HeaderTabProps & SelectProps;

export function HeaderTab({
  icon,
  depth,
  title,
  ...selectProps
}: HeaderTabProps) {
  const targetEl = document.getElementById(`headerTabsPortalTarget${depth}`);

  const [_, rerender] = useState(false);

  if (targetEl) {
    return createPortal(
      <>
        {depth ? <TabSep /> : null}
        <Select
          title={
            <>
              {icon}
              {title}
            </>
          }
          className={styles.tab}
          {...selectProps}
        />
      </>,
      targetEl
    );
  } else {
    // temporary hack to fix nextjs rendering header tab before
    // header target is ready
    setTimeout(() => rerender(!_), 0);
  }
  return null;
}

interface HeaderTabsProps {
  className?: string;
}

export function HeaderTabs({className}: HeaderTabsProps) {
  return (
    <div className={cn(styles.tabs, className)}>
      {Array(3)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            id={`headerTabsPortalTarget${i}`}
            style={{display: "contents"}}
          />
        ))}
    </div>
  );
}

export function TabSep() {
  return (
    <svg
      width="8"
      height="17"
      viewBox="0 0 8 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.tabSep}
    >
      <path
        d="M7.66602 0.78125L1.73828 16.2207H0.185547L6.12305 0.78125H7.66602Z"
        fill="currentColor"
      />
    </svg>
  );
}
