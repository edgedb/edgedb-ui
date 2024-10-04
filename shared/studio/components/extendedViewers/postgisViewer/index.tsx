import {useContext, useEffect, useMemo, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import "@fontsource-variable/roboto-flex";
import "@fontsource-variable/roboto-mono";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {Protocol} from "pmtiles";
import layers from "protomaps-themes-base";

import cn from "@edgedb/common/utils/classNames";

import styles from "./postgisViewer.module.scss";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";
import {
  Geometry,
  Box2D,
  Box3D,
} from "../../../../../web/node_modules/edgedb/dist/datatypes/postgis";
import {Metadata, toGeoJSON} from "./toGeojson";
import {createPostgisEditorState, PostgisEditor} from "./state";

import {WKTRenderer} from "./wktRenderers";
import {FloatingToolbar} from "./toolbar";
import {ExtendedViewerContext} from "..";
import {CloseIcon} from "./icons";
import {SettingsIcon} from "@edgedb/common/newui";

const protomapsProtocol = new Protocol();
maplibregl.addProtocol("pmtiles", protomapsProtocol.tile);

export interface PostgisViewerProps {
  data: Geometry | Box2D | Box3D;
}

export const PostgisViewer = observer(function PostgisViewer({
  data,
}: PostgisViewerProps) {
  const [_, theme] = useTheme();

  const [state] = useState(() => createPostgisEditorState(data, theme));

  useEffect(() => state.init(), []);

  useEffect(() => {
    state.setTheme(theme);
  }, [theme]);

  return (
    <div className={styles.postgisViewer}>
      <div ref={state.mapElRef} className={styles.map}>
        <DragSelection state={state} />
      </div>
      <div className={styles.sidepanel}>
        <SidepanelHeader state={state} />
        {state.data ? <WKTRenderer state={state} /> : null}
      </div>
      <FloatingToolbar state={state} />
    </div>
  );
});

const SidepanelHeader = observer(function SidepanelHeader({
  state,
}: {
  state: PostgisEditor;
}) {
  const {closeExtendedView} = useContext(ExtendedViewerContext);

  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  return (
    <div className={styles.panelHeader}>
      <div className={styles.optionsMenu}>
        <div
          className={cn(styles.headerButton, styles.optionsMenuButton)}
          onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
        >
          <SettingsIcon />
        </div>
        {optionsMenuOpen ? (
          <div className={styles.menuDropdown}>
            <div
              className={styles.menuItem}
              onClick={() => {
                setOptionsMenuOpen(false);
                state.toggleHasZ();
              }}
            >
              {state.hasZ ? "Disable" : "Enable"} Z coordinates
            </div>
            <div
              className={styles.menuItem}
              onClick={() => {
                setOptionsMenuOpen(false);
                state.toggleHasM();
              }}
            >
              {state.hasM ? "Disable" : "Enable"} M values
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={cn(styles.headerButton, styles.closeButton)}
        onClick={() => closeExtendedView()}
      >
        <CloseIcon />
      </div>
    </div>
  );
});

const DragSelection = observer(function DragSelection({
  state,
}: {
  state: PostgisEditor;
}) {
  const bounds = state.dragSelectionBounds;
  return bounds ? (
    <div
      className={styles.dragSelection}
      style={{
        top: Math.min(bounds[0][1], bounds[1][1]),
        left: Math.min(bounds[0][0], bounds[1][0]),
        width: Math.abs(bounds[1][0] - bounds[0][0]),
        height: Math.abs(bounds[1][1] - bounds[0][1]),
      }}
    />
  ) : null;
});
