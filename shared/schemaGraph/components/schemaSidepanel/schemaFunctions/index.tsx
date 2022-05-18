import React from "react";
import {observer} from "mobx-react";

import {SchemaFunction} from "@edgedb/common/schemaData";

import sharedStyles from "../schemaSidepanel.module.scss";
import colourStyles from "../colours.module.scss";

import {useSchemaState} from "../../../state/provider";
import {FilterMatches} from "../../../state/sidepanel";
import {
  markString,
  MarkedString,
  joinMarkedStrings,
  markedStringToJSX,
  markModuleName,
  getFullTypeExpr,
} from "@edgedb/common/utils/markString";

import DetailCard from "../detailCard";

import {Annotation, SearchBar} from "../shared";

function FunctionCard(func: SchemaFunction, filterMatch?: FilterMatches) {
  let funcName = markModuleName(func.name, ["object"]);

  if (filterMatch?.name)
    funcName = markString(funcName, "filterMatch", filterMatch.name);

  const params = func.params.map<MarkedString>((param, i) => {
    let paramName: MarkedString = [{str: param.name, marks: ["param"]}];

    const match = filterMatch?.["params.name." + i];
    if (match) {
      paramName = markString(paramName, "filterMatch", match);
    }

    return [
      ...paramName,
      {str: ": "},
      ...getFullTypeExpr(param.type.name, param.typemod),
      ...(param.default ? [{str: " = "}, {str: param.default}] : []),
    ];
  });

  const signature: MarkedString = [
    ...funcName,
    {str: "("},
    ...(params.length
      ? [
          {str: "\n  "},
          ...joinMarkedStrings(params, [{str: ",\n  "}]),
          {str: "\n"},
        ]
      : []),
    {str: ")"},
    {str: " -> ", marks: ["operator"]},
    ...getFullTypeExpr(func.returnType.name, func.returnTypemod),
  ];

  const tags = [func.volatility];

  const body = (
    <>
      {func.annotations.length ? (
        <>
          <div className={sharedStyles.subheading}>Annotations</div>
          {func.annotations.map((anno, i) => (
            <Annotation {...anno} key={i} />
          ))}
        </>
      ) : null}
    </>
  );

  return (
    <DetailCard
      key={func.id.toString()}
      type="function"
      title={markedStringToJSX(signature, colourStyles)}
      tags={tags}
      body={body}
    />
  );
}

export default observer(function SchemaFunctions() {
  const schemaState = useSchemaState();
  const functionsState = schemaState.sidepanel.functions;

  const {items, matches} = functionsState.filteredItems;

  return (
    <div className={sharedStyles.panel}>
      <SearchBar
        value={functionsState.filterValue}
        onChange={functionsState.updateFilterValue}
      />
      <div className={sharedStyles.panelScroll}>
        {items?.map((item) => FunctionCard(item, matches.get(item)))}
      </div>
    </div>
  );
});
