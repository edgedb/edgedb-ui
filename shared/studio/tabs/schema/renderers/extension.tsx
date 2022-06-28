import Fuse from "fuse.js";

import cn from "@edgedb/common/utils/classNames";
import {SchemaExtension} from "@edgedb/common/schemaData";

import {
  Copyable,
  CopyButton,
  CopyHighlight,
  highlightString,
  ItemHeader,
  Keyword,
  Punc,
} from "./utils";

import styles from "../textView.module.scss";

export function ExtensionRenderer({
  type,
  matches,
}: {
  type: SchemaExtension;
  matches?: Fuse.FuseResultMatch[];
}) {
  const nameMatch = matches?.find((match) => match.key === "name");

  return (
    <Copyable>
      <div className={cn(styles.typeItem, styles.topLevel)}>
        <ItemHeader
          actions={<CopyButton getSDL={() => extensionToSDL(type)} />}
        >
          <CopyHighlight>
            <Keyword>using extension</Keyword>{" "}
            {nameMatch
              ? highlightString(type.name, nameMatch.indices)
              : type.name}
            <Punc>;</Punc>
          </CopyHighlight>
        </ItemHeader>
      </div>
    </Copyable>
  );
}

export function extensionToSDL(type: SchemaExtension) {
  return `using extension ${type.name};`;
}
