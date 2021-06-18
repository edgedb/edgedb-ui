import {useCallback} from "react";

export interface Position {
  x: number;
  y: number;
}

export function useDragHandler<T = undefined>(
  setup: () => {
    onStart: (
      initialMousePos: Position,
      event: React.MouseEvent,
      customParams?: T
    ) => void;
    onMove: (
      currentMousePos: Position,
      isFirstMove: boolean,
      customParams?: T
    ) => void;
    onEnd?: (didMove: boolean, customParams?: T) => void;
  },
  deps: React.DependencyList = []
) {
  return useCallback((event: React.MouseEvent, customParams?: T) => {
    const {onStart, onMove, onEnd} = setup();

    onStart(
      {
        x: event.clientX,
        y: event.clientY,
      },
      event,
      customParams
    );

    let hasMoved = false;
    const mousemove = (e: MouseEvent) => {
      onMove(
        {
          x: e.clientX,
          y: e.clientY,
        },
        !hasMoved,
        customParams
      );
      hasMoved = true;
    };

    window.addEventListener("mousemove", mousemove, {capture: true});
    window.addEventListener(
      "mouseup",
      () => {
        window.removeEventListener("mousemove", mousemove, {
          capture: true,
        });
        onEnd?.(hasMoved, customParams);
      },
      {capture: true, once: true}
    );
  }, deps);
}
