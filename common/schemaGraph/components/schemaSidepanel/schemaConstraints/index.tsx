import React from "react";
import {observer} from "mobx-react";

import sharedStyles from "../schemaSidepanel.module.scss";
import colourStyles from "../colours.module.scss";

import {useSchemaState} from "../../../state/provider";
import {SchemaAbstractConstraint} from "../../../state";
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

import {Annotation, SearchBar, ShowSource} from "../shared";

function ConstraintCard(
  constraint: SchemaAbstractConstraint,
  filterMatch?: FilterMatches
) {
  let constraintName = markModuleName(constraint.name, ["object"]);

  if (filterMatch?.name)
    constraintName = markString(
      constraintName,
      "filterMatch",
      filterMatch.name
    );

  const params = constraint.params.map<MarkedString>((param, i) => {
    let paramName: MarkedString = [{str: param.name, marks: ["param"]}];

    const match = filterMatch?.["params.name." + i];
    if (match) {
      paramName = markString(paramName, "filterMatch", match);
    }

    return [
      ...(param.kind === "VARIADIC"
        ? [{str: "VARIADIC ", marks: ["typemod"]}]
        : []),
      ...paramName,
      {str: ": "},
      ...getFullTypeExpr(param.typeName, param.typemod),
      ...(param.default ? [{str: " = "}, {str: param.default}] : []),
    ];
  });

  const signature: MarkedString = [
    ...constraintName,
    {str: "("},
    ...(params.length
      ? [
          {str: "\n  "},
          ...joinMarkedStrings(params, [{str: ",\n  "}]),
          {str: "\n"},
        ]
      : []),
    {str: ")"},
  ];

  const body = (
    <>
      {constraint.expr ? <ShowSource source={constraint.expr} /> : null}
      {constraint.annotations.length ? (
        <>
          <div className={sharedStyles.subheading}>Annotations</div>
          {constraint.annotations.map((anno, i) => (
            <Annotation {...anno} key={i} />
          ))}
        </>
      ) : null}
    </>
  );

  return (
    <DetailCard
      key={constraint.id.toString()}
      type="abstract constraint"
      title={markedStringToJSX(signature, colourStyles)}
      body={body}
    />
  );
}

export default observer(function SchemaConstraints() {
  const schemaState = useSchemaState();
  const constraintsState = schemaState.sidepanel.constraints;

  const {items, matches} = constraintsState.filteredItems;

  return (
    <div className={sharedStyles.panel}>
      <SearchBar
        value={constraintsState.filterValue}
        onChange={constraintsState.updateFilterValue}
      />
      <div className={sharedStyles.panelScroll}>
        {items?.map((item) => ConstraintCard(item, matches.get(item)))}
      </div>
    </div>
  );
});
