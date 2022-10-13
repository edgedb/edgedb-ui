import {memo} from "react";
import {Text} from "@codemirror/state";
import {createCodeEditor} from "@edgedb/code-editor";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";

import styles from "./textViewer.module.scss";
import {ActionsBar} from "../shared";

interface TextViewerProps {
  data: string;
}

export const TextViewer = memo(function TextViewer({data}: TextViewerProps) {
  const CodeEditor = createCodeEditor({
    language: null,
    highlightActiveLine: false,
  });

  const [_, theme] = useTheme();

  return (
    <div className={styles.textViewer}>
      <ActionsBar />
      <CodeEditor
        code={Text.of(data.split("\n"))}
        onChange={() => {}}
        useDarkTheme={theme === Theme.dark}
        readonly
      />
    </div>
  );
});
