import React, {useState, useEffect} from "react";

import {useCodeHighlighting} from "@edgedb/common/hooks/useCodeHighlighting";

interface CodeBlockProps {
  code: string;
}

export default function CodeBlock({
  code,
  className,
  ...otherProps
}: React.HTMLAttributes<HTMLPreElement> & CodeBlockProps) {
  const [codeHtml, setCodeHtml] = useState(code);

  const {highlight, style} = useCodeHighlighting();

  useEffect(() => {
    Promise.resolve(highlight(code)).then(setCodeHtml);
  }, [code, highlight]);

  return (
    <pre
      className={`${style ?? ""} ${className}`}
      {...otherProps}
      dangerouslySetInnerHTML={{__html: codeHtml}}
    />
  );
}
