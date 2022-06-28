import {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {SchemaModule} from "../state/textView";
import {useSchemaTextState} from "../textView";

import {Arrow, CollapseArrow, Keyword, Punc, Str} from "./utils";

import styles from "../textView.module.scss";

export function ModuleRenderer({
  type,
  isSticky,
}: {
  type: SchemaModule;
  isSticky?: boolean;
}) {
  if (!type.isEnd && !isSticky) return null;

  const ref = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    if (isSticky) {
      const observer = new IntersectionObserver(
        ([e]) => {
          if (e.boundingClientRect.top < e.rootBounds!.height / 2) {
            setIsStuck(e.intersectionRatio < 1);
          }
        },
        {threshold: [1]}
      );

      observer.observe(ref.current!);

      return () => {
        observer.disconnect();
      };
    }
  }, []);

  return (
    <div
      className={cn(styles.moduleItem, {
        [styles.stickyHeader]: !!isSticky,
        [styles.isStuck]: isStuck,
      })}
    >
      <div ref={ref} className={styles.stickySentinel} />
      {type.isEnd ? (
        <Punc>{"};"}</Punc>
      ) : (
        <>
          <Keyword>module</Keyword> {type.module} <Punc>{"{"}</Punc>
        </>
      )}
    </div>
  );
}

export const ModuleHeaders = observer(function ModuleHeaders({}: {
  // dummy prop to trigger rerender since
  // `observer` isn't reactive to change in list height
  _rerender: any;
}) {
  const state = useSchemaTextState();

  if (!state.listRef) {
    return null;
  }

  const modules = state.renderListItems.reduce((mods, item, index) => {
    if (item.item.schemaType === "Module") {
      if (!item.item.isEnd) {
        mods.push({module: item.item, index} as any);
      } else {
        mods[mods.length - 1].endIndex = index;
      }
    }
    return mods;
  }, [] as {module: SchemaModule; index: number; endIndex: number}[]);

  return (
    <>
      {modules.map((mod, i) => {
        const start = (state.listRef as any)._getItemStyle(mod.index);
        const end = (state.listRef as any)._getItemStyle(mod.endIndex);

        return (
          <div
            key={i}
            className={cn(styles.listItem, styles.moduleWrapper)}
            style={{
              marginTop: (i === 0 ? start.top : 42) + "px",
              height: end.top - start.top + "px",
            }}
          >
            <ModuleRenderer type={mod.module} isSticky />
          </div>
        );
      })}
    </>
  );
});
