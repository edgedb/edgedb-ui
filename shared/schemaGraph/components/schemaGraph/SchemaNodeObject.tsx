import React from "react";
import {observer} from "mobx-react";
import {useNavigate, createSearchParams} from "react-router-dom";

import styles from "./schemaGraph.module.scss";
import {useSchemaState} from "../../state/provider";

import cn from "@edgedb/common/utils/classNames";
import {stripModuleName} from "@edgedb/common/utils/moduleNames";

import {ISchemaNodeProps} from "./interfaces";

export default observer(function SchemaNodeObject(props: ISchemaNodeProps) {
  const schemaState = useSchemaState();

  const object = schemaState.objects!.get(props.node.id)!;

  const isObjectSelected = schemaState.selectedObjectName === props.node.id;

  const objectName = object.name.split("::");

  const navigate = useNavigate();

  const handleSelectObject = () => {
    schemaState.selectObject(props.node.id);
    navigate({
      search: createSearchParams({focus: object.name}).toString(),
    });
  };

  const properties = object.properties.map((prop) => {
    return (
      <div className={styles.row} key={prop.name}>
        <div>{prop.name}</div>
        <div className={styles.targettype}>
          {stripModuleName(prop.targetName)}
        </div>
      </div>
    );
  });

  const links = object.links.map((link) => {
    const isSelected =
      isObjectSelected && schemaState.selectedLinkName === link.name;
    return (
      <div
        className={cn(styles.row, isSelected ? styles.selectedLink : null)}
        key={link.name}
        onClick={() => schemaState.selectLink(props.node.id, link.name)}
      >
        <div>{link.name}</div>
        <div className={styles.targettype}>
          {link.targetNames.map(stripModuleName).join(" | ")}
        </div>
      </div>
    );
  });

  return (
    <div
      className={cn(
        styles.object,
        object.is_abstract ? styles.abstract : null,
        isObjectSelected ? styles.selectedNode : null
      )}
      onClickCapture={handleSelectObject}
    >
      <div
        className={styles.header}
        onMouseDown={props.onDragHandleStart}
        onDoubleClick={(e) => {
          schemaState.graph.focusOnNode(props.node.id);
          e.stopPropagation();
        }}
        onAuxClick={() => schemaState.graph.centerOnNode(props.node.id)}
      >
        {schemaState.graph.showModuleNames ? (
          <span className={styles.moduleName}>{objectName[0]}::</span>
        ) : null}
        {objectName[1]}
      </div>
      {properties}
      {object.links.length ? (
        <div className={styles.links}>
          <div className={styles.linkheader}>Links</div>
          {links}
        </div>
      ) : null}
    </div>
  );
});
