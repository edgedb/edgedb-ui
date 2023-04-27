import {RangeSet} from "@codemirror/state";
import {Decoration, DecorationSet, ViewPlugin} from "@codemirror/view";

import styles from "./codeEditor.module.scss";

export function cursorPlugin() {
  let decorations: DecorationSet = RangeSet.empty;
  return ViewPlugin.define(
    () => ({
      update: (update) => {
        const cursor = update.state.selection.main.head;
        decorations = update.view.hasFocus
          ? RangeSet.of(
              Decoration.mark({
                class: styles.terminalCursorMark,
              }).range(cursor, cursor + 1)
            )
          : RangeSet.empty;
      },
    }),
    {
      decorations: () => decorations,
    }
  );
}
