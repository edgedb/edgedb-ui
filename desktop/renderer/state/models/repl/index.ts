import {action, computed, observable} from "mobx";
import {
  model,
  Model,
  ExtendedModel,
  prop,
  modelAction,
  rootRef,
  Ref,
  modelFlow,
  _async,
  _await,
  findParent,
  ModelCreationData,
  getRefsResolvingTo,
  Frozen,
  frozen,
} from "mobx-keystone";

import {InspectorState, resultGetterCtx} from "@edgedb/inspector/v2/state";

import {
  storeReplResult,
  fetchReplResult,
  removeReplResults,
} from "../../../idbStore";

import {QueryDuration} from "../../../../shared/interfaces/connections";

import {EdgeDBSet, decode} from "../../../utils/decodeRawBuffer";

import {splitQuery, Statement, TransactionStatementType} from "./splitQuery";

import {tabCtx} from "..";
import {Transaction, TransactionState} from "../connection";
import {SplitViewState} from "../splitView";
import {
  filterParamsData,
  ParamsData,
  ReplQueryParamsEditor,
} from "./parameters";

export {TransactionStatementType};

export enum ReplHistoryCellStatus {
  active,
  rolledback,
}

@model("Repl/HistoryCell")
export class ReplHistoryCell extends Model({
  query: prop<string>(),
  timestamp: prop<number>(),
  duration: prop<number | QueryDuration>(),
  transaction: prop<Ref<Transaction> | null>(null),
  status: prop<ReplHistoryCellStatus>(ReplHistoryCellStatus.active),
  renderHeight: prop<number>(64).withSetter(),
}) {
  edit() {
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;
    repl.setCurrentQuery(this.query);

    repl.queryParamsEditor.restoreParamsData(
      this.scriptBlock?.paramsData?.data
    );
  }

  copyToClipboard() {
    navigator.clipboard?.writeText(this.query);
  }

  @computed
  get scriptBlock() {
    const ref = getRefsResolvingTo(this, scriptBlockCellRef).values().next()
      .value as Ref<ReplHistoryCell> | undefined;
    return (
      ref &&
      findParent<ReplHistoryScriptBlock>(
        ref,
        (parent) => parent instanceof ReplHistoryScriptBlock
      )
    );
  }

  @computed
  get isFirstInScriptBlock() {
    if (this.scriptBlock) {
      return this.scriptBlock.cells[0]?.current === this;
    }
    return false;
  }

  @computed
  get isLastInScriptBlock() {
    if (this.scriptBlock) {
      const cells = this.scriptBlock.cells;
      return cells[cells.length - 1].current === this;
    }
    return false;
  }
}

@model("Repl/ExpandableCell")
export class ReplExpandableCell extends ExtendedModel(ReplHistoryCell, {
  expanded: prop(false),
}) {
  @modelAction
  toggleExpanded() {
    this.expanded = !this.expanded;
  }
}

@model("Repl/ResultCell")
export class ReplResultCell extends ExtendedModel(ReplExpandableCell, {
  inspectorState: prop<InspectorState>(),
}) {
  @observable.ref
  _result: EdgeDBSet | null = null;

  @action
  setResult(result: EdgeDBSet) {
    this._result = result;
  }

  onInit() {
    resultGetterCtx.set(this, async () => {
      if (this._result) {
        return {data: this._result, codec: this._result._codec};
      }

      const result = await fetchReplResult(this.$modelId);
      const decodedResult =
        result && decode(result.outCodecBuf, result.resultBuf);
      if (decodedResult) {
        return {data: decodedResult, codec: decodedResult._codec};
      }
    });
  }
}

@model("Repl/ErrorCell")
export class ReplErrorCell extends ExtendedModel(ReplExpandableCell, {
  error: prop<string>(),
}) {}

@model("Repl/TransactionCell")
export class ReplTransactionCell extends ExtendedModel(ReplHistoryCell, {
  type: prop<
    Exclude<TransactionStatementType, TransactionStatementType.savepoint>
  >(),
}) {}

