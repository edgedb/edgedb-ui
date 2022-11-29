import {DependencyList, useLayoutEffect} from "react";

export function useResize(
  ref: React.RefObject<Element> | Element | null,
  onResize: (rect: DOMRect) => void,
  deps: DependencyList = []
): void {
  useLayoutEffect(() => {
    const _ref = ref instanceof Element ? ref : ref?.current;
    if (_ref) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries[0]) {
          onResize(entries[0].contentRect);
        }
      });

      resizeObserver.observe(_ref);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [ref, ...deps]);
}
