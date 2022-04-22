import {EditorView} from "@codemirror/view";
import {tags as t, HighlightStyle} from "@codemirror/highlight";

export const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--code-editor-bg, #242424)",
      color: "#e5e5e5",
      width: "100%",
    },
    "&.cm-editor.cm-focused": {
      outline: "none",
    },
    "& .cm-scroller": {
      fontSize: "15px",
      fontFamily: `"Roboto Mono", monospace;`,
      overflow: "auto",
    },
    ".cm-gutters": {
      backgroundColor: "var(--code-editor-bg, #242424)",
      padding: "0 12px 0 8px",
      userSelect: "none",
    },
    ".cm-lineNumbers": {
      color: "#8b8b8b",
    },
    ".cm-activeLine": {
      backgroundColor: "#353535",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "#353535",
    },
    ".cm-cursor": {
      borderLeft: "2px solid #4a96e6",
      marginLeft: "-1px",
    },
    ".cm-cursor-secondary": {
      opacity: 0.5,
    },
    "&.cm-focused .cm-matchingBracket": {
      background: "none",
      outline: "1px solid rgba(255,255,255,0.35)",
      // borderRadius: "1px",
    },
    "&.cm-focused .cm-nonmatchingBracket": {
      background: "none",
    },
    ".cm-indentation-marker": {
      background: "none",
      borderLeft: "1px solid rgba(255,255,255,0.1)",
      marginLeft: "-1px",
    },
  },
  {dark: true}
);

export const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--code-editor-bg, #f5f5f5)",
    color: "#333",
    width: "100%",
  },
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
  "& .cm-scroller": {
    fontSize: "15px",
    fontFamily: `"Roboto Mono", monospace;`,
    overflow: "auto",
  },
  ".cm-gutters": {
    backgroundColor: "var(--code-editor-bg, #f5f5f5)",
    padding: "0 12px 0 8px",
    userSelect: "none",
    borderRight: "none",
  },
  ".cm-lineNumbers": {
    color: "#8b8b8b",
  },
  ".cm-activeLineGutter": {
    background: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "#ebebeb",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "#ebebeb",
  },
  ".cm-cursor": {
    borderLeft: "2px solid #4a96e6",
    marginLeft: "-1px",
  },
  ".cm-cursor-secondary": {
    opacity: 0.5,
  },
  "&.cm-focused .cm-matchingBracket": {
    background: "none",
    outline: "1px solid rgba(0,0,0,0.2)",
    // borderRadius: "1px",
  },
  "&.cm-focused .cm-nonmatchingBracket": {
    background: "none",
  },
  ".cm-indentation-marker": {
    background: "none",
    borderLeft: "1px solid rgba(0,0,0,0.1)",
    marginLeft: "-1px",
  },
});

export const highlightStyle = HighlightStyle.define([
  {tag: t.keyword, color: "var(--syntax-purple)"},
  {tag: t.string, color: "var(--syntax-green)"},
  {tag: t.comment, color: "var(--syntax-comment)"},
  {tag: t.standard(t.name), color: "var(--syntax-blue)"},
  {tag: t.operator, color: "var(--syntax-red)"},
  {tag: t.bool, color: "var(--syntax-orange)"},
  {tag: t.number, color: "var(--syntax-orange)"},
  {tag: t.special(t.string), color: "var(--syntax-blue)"},
  {tag: t.special(t.number), color: "var(--syntax-blue)"},
  {tag: t.variableName, color: "var(--syntax-blue)"},
  {tag: t.escape, color: "var(--syntax-orange)"},
  {tag: t.special(t.name), color: "var(--syntax-mod)"},
]);
