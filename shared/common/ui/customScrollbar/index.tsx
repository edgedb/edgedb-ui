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
  verScrollIgnoreLength?: number;
  verScrollBarBottomOffset?: number;
  reverse?: boolean;
  hideVertical?: boolean;
  hideHorizontal?: boolean;
}

const defaultThumbSizes: [number, number] = [-1, -1];

export function CustomScrollbars({
  className,
  children,
  scrollClass,
  verticalBarClass,
  innerClass,
  headerPadding = 0,
  verScrollIgnoreLength = 0,
  verScrollBarBottomOffset = 8,
  reverse,
  hideVertical,
  hideHorizontal,
}: PropsWithChildren<CustomScrollbarsProps>) {
  const ref = useRef<HTMLDivElement>(null);

  const thumbSizes = useRef<[number, number]>(defaultThumbSizes);
  const [scrollBarHeight, setScrollBarHeight] = useState(0);
  const [scrollBarTopOffset, setScrollBarTopOffset] = useState(0);
  const [scrollOffsets, setScrollOffsets] = useState<[number, number]>(() => [
    0, 0,
  ]);
  const _scrollOffsets = useRef(scrollOffsets);
  const [dragging, setDragging] = useState(false);

  const onScroll = useCallback(
    (el: HTMLElement) => {
      const scrollTop = Math.max(
        0,
        reverse
          ? el.scrollHeight - el.clientHeight + el.scrollTop
          : el.scrollTop - verScrollIgnoreLength
      );

      setScrollBarTopOffset(
        !reverse && el.scrollTop < verScrollIgnoreLength
          ? el.scrollTop
          : verScrollIgnoreLength
      );

      const hasH = el.scrollWidth > el.clientWidth;

      const maxScrollbarHeight =
        el.clientHeight -
        (hasH ? 14 : verScrollBarBottomOffset) -
        headerPadding +
        verScrollIgnoreLength;

      _scrollOffsets.current = [
        ((maxScrollbarHeight - thumbSizes.current[0]) * scrollTop) /
          (el.scrollHeight - el.clientHeight - verScrollIgnoreLength),
        (el.scrollLeft / (el.scrollWidth - el.clientWidth)) *
          (el.clientWidth -
            thumbSizes.current[1] -
            (thumbSizes.current[0] === -1 ? 8 : 14)),
      ];

      if (el.scrollTop <= verScrollIgnoreLength) {
        setScrollBarHeight(
          el.clientHeight -
            (hasH ? 8 : verScrollBarBottomOffset) -
            headerPadding +
            el.scrollTop
        );
      }

      setScrollOffsets(_scrollOffsets.current);
    },
    [headerPadding, reverse, verScrollIgnoreLength]
  );

  const onResize = useCallback(() => {
    const el = (
      scrollClass
        ? ref.current?.querySelector(`.${scrollClass}`)
        : ref.current!.firstChild
    ) as HTMLElement;
    if (!el) return;

    const hasV = el.scrollHeight > el.clientHeight;
    const hasH = el.scrollWidth > el.clientWidth;

    if (scrollBarHeight === 0 && el.clientHeight < el.scrollHeight) {
      setScrollBarHeight(
        el.clientHeight - (hasH ? 8 : verScrollBarBottomOffset) - headerPadding
      );
    }

    thumbSizes.current = [
      hasV
        ? Math.max(
            28,
            ((el.clientHeight + verScrollIgnoreLength) * scrollBarHeight) /
              el.scrollHeight
          )
        : -1,
      hasH
        ? Math.max(
            28,
            (el.clientWidth / el.scrollWidth) *
              (el.clientWidth - (hasV ? 14 : 8))
          )
        : -1,
    ];
    onScroll(el);
  }, [headerPadding, scrollBarHeight]);

  useResize(ref, onResize, [onResize]);

  const innerRef = useMemo(
    () =>
      (typeof innerClass === "string"
        ? ref.current?.querySelector(`.${innerClass}`)
        : innerClass) ?? null,
    [ref.current, innerClass]
  );

  useResize(innerRef, onResize, [onResize]);

  useEffect(() => {
    const el = (
      scrollClass
        ? ref.current?.querySelector(`.${scrollClass}`)
        : ref.current!.firstChild
    ) as HTMLElement;
    if (el) {
      const listener = (e: Event) => onScroll(e.target as HTMLElement);

      el.addEventListener("scroll", listener, {passive: true});

      return () => {
        el.removeEventListener("scroll", listener);
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
            thumbSizes.current[0] -
            (thumbSizes.current[1] === -1 ? 8 : 14) -
            headerPadding
          : ref.current!.clientWidth -
            thumbSizes.current[1] -
            (thumbSizes.current[0] === -1 ? 8 : 14);

        const rel =
          initial - (vScroll ? rect.top + headerPadding : rect.left) - 4;
        if (
          vScroll
            ? rel > _scrollOffsets.current[0] &&
              rel < _scrollOffsets.current[0] + thumbSizes.current[0]
            : rel > _scrollOffsets.current[1] &&
              rel < _scrollOffsets.current[1] + thumbSizes.current[1]
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
                (_scrollOffsets.current[0] + thumbSizes.current[0] / 2)) /
                barSize) *
              (el.scrollHeight - el.clientHeight);
          } else {
            el.scrollLeft +=
              ((rel -
                (_scrollOffsets.current[1] + thumbSizes.current[1] / 2)) /
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
      {!hideVertical && thumbSizes.current[0] !== -1 ? (
        <div
          className={cn(styles.verticalBar, verticalBarClass)}
          style={{
            top: headerPadding - scrollBarTopOffset,
            bottom:
              thumbSizes.current[1] === -1 ? verScrollBarBottomOffset : 6,
          }}
        >
          <div
            className={styles.scroller}
            style={{
              height: thumbSizes.current[0],
              transform: `translateY(${scrollOffsets[0]}px)`,
            }}
          />
        </div>
      ) : null}
      {!hideHorizontal && thumbSizes.current[1] !== -1 ? (
        <div
          className={styles.horizontalBar}
          style={{right: thumbSizes.current[0] === -1 ? 0 : 6}}
        >
          <div
            className={styles.scroller}
            style={{
              width: thumbSizes.current[1],
              transform: `translateX(${scrollOffsets[1]}px)`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
