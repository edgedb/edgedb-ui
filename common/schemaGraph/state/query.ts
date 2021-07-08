export const schemaQuery = `
WITH MODULE schema,
  module_names := (SELECT schema::Module FILTER NOT .builtin).name
SELECT ObjectType {
  name,
  is_abstract,
  expr,
  inherits_from := (
    SELECT .bases
    FILTER .name != 'std::Object'
    ORDER BY @index
  ).name,
  inherited_by := .<bases[IS ObjectType].name,
  constraints: {
    name,
    params: {
      name,
      @value,
    } FILTER .name != '__subject__'
      ORDER BY .num,
    delegated,
  },
  annotations: {
    name,
    @value
  },
  properties: {
    name,
    targetName := .target.name,
    required,
    expr,
    default,
    constraints: {
      name,
      params: {
        name,
        @value,
      } FILTER .name != '__subject__'
        ORDER BY .num,
      delegated,
    },
    annotations: {
      name,
      @value
    },
  },
  links: {
    name,
    targetNames := (
      WITH target := .target[IS ObjectType]
      SELECT std::array_agg(
        target.name
        IF NOT target.is_compound_type
        ELSE target.union_of.name UNION target.intersection_of.name
      )
    ),
    required,
    expr,
    default,
    constraints: {
      name,
      params: {
        name,
        @value,
      } FILTER .name != '__subject__'
        ORDER BY .num,
      delegated,
    },
    annotations: {
      name,
      @value
    },
    properties: {
      name,
      targetName := .target.name,
      required,
      expr,
      default,
      constraints: {
        name,
        params: {
          name,
          @value,
        } FILTER .name != '__subject__'
          ORDER BY .num,
        delegated,
      },
      annotations: {
        name,
        @value
      },
    } FILTER .name NOT IN {'source', 'target'}
  } FILTER .name != '__type__'
}
FILTER .name LIKE module_names ++ '::%'
   AND NOT .is_compound_type
ORDER BY count(.links) DESC
  THEN .name
`;

export const functionsQuery = `
WITH MODULE schema
SELECT Function {
  id,
  name,
  params: {
    name,
    typeName := .type.name,
    default,
    kind,
    num,
    typemod,
  } ORDER BY .num,
  returnTypeName := .return_type.name,
  returnTypemod := .return_typemod,
  volatility,
  annotations: {
    name,
    @value
  },
}`;

export const constraintsQuery = `
WITH MODULE schema
SELECT Constraint {
  id,
  name,
  params: {
    name,
    typeName := .type.name,
    default,
    kind,
    num,
    typemod,
  } FILTER .name != '__subject__'
    ORDER BY .num,
  annotations: {
    name,
    @value
  },
  expr,
} FILTER .is_abstract`;

export const scalarsQuery = `
WITH MODULE schema
SELECT ScalarType {
  id,
  name,
  extends := (
    SELECT .bases
    ORDER BY @index
  ).name,
  constraints: {
    name,
    params: {
      name,
      @value,
    } FILTER .name != '__subject__'
      ORDER BY .num,
    delegated,
  },
  enum_values,
  annotations: {
    name,
    @value
  },
}`;
