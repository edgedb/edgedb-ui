import {useEffect, useRef} from "react";

import styles from "./dataEditor.module.scss";

export interface DataEditorProps<T = any> {
  value: T;
  onChange: (val: T) => void;
  onClose: () => void;
  style?: any;
}

export function DataEditor({
  value,
  onChange,
  onClose,
  style,
}: DataEditorProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus({preventScroll: true});

      ref.current.addEventListener("blur", onClose);
    }
  }, []);

  return (
    <div className={styles.dataEditor} style={style}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
