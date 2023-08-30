import {useEffect, useState} from "react";

const mediaQuery = window.matchMedia("(max-width: 767.5px)");

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => mediaQuery.matches);

  useEffect(() => {
    const listener = (ev: MediaQueryListEvent) => setIsMobile(ev.matches);

    mediaQuery.addEventListener("change", listener);

    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  return isMobile;
}
