import {DependencyList, useLayoutEffect} from "react";

export function useResize(
  ref: React.RefObject<HTMLElement>,
  onResize: (rect: DOMRect) => void,
  deps: DependencyList = []
): void {
  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        onResize(entries[0].contentRect);
      }
    });

    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref, ...deps]);
}
