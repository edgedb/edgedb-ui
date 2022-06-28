import {SchemaObjectType, SchemaParam} from ".";

export function resolveObjectTypeUnion(
  type: SchemaObjectType
): SchemaObjectType[] {
  if (type.unionOf) {
    return type.unionOf.flatMap(resolveObjectTypeUnion);
  }
  // todo: handle intersection types?
  return [type];
}

export function paramToSDL(param: SchemaParam) {
  return `${
    param.kind !== "PositionalParam"
      ? param.kind === "NamedOnlyParam"
        ? "named only "
        : "variadic "
      : ""
  }${param.name}: ${
    param.typemod !== "SingletonType"
      ? param.typemod === "SetOfType"
        ? "set of "
        : "optional "
      : ""
  }${param.type.name}${param.default ? ` = ${param.default}` : ""}`;
}
