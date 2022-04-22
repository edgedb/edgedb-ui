import React from "react";

import {_ICodec} from "edgedb";

import InspectorDispatch from "./dispatch";

import styles from "./inspector.module.scss";

interface InspectorProps {
  data: any[];
  codec: _ICodec;
}

const Inspector = ({
  data,
  codec,
  className,
  ...otherProps
}: InspectorProps & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div {...otherProps} className={styles.inspector + " " + className ?? ""}>
      <InspectorDispatch value={data} level={0} comma={false} codec={codec} />
    </div>
  );
};

export default Inspector;
