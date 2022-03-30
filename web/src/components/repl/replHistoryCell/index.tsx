import React from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import styles from "./replHistoryCell.module.scss";

import {useDatabaseState} from "../../../state/providers";
import {Transaction, TransactionState} from "../../../state/models/connection";
import {
  ReplErrorCell,
  ReplExpandableCell,
  ReplHistoryCell as ReplHistoryCellState,
  ReplHistoryCellStatus,
  ReplResultCell,
  ReplTransactionCell,
  ReplTransactionSavepointCell,
  TransactionStatementType,
} from "../../../state/models/repl";
import {currentDate} from "../../../state/models/repl/currentDate";
import {QueryDuration} from "src/interfaces/connection";

import {formatDuration} from "src/utils/formatDuration";

import Inspector from "@edgedb/inspector/v2";
import {ChevronIcon} from "src/ui/icons";

function MarkerIcon({
  cell,
  ...props
}: {
  cell: ReplTransactionCell | ReplTransactionSavepointCell;
} & React.HTMLAttributes<SVGElement>): JSX.Element | null {
  if (cell instanceof ReplTransactionSavepointCell) {
    // if (cell.isReleased) {
    //   return ();
    // } else {
    return (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0ZM11 6C11 7.65685 9.65685 9 8 9C6.34315 9 5 7.65685 5 6C5 4.34315 6.34315 3 8 3C9.65685 3 11 4.34315 11 6ZM8 10C8.55228 10 9 10.4477 9 11V13C9 13.5523 8.55229 14 8 14C7.44772 14 7 13.5523 7 13V11C7 10.4477 7.44772 10 8 10Z"
        fill="currentColor"
      />
    );
    // }
  }
  switch (cell.type) {
    case TransactionStatementType.startTransaction:
      return (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0ZM5.00027 12C5.00027 12.5523 5.44799 13 6.00027 13C6.55256 13 7.00027 12.5523 7.00027 12V9.47703L10.6078 10.9201C10.6724 10.9476 10.7404 10.9686 10.8111 10.9821C11.076 11.0335 11.3453 10.9739 11.5609 10.8282C11.7763 10.6821 11.9316 10.4542 11.9824 10.1892C11.9961 10.1185 12.0019 10.0475 12.0003 9.97732V6.01853C12.002 5.93005 11.9919 5.8432 11.9712 5.75981C11.9351 5.61312 11.8665 5.47918 11.7736 5.36599C11.6809 5.2527 11.563 5.15922 11.4262 5.09499C11.3485 5.05836 11.2653 5.03143 11.1782 5.01579L7.00027 4.1802V4C7.00027 3.44771 6.55256 3 6.00027 3C5.44799 3 5.00006 3.44771 5.00006 4L5.00027 12Z"
          fill="currentColor"
        />
      );
    case TransactionStatementType.rollback:
    case TransactionStatementType.rollbackTo:
    case TransactionStatementType.releaseSavepoint:
      return (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0ZM11.7071 4.29289C12.0976 4.68342 12.0976 5.31658 11.7071 5.70711L9.41437 7.99985L11.7074 10.2929C12.0979 10.6834 12.0979 11.3166 11.7074 11.7071C11.3169 12.0976 10.6837 12.0976 10.2932 11.7071L8.00015 9.41406L5.70711 11.7071C5.31658 12.0976 4.68342 12.0976 4.29289 11.7071C3.90237 11.3166 3.90237 10.6834 4.29289 10.2929L6.58594 7.99985L4.2932 5.70711C3.90267 5.31658 3.90267 4.68342 4.2932 4.29289C4.68372 3.90237 5.31688 3.90237 5.70741 4.29289L8.00015 6.58564L10.2929 4.29289C10.6834 3.90237 11.3166 3.90237 11.7071 4.29289Z"
          fill="currentColor"
        />
      );
    case TransactionStatementType.commit:
      return (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0ZM12.7072 5.29289C13.0977 5.68342 13.0977 6.31658 12.7072 6.70711L7.7072 11.7071C7.31667 12.0976 6.68351 12.0976 6.29298 11.7071L3.29298 8.70711C2.90246 8.31658 2.90246 7.68342 3.29298 7.29289C3.68351 6.90237 4.31667 6.90237 4.7072 7.29289L7.00009 9.58579L11.293 5.29289C11.6835 4.90237 12.3167 4.90237 12.7072 5.29289Z"
          fill="currentColor"
        />
      );
  }
  return null;
}

