import {observer} from "mobx-react-lite";
import Fuse from "fuse.js";

import cn from "@edgedb/common/utils/classNames";
import {
  SchemaAbstractAnnotation,
  SchemaAnnotation,
  SchemaConstraint,
  SchemaObjectType,
  SchemaParam,
  SchemaPointer,
} from "@edgedb/common/schemaData";

import {SchemaModule} from "../state/textView";

import {
  Arrow,
  CollapseArrow,
  Copyable,
  CopyButton,
  CopyHighlight,
  highlightString,
  indent,
  ItemHeader,
  Keyword,
  mapTypeLinkList,
  Punc,
  ShowInGraphButton,
  Str,
  TypeLink,
  TypeName,
} from "./utils";

import styles from "../textView.module.scss";
import {useSchemaTextState} from "../textView";
import {PointerRenderer, pointerToSDL} from "./pointer";
import {AnnotationRenderer, annotationToSDL} from "./annotation";
import {ConstraintRenderer, constraintToSDL} from "./constraint";
import {IndexRenderer, indexToSDL} from "./schemaIndex";

const InheritedGroup = observer(function InheritedGroup({
  baseId,
  type,
  matches,
  parentModule,
}: {
  baseId: string;
  type: SchemaObjectType;
  matches?: Fuse.FuseResultMatch[];
  parentModule: string;
}) {
  const pointers = [
    ...Object.values(type.properties),
    ...Object.values(type.links),
  ].filter((p) => p["@owned"]);

  if (!pointers.length) return null;

  return (
    <div className={styles.inheritedBlock}>
      <div className={styles.inheritedFrom}>
        <span>inherited from </span>{" "}
        <TypeLink type={type} parentModule={parentModule} />
      </div>

      {pointers.map((pointer) => (
        <PointerRenderer
          key={pointer.id}
          id={baseId + pointer.id}
          pointer={pointer}
          match={matches?.find(
            (m) => m.key === "pointers" && m.value === pointer.name
          )}
          parentModule={parentModule}
          defaultCollapsed
        />
      ))}
    </div>
  );
});

export const ObjectTypeRenderer = observer(function ObjectTypeRenderer({
  type,
  matches,
}: {
  type: SchemaObjectType;
  matches?: Fuse.FuseResultMatch[];
}) {
  const state = useSchemaTextState();

  const extendingTypes = type.bases.filter((t) => t.name !== "std::Object");

  const ownedPointers = type.pointers.filter((pointer) => pointer["@owned"]);

  const collapsed = state.toggledItems.has(type.id);

  return (
    <Copyable>
      <div className={styles.typeItem}>
        <ItemHeader
          actions={
            <>
              <CopyButton getSDL={() => objectToSDL(type)} />
              <ShowInGraphButton type={type} />
            </>
          }
        >
          <CollapseArrow
            collapsed={collapsed}
            onToggle={() => state.toggleItemCollapse(type.id)}
          />
          <CopyHighlight>
            <Keyword>{type.abstract ? "abstract " : ""}type</Keyword>{" "}
            <TypeName type={type} matches={matches} />
            {extendingTypes.length ? (
              <>
                {" "}
                <Keyword>extending</Keyword>{" "}
                {mapTypeLinkList(extendingTypes, type.module)}
              </>
            ) : null}{" "}
            <Punc>
              {"{"}
              {collapsed ? "...};" : null}
            </Punc>
          </CopyHighlight>
        </ItemHeader>
        {collapsed ? null : (
          <>
            <div className={styles.indentedBlock}>
              {type.ancestors.map((ancestor) => (
                <InheritedGroup
                  key={ancestor.id}
                  baseId={type.id}
                  type={ancestor}
                  matches={matches}
                  parentModule={type.module}
                />
              ))}
              {type.annotations.map((anno, i) => (
                <AnnotationRenderer key={i} annotation={anno} />
              ))}
              {ownedPointers
                .filter((pointer) => !(pointer.isDeprecated && type.builtin))
                .map((pointer) => (
                  <PointerRenderer
                    key={pointer.id}
                    pointer={pointer}
                    match={matches?.find(
                      (m) => m.key === "pointers" && m.value === pointer.name
                    )}
                    parentModule={type.module}
                  />
                ))}
              {type.constraints.map((constraint) => (
                <ConstraintRenderer
                  key={constraint.id}
                  constraint={constraint}
                />
              ))}
              {type.indexes
                .filter((index) => index["@owned"])
                .map((index) => (
                  <IndexRenderer key={index.id} index={index} />
                ))}
            </div>
            <div>
              <CopyHighlight>
                <Punc>{"};"}</Punc>
              </CopyHighlight>
            </div>
          </>
        )}
      </div>
    </Copyable>
  );
});

export function objectToSDL(type: SchemaObjectType) {
  const pointers = [
    ...Object.values(type.properties),
    ...Object.values(type.links),
  ].filter((p) => p["@owned"]);
  const indexes = type.indexes.filter((index) => index["@owned"]);

  const extendingTypes = type.bases.filter((t) => t.name !== "std::Object");

  const hasBody =
    type.annotations.length ||
    pointers.length ||
    type.constraints.length ||
    indexes.length;

  return `${type.abstract ? "abstract " : ""}type ${type.name}${
    extendingTypes.length
      ? ` extending ${extendingTypes.map((t) => t.name).join(", ")}`
      : ""
  }${
    hasBody
      ? ` {\n${type.annotations.map(
          (anno) => "  " + annotationToSDL(anno) + "\n"
        )}${pointers
          .map((pointer) => indent(pointerToSDL(pointer)) + "\n")
          .join("")}${type.constraints
          .map((constraint) => indent(constraintToSDL(constraint)) + "\n")
          .join("")}${indexes
          .map((index) => indent(indexToSDL(index)) + "\n")
          .join("")}}`
      : ""
  };`;
}
