import {
  EditorSelection,
  EditorState,
  Range,
  RangeSet,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";

import styles from "./codeEditor.module.scss";

class TerminalCursorWidget extends WidgetType {
  constructor(readonly char: string) {
    super();
  }

  eq(other: TerminalCursorWidget) {
    return other.char == this.char;
  }

  toDOM() {
    let el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    el.className = styles.terminalCursor;
    el.textContent = this.char;
    return el;
  }
}

// export const terminalCursor = EditorState.transactionExtender.of((tr) => {
//   const selection = tr.newSelection;
//   console.log(selection.main.head);
//   // return {effects: }
//   return null;
// });

export function cursorPlugin() {
  let decorations: DecorationSet = RangeSet.empty;
  return ViewPlugin.define(
    () => ({
      update: (update) => {
        const cursor = update.state.selection.main.head;
        const char = update.state.doc.sliceString(cursor, cursor + 1);
        decorations = RangeSet.of(
          Decoration.widget({
            widget: new TerminalCursorWidget(char),
            side: 1,
          }).range(cursor)
        );
        console.log(update.state.selection.main.head);
      },
    }),
    {
      decorations: () => decorations,
    }
  );
}
