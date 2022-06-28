import {observer} from "mobx-react-lite";
import Fuse from "fuse.js";

import cn from "@edgedb/common/utils/classNames";
import {
  SchemaConstraint,
  SchemaFunction,
  SchemaParam,
} from "@edgedb/common/schemaData";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import {
  Arrow,
  Copyable,
  CopyButton,
  CopyHighlight,
  highlightString,
  ItemHeader,
  Keyword,
  Punc,
  Str,
  TypeLink,
  TypeName,
} from "./utils";

import styles from "../textView.module.scss";
import {AnnotationRenderer, annotationToSDL} from "./annotation";
import {paramToSDL} from "@edgedb/common/schemaData/utils";
import {Fragment} from "react";

export function SchemaParamRenderer({
  param,
  parentModule,
}: {
  param: SchemaParam;
  parentModule: string;
}) {
  return (
    <>
      {param.kind !== "PositionalParam" ? (
        <Keyword>
          {param.kind === "NamedOnlyParam" ? "named only " : "variadic "}
        </Keyword>
      ) : null}
      {param.name}:{" "}
      {param.typemod !== "SingletonType" ? (
        <Keyword>
          {param.typemod === "SetOfType" ? "set of " : "optional "}
        </Keyword>
      ) : null}
      <TypeLink type={param.type} parentModule={parentModule} />
      {param.default ? ` = ${param.default}` : null}
    </>
  );
}

export const FunctionTypeRenderer = observer(function FunctionTypeRenderer({
  type,
  matches,
}: {
  type: SchemaFunction;
  matches: Fuse.FuseResultMatch[];
}) {
  const hasBody = type.volatility !== "Volatile" || type.annotations?.length;

  const funcBody = (
    <>
      <Keyword>using</Keyword>{" "}
      {type.language === "builtin" ? (
        <>
          <Punc>{"("}</Punc>
          <span className={styles.builtinFunc}>builtin function</span>
          <Punc>{")"}</Punc>
        </>
      ) : type.language === "EdgeQL" ? (
        <>
          <Punc>{"("}</Punc>
          <CodeBlock code={type.body ?? ""} inline />
          <Punc>{")"}</Punc>
        </>
      ) : (
        <>
          {type.language} <Str>{type.body}</Str>
        </>
      )}
      <Punc>{";"}</Punc>
    </>
  );

  return (
    <Copyable>
      <div className={styles.typeItem}>
        <ItemHeader
          actions={<CopyButton getSDL={() => functionToSDL(type)} />}
        >
          <CopyHighlight>
            <Keyword>function</Keyword>{" "}
            <TypeName type={type} matches={matches} />(
            {type.wrapParams ? <br /> : null}
            {type.params.map((param, i) => (
              <Fragment key={i}>
                {i !== 0 ? (
                  type.wrapParams ? (
                    <>
                      ,<br />
                    </>
                  ) : (
                    ", "
                  )
                ) : null}
                {type.wrapParams ? "\u00a0\u00a0" : null}
                <SchemaParamRenderer
                  param={param}
                  parentModule={type.module}
                />
              </Fragment>
            ))}
            {type.wrapParams ? <br /> : null}
            ) <Arrow />{" "}
            {type.returnTypemod !== "SingletonType" ? (
              <Keyword>
                {type.returnTypemod === "SetOfType" ? "set of " : "optional "}
              </Keyword>
            ) : null}
            <TypeLink type={type.returnType} parentModule={type.module} />
            {hasBody ? (
              <Punc>{" {"}</Punc>
            ) : (
              <>
                <br />
                {funcBody}
              </>
            )}
          </CopyHighlight>
        </ItemHeader>
        {hasBody ? (
          <>
            <div className={styles.indentedBlock}>
              {type.annotations?.map((anno, i) => (
                <AnnotationRenderer key={i} annotation={anno} />
              ))}
              {type.volatility !== "Volatile" ? (
                <div>
                  <CopyHighlight>
                    <Keyword>volatility</Keyword> <Punc>:=</Punc>{" "}
                    <Str>{type.volatility}</Str>
                    <Punc>;</Punc>
                  </CopyHighlight>
                </div>
              ) : null}
              <div>
                <CopyHighlight>{funcBody}</CopyHighlight>
              </div>
            </div>
            <div>
              <CopyHighlight>
                <Punc>{"};"}</Punc>
              </CopyHighlight>
            </div>
          </>
        ) : (
          <div></div>
        )}
      </div>
    </Copyable>
  );
});

export function functionToSDL(type: SchemaFunction) {
  const hasBody = type.volatility !== "Volatile" || type.annotations?.length;
  const funcBody = `using ${
    type.language === "builtin"
      ? "(builtin function)"
      : type.language === "EdgeQL"
      ? `(${type.body})`
      : `${type.language} '${type.body}'`
  };`;

  return `function ${type.name}(${
    type.wrapParams
      ? `\n${type.params
          .map((param) => "  " + paramToSDL(param))
          .join(",\n")}\n`
      : type.params.map(paramToSDL).join(", ")
  }) -> ${
    type.returnTypemod !== "SingletonType"
      ? type.returnTypemod === "SetOfType"
        ? "set of "
        : "optional "
      : ""
  }${type.returnType.name}${
    hasBody
      ? ` {\n${
          type.annotations.length
            ? type.annotations
                .map((anno) => "  " + annotationToSDL(anno) + "\n")
                .join("")
            : ""
        }${
          type.volatility !== "Volatile"
            ? `  volatility := '${type.volatility}';\n`
            : ""
        }  ${funcBody}\n}`
      : `\n${funcBody}`
  }`;
}
