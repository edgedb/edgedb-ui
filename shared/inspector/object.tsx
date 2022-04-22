import React from "react";

import {_introspect, _ICodec} from "edgedb";

import InspectorDispatch from "./dispatch";
import {Collapsible} from "./collapsible";
import * as icons from "./icons";
import styles from "./inspector.module.scss";

type ClassName = string | undefined | null;

function classNames(...names: ClassName[]): string {
  return names.filter((x) => !!x).join(" ");
}

interface ObjectProps {
  value: any;
  level: number;
  comma: boolean;
  codec: _ICodec;
  label?: JSX.Element;
}

const ObjectInspector = ({value, level, label, comma, codec}: ObjectProps) => {
  const kind = _introspect(value);
  if (!kind || kind.kind !== "object") {
    throw new Error("unexpected object type to render");
  }

  const hash = kind.fields.map((x) => x.name).join("|");

  const explicitNum = kind.fields.filter((x) => !x.implicit).length;

  const getBody = () => {
    const els = [];
    const subCodecs = codec.getSubcodecs();

    for (let i = 0; i < kind.fields.length; i++) {
      const field = kind.fields[i];

      if (field.implicit && !(field.name === "id" && !explicitNum)) {
        continue;
      }

      els.push(
        <InspectorDispatch
          key={i}
          value={value[field.name]}
          level={level + 1}
          codec={subCodecs[i]}
          label={
            <>
              <span
                className={classNames(field.linkprop ? styles.linkprop : null)}
              >
                {field.name}
              </span>
              <span className={styles.operator_colon}>:</span>
            </>
          }
          comma={i < kind.fields.length - 1}
        />
      );
    }

    return <>{els}</>;
  };

  return (
    <Collapsible
      hash={hash}
      label={
        <>
          <span className={styles.label}>{label}</span>
          <span className={styles.type_name}>
            {value.__tname__ ?? "Object"}
          </span>
        </>
      }
      level={level}
      braces="{}"
      comma={comma}
      body={getBody}
    />
  );
};

export default ObjectInspector;
