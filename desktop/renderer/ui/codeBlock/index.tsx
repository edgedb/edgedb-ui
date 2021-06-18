import React, {useState, useEffect} from "react";

import monaco from "../../monaco";

interface CodeBlockProps {
  code: string;
}

export default function CodeBlock({
  code,
  ...otherProps
}: React.HTMLAttributes<HTMLPreElement> & CodeBlockProps) {
  const [codeHtml, setCodeHtml] = useState(code);

  useEffect(() => {
    monaco.editor.colorize(code, "edgeql", {}).then(setCodeHtml);
  }, [code]);

  return <pre {...otherProps} dangerouslySetInnerHTML={{__html: codeHtml}} />;
}
