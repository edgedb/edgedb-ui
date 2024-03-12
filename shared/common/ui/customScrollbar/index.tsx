import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {useResize} from "../../hooks/useResize";
import cn from "../../utils/classNames";

import styles from "./customScrollbar.module.scss";

export interface CustomScrollbarsProps {
  className?: string;
  scrollClass?: string;
  verticalBarClass?: string;
  innerClass: string | Element | null;
  headerPadding?: number;
  scrollIgnoreLength?: number;
  bottomScrollBarOffset?: number;
  reverse?: boolean;
  hideVertical?: boolean;
  hideHorizontal?: boolean;
}

const defaultScrollSizes: [number, number] = [-1, -1];

export function CustomScrollbars({
  className,
  children,
  scrollClass,
  verticalBarClass,
  innerClass,
  headerPadding = 0,
  scrollIgnoreLength = 0,
  bottomScrollBarOffset = 8,
  reverse,
  hideVertical,
  hideHorizontal,
}: PropsWithChildren<CustomScrollbarsProps>) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollSizes = useRef<[number, number]>(defaultScrollSizes);
  const [rawScrollOffset, setRawScrollOffset] = useState(0);
  const [scrollOffsets, setScrollOffsets] = useState<[number, number]>(() => [
    0, 0,
  ]);
  const _scrollOffsets = useRef(scrollOffsets);
  const [dragging, setDragging] = useState(false);

  const scrollBarTopOffset =
    rawScrollOffset < scrollIgnoreLength
      ? rawScrollOffset
      : scrollIgnoreLength;

  const onScroll = useCallback(
    (el: HTMLElement) => {
      const scrollTop =
        Math.max(
          0,
          reverse
            ? el.scrollHeight + el.scrollTop - el.clientHeight
            : el.scrollTop - scrollIgnoreLength
        ) /
        (el.scrollHeight - scrollIgnoreLength - el.clientHeight);

      _scrollOffsets.current = [
        scrollTop *
          (el.clientHeight -
            scrollSizes.current[0] +
            scrollBarTopOffset -
            (scrollSizes.current[1] === -1 ? bottomScrollBarOffset : 14) -
            headerPadding),
        (el.scrollLeft / (el.scrollWidth - el.clientWidth)) *
          (el.clientWidth -
            scrollSizes.current[1] -
            (scrollSizes.current[0] === -1 ? 8 : 14)),
      ];
      setScrollOffsets(_scrollOffsets.current);
      setRawScrollOffset(el.scrollTop);
    },
    [headerPadding, reverse, scrollBarTopOffset]
  );

  const onResize = useCallback(() => {
    const scrollEl = (
      scrollClass
        ? ref.current?.querySelector(`.${scrollClass}`)
        : ref.current!.firstChild
    ) as HTMLElement;
    if (!scrollEl) return;

    const hasV = scrollEl.scrollHeight > scrollEl.clientHeight;
    const hasH = scrollEl.scrollWidth > scrollEl.clientWidth;
    scrollSizes.current = [
      hasV
        ? Math.max(
            28,
            (scrollEl.clientHeight / scrollEl.scrollHeight) *
              (scrollEl.clientHeight - (hasH ? 14 : 8)) -
              headerPadding
          )
        : -1,
      hasH
        ? Math.max(
            28,
            (scrollEl.clientWidth / scrollEl.scrollWidth) *
              (scrollEl.clientWidth - (hasV ? 14 : 8))
          )
        : -1,
    ];
    onScroll(scrollEl);
  }, [headerPadding]);

  useResize(ref, onResize);

  const innerRef = useMemo(
    () =>
      (typeof innerClass === "string"
        ? ref.current?.querySelector(`.${innerClass}`)
        : innerClass) ?? null,
    [ref.current, innerClass]
  );
  useResize(innerRef, onResize);

  useEffect(() => {
    const scrollEl = (
      scrollClass
        ? ref.current?.querySelector(`.${scrollClass}`)
        : ref.current!.firstChild
    ) as HTMLElement;
    if (scrollEl) {
      const listener = (e: Event) => onScroll(e.target as HTMLElement);

      scrollEl.addEventListener("scroll", listener, {passive: true});

      return () => {
        scrollEl.removeEventListener("scroll", listener);
      };
    }
  }, [children]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = ref.current!.getBoundingClientRect();
      const vScroll = !hideVertical && rect.right - e.clientX < 16;
      const hScroll = !hideHorizontal && rect.bottom - e.clientY < 16;

      if (vScroll || hScroll) {
        e.stopPropagation();
        e.preventDefault();

        const el = (
          scrollClass
            ? ref.current?.querySelector(`.${scrollClass}`)
            : ref.current!.firstChild
        ) as HTMLElement;
        const initial = vScroll ? e.clientY : e.clientX;
        const initialScroll = vScroll ? el.scrollTop : el.scrollLeft;
        const barSize = vScroll
          ? ref.current!.clientHeight -
            scrollSizes.current[0] -
            (scrollSizes.current[1] === -1 ? 8 : 14) -
            headerPadding
          : ref.current!.clientWidth -
            scrollSizes.current[1] -
            (scrollSizes.current[0] === -1 ? 8 : 14);

        const rel =
          initial - (vScroll ? rect.top + headerPadding : rect.left) - 4;
        if (
          vScroll
            ? rel > _scrollOffsets.current[0] &&
              rel < _scrollOffsets.current[0] + scrollSizes.current[0]
            : rel > _scrollOffsets.current[1] &&
              rel < _scrollOffsets.current[1] + scrollSizes.current[1]
        ) {
          setDragging(true);

          const mouseMoveListener = (e: MouseEvent) => {
            const rel = (vScroll ? e.clientY : e.clientX) - initial;

            if (vScroll) {
              el.scrollTop =
                initialScroll +
                (rel / barSize) * (el.scrollHeight - el.clientHeight);
            } else {
              el.scrollLeft =
                initialScroll +
                (rel / barSize) * (el.scrollWidth - el.clientWidth);
            }
          };

          window.addEventListener("mousemove", mouseMoveListener);
          window.addEventListener(
            "mouseup",
            () => {
              window.removeEventListener("mousemove", mouseMoveListener);
              setDragging(false);
            },
            {once: true}
          );
        } else {
          if (vScroll) {
            el.scrollTop +=
              ((rel -
                (_scrollOffsets.current[0] + scrollSizes.current[0] / 2)) /
                barSize) *
              (el.scrollHeight - el.clientHeight);
          } else {
            el.scrollLeft +=
              ((rel -
                (_scrollOffsets.current[1] + scrollSizes.current[1] / 2)) /
                barSize) *
              (el.scrollWidth - el.clientWidth);
          }
        }
      }
    },
    [headerPadding]
  );

  return (
    <div
      ref={ref}
      className={cn(styles.customScrollbars, className, {
        [styles.dragging]: dragging,
      })}
      onMouseDownCapture={onMouseDown}
    >
      {children}
      {!hideVertical && scrollSizes.current[0] !== -1 ? (
        <div
          className={cn(styles.verticalBar, verticalBarClass)}
          style={{
            top: headerPadding - scrollBarTopOffset,
            bottom: scrollSizes.current[1] === -1 ? bottomScrollBarOffset : 6,
          }}
        >
          <div
            className={styles.scroller}
            style={{
              height: scrollSizes.current[0] + scrollBarTopOffset,
              transform: `translateY(${scrollOffsets[0]}px)`,
            }}
          />
        </div>
      ) : null}
      {!hideHorizontal && scrollSizes.current[1] !== -1 ? (
        <div
          className={styles.horizontalBar}
          style={{right: scrollSizes.current[0] === -1 ? 0 : 6}}
        >
          <div
            className={styles.scroller}
            style={{
              width: scrollSizes.current[1],
              transform: `translateX(${scrollOffsets[1]}px)`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
