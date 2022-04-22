import React from "react";

import {_introspect, _ICodec} from "edgedb";

import {Collapsible} from "./collapsible";
import InspectorDispatch from "./dispatch";

import styles from "./inspector.module.scss";

interface NamedTupleProps {
  value: any[];
  level: number;
  comma: boolean;
  label?: JSX.Element;
  codec: _ICodec;
}

const NamedTuple = ({value, level, label, comma, codec}: NamedTupleProps) => {
  const kind = _introspect(value);
  if (!kind || kind.kind !== "namedtuple") {
    throw new Error("unexpected object type to render");
  }

  const getBody = () => {
    const els = [];
    const subCodecs = codec.getSubcodecs();

    for (let i = 0; i < value.length; i++) {
      const el = value[i];
      const field = kind.fields[i];
      els.push(
        <InspectorDispatch
          comma={i < value.length - 1}
          key={i}
          value={el}
          codec={subCodecs[i]}
          label={
            <>
              {field.name}
              <span className={styles.operator_walrus}>:=</span>
            </>
          }
          level={level + 1}
        />
      );
    }

    return <>{els}</>;
  };

  return (
    <Collapsible
      hash={`nt-${level}-${value.length}`}
      label={
        <>
          <span className={styles.label}>{label}</span>
        </>
      }
      level={level}
      braces={"()"}
      comma={comma}
      body={getBody}
    />
  );
};

export default NamedTuple;
