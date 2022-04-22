import React, {useState} from "react";
import {observer} from "mobx-react";

import CodeBlock from "@edgedb/common/ui/codeBlock";

import styles from "./schemaDetails.module.scss";
import sharedStyles from "../schemaSidepanel.module.scss";

import {useSchemaState} from "../../../state/provider";
import {
  SchemaLink,
  SchemaProp,
  SchemaConstraint,
  SchemaAnnotation,
} from "../../../state";

import {ChevronIcon, Annotation, Constraint} from "../shared";

function Field(item: {
  name: string;
  targetNames: string[];
  default: string;
  required: boolean;
  constraints: SchemaConstraint[];
  annotations: SchemaAnnotation[];
  properties?: SchemaProp[];
}) {
  const [expanded, setExpanded] = useState(false);

  const canExpand =
    item.default ||
    item.constraints.length ||
    item.annotations.length ||
    item.properties?.length;

  return (
    <div className={styles.field}>
      <div
        className={styles.fieldHeader}
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        {canExpand ? (
          <ChevronIcon
            className={styles.icon}
            style={{
              transform: expanded ? "rotate(90deg)" : "",
            }}
          />
        ) : null}
        {item.name}
        {item.required ? (
          <div className={sharedStyles.tag}>Required</div>
        ) : null}
        <div className={styles.type}>{item.targetNames.join(", ")}</div>
      </div>
      {expanded ? (
        <div className={styles.fieldBody}>
          {item.default ? (
            <>
              <div className={styles.subheading}>Default</div>
              <CodeBlock
                className={sharedStyles.codeBlock}
                code={item.default}
              />
            </>
          ) : null}
          {item.constraints.length ? (
            <>
              <div className={styles.subheading}>Constraints</div>
              {item.constraints.map((constraint, i) => (
                <Constraint {...constraint} key={i} />
              ))}
            </>
          ) : null}
          {item.annotations.length ? (
            <>
              <div className={styles.subheading}>Annotations</div>
              {item.annotations.map((anno, i) => (
                <Annotation {...anno} key={i} />
              ))}
            </>
          ) : null}
          {item.properties?.length ? (
            <>
              <div className={styles.subheading}>Properties</div>
              {item.properties.map(Prop)}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Prop(item: SchemaProp) {
  const props = {
    ...item,
    targetNames: [item.targetName],
  };
  return <Field {...props} key={item.name} />;
}

function Link(item: SchemaLink) {
  return <Field {...item} key={item.name} />;
}

export default observer(function SchemaDetails() {
  const schemaState = useSchemaState();

  const selectedObject = schemaState.selectedObject;

  if (!selectedObject) {
    return (
      <div className={styles.details}>
        <div className={styles.emptyState}>No object selected</div>
      </div>
    );
  }

  const objectName = selectedObject?.name.split("::");

  function ObjectLink(linkObjName: string) {
    const name = linkObjName.split("::");
    return (
      <span
        className={styles.link}
        key={linkObjName}
        onClick={() => schemaState.selectObject(linkObjName, true)}
      >
        {name[0] !== objectName[0] ? (
          <span className={styles.moduleName}>{name[0]}::</span>
        ) : null}
        {name[1]}
      </span>
    );
  }

  return (
    <div className={styles.details} key={selectedObject.name}>
      <div className={styles.header}>
        <div className={styles.secondary}>
          {selectedObject.is_abstract ? "abstract " : ""}type
        </div>
        <div className={styles.objectName}>
          <span className={styles.moduleName}>{objectName[0]}::</span>
          {objectName[1]}
        </div>
        {selectedObject.inherits_from.length ? (
          <div className={styles.secondary} style={{display: "flex"}}>
            extends&nbsp;&nbsp;
            <div className={styles.linkList}>
              {selectedObject.inherits_from.map(ObjectLink)}
            </div>
          </div>
        ) : null}
        {selectedObject.inherited_by.length ? (
          <div className={styles.secondary} style={{display: "flex"}}>
            inherited by&nbsp;&nbsp;
            <div className={styles.linkList}>
              {selectedObject.inherited_by.map(ObjectLink)}
            </div>
          </div>
        ) : null}
      </div>
      {selectedObject.properties.length ? (
        <div className={styles.fieldGroup}>
          <div className={styles.subheading}>Properties</div>
          {selectedObject.properties.map(Prop)}
        </div>
      ) : null}
      {selectedObject.links.length ? (
        <div className={styles.fieldGroup}>
          <div className={styles.subheading}>Links</div>
          {selectedObject.links.map(Link)}
        </div>
      ) : null}
      {selectedObject.constraints.length ? (
        <div className={styles.fieldGroup}>
          <div className={styles.subheading}>Constraints</div>
          <div className={styles.blockMargins}>
            {selectedObject.constraints.map(Constraint)}
          </div>
        </div>
      ) : null}
      {selectedObject.annotations.length ? (
        <div className={styles.fieldGroup}>
          <div className={styles.subheading}>Annotations</div>
          <div className={styles.blockMargins}>
            {selectedObject.annotations.map(Annotation)}
          </div>
        </div>
      ) : null}
    </div>
  );
});
