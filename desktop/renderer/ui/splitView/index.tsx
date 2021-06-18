import React, {Fragment, HTMLAttributes, useRef} from "react";
import {observer} from "mobx-react";

import styles from "./splitView.module.scss";
import {classNames} from "../../utils/names";

import {useDragHandler, Position} from "@edgedb/common/hooks/useDragHandler";
import {useAppState} from "../../state/providers";
import {
  SplitViewDirection,
  SplitViewState,
} from "../../state/models/splitView";

interface SplitViewProps {
  views: JSX.Element[];
  state: SplitViewState;
  minViewSize?: number;
}

interface ResizeDragHandlerParams {
  viewIndex: number;
}

export default observer(function SplitView({
  views,
  state,
  minViewSize = 10,
  ...otherProps
}: React.HTMLAttributes<HTMLDivElement> & SplitViewProps) {
  const appState = useAppState();

  const childSizeKey =
    state.direction === SplitViewDirection.vertical ? "height" : "width";

  const ref = useRef<HTMLDivElement>(null);

  const resizeHandler = useDragHandler<ResizeDragHandlerParams>(() => {
    let initialPos: Position;
    let parentSize: number;
    let initialSize: number;
    let maxSize: number;
    let axis: "x" | "y";

    return {
      onStart(
        initialMousePos: Position,
        _: React.MouseEvent,
        params?: ResizeDragHandlerParams
      ) {
        appState.setGlobalDragCursor(
          state.direction === SplitViewDirection.vertical
            ? "ns-resize"
            : "ew-resize"
        );
        initialPos = initialMousePos;
        const BBox = ref.current!.getBoundingClientRect();
        parentSize =
          state.direction === SplitViewDirection.vertical
            ? BBox.height
            : BBox.width;
        initialSize = state.sizes[params!.viewIndex];
        maxSize = initialSize + state.sizes[params!.viewIndex + 1];
        axis = state.direction === SplitViewDirection.vertical ? "y" : "x";
      },
      onMove(
        currentMousePos: Position,
        _: boolean,
        params?: ResizeDragHandlerParams
      ) {
        const sizeDelta =
          ((currentMousePos[axis] - initialPos[axis]) / parentSize) * 100;
        const newSize = Math.min(
          Math.max(initialSize + sizeDelta, minViewSize),
          maxSize - minViewSize
        );
        const newSizes = [...state.sizes];
        newSizes[params!.viewIndex] = newSize;
        newSizes[params!.viewIndex + 1] = maxSize - newSize;
        state.setSizes(newSizes as [number, number]);
      },
      onEnd() {
        appState.setGlobalDragCursor(null);
      },
    };
  }, [state.sizes, state.direction]);

  return (
    <div
      {...otherProps}
      ref={ref}
      className={classNames(
        styles.splitViewContainer,
        state.direction === SplitViewDirection.vertical
          ? styles.splitVertical
          : null
      )}
    >
      {views.map((view, viewIndex) => {
        const lastView = viewIndex === views.length - 1;
        const margins = 4 + (viewIndex === 0 ? -2 : 0) + (lastView ? -2 : 0);
        const size = {
          [childSizeKey]: `calc(${state.sizes[viewIndex]}%${
            margins ? ` - ${margins}px` : ""
          })`,
        };

        return (
          <Fragment key={viewIndex}>
            <div className={styles.splitViewChild} style={size}>
              {view}
            </div>
            {!lastView ? (
              <Resizer
                direction={state.direction}
                onFlip={() => state.flipSplitDirection()}
                onResizeStart={(e) =>
                  resizeHandler(e, {
                    viewIndex,
                  })
                }
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
});

interface ResizerProps {
  direction: SplitViewDirection;
  onFlip: () => void;
  onResizeStart: (event: React.MouseEvent) => void;
}

function Resizer({direction, onFlip, onResizeStart}: ResizerProps) {
  return (
    <div className={styles.resizer}>
      <div className={styles.grabHandle} onMouseDown={onResizeStart}></div>
      <div className={styles.resizerFlip} onClick={onFlip}>
        <ResizeIcon
          style={{
            transform:
              direction === SplitViewDirection.vertical
                ? "rotate(90deg)"
                : undefined,
          }}
        />
      </div>
    </div>
  );
}

function ResizeIcon(props: HTMLAttributes<SVGElement>) {
  return (
    <svg
      {...props}
      width="11"
      height="9"
      viewBox="0 0 11 9"
      fill="currentColor"
    >
      <path d="M11 8C11 8.55228 10.5523 9 10 9H7L7 0H10C10.5523 0 11 0.447715 11 1V8Z" />
      <path
        d="M5 9V2.38419e-05L1 4.76837e-06C0.447718 1.90735e-06 -4.76837e-07 0.447719
          -4.76837e-07 1.00001L0 7.99998C0 8.55226 0.447712 8.99998 0.999995 8.99998L5
          9ZM1 7.99998L1 1.00001L4 1.00002L4 8L1 7.99998Z"
      />
    </svg>
  );
}
