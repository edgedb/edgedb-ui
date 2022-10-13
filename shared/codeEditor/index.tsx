import {
  useEffect,
  useRef,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
} from "react";

import {
  EditorState,
  Text,
  Compartment,
  EditorSelection,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine as highlightActiveLineExt,
  highlightSpecialChars,
  drawSelection,
  KeyBinding,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import {
  bracketMatching,
  LanguageSupport,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
  completionKeymap,
} from "@codemirror/autocomplete";
import {indentationMarkers} from "@replit/codemirror-indentation-markers";
import {indentOnInput} from "@codemirror/language";
import {lintKeymap} from "@codemirror/lint";

import {edgeql, edgeqlLanguage} from "@edgedb/lang-edgeql";
import {highlightStyle, darkTheme, lightTheme} from "./theme";
import {getCompletions} from "./completions";

import cn from "@edgedb/common/utils/classNames";

import {SchemaObjectType} from "@edgedb/common/schemaData";

import styles from "./codeEditor.module.scss";
// import {cursorPlugin} from "./terminalCursor";

const readOnlyComp = new Compartment();
const darkThemeComp = new Compartment();
const keybindingsComp = new Compartment();
const onChangeComp = new Compartment();
const autocompleteComp = new Compartment();

const baseExtensions = [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  EditorState.allowMultipleSelections.of(true),
  indentationMarkers(),
  syntaxHighlighting(highlightStyle),
];

export interface CodeEditorProps {
  code: Text;
  onChange: (value: Text) => void;
  keybindings?: KeyBinding[];
  useDarkTheme?: boolean;
  readonly?: boolean;
  schemaObjects?: Map<string, SchemaObjectType>;
  noPadding?: boolean;
}

export interface CodeEditorRef {
  focus: () => void;
}

export function createCodeEditor({
  language,
  highlightActiveLine = true,
  formatLineNo,
  terminalCursor,
}: {
  language?: LanguageSupport | null;
  highlightActiveLine?: boolean;
  formatLineNo?: (lineNo: number) => string;
  terminalCursor?: boolean;
}) {
  function createState({
    doc,
    onChange,
    readonly,
    keybindings,
    useDarkTheme,
    schemaObjects,
  }: {
    doc: Text;
    onChange: (value: Text) => void;
    readonly: boolean;
    keybindings: KeyBinding[];
    useDarkTheme: boolean;
    schemaObjects?: Map<string, SchemaObjectType>;
  }) {
    return EditorState.create({
      doc,
      selection: EditorSelection.cursor(doc.length),
      extensions: [
        ...baseExtensions,
        ...(highlightActiveLine ? [highlightActiveLineExt()] : []),
        lineNumbers({
          formatNumber: formatLineNo,
        }),
        readOnlyComp.of([
          EditorState.readOnly.of(readonly),
          EditorView.editable.of(!readonly),
        ]),
        keybindingsComp.of(keymap.of(keybindings)),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
          {
            key: "Tab",
            run: ({state, dispatch}) => {
              if (state.selection.ranges.some((r) => !r.empty))
                return indentMore({state, dispatch});
              dispatch(
                state.update(state.replaceSelection("  "), {
                  scrollIntoView: true,
                  userEvent: "input",
                })
              );
              return true;
            },
            shift: indentLess,
          },
        ]),
        darkThemeComp.of(useDarkTheme ? darkTheme : lightTheme),
        language === undefined ? edgeql() : [],
        onChangeComp.of(
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc);
            }
          })
        ),
        autocompleteComp.of(
          schemaObjects
            ? [
                edgeqlLanguage.data.of({
                  autocomplete: getCompletions(schemaObjects),
                }),
              ]
            : []
        ),
      ],
    });
  }

  return forwardRef(function CodeEditor(
    {
      code,
      onChange,
      keybindings,
      noPadding,
      readonly,
      schemaObjects,
      useDarkTheme,
    }: CodeEditorProps,
    componentRef
  ) {
    const ref = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);

    useImperativeHandle<unknown, CodeEditorRef>(componentRef, () => ({
      focus: () => view.current?.focus(),
    }));

    useEffect(() => {
      if (ref.current) {
        view.current = new EditorView({
          state: createState({
            doc: code,
            keybindings,
            onChange,
            readonly,
            useDarkTheme,
            schemaObjects,
          }),
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
          createState({
            doc: code,
            keybindings,
            onChange,
            readonly,
            useDarkTheme,
            schemaObjects,
          })
        );
      }
    }, [code]);

    useLayoutEffect(
      () =>
        view.current?.dispatch({
          effects: readOnlyComp.reconfigure([
            EditorState.readOnly.of(readonly),
            EditorView.editable.of(!readonly),
          ]),
        }),
      [readonly]
    );

    useLayoutEffect(
      () =>
        view.current?.dispatch({
          effects: darkThemeComp.reconfigure(
            useDarkTheme ? darkTheme : lightTheme
          ),
        }),
      [useDarkTheme]
    );

    useLayoutEffect(
      () =>
        view.current?.dispatch({
          effects: keybindingsComp.reconfigure(keymap.of(keybindings)),
        }),
      [keybindings]
    );

    useLayoutEffect(
      () =>
        view.current?.dispatch({
          effects: onChangeComp.reconfigure(
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChange(update.state.doc);
              }
            })
          ),
        }),
      [onChange]
    );

    useLayoutEffect(
      () =>
        view.current?.dispatch({
          effects: autocompleteComp.reconfigure(
            schemaObjects
              ? [
                  edgeqlLanguage.data.of({
                    autocomplete: getCompletions(schemaObjects),
                  }),
                ]
              : []
          ),
        }),
      [schemaObjects]
    );

    useEffect(() => {
      if (!noPadding && ref.current?.firstChild) {
        const observer = new ResizeObserver((entries) => {
          (
            ref.current?.querySelector(".cm-content") as HTMLElement
          )?.style.setProperty(
            "padding-bottom",
            // `${entries[0].contentRect.height - 25}px`
            `${entries[0].contentRect.height / 2}px`
          );
        });

        observer.observe(ref.current.firstChild as Element);

        return () => {
          observer.disconnect();
        };
      }
    }, [ref]);

    return (
      <div
        className={cn(styles.codeEditor, {
          [styles.terminalCursor]: terminalCursor,
        })}
        ref={ref}
      />
    );
  });
}

export const CodeEditor = createCodeEditor({});
