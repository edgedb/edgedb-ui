import {useEffect, useRef, useState, useLayoutEffect} from "react";

import {EditorState, StateEffect, Text} from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  highlightSpecialChars,
  drawSelection,
  KeyBinding,
} from "@codemirror/view";
import {defaultKeymap} from "@codemirror/commands";
import {lineNumbers, highlightActiveLineGutter} from "@codemirror/gutter";
import {history, historyKeymap} from "@codemirror/history";
import {bracketMatching} from "@codemirror/matchbrackets";
import {closeBrackets, closeBracketsKeymap} from "@codemirror/closebrackets";
import {commentKeymap} from "@codemirror/comment";
import {searchKeymap, highlightSelectionMatches} from "@codemirror/search";
import {indentationMarkers} from "@replit/codemirror-indentation-markers";
import {autocompletion} from "@codemirror/autocomplete";

import {edgeql} from "@edgedb/lang-edgeql";
import {highlightStyle, darkTheme, lightTheme} from "./theme";

import styles from "./codeEditor.module.scss";

// import { foldGutter, foldKeymap } from "@codemirror/fold";
// import { indentOnInput } from "@codemirror/language";
// import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
// import { rectangularSelection } from "@codemirror/rectangular-selection";
// import { lintKeymap } from "@codemirror/lint";

interface ExtensionConfig {
  onChange: (doc: Text) => void;
  keybindings?: KeyBinding[];
  useDarkTheme?: boolean;
}

function getExtensions({
  onChange,
  keybindings = [],
  useDarkTheme = false,
}: ExtensionConfig) {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    // foldGutter(),
    drawSelection(),
    // dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    // indentOnInput(),
    // defaultHighlightStyle.fallback,
    bracketMatching(),
    closeBrackets(),
    // autocompletion(),
    // rectangularSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    indentationMarkers(),
    autocompletion(),
    keymap.of([
      ...keybindings,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      // ...searchKeymap,
      ...historyKeymap,
      // ...foldKeymap,
      ...commentKeymap,
      // ...completionKeymap,
      // ...lintKeymap,
    ]),
    //
    useDarkTheme ? darkTheme : lightTheme,
    highlightStyle,
    edgeql(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc);
      }
    }),
  ];
}

function createState(doc: Text, extensionConfig: ExtensionConfig) {
  return EditorState.create({
    doc,
    extensions: getExtensions(extensionConfig),
  });
}

export interface CodeEditorProps {
  code: Text;
  onChange: (value: Text) => void;
  keybindings?: KeyBinding[];
  useDarkTheme?: boolean;
}

export function CodeEditor({
  code,
  onChange,
  keybindings = [],
  useDarkTheme = false,
}: CodeEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    if (ref.current) {
      view.current = new EditorView({
        state: createState(code, {onChange, keybindings, useDarkTheme}),
        parent: ref.current,
      });

      return () => {
        view.current?.destroy();
      };
    }
  }, [ref]);

  useEffect(() => {
    if (view.current && view.current?.state.doc !== code) {
      view.current.setState(
        createState(code, {onChange, keybindings, useDarkTheme})
      );
    }
  }, [code]);

  useLayoutEffect(() => {
    if (view.current) {
      view.current.dispatch({
        effects: StateEffect.reconfigure.of(
          getExtensions({onChange, keybindings, useDarkTheme})
        ),
      });
    }
  }, [useDarkTheme]);

  useEffect(() => {
    if (ref.current?.firstChild) {
      const observer = new ResizeObserver((entries) => {
        (
          ref.current?.querySelector(".cm-content") as HTMLElement
        )?.style.setProperty(
          "padding-bottom",
          `${entries[0].contentRect.height - 25}px`
        );
      });

      observer.observe(ref.current.firstChild as Element);

      return () => {
        observer.disconnect();
      };
    }
  }, [ref]);

  return <div className={styles.codeEditor} ref={ref} />;
}