const cellTransactionClasses: {
  [key in TransactionState]?: string;
} = {
  [TransactionState.Active]: styles.transactionActive,
  [TransactionState.Committed]: styles.transactionCommitted,
  [TransactionState.InError]: styles.transactionInError,
  [TransactionState.Rolledback]: styles.transactionRolledback,
};

interface ReplHistoryCellProps {
  cell: ReplHistoryCellState;
}

export default observer(function ReplHistoryCell({
  cell,
}: ReplHistoryCellProps) {
  const transaction = cell.transaction?.current;

  const isTransactionCell =
    cell instanceof ReplTransactionCell ||
    cell instanceof ReplTransactionSavepointCell;
  const cellExpanded = cell instanceof ReplExpandableCell && cell.expanded;

  const inScriptBlock = (cell.scriptBlock?.cells.length ?? 0) > 1;

  return (
    <div
      className={cn(
        styles.historyBlock,
        transaction ? cellTransactionClasses[transaction.state] : null,
        isTransactionCell
          ? styles[
              `transactionCell-${
                (cell as ReplTransactionCell | ReplTransactionSavepointCell)
                  .type
              }`
            ]
          : null,
        {
          [styles.insideScriptBlock]: inScriptBlock,
          [styles.scriptBlockFirst]:
            inScriptBlock && cell.isFirstInScriptBlock,
          [styles.scriptBlockLast]: inScriptBlock && cell.isLastInScriptBlock,

          [styles.expanded]: cellExpanded,

          [styles.transactionCellRolledback]:
            !!transaction && cell.status === ReplHistoryCellStatus.rolledback,
          [styles.transactionSavepointRolledback]:
            cell instanceof ReplTransactionSavepointCell &&
            (cell.beforeStatus === ReplHistoryCellStatus.rolledback ||
              cell.isReleased),
        }
      )}
    >
      {transaction ? (
        <div className={cn(styles.transactionIndicator)}>
          {!(cell instanceof ReplTransactionCell) ||
          (cell.type !== TransactionStatementType.commit &&
            cell.type !== TransactionStatementType.rollback) ? (
            <div className={styles.transactionLine} />
          ) : null}

          {isTransactionCell ? (
            <>
              <svg className={styles.transactionMarker} viewBox="-2 -2 20 20">
                <MarkerIcon
                  cell={
                    cell as ReplTransactionCell | ReplTransactionSavepointCell
                  }
                />
              </svg>
              {!(
                cell instanceof ReplTransactionCell &&
                cell.type === TransactionStatementType.startTransaction
              ) ? (
                <div
                  className={cn(styles.transactionLine, {
                    [styles.transactionLineActive]:
                      cell instanceof ReplTransactionSavepointCell &&
                      cell.beforeStatus === ReplHistoryCellStatus.active,
                    [styles.transactionLineError]:
                      cell instanceof ReplTransactionCell &&
                      cell.type === TransactionStatementType.rollbackTo,
                  })}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      <div className={styles.blockBody}>
        {inScriptBlock && cell.isLastInScriptBlock ? (
          <div className={styles.scriptBlockHeader}>
            <div className={styles.scriptBlockLabel}>Script</div>
            <button
              className={styles.smallButton}
              onClick={() => cell.scriptBlock!.edit()}
            >
              Edit
            </button>
            <button
              className={styles.smallButton}
              onClick={() => cell.scriptBlock!.copyToClipboard()}
            >
              Copy
            </button>
          </div>
        ) : null}
        <div
          className={cn(styles.cell, {
            [styles.transactionCell]: isTransactionCell,
          })}
        >
          {cell instanceof ReplExpandableCell ? (
            <div
              className={styles.collapse}
              onClick={() => cell.toggleExpanded()}
            >
              <ChevronIcon className={styles.collapseIcon} />
            </div>
          ) : null}
          <div className={styles.inputBlock}>
            <ReplCellHeader
              cell={cell}
              expanded={cellExpanded}
              inject={
                cell instanceof ReplTransactionSavepointCell &&
                cell.isReleased ? (
                  <div className={styles.savepointReleasedLabel}>Released</div>
                ) : null
              }
            />
          </div>
          {cellExpanded ? (
            <div className={styles.outputBlock}>
              <div className={styles.header}>
                <div className={styles.blockLabel}>
                  {cell instanceof ReplResultCell ? "Output" : "Error"}
                </div>
                {cell instanceof ReplErrorCell ? (
                  <div className={styles.queryError}>{cell.error}</div>
                ) : null}
                <div className={styles.info}>
                  <div className={styles.infoLabel}>
                    <ReplQueryDuration duration={cell.duration} />
                  </div>
                </div>
              </div>

              {cell instanceof ReplResultCell ? (
                <Inspector
                  className={styles.inspector}
                  state={cell.inspectorState}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

interface ReplCellHeaderProps {
  cell: ReplHistoryCellState;
  expanded?: boolean;
  inject?: JSX.Element | null;
}

const ReplCellHeader = observer(function _ReplCellHeader({
  cell,
  expanded,
  inject,
}: ReplCellHeaderProps) {
  const date = new Date(cell.timestamp);

  const time = currentDate.isToday(date)
    ? date.toLocaleTimeString()
    : date.toLocaleString();

  return (
    <>
      <div className={styles.header}>
        <div className={styles.blockLabel}>Input</div>
        {!expanded ? (
          <div className={cn(styles.code, styles.collapsedQuery)}>
            {cell.query}
          </div>
        ) : null}

        <div className={styles.info}>
          {inject}

          {expanded ? (
            <>
              <button
                className={styles.smallButton}
                onClick={() => cell.edit()}
              >
                Edit
              </button>
              <button
                className={styles.smallButton}
                onClick={() => cell.copyToClipboard()}
              >
                Copy
              </button>
            </>
          ) : null}

          <div className={styles.infoLabel}>{time}</div>
        </div>
      </div>
      {expanded ? (
        <CodeBlock
          className={cn(styles.code, styles.query)}
          code={cell.query}
        />
      ) : null}
    </>
  );
});

interface ReplQueryDurationProps {
  duration: number | QueryDuration;
}

function ReplQueryDuration({duration}: ReplQueryDurationProps) {
  const totalDuration =
    typeof duration === "number"
      ? duration
      : duration.prepare + duration.execute;

  return (
    <div className={styles.queryDuration}>
      {formatDuration(totalDuration)}
      {typeof duration !== "number" ? (
        <div className={styles.queryDurationTooltip}>
          <span>Prepare</span>
          {formatDuration(duration.prepare)}
          <br />
          <span>Execute</span>
          {formatDuration(duration.execute)}
        </div>
      ) : null}
    </div>
  );
}

interface ReplTransactionStatusProps {
  transaction: Transaction;
}

export const ReplTransactionStatus = observer(function _ReplTransactionStatus({
  transaction,
}: ReplTransactionStatusProps) {
  const inError = transaction.state === TransactionState.InError;
  const statusLabel = inError ? "Transaction In Error" : "In Transaction";

  return (
    <div
      className={cn(
        styles.historyBlock,
        styles.transactionStatus,
        inError ? styles.transactionInError : styles.transactionActive
      )}
    >
      <div className={cn(styles.transactionIndicator)}>
        <svg className={styles.transactionMarker} viewBox="-2 -2 20 20">
          <circle cx="8" cy="8" r="7" />
        </svg>
        <div className={styles.transactionLine} />
      </div>
      <div className={styles.transactionStatusMessage}>
        <div className={styles.statusLabel}>{statusLabel}</div>
        {inError ? (
          <div className={styles.statusMessage}>
            commands ignored until end of transaction block
          </div>
        ) : null}
      </div>
    </div>
  );
});
