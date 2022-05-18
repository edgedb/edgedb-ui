import React from "react";
import {observer} from "mobx-react";

import {SchemaScalarType} from "@edgedb/common/schemaData";

import sharedStyles from "../schemaSidepanel.module.scss";
import colourStyles from "../colours.module.scss";

import {useSchemaState} from "../../../state/provider";
import {FilterMatches} from "../../../state/sidepanel";
import {
  markString,
  joinMarkedStrings,
  markedStringToJSX,
  markModuleName,
} from "@edgedb/common/utils/markString";

import DetailCard from "../detailCard";

import {Annotation, SearchBar, Constraint} from "../shared";

function ScalarCard(scalar: SchemaScalarType, filterMatch?: FilterMatches) {
  let scalarName = markModuleName(scalar.name, ["object"]);

  if (filterMatch?.name)
    scalarName = markString(scalarName, "filterMatch", filterMatch.name);

  const extendNames = scalar.bases.length
    ? joinMarkedStrings(
        scalar.bases.map(({name}) => markModuleName(name)),
        [{str: ", "}]
      )
    : null;

  const tags = scalar.enum_values?.length ? ["enum"] : [];

  const body = (
    <>
      {extendNames ? (
        <div className={sharedStyles.extends}>
          extends{" "}
          <span className={sharedStyles.extendsNames}>
            {markedStringToJSX(extendNames, colourStyles)}
          </span>
        </div>
      ) : null}
      {scalar.enum_values?.length ? (
        <>
          <div className={sharedStyles.subheading}>Enum Values</div>
          {scalar.enum_values.join(", ")}
        </>
      ) : null}
      {scalar.constraints.length ? (
        <>
          <div className={sharedStyles.subheading}>Constraints</div>
          {scalar.constraints.map((constraint, i) => (
            <Constraint {...constraint} key={i} />
          ))}
        </>
      ) : null}
      {scalar.annotations.length ? (
        <>
          <div className={sharedStyles.subheading}>Annotations</div>
          {scalar.annotations.map((anno, i) => (
            <Annotation {...anno} key={i} />
          ))}
        </>
      ) : null}
    </>
  );

  return (
    <DetailCard
      key={scalar.id.toString()}
      type="scalar type"
      title={markedStringToJSX(scalarName, colourStyles)}
      tags={tags}
      body={body}
    />
  );
}

export default observer(function SchemaScalars() {
  const schemaState = useSchemaState();
  const scalarsState = schemaState.sidepanel.scalars;

  const {items, matches} = scalarsState.filteredItems;

  return (
    <div className={sharedStyles.panel}>
      <SearchBar
        value={scalarsState.filterValue}
        onChange={scalarsState.updateFilterValue}
      />
      <div className={sharedStyles.panelScroll}>
        {items?.map((item) => ScalarCard(item, matches.get(item)))}
      </div>
    </div>
  );
});
