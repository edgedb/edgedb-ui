import {Item, ItemType} from "@edgedb/inspector/buildItem";
import {createContext} from "react";
import {HexViewer} from "./hexViewer";
import {JsonViewer} from "./jsonViewer";
import {TextViewer} from "./textViewer";
import {PostgisViewer} from "./postgisViewer";

import styles from "./shared.module.scss";
import {ActionsBar} from "./shared";

type Renderer = (props: {data: any}) => JSX.Element | null;

export const extendedViewerRenderers: {
  [key: string]: Renderer;
} = {
  "std::str": TextViewer as Renderer,
  "std::bytes": HexViewer as Renderer,
  "std::json": JsonViewer as Renderer,
  "ext::postgis::geometry": PostgisViewer,
  "ext::postgis::box2d": PostgisViewer,
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
