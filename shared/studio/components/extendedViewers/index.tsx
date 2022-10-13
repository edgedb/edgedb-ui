import {Item, ItemType} from "@edgedb/inspector/buildItem";
import {createContext} from "react";
import {HexViewer} from "./hexViewer";
import {TextViewer} from "./textViewer";

export const extendedViewerRenderers: {
  [key: string]: (props: {data: any}) => JSX.Element | null;
} = {
  "std::str": TextViewer,
  "std::bytes": HexViewer,
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

  return <div>No extended viewer for this type</div>;
}
