import {Fragment, FunctionComponent, useRef, useState} from "react";
import {observer} from "mobx-react-lite";

import {
  Geometry,
  MultiGeometry,
  LineString,
  Point,
  Polygon,
  ListItem,
  ListItemWrapper,
} from "./editableGeom/types";
import {ListItemRowHeight, PostgisEditor} from "./state";

import cn from "@edgedb/common/utils/classNames";

import styles from "./postgisViewer.module.scss";
import {useResize} from "@edgedb/common/hooks/useResize";
import {ChevronDownIcon, OverflowMenuIcon} from "@edgedb/common/newui";
import {runInAction} from "mobx";

function getExpandItemToggle(geom: Geometry) {
  return (
    <div
      className={cn(styles.expandToggle, {
        [styles.expanded]: geom.listItemExpanded,
      })}
      onClick={() =>
        runInAction(() => {
          geom.listItemExpanded = !geom.listItemExpanded;
        })
      }
    >
      <ChevronDownIcon />
    </div>
  );
}

function PointInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const [editingValue, setEditingValue] = useState<string | null>(null);

  return (
    <input
      className={styles.pointInput}
      value={editingValue ?? value.toString()}
      onChange={(e) => setEditingValue(e.target.value)}
      onBlur={() => {
        if (editingValue) {
          onChange(parseFloat(editingValue));
          setEditingValue(null);
        }
      }}
      size={14}
    />
  );
}

