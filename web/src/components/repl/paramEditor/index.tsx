import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useDatabaseState} from "src/state/providers";
import {ResolvedParameter} from "src/state/models/repl/parameters";

import styles from "./paramEditor.module.scss";

export default observer(function ParamEditorPanel() {
  const replState = useDatabaseState().replState;
  const paramEditorState = replState.queryParamsEditor;

  if (paramEditorState.currentParams.size === 0) {
    return null;
  }

  return (
    <div className={styles.paramEditorPanel}>
      <div className={styles.header}>Parameters</div>

      {paramEditorState.mixedParamsError ? (
        <div className={cn(styles.paramError, styles.topLevelError)}>
          Cannot have both positional and named parameters in query
        </div>
      ) : (
        <div className={styles.paramsList}>
          {[...paramEditorState.currentParams.values()].map((param) => (
            <ParamEditor param={param} key={param.name} />
          ))}
        </div>
      )}
    </div>
  );
});

interface ParamEditorProps {
  param: ResolvedParameter;
}

const ParamEditor = observer(function ParamEditor({param}: ParamEditorProps) {
  const paramData =
    useDatabaseState().replState.queryParamsEditor.paramData.get(param.name)!;

  const values = param.array ? paramData.values : paramData.values.slice(0, 1);

  return (
    <div
      className={cn(styles.paramEditorItem, {
        [styles.paramDisabled]:
          !param.error && param.optional && paramData.disabled,
      })}
    >
      <div className={styles.paramOptional}>
        {!param.error && param.optional ? (
          <input
            type="checkbox"
            checked={!paramData.disabled}
            onChange={(e) => paramData.setDisabled(!e.target.checked)}
          />
        ) : null}
      </div>
      <div className={styles.paramDetails}>
        <div className={styles.paramIdents}>
          {!param.error && param.type ? (
            <div className={styles.paramType}>
              {param.array ? `array<${param.type}>` : param.type}
            </div>
          ) : null}
          <div className={styles.paramName}>${param.name}</div>
        </div>
        {!param.error && param.optional ? (
          <div className={styles.paramOptionalLabel}>optional</div>
        ) : null}
      </div>
      {param.error ? (
        <div className={styles.paramError}>{param.error}</div>
      ) : (
        <div className={styles.paramData}>
          {values.map((value, i) => (
            <div className={styles.paramValue} key={i}>
              <input
                type="text"
                value={value}
                onChange={(e) => paramData.setValue(i, e.target.value)}
              />
              {values.length > 1 ? (
                <button onClick={() => paramData.removeValue(i)}>×</button>
              ) : null}
            </div>
          ))}
          {param.array ? (
            <button onClick={() => paramData.addNewValue()}>Add</button>
          ) : null}
        </div>
      )}
    </div>
  );
});
