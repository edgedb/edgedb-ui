import {EditorView} from "@codemirror/view";
import {HighlightStyle} from "@codemirror/language";
import {tags as t} from "@lezer/highlight";
import {StyleSpec} from "style-mod";

type ThemeSpec = {[selector: string]: StyleSpec};

function mergeThemeSpec(baseSpec: ThemeSpec, spec: ThemeSpec): ThemeSpec {
  const newSpec = {...baseSpec};
  for (const [key, val] of Object.entries(spec)) {
    newSpec[key] = {...newSpec[key], ...val};
  }
  return newSpec;
}

const lightThemeSpec: ThemeSpec = {
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
    fontSize: "14px",
  },
  ".cm-activeLineGutter": {
    background: "none",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(0,0,0,0.04)",
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
  },
  "&.cm-focused .cm-nonmatchingBracket": {
    background: "none",
  },
  ".cm-indentation-marker": {
    background: "none",
    borderLeft: "1px solid rgba(0,0,0,0.1)",
    marginLeft: "-1px",
  },
  ".cm-tooltip": {
    zIndex: "101",
  },
  ".cm-tooltip-autocomplete": {
    background: "#fff",
    border: "none",
    borderRadius: "4px",
    overflow: "hidden",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.15)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    maxHeight: "166px",
    scrollbarWidth: "thin",
    fontFamily: `"Roboto Mono", monospace;`,
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    lineHeight: "28px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "var(--app-accent-green)",
  },
  ".cm-specialChar": {
    color: "#333",
    opacity: 0.5,
  },
  ".cm-tab": {
    display: "inline",
    position: "relative",
    color: "#333",
    "&:before": {
      position: "absolute",
      content: '"→"',
      opacity: 0.5,
    },
  },
};

export const lightTheme = EditorView.theme(lightThemeSpec);

export const darkTheme = EditorView.theme(
  mergeThemeSpec(lightThemeSpec, {
    "&": {
      backgroundColor: "var(--code-editor-bg, #242424)",
      color: "#e5e5e5",
    },
    ".cm-gutters": {
      backgroundColor: "var(--code-editor-bg, #242424)",
    },
    ".cm-lineNumbers": {
      color: "#8b8b8b",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "hsla(0,0%,96%,0.11)",
    },
    ".cm-cursor": {
      borderLeftColor: "#4a96e6",
    },
    "&.cm-focused .cm-matchingBracket": {
      outlineColor: "rgba(255,255,255,0.35)",
    },
    ".cm-indentation-marker": {
      borderLeftColor: "rgba(255,255,255,0.1)",
    },
    ".cm-tooltip-autocomplete": {
      background: "#1F1F1F",
    },
    ".cm-specialChar": {
      color: "#e5e5e5",
    },
    ".cm-tab": {
      color: "#e5e5e5",
    },
    ".cm-content": {
      caretColor: "blue",
    },
  }),
  {dark: true}
);

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
