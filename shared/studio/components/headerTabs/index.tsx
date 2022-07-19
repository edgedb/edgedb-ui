import {useLayoutEffect, useState} from "react";
import {createPortal} from "react-dom";

import cn from "@edgedb/common/utils/classNames";

import {Select, SelectProps} from "@edgedb/common/ui/select";

import styles from "./headerTab.module.scss";

interface _HeaderTabProps {
  icon: JSX.Element;
  depth: number;
}

export type HeaderTabProps = _HeaderTabProps & SelectProps;

export function HeaderTab({icon, depth, ...selectProps}: HeaderTabProps) {
  const targetEl = document.getElementById(`headerTabsPortalTarget${depth}`);

  if (targetEl) {
    return createPortal(
      <>
        {depth ? <TabSep /> : null}
        <div className={styles.tab}>
          {icon}
          <Select titleClassName={styles.tabTitle} {...selectProps} />
        </div>
      </>,
      targetEl
    );
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

function TabSep() {
  return (
    <svg
      width="16"
      height="24"
      viewBox="0 0 16 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.tabSep}
    >
      <path
        d="M 1,29 L 15,1"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
