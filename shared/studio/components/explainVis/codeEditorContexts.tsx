import {CodeEditorRef} from "@edgedb/code-editor";
import {observer} from "mobx-react-lite";
import {useEffect, useState} from "react";
import {createPortal} from "react-dom";

import cn from "@edgedb/common/utils/classNames";

import styles from "./explainVis.module.scss";
import {Context, ExplainState} from "./state";
import {palette} from "./treemapLayout";

interface CtxRect {
  id: number;
  top: number;
  left: number;
  width: number;
  height: number;
  depth: number;
}

export const CodeEditorExplainContexts = observer(function ExplainContexts({
  editorRef,
  state,
}: {
  editorRef: CodeEditorRef;
  state: ExplainState;
}) {
  const [containerEl] = useState(() => document.createElement("div"));

  const [ctxRects, setCtxRects] = useState<CtxRect[]>([]);

  useEffect(() => {
    const scrollerEl = editorRef.view().scrollDOM;

    containerEl.classList.add(styles.explainContextsContainer);
    scrollerEl.appendChild(containerEl);

    let rects: CtxRect[] = [];

    const updateContextRects = () => {
      const scrollRect = scrollerEl.getBoundingClientRect();

      const offsetTop = scrollRect.top - scrollerEl.scrollTop;
      const offsetLeft = scrollRect.left - scrollerEl.scrollLeft;

      const ctxs = state.contextsByBufIdx[0];
      rects = [];
      let parentCtxs: Context[] = [];
      for (const ctx of ctxs) {
        const els = [
          ...scrollerEl.querySelectorAll(`[data-ctx-id="${ctx.id}"]`),
        ];
        if (!els.length) {
          continue;
        }
        let top = Infinity,
          left = Infinity,
          right = -Infinity,
          bottom = -Infinity;

        for (const el of els) {
          const elRect = el.getBoundingClientRect();
          if (elRect.left < left) left = elRect.left;
          if (elRect.top < top) top = elRect.top;
          if (elRect.right > right) right = elRect.right;
          if (elRect.bottom > bottom) bottom = elRect.bottom;
        }

        while (parentCtxs.length) {
          const lastCtx = parentCtxs[parentCtxs.length - 1];
          if (ctx.end <= lastCtx.end) {
            break;
          } else {
            parentCtxs.pop();
          }
        }
        let depth = parentCtxs.length;
        parentCtxs.push(ctx);

        rects.push({
          id: ctx.id,
          top: top - offsetTop,
          left: left - offsetLeft,
          width: right - left,
          height: bottom - top,
          depth: depth,
        });
      }

      setCtxRects(rects);
    };

    updateContextRects();

    let lastViewport = {from: 0, to: 0};

    const scrollListener = () => {
      const viewport = editorRef.view().viewport;
      if (
        viewport.from !== lastViewport.from ||
        viewport.to !== lastViewport.to
      ) {
        lastViewport = {...viewport};
        updateContextRects();
      }
    };
    scrollerEl.addEventListener("scroll", scrollListener);

    const hoverListener = (e: MouseEvent) => {
      const scrollRect = scrollerEl.getBoundingClientRect();
      const x = e.clientX - scrollRect.left,
        y = e.clientY - scrollRect.top + scrollerEl.scrollTop;

      let depth = 0;
      let ctxId: number | null = null;
      for (const rect of rects) {
        if (
          rect.depth >= depth &&
          x >= rect.left &&
          x <= rect.left + rect.width &&
          y >= rect.top &&
          y <= rect.top + rect.height
        ) {
          ctxId = rect.id;
          depth = rect.depth;
        }
      }
      state.setCtxId(ctxId);
    };
    scrollerEl.addEventListener("mousemove", hoverListener);

    return () => {
      scrollerEl.removeChild(containerEl);
      scrollerEl.removeEventListener("scroll", scrollListener);
      scrollerEl.removeEventListener("mousemove", hoverListener);
    };
  }, [state]);

  return createPortal(
    <>
      {ctxRects.map((ctxRect) => (
        <div
          className={cn(styles.explainContextRect, {
            [styles.highlighted]: state.ctxId === ctxRect.id,
          })}
          style={{
            top: ctxRect.top,
            left: ctxRect.left,
            width: ctxRect.width,
            height: ctxRect.height,
            backgroundColor:
              state.ctxId === ctxRect.id
                ? palette[ctxRect.depth % palette.length]
                : undefined,
          }}
        />
      ))}
    </>,
    containerEl
  );
});
