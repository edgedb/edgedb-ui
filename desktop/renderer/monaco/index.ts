import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

import {autorun} from "mobx";

import {loadWASM} from "onigasm";
import {Registry} from "monaco-textmate";
import {wireTmGrammars} from "monaco-editor-textmate";

// @ts-ignore
import onigasmPath from "onigasm/lib/onigasm.wasm";

import "./themes/EdgeDBDark";
import "./themes/EdgeDBLight";

import grammar from "./edgeql.tmGrammar.json";

import appState from "../state/store";
import {Theme} from "../state/models/app";

monaco.languages.register({id: "edgeql"});

monaco.languages.setLanguageConfiguration("edgeql", {
  comments: {
    lineComment: "#",
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    {open: "{", close: "}"},
    {open: "[", close: "]"},
    {open: "(", close: ")"},
    {open: "'", close: "'"},
    {open: '"', close: '"'},
  ],
  surroundingPairs: [
    {open: "{", close: "}"},
    {open: "[", close: "]"},
    {open: "(", close: ")"},
    {open: "'", close: "'"},
    {open: '"', close: '"'},
    {open: "<", close: ">"},
  ],
});

(async () => {
  try {
    await loadWASM(onigasmPath);
  } catch (err) {
    // catch wasm already loaded error on hot reload
  }

  const registry = new Registry({
    getGrammarDefinition: async () => {
      return {
        format: "json",
        content: grammar,
      };
    },
  });

  const grammars = new Map([["edgeql", "source.edgeql"]]);
  await wireTmGrammars(monaco, registry, grammars);
})();

autorun(() => {
  const theme = appState.theme;

  switch (theme) {
    case Theme.dark:
      monaco.editor.setTheme("EdgeDB-Dark");
      break;
    case Theme.light:
      monaco.editor.setTheme("EdgeDB-Light");
      break;
  }
});

export default monaco;
