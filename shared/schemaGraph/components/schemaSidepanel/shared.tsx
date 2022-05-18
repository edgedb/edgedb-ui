import React, {useState} from "react";

import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import {SchemaConstraint} from "@edgedb/common/schemaData";

import styles from "./schemaSidepanel.module.scss";

import {SchemaAnnotation} from "../../state";

export function Annotation(annotation: SchemaAnnotation) {
  return (
    <div className={styles.annotation}>
      <div className={styles.annotationName}>{annotation.name}</div>
      {annotation["@value"]}
    </div>
  );
}

export function Constraint(constraint: SchemaConstraint) {
  const code = `${constraint.delegated ? "delegated " : ""}${
    constraint.name
  }(${constraint.params.map(
    (param) => `${param.name} := ${param["@value"]}`
  )})`;
  return <CodeBlock className={styles.codeBlock} code={code} />;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar(props: SearchBarProps) {
  return (
    <div className={styles.searchBar}>
      <FilterIcon
        className={cn(
          styles.filterIcon,
          props.value ? styles.filterActive : null
        )}
      />
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <ClearIcon
        className={styles.clearIcon}
        onClick={() => props.onChange("")}
      />
    </div>
  );
}

interface ShowSourceProps {
  source: string;
}

export function ShowSource({source}: ShowSourceProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.showSource} onClick={() => setExpanded(!expanded)}>
      <div className={styles.showSourceLabel}>
        <ChevronIcon
          className={styles.icon}
          style={{
            transform: expanded ? "rotate(90deg)" : "",
          }}
        />
        {expanded ? "Hide" : "Show"} Source
      </div>
      {expanded ? <CodeBlock code={source} /> : null}
    </div>
  );
}

export function ChevronIcon(props: React.HTMLAttributes<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 12 12">
      <path d="M 4 2 L 9 6 L 4 10" />
    </svg>
  );
}

function ClearIcon(props: React.HTMLAttributes<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 17 17">
      <path
        d="M 4 4 L 13 13 M 4 13 L 13 4"
        stroke="currentColor"
        strokeWidth="1.5px"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterIcon(props: React.HTMLAttributes<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 12 11">
      <path d="M12 0H0L5 6V11L7 9V6L12 0Z" fill="currentColor" />
    </svg>
  );
}
