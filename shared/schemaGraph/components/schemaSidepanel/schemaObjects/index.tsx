import React from "react";
import {observer} from "mobx-react";

import {useSchemaState} from "../../../state/provider";

export default observer(function SchemaObjects() {
  const schemaState = useSchemaState();

  return <div>Objects</div>;
});
