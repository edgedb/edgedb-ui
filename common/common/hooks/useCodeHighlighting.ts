import {createContext, useContext} from "react";

export const CodeHighlightingContext = createContext<{
  highlight: (code: string) => string | Promise<string>;
  style?: string;
} | null>(null);

export function useCodeHighlighting() {
  const context = useContext(CodeHighlightingContext);
  if (!context) {
    throw new Error(
      `"useCodeHighlighting()" hook must be used within a "<CodeHighlightingContext>"`
    );
  }
  return context;
}
