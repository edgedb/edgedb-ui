import {Fragment, useState} from "react";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {DataView} from "./state";
import {getAllChildren} from "../../utils/syntaxTree";
import {SchemaType} from "@edgedb/common/schemaData";

import {useModal} from "@edgedb/common/hooks/useModal";
import {Modal, ModalOverlay} from "@edgedb/common/ui/modal";
import Button from "@edgedb/common/ui/button";
import {WarningIcon} from "../../icons";

import {
  ErrorDetails,
  extractErrorDetails,
} from "../../utils/extractErrorDetails";

import {
  PrimitiveType,
  renderInvalidEditorValue,
} from "../../components/dataEditor/utils";

import {renderValue} from "@edgedb/inspector/buildScalar";
import inspectorStyles from "@edgedb/inspector/inspector.module.scss";

import CodeBlock from "@edgedb/common/ui/codeBlock";

import styles from "./editsModal.module.scss";

interface ReviewEditsModalProps {
  state: DataView;
}

export const ReviewEditsModal = observer(function ReviewEditsModal({
  state,
}: ReviewEditsModalProps) {
  const {openModal} = useModal();

  const [commiting, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<ErrorDetails | null>(null);

  const {params, statements} = state.edits.generateStatements();

  const hasErrors = statements.some((statement) => statement.error);

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <Modal
        contentClass={styles.modal}
        title="Review Changes"
        close={() => openModal(null)}
        actions={
          <>
            <Button
              className={styles.redButton}
              label="Clear all changes"
              onClick={() => {
                state.edits.clearAllPendingEdits();
                openModal(null);
              }}
            />
            <Button
              className={styles.greenButton}
              label={commiting ? "Committing..." : "Commit Changes"}
              loading={commiting}
              disabled={hasErrors || commiting}
              onClick={async () => {
                setCommitting(true);
                try {
                  await state.edits.commitPendingEdits();
                  state.edits.clearAllPendingEdits();
                  state.refreshAllViews();
                  openModal(null);
                } catch (e: any) {
                  setCommitError(extractErrorDetails(e));
                }
                setCommitting(false);
              }}
            />
          </>
        }
      >
        <div className={cn(styles.codeBlock, inspectorStyles.inspectorTheme)}>
          {statements.map(({varName, code, error}, i) => (
            <Fragment key={i}>
              <div className={styles.statementName}>{varName} :=</div>
              <CodeBlock
                code={code}
                customRanges={(tree) =>
                  getAllChildren(tree.topNode, "QueryParameter").map(
                    (node) => ({
                      range: [node.from, node.to],
                      renderer: (_, content) => {
                        const [paramCast, paramName] = code
                          .slice(node.from, node.to)
                          .split("$");
                        const param = params[paramName];

                        if (paramCast === "<_invalid>") {
                          return (
                            <span className={styles.codeBlockParamInvalid}>
                              {renderInvalidEditorValue(
                                param.value,
                                param.type as PrimitiveType
                              )}
                            </span>
                          );
                        }

                        content.props.children.pop();
                        return (
                          <span className={styles.codeBlockParam}>
                            {content}
                            <span className={styles.codeBlockParamValue}>
                              {renderParam(param)}
                            </span>
                          </span>
                        );
                      },
                    })
                  )
                }
              />
              <div className={styles.statementMessages}>
                {error ? (
                  <div className={styles.errorMessage}>
                    <WarningIcon />
                    {error}
                  </div>
                ) : null}
              </div>
            </Fragment>
          ))}
        </div>
        {/* <details>
          <summary>debug</summary>
          <pre>
            {JSON.stringify(
              state.edits,
              (key, val) => (typeof val === "bigint" ? val.toString() : val),
              2
            )}
          </pre>
        </details> */}
        {commitError ? (
          <div className={styles.errorMessage}>
            <WarningIcon />
            <div>
              <span className={styles.errorName}>{commitError.name}</span>:{" "}
              {commitError.msg}
              {commitError.details ? (
                <div className={styles.errorDetails}>
                  Details: {commitError.details}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </ModalOverlay>
  );
});

function renderParam({
  type,
  value,
}: {
  type: SchemaType;
  value: any;
}): JSX.Element {
  if (type.schemaType === "Array") {
    return (
      <>
        [
        {(value as any[]).map((item, i) => (
          <>
            {i !== 0 ? ", " : null}
            {renderParam({type: type.elementType, value: item})}
          </>
        ))}
        ]
      </>
    );
  } else {
    return renderValue(
      value,
      type.name,
      type.schemaType === "Scalar" && !!type.enum_values,
      type.schemaType === "Range" || type.schemaType === "Multirange"
        ? type.elementType.name
        : undefined,
      false,
      undefined,
      undefined,
      50
    ).body;
  }
}
