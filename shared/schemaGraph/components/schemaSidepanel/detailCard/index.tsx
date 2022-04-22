import React, {useState} from "react";

import styles from "./detailCard.module.scss";
import sharedStyles from "../schemaSidepanel.module.scss";

import {ChevronIcon} from "../shared";
import cn from "@edgedb/common/utils/classNames";

interface DetailCardProps {
  type: string;
  title: JSX.Element;
  tags?: string[];
  body?: JSX.Element;
}

export default function DetailCard(
  props: React.PropsWithChildren<DetailCardProps>
) {
  const [expanded, setExpanded] = useState(false);

  const canExpand = true;

  return (
    <div className={styles.detailCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <div className={styles.cardType}>{props.type}</div>
          {props.tags?.map((tag) => (
            <div key={tag} className={sharedStyles.tag}>
              {tag}
            </div>
          ))}
        </div>
        <div
          onClick={() => canExpand && setExpanded(!expanded)}
          style={{cursor: "pointer"}}
        >
          {canExpand ? (
            <ChevronIcon
              className={styles.icon}
              style={{
                transform: expanded ? "rotate(90deg)" : "",
              }}
            />
          ) : null}
          <div
            className={cn(
              styles.cardTitle,
              !expanded ? styles.lineClamp : null
            )}
          >
            {props.title}
          </div>
        </div>
      </div>
      {expanded ? <div className={styles.cardBody}>{props.body}</div> : null}
    </div>
  );
}
