import {Tree} from "@lezer/common";
import {parser} from "@edgedb/lang-edgeql";

import {getNodeText, getAllChildren} from "../../../utils/syntaxTree";

import {ParamsData} from "./parameters";

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

export function splitQuery(
  query: string,
  paramsData: ParamsData | null
): Statement[] {
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

    const params = getAllChildren(statementNode, "QueryParameter");
    const paramNames: string[] = [];
    // rewrite positional params to named params to fix queries where params
    // get split across multiple statements
    // eg. second statement becomes invalid after splitting:
    // select <str>$0; select <str>$1;
    if (params.length) {
      let offset = statementNode.from;
      expression = "";

      for (const paramNode of params) {
        const paramNameNode = paramNode.getChild("QueryParameterName");
        if (!paramNameNode) {
          continue;
        }

        let paramName = getNodeText(query, paramNameNode).slice(1);
        paramNames.push(paramName);

        const paramData = paramsData?.[paramName];

        if (!paramData?.type) {
          continue;
        }

        // is positional param
        if (/^\d+$/.test(paramName)) {
          paramName = `__p${paramName}`;
        }

        expression +=
          query.slice(offset, paramNode.from) +
          (paramData.isArray
            ? `<array<${paramData.type}>>`
            : `<${paramData.type}>`) +
          `<${paramData.isOptional ? "optional " : ""}${
            paramData.isArray ? "array<str>" : "str"
          }>$${paramName}`;
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
