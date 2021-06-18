import {lexEdgeQL, Token, TokenKind} from "@edgedb/lexer";

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

  let tokens: Token[];
  try {
    tokens = await lexEdgeQL(query);
  } catch {
    // If lexing fails return entire query and let server sort it out
    return [
      {
        displayExpression: query,
        expression: query,
        params: [],
      },
    ];
  }

  let tokenIndex = 0;

  function nextTokenIsEndOfStatement(index: number = tokenIndex): boolean {
    const nextToken = tokens[index];
    return !nextToken || nextToken.kind === TokenKind.Semicolon;
  }

  while (true) {
    const token = tokens[tokenIndex++];
    if (!token) break;

    let transactionType: TransactionStatementType;
    let savepointName: string;

    if (token.kind === TokenKind.Semicolon) {
      continue; // skip extra semicolons
    }
    if (token.kind === TokenKind.Keyword) {
      const nextToken = tokens[tokenIndex] as Token | undefined;
      switch (token.value.toLowerCase()) {
        case "commit":
          if (nextTokenIsEndOfStatement()) {
            transactionType = TransactionStatementType.commit;
          }
          break;
        case "start":
          if (
            nextToken?.value.toLowerCase() === "transaction" &&
            nextTokenIsEndOfStatement(tokenIndex + 1)
          ) {
            transactionType = TransactionStatementType.startTransaction;
          }
          break;
        case "rollback":
          if (nextTokenIsEndOfStatement()) {
            transactionType = TransactionStatementType.rollback;
          } else {
            const savepoint = tokens[tokenIndex + 2];
            if (
              nextToken?.value.toLowerCase() === "to" &&
              tokens[tokenIndex + 1]?.value.toLowerCase() === "savepoint" &&
              validSavepointName(savepoint) &&
              nextTokenIsEndOfStatement(tokenIndex + 3)
            ) {
              transactionType = TransactionStatementType.rollbackTo;
              savepointName = savepoint.value;
            }
          }
          break;
        case "declare":
        case "release": {
          const savepoint = tokens[tokenIndex + 1];
          if (
            nextToken?.value.toLowerCase() === "savepoint" &&
            validSavepointName(savepoint) &&
            nextTokenIsEndOfStatement(tokenIndex + 2)
          ) {
            transactionType =
              token.value.toLowerCase() === "declare"
                ? TransactionStatementType.savepoint
                : TransactionStatementType.releaseSavepoint;
            savepointName = savepoint.value;
          }
          break;
        }
      }
    }

    const params: Token[] = [];
    let openBraces = 0;
    let nextToken = tokens[tokenIndex++];
    while (nextToken) {
      if (nextToken.kind === TokenKind.Argument) {
        params.push(nextToken);
      }
      if (nextToken.kind === TokenKind.OpenBrace) {
        openBraces += 1;
      }
      if (nextToken.kind === TokenKind.CloseBrace) {
        openBraces -= 1;
      }
      if (nextToken.kind === TokenKind.Semicolon && openBraces === 0) {
        break;
      }
      nextToken = tokens[tokenIndex++];
    }

    const displayExpression = query
      .slice(token.position.offset, nextToken?.position.offset)
      .trim();

    let expression = displayExpression;

    // rewrite positional params to named params to fix queries where params
    // get split across multiple statements
    // eg. second statement becomes invalid after splitting:
    // select <str>$0; select <str>$1;
    if (params.length) {
      let offset = token.position.offset;
      expression = "";

      for (const paramToken of params) {
        const isPositional = /^\$\d+$/.test(paramToken.value);
        expression +=
          query.slice(offset, paramToken.position.offset) +
          (isPositional ? `$p${paramToken.value.slice(1)}` : paramToken.value);
        offset =
          paramToken.position.offset +
          paramToken.value.length +
          (isPositional ? 1 : 0);
      }

      expression += query.slice(offset, nextToken?.position.offset);
    }

    if (expression) {
      statements.push({
        displayExpression,
        expression,
        params: params.map((token) => token.value.slice(1)),
        transactionType: transactionType!,
        savepointName: savepointName!,
      });
    }
  }

  return statements;
}

function validSavepointName(token?: Token): boolean {
  return !!token && token.kind === TokenKind.Ident;
}