const PointRenderer = observer(function _PointRenderer({
  state,
  geom,
}: {
  state: PostgisEditor;
  geom: Point;
}) {
  return (
    <div className={cn(styles.listItemPoint, {})}>
      <div className={styles.points}>
        <div className={styles.pointLabel}>x</div>
        <PointInput
          value={geom.point[0]}
          onChange={(val) => state.updatePointCoord(geom, 0, val)}
        />
        <div className={styles.pointLabel}>y</div>
        <PointInput
          value={geom.point[1]}
          onChange={(val) => state.updatePointCoord(geom, 1, val)}
        />
        {state.hasZ ? (
          <>
            <div className={styles.pointLabel}>z</div>
            <PointInput
              value={geom.point.length > 2 ? geom.point[2]! : 0}
              onChange={(val) => state.updatePointCoord(geom, 2, val)}
            />
          </>
        ) : null}
        {state.hasM ? (
          <>
            <div className={styles.pointLabel}>m</div>
            <PointInput
              value={geom.m ?? 0}
              onChange={(val) => state.updatePointMValue(geom, val)}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}) as GeometryRenderer;

function isParentSelected(state: PostgisEditor, geom: Geometry): boolean {
  if (!state.selectedGeoms.size) return false;
  let parent = geom.parent;
  while (parent) {
    if (state.selectedGeoms.has(parent)) return true;
    parent = parent.parent;
  }
  return false;
}

const LineStringRenderer = observer(function _LineStringRenderer({
  state,
  geom,
}: {
  state: PostgisEditor;
  geom: LineString;
}) {
  return (
    <>
      <div
        className={cn(styles.listItem, {
          [styles.selected]: state.selectedGeoms.has(geom),
          [styles.expanded]: geom.listItemExpanded,
          [styles.parentSelected]: isParentSelected(state, geom),
        })}
      >
        <div className={styles.inner}>
          {getExpandItemToggle(geom)}
          <div className={styles.header}>
            {geom.kind === "LineString" && geom.parent instanceof Polygon
              ? "LinearRing"
              : geom.kind}{" "}
            {"("}
            {!geom.listItemExpanded ? (
              <>
                <span>...</span>
                {")"}
              </>
            ) : null}
          </div>
          <div className={styles.actions}>
            <OverflowMenuIcon />
          </div>
        </div>
      </div>
      {state.selectedGeoms.has(geom) && geom.listItemExpanded ? (
        <div className={styles.selectedBackground} />
      ) : null}
    </>
  );
}) as GeometryRenderer;

const CompoundCurveRenderer = observer(function _CompoundCurveRenderer({
  state,
  geom,
}: {
  state: PostgisEditor;
  geom: LineString;
}) {
  return (
    <div
      className={cn(styles.listItem, {})}
      style={{"--itemDepth": geom.listDepth} as any}
    >
      {getExpandItemToggle(geom)}
      <div className={styles.header}>
        {geom.kind === "LineString" && geom.parent instanceof Polygon
          ? "LinearRing"
          : geom.kind}{" "}
        {"("}
        {!geom.listItemExpanded ? (
          <>
            <span>...</span>
            {")"}
          </>
        ) : null}
      </div>
    </div>
  );
}) as GeometryRenderer;

const PolygonRenderer = observer(function _PolygonRenderer({
  state,
  geom,
}: {
  state: PostgisEditor;
  geom: Polygon;
}) {
  return (
    <>
      <div
        className={cn(styles.listItem, {
          [styles.selected]: state.selectedGeoms.has(geom),
          [styles.expanded]: geom.listItemExpanded,
          [styles.parentSelected]: isParentSelected(state, geom),
        })}
      >
        <div className={styles.inner}>
          {getExpandItemToggle(geom)}
          <div className={styles.header}>
            {geom.kind} {"("}
            {!geom.listItemExpanded ? (
              <>
                <span>...</span>
                {")"}
              </>
            ) : null}
          </div>
          <div className={styles.actions}>
            <OverflowMenuIcon />
          </div>
        </div>
      </div>
      {state.selectedGeoms.has(geom) && geom.listItemExpanded ? (
        <div className={styles.selectedBackground} />
      ) : null}
    </>
  );
}) as GeometryRenderer;

const MultiGeometryRenderer = observer(function _MultiGeometryRenderer({
  state,
  geom,
}: {
  state: PostgisEditor;
  geom: MultiGeometry;
}) {
  return (
    <>
      <div
        className={cn(styles.listItem, {
          [styles.selected]: state.selectedGeoms.has(geom),
          [styles.expanded]: geom.listItemExpanded,
          [styles.parentSelected]: isParentSelected(state, geom),
        })}
      >
        <div className={styles.inner}>
          {getExpandItemToggle(geom)}
          <div className={styles.header}>
            {geom.kind} {"("}
            {!geom.listItemExpanded ? (
              <>
                <span>...</span>
                {")"}
              </>
            ) : null}
          </div>
          <div className={styles.actions}>
            <OverflowMenuIcon />
          </div>
        </div>
      </div>
      {state.selectedGeoms.has(geom) && geom.listItemExpanded ? (
        <div className={styles.selectedBackground} />
      ) : null}
    </>
  );
}) as GeometryRenderer;

const DuplicatePointRender: GeometryRenderer = ({state, geom}) => (
  <PointRenderer state={state} geom={(geom as ListItemWrapper).geom} />
);

const EndPlaceholderRenderer = observer(function _EndPlaceholderRenderer({
  state,
  geom: item,
}: {
  state: PostgisEditor;
  geom: ListItemWrapper;
}) {
  return (
    <div
      className={cn(styles.listItem, styles.endBracket, {
        [styles.startSelected]: state.selectedGeoms.has(item.geom),
        [styles.parentSelected]: isParentSelected(state, item.geom),
      })}
      style={{"--parentLength": item.geom.listItems.length - 2} as any}
    >
      <div className={styles.header}>{")"}</div>
    </div>
  );
}) as GeometryRenderer;

type GeometryRenderer = FunctionComponent<{
  state: PostgisEditor;
  geom: ListItem;
}>;

const renderers: {[key in ListItem["kind"]]: GeometryRenderer} = {
  Point: PointRenderer,
  LineString: LineStringRenderer,
  CompoundCurve: CompoundCurveRenderer,
  CircularString: LineStringRenderer,
  Polygon: PolygonRenderer,
  Triangle: PolygonRenderer,
  MultiPoint: MultiGeometryRenderer,
  MultiLineString: MultiGeometryRenderer,
  MultiPolygon: MultiGeometryRenderer,
  GeometryCollection: MultiGeometryRenderer,
  __Point: DuplicatePointRender,
  __ListItemEndPlaceholder: EndPlaceholderRenderer,
};

export const WKTRenderer = observer(function _WKTRenderer({
  state,
}: {
  state: PostgisEditor;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useResize(ref, ({height}) => state.setSidePanelHeight(height));

  const listItems = state.data?.listItems ?? [];
  const [startIndex, endIndex] = state.visibleListItemIndexes;

  return (
    <div
      ref={ref}
      className={styles.wktListWrapper}
      onScroll={() =>
        state.setSidePanelScrollTop(Math.max(0, ref.current!.scrollTop))
      }
    >
      <div
        className={styles.listInner}
        style={{height: listItems.length * ListItemRowHeight}}
      >
        {listItems.map((item, i) => {
          if (
            (i < startIndex || i > endIndex) &&
            !(
              item.kind !== "__ListItemEndPlaceholder" &&
              item.kind !== "__Point" &&
              i < endIndex &&
              i + (item as Geometry).listItems.length > startIndex
            )
          ) {
            return null;
          }

          const isWrapper =
            item.kind === "__ListItemEndPlaceholder" ||
            item.kind === "__Point";
          const geom = isWrapper ? item.geom : (item as Geometry);

          const Renderer = renderers[item.kind];
          return (
            <div
              key={item.id}
              className={styles.listItemWrapper}
              style={
                {
                  gridRow: `${i + 1} / span ${
                    isWrapper ? 1 : Math.max(1, geom.listItems.length - 1)
                  }`,
                  "--itemDepth": geom.listDepth,
                } as any
              }
            >
              <Renderer state={state} geom={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
