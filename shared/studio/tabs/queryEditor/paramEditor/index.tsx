import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useTabState} from "../../../state";
import {QueryEditor} from "../state";
import {QueryParamsEditor, ResolvedParameter} from "../state/parameters";

import {getInputComponent} from "../../../components/dataEditor";

import styles from "./paramEditor.module.scss";
import {Position, useDragHandler} from "@edgedb/common/hooks/useDragHandler";
import {useGlobalDragCursor} from "@edgedb/common/hooks/globalDragCursor";
import {RefObject, useRef} from "react";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";

export default observer(function ParamEditorPanel() {
  const editorState = useTabState(QueryEditor);
  const paramEditorState = editorState.queryParamsEditor;

  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  if (paramEditorState.paramDefs.size === 0) {
    return null;
  }

  return (
    <CustomScrollbars
      innerClass={contentRef.current}
      className={styles.scrollWrapper}
    >
      <div
        ref={ref}
        className={styles.paramEditorPanel}
        style={{height: paramEditorState.panelHeight}}
      >
        <div className={styles.header}>
          <DragHandle state={paramEditorState} parentRef={ref} />
          Query Parameters
        </div>

        <div ref={contentRef}>
          {paramEditorState.mixedParamsError ? (
            <div className={cn(styles.paramError, styles.topLevelError)}>
              Cannot have both positional and named parameters in query
            </div>
          ) : (
            <div className={styles.paramsList}>
              {[...paramEditorState.paramDefs.values()].map(
                (param, i, arr) => (
                  <ParamEditor
                    param={param}
                    lastParam={i === arr.length - 1}
                    key={
                      param.name +
                      "--" +
                      (param.error === null ? param.type.name : "error")
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </CustomScrollbars>
  );
});

const DragHandle = observer(function DragHandle({
  state,
  parentRef,
}: {
  state: QueryParamsEditor;
  parentRef: RefObject<HTMLDivElement>;
}) {
  const [_, setGlobalDragCursor] = useGlobalDragCursor();

  const resizeHandler = useDragHandler(() => {
    let initialHeight: number;
    let initialPos: Position;

    return {
      onStart(initialMousePos: Position, _: React.MouseEvent) {
        setGlobalDragCursor("ns-resize");
        initialPos = initialMousePos;
        initialHeight = parentRef.current!.getBoundingClientRect().height;
      },
      onMove(currentMousePos: Position, _: boolean) {
        state.setPanelHeight(
          initialHeight + (initialPos.y - currentMousePos.y)
        );
      },
      onEnd() {
        setGlobalDragCursor(null);
      },
    };
  }, [state, parentRef.current]);

  return <div className={styles.dragHandle} onMouseDown={resizeHandler} />;
});

interface ParamEditorProps {
  param: ResolvedParameter;
  lastParam: boolean;
}

const ParamEditor = observer(function ParamEditor({
  param,
  lastParam,
}: ParamEditorProps) {
  const editorState = useTabState(QueryEditor).queryParamsEditor;
  const paramData = editorState.currentParams[param.name];

  const Input = param.error === null ? getInputComponent(param.type) : null!;

  return (
    <div
      className={cn(styles.paramEditorItem, {
        [styles.paramDisabled]:
          param.error == null && param.optional && paramData.disabled,
      })}
    >
      <div className={styles.paramOptional}>
        {param.error == null && param.optional ? (
          <input
            type="checkbox"
            checked={!paramData.disabled}
            onChange={(e) =>
              editorState.setDisabled(param.name, !e.target.checked)
            }
          />
        ) : null}
      </div>
      <div className={styles.paramDetails}>
        <div className={styles.paramIdents}>
          {param.error == null ? (
            <div className={styles.paramType}>{param.type.name}</div>
          ) : null}
          <div className={styles.paramName}>${param.name}</div>
        </div>
        {param.error == null && param.optional ? (
          <div className={styles.paramOptionalLabel}>optional</div>
        ) : null}
      </div>
      {param.error !== null ? (
        <div className={styles.paramError}>{param.error}</div>
      ) : (
        <div className={styles.paramData}>
          <Input
            type={param.type}
            errorMessageAbove={lastParam}
            value={paramData.data.value.data}
            depth={2}
            onChange={(val, err) => {
              editorState.setParamValue(param.name, val, err);
            }}
          />
        </div>
      )}
    </div>
  );
});