@model("Repl/TransactionSavepointCell")
export class ReplTransactionSavepointCell extends ExtendedModel(
  ReplHistoryCell,
  {
    type: prop<TransactionStatementType.savepoint>(
      TransactionStatementType.savepoint
    ),
    savepointName: prop<string>(),
    isReleased: prop<boolean>(false),
    beforeStatus: prop<ReplHistoryCellStatus>(ReplHistoryCellStatus.active),
  }
) {}

const transactionRef = rootRef<Transaction>("Repl/TransactionRef");

const scriptBlockCellRef = rootRef<ReplHistoryCell>("Repl/ScriptBlockCellRef");

@model("Repl/HistoryScriptBlock")
export class ReplHistoryScriptBlock extends Model({
  query: prop<string>(),
  paramsData: prop<Frozen<ParamsData> | null>(null),
  cells: prop<Ref<ReplHistoryCell>[]>(() => []),
}) {
  edit() {
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;
    repl.setCurrentQuery(this.query);
    repl.queryParamsEditor.restoreParamsData(this.paramsData?.data);
  }

  copyToClipboard() {
    navigator.clipboard?.writeText(this.query);
  }
}

@model("Repl")
export class Repl extends Model({
  currentQuery: prop("").withSetter(),
  queryParamsEditor: prop(() => new ReplQueryParamsEditor({})),

  queryHistory: prop<ReplHistoryCell[]>(() => []),
  transactionHistory: prop<Transaction[]>(() => []),
  scriptBlocks: prop<ReplHistoryScriptBlock[]>(() => []),

  splitView: prop(() => new SplitViewState({})),

  historyScrollPos: prop<number>(0).withSetter(),
}) {
  @observable queryRunning = false;

  @observable
  currentTransaction: Transaction | undefined = undefined;

  @computed
  get canRunQuery() {
    return !!this.currentQuery.trim();
  }

  onAttachedToRootStore() {
    const lastTransaction = this.transactionHistory[
      this.transactionHistory.length - 1
    ];
    if (
      lastTransaction &&
      lastTransaction.state !== TransactionState.Committed &&
      lastTransaction.state !== TransactionState.Rolledback
    ) {
      lastTransaction.setState(TransactionState.Rolledback);
    }

    return () => {
      removeReplResults(this.$modelId);
    };
  }

  @modelAction
  addHistoryCell({
    statement,
    timestamp,
    duration,
    scriptBlock,
    ...data
  }: {
    statement: Statement;
    timestamp: number;
    duration: number | QueryDuration;
    scriptBlock: ReplHistoryScriptBlock | null;
  } & (
    | {
        result: EdgeDBSet | null;
        outCodecBuf: Buffer;
        resultBuf: Buffer;
      }
    | {
        error: string;
      }
  )) {
    const historyCellData: ModelCreationData<ReplHistoryCell> = {
      query: statement.displayExpression,
      timestamp,
      duration,
      transaction: this.currentTransaction
        ? transactionRef(this.currentTransaction)
        : undefined,
    };

    let historyCell: ReplHistoryCell;

    if ("error" in data) {
      historyCell = new ReplErrorCell({
        ...historyCellData,
        error: data.error,
        expanded: true,
      });
      if (this.currentTransaction) {
        this.currentTransaction.state = TransactionState.InError;
      }
    } else {
      if (statement.transactionType) {
        if (statement.transactionType === TransactionStatementType.savepoint) {
          historyCell = new ReplTransactionSavepointCell({
            ...historyCellData,
            savepointName: statement.savepointName,
          });
        } else {
          switch (statement.transactionType) {
            case TransactionStatementType.startTransaction: {
              const newTransaction = new Transaction({});
              this.transactionHistory.unshift(newTransaction);
              this.currentTransaction = newTransaction;
              historyCellData.transaction = transactionRef(newTransaction);
              break;
            }
            case TransactionStatementType.rollback: {
              if (this.currentTransaction) {
                this.currentTransaction.state = TransactionState.Rolledback;
              }
              this.currentTransaction = undefined;
              break;
            }
            case TransactionStatementType.commit: {
              if (this.currentTransaction) {
                this.currentTransaction.state = TransactionState.Committed;
              }
              this.currentTransaction = undefined;
              break;
            }
            case TransactionStatementType.releaseSavepoint: {
              const historyCell = this.queryHistory.find(
                (cell) =>
                  cell instanceof ReplTransactionSavepointCell &&
                  cell.transaction?.current === this.currentTransaction &&
                  cell.savepointName === statement.savepointName &&
                  cell.isReleased === false
              ) as ReplTransactionSavepointCell | undefined;
              if (historyCell) {
                historyCell.isReleased = true;
              }
              break;
            }
            case TransactionStatementType.rollbackTo: {
              if (this.currentTransaction) {
                this.currentTransaction.state = TransactionState.Active;
                const historyCells = this.queryHistory.filter(
                  (cell) =>
                    cell.transaction?.current === this.currentTransaction
                );
                let foundSavepoint = false;
                for (const cell of historyCells) {
                  if (foundSavepoint) {
                    cell.status = ReplHistoryCellStatus.rolledback;
                    if (cell instanceof ReplTransactionSavepointCell) {
                      cell.beforeStatus = ReplHistoryCellStatus.rolledback;
                    }
                  } else if (
                    cell instanceof ReplTransactionSavepointCell &&
                    cell.savepointName === statement.savepointName &&
                    cell.isReleased === false
                  ) {
                    foundSavepoint = true;
                    cell.status = ReplHistoryCellStatus.rolledback;
                  }
                }
              }
              break;
            }
          }
          historyCell = new ReplTransactionCell({
            ...historyCellData,
            type: statement.transactionType,
          });
        }
      } else {
        historyCell = new ReplResultCell({
          ...historyCellData,
          inspectorState: new InspectorState({}),
          expanded: !!data.result,
        });
        if (data.result) {
          (historyCell as ReplResultCell).setResult(data.result);
          storeReplResult(historyCell.$modelId, {
            replId: this.$modelId,
            outCodecBuf: data.outCodecBuf,
            resultBuf: data.resultBuf,
          });
        }
      }
    }

    this.queryHistory.push(historyCell);
    if (scriptBlock) {
      scriptBlock.cells.push(scriptBlockCellRef(historyCell));
    }
  }

  @modelFlow
  _runStatement = _async(function* (
    this: Repl,
    statement: Statement,
    scriptBlock: ReplHistoryScriptBlock | null = null
  ) {
    const conn = tabCtx.get(this)!.connection;

    const paramsData = scriptBlock?.paramsData?.data;

    const timestamp = Date.now();
    try {
      const {result, duration, outCodecBuf, resultBuf} = yield* _await(
        conn.query(
          statement.expression,
          false,
          paramsData && filterParamsData(paramsData, statement.params)
        )
      );
      this.addHistoryCell({
        statement,
        timestamp,
        duration,
        result,
        outCodecBuf,
        resultBuf,
        scriptBlock,
      });
      return true;
    } catch (e) {
      this.addHistoryCell({
        statement,
        timestamp,
        duration: Date.now() - timestamp,
        error: e.message,
        scriptBlock,
      });
    }
    return false;
  });

  @modelFlow
  runSingleQuery = _async(function* (this: Repl, query: string) {
    this.queryRunning = true;

    const statement = (yield* _await(splitQuery(query)))[0];
    if (statement) {
      yield* _await(this._runStatement(statement));
    }

    this.queryRunning = false;
  });

  @modelFlow
  runQuery = _async(function* (this: Repl) {
    const query = this.currentQuery.trim();
    if (!query) return;

    this.queryRunning = true;
    let error = false;

    const [statements, paramsData] = yield* _await(
      Promise.all([splitQuery(query), this.queryParamsEditor.getParamsData()])
    );

    let scriptBlock: ReplHistoryScriptBlock | null = null;
    if (statements.length > 1 || paramsData !== null) {
      scriptBlock = new ReplHistoryScriptBlock({
        query,
        paramsData: paramsData ? frozen(paramsData) : null,
      });
      this.scriptBlocks.push(scriptBlock);
    }

    for (const statement of statements) {
      const success = yield* _await(
        this._runStatement(statement, scriptBlock)
      );
      if (!success) {
        error = true;
        break;
      }
    }
    if (!error) {
      this.currentQuery = "";
      this.queryParamsEditor.clear();
    }

    this.queryRunning = false;
  });
}
