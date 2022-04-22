import React from "react";

import {useState} from "react";

import * as icons from "./icons";
import styles from "./inspector.module.scss";

type ClassName = string | undefined | null;

function classNames(...names: ClassName[]): string {
  return names.filter((x) => !!x).join(" ");
}


const COLLAPSE_FROM = 4;

export function useCollapsed(
  hash: string,
  level: number
): [boolean, (val: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => level > COLLAPSE_FROM);
  const [oldHash, setHash] = useState<string | null>(null);

  if (oldHash != null) {
    if (oldHash !== hash) {
      setCollapsed(level > COLLAPSE_FROM);
      setHash(hash);
    }
  } else {
    setHash(hash);
  }

  return [
    collapsed,
    (val: boolean) => {
      setCollapsed(val);
    },
  ];
}

type CollapsibleParams = {
  label?: JSX.Element;
  hash: string;
  level: number;
  braces: string;
  comma: boolean;
  body: () => JSX.Element;
};

export const Collapsible = ({
  label,
  hash,
  level,
  braces,
  body,
  comma,
}: CollapsibleParams) => {
  const [collapsed, setCollapsed] = useCollapsed(hash, level);

  const className = classNames(
    styles.collapsible,
    collapsed ? styles.collapsed : styles.expanded
  );

  const iconEl = collapsed ? <icons.Collapsed /> : <icons.Expanded />;
  const ellipsisBtn = collapsed ? (
    <div
      key="show-more"
      className={styles.more}
      onClick={() => setCollapsed(false)}
    >
      <icons.More />
    </div>
  ) : null;

  return (
    <div className={className}>
      <div className={styles.head}>
        <div
          className={styles.collapse_icon}
          onClick={() => setCollapsed(!collapsed)}
        >
          {iconEl}
        </div>
        <div className={styles.label}>{label}</div>{" "}
        <div className={styles.opening_brace}>{braces[0]}</div>
      </div>

      <div className={styles.body}>
        <div className={styles.body_content}>{body()}</div>
        {ellipsisBtn}
      </div>

      <div className={styles.footer}>
        <span className={styles.closing_brace}>
          {braces[1]}
          {comma ? ", " : null}
        </span>
      </div>
    </div>
  );
};
