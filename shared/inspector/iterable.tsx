import React, {useState} from "react";

import * as edgedb from "edgedb";

import styles from "./inspector.module.scss";

import InspectorDispatch from "./dispatch";

import {Collapsible} from "./collapsible";

import {_ICodec} from "edgedb";

interface IterableProps {
  value: any[];
  level: number;
  kind: string;
  braces: string;
  comma: boolean;
  codec: edgedb._ICodec;
  label?: JSX.Element;
}

const Iterable = ({
  value,
  level,
  kind,
  braces,
  label,
  comma,
  codec,
}: IterableProps) => {
  const [maxItems, setMaxItems] = useState(100);

  const getBody = () => {
    const els = [];

    const displayLength = Math.min(maxItems, value.length);

    for (let i = 0; i < displayLength; i++) {
      const el = value[i];

      const subCodec =
        level === 0
          ? codec
          : codec.getKind() === "tuple"
          ? codec.getSubcodecs()[i]
          : codec.getSubcodecs()[0];

      els.push(
        <InspectorDispatch
          comma={i < value.length - 1}
          key={i}
          value={el}
          level={level + 1}
          codec={subCodec}
        />
      );
    }

    if (value.length > displayLength) {
      els.push(
        <div
          key="show_more"
          className={styles.show_more}
          onClick={() => setMaxItems(maxItems + 100)}
        >
          + show {Math.min(value.length - displayLength, 100)} more
        </div>
      );
    }

    return <>{els}</>;
  };

  return (
    <Collapsible
      hash={`${kind}-${level}-${value.length}`}
      label={<>{label}</>}
      level={level}
      braces={braces}
      comma={comma}
      body={getBody}
    />
  );
};

export default Iterable;
