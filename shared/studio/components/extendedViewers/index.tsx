import {Item, ItemType} from "@edgedb/inspector/buildItem";
import {createContext} from "react";
import {HexViewer} from "./hexViewer";
import {JsonViewer} from "./jsonViewer";
import {TextViewer} from "./textViewer";

import styles from "./shared.module.scss";
import {ActionsBar} from "./shared";

export const extendedViewerRenderers: {
  [key: string]: (props: {data: any}) => JSX.Element | null;
} = {
  "std::str": TextViewer,
  "std::bytes": HexViewer,
  "std::json": JsonViewer,
};

export const extendedViewerIds = new Set(Object.keys(extendedViewerRenderers));

export const ExtendedViewerContext = createContext<{
  closeExtendedView: () => void;
}>(null!);

export interface ExtendedViewerRendererProps {
  item?: Item;
}

export function ExtendedViewerRenderer({item}: ExtendedViewerRendererProps) {
  if (item?.type === ItemType.Scalar) {
    const Renderer = extendedViewerRenderers[item.codec.getKnownTypeName()];

    if (Renderer) {
      return <Renderer data={(item.parent as any).data[item.index]} />;
    }
  }

  return (
    <div className={styles.noViewer}>
      <ActionsBar />
      <div className={styles.message}>No extended viewer for this type</div>
    </div>
  );
}
