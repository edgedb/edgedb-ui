import React, {useRef, useEffect} from "react";

import monaco from "../../monaco";

import styles from "./queryEditor.module.scss";

import {useResize} from "../../hooks/useResize";

export interface QueryEditorProps {
  query: string;
  onChange: (value: string) => void;
  onRun: () => void;
}

const QueryEditor = (props: QueryEditorProps) => {
  const editorEl = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor>();

  useEffect(() => {
    if (!editorEl.current) {
      return;
    }

    editor.current = monaco.editor.create(editorEl.current, {
      language: "edgeql",
      minimap: {
        enabled: false,
      },
      fontFamily: "Roboto Mono",
    });

    editor.current.addCommand(monaco.KeyCode.F1, () => {
      // no-op to disable Command Palette
    });

    return () => {
      editor.current?.dispose();
    };
  }, [editorEl]);

  const {query, onChange, onRun} = props;

  useEffect(() => {
    editor.current?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      onRun
    );
  }, [editor, onRun]);

  useEffect(() => {
    const listener = editor.current?.onDidChangeModelContent(() => {
      onChange(editor.current!.getValue());
    });
    return () => listener?.dispose();
  }, [editor, onChange]);

  useEffect(() => {
    if (query !== editor.current?.getValue()) {
      editor.current?.setValue(props.query);
    }
  }, [query]);

  useResize(editorEl, () => {
    editor.current?.layout();
  });

  return <div className={styles.editor} ref={editorEl} />;
};

export default QueryEditor;
