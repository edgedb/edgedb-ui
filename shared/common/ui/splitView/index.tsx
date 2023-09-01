import React, {Fragment, HTMLAttributes, useRef} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./splitView.module.scss";

import {useDragHandler, Position} from "@edgedb/common/hooks/useDragHandler";
import {useGlobalDragCursor} from "@edgedb/common/hooks/globalDragCursor";

import {SplitViewDirection, SplitViewState} from "./model";
import {useIsMobile} from "../../hooks/useMobile";

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
  className,
  ...otherProps
}: React.HTMLAttributes<HTMLDivElement> & SplitViewProps) {
  const [_, setGlobalDragCursor] = useGlobalDragCursor();

  const childSizeKey =
    state.direction === SplitViewDirection.vertical ? "height" : "width";

  const ref = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();

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
        setGlobalDragCursor(
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
        setGlobalDragCursor(null);
      },
    };
  }, [state.sizes, state.direction]);

  return (
    <div
      {...otherProps}
      ref={ref}
      className={cn(className, styles.splitViewContainer, {
        [styles.splitVertical]:
          state.direction === SplitViewDirection.vertical,
      })}
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
            {((isMobile && state.activeViewIndex === viewIndex) ||
              !isMobile) && (
              <div className={styles.splitViewChild} style={size}>
                {view}
              </div>
            )}
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
      {/* <div className={styles.resizerFlip} onClick={onFlip}></div> */}
      <div className={styles.resizerIndicator} />
    </div>
  );
}
