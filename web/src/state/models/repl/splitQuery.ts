import {Tree} from "@lezer/common";
import {parser} from "@edgedb/lang-edgeql";

import {getNodeText, getAllChildren} from "src/utils/syntaxTree";

export enum TransactionStatementType {
  startTransaction = "startTransaction",
  savepoint = "savepoint",
  releaseSavepoint = "releaseSavepoint",
  commit = "commit",
  rollback = "rollback",
  rollbackTo = "rollbackTo",
}

export type Statement = {
  displayExpression: string;
  expression: string;
  params: string[];
} & (
  | {
      transactionType?:
        | TransactionStatementType.startTransaction
        | TransactionStatementType.commit
        | TransactionStatementType.rollback;
    }
  | {
      transactionType:
        | TransactionStatementType.savepoint
        | TransactionStatementType.releaseSavepoint
        | TransactionStatementType.rollbackTo;
      savepointName: string;
    }
);

export async function splitQuery(query: string): Promise<Statement[]> {
  const statements: Statement[] = [];

  let syntaxTree: Tree;
  try {
    syntaxTree = parser.parse(query);
  } catch {
    // If parsing fails return entire query and let server sort it out
    return [
      {
        displayExpression: query,
        expression: query,
        params: [],
      },
    ];
  }

  const statementNodes = syntaxTree.topNode.getChildren("Statement");

  for (const statementNode of statementNodes) {
    const displayExpression = getNodeText(query, statementNode).trim();

    let expression = displayExpression;

    const params = getAllChildren(statementNode, "QueryParameterName");
    const paramNames: string[] = [];
    // rewrite positional params to named params to fix queries where params
    // get split across multiple statements
    // eg. second statement becomes invalid after splitting:
    // select <str>$0; select <str>$1;
    if (params.length) {
      let offset = statementNode.from;
      expression = "";

      for (const paramNode of params) {
        const paramName = getNodeText(query, paramNode);
        paramNames.push(paramName.slice(1));
        const isPositional = /^\$\d+$/.test(paramName);
        expression +=
          query.slice(offset, paramNode.from) +
          (isPositional ? `p${paramName.slice(1)}` : paramName);
        offset = paramNode.to;
      }

      expression += query.slice(offset, statementNode.to);
    }

    if (expression) {
      statements.push({
        displayExpression,
        expression,
        params: paramNames,
      });
    }
  }

  return statements;
}
