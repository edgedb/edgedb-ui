import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useTabState} from "../../../state";
import {Repl} from "../state";
import {ResolvedParameter} from "../state/parameters";

import {ArrayEditor, getInputComponent} from "../../../components/dataEditor";

import styles from "./paramEditor.module.scss";

export default observer(function ParamEditorPanel() {
  const replState = useTabState(Repl);
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
          {[...paramEditorState.currentParams.values()].map(
            (param, i, arr) => (
              <ParamEditor
                param={param}
                lastParam={i === arr.length - 1}
                key={param.name + param.type}
              />
            )
          )}
        </div>
      )}
    </div>
  );
});

interface ParamEditorProps {
  param: ResolvedParameter;
  lastParam: boolean;
}

const ParamEditor = observer(function ParamEditor({
  param,
  lastParam,
}: ParamEditorProps) {
  const paramData = useTabState(Repl).queryParamsEditor.paramData.get(
    param.name
  )!;

  const Input = (
    param.resolvedBaseType
      ? param.array
        ? ArrayEditor
        : getInputComponent(param.resolvedBaseType)
      : null
  )!;

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
          <Input
            type={param.resolvedBaseType as any}
            isSetType={param.array}
            stringMode
            errorMessageAbove={lastParam}
            value={
              param.array
                ? (paramData.values as any)
                : paramData.values[0] ?? ""
            }
            depth={2}
            onChange={(val, err) => {
              if (param.array) paramData.setArrayValues(val, err);
              else paramData.setSingleValue(val, err);
            }}
          />
        </div>
      )}
    </div>
  );
});
