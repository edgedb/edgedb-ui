import {useEffect} from "react";

export function useResize(
  ref: React.RefObject<HTMLElement>,
  onResize: (rect: DOMRect) => void
): void {
  useEffect(() => {
    // https://github.com/microsoft/TypeScript/issues/37861
    // @ts-ignore
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
  }, [ref]);
}
