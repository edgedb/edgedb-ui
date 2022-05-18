import {SchemaObjectType} from ".";

export function resolveObjectTypeUnion(
  type: SchemaObjectType
): SchemaObjectType[] {
  if (type.unionOf) {
    return type.unionOf.flatMap(resolveObjectTypeUnion);
  }
  // todo: handle intersection types?
  return [type];
}
