import {useMemo} from "react";

import {SchemaObjectType} from "@edgedb/common/schemaData";
import {Select, SelectItem, SelectItems} from "@edgedb/common/ui/select";

export function ObjectTypeSelect({
  className,
  objectTypes,
  selectedObjectType,
  action,
}: {
  className?: string;
  objectTypes: SchemaObjectType[];
  selectedObjectType: SchemaObjectType;
  action: (objectType: SchemaObjectType) => void;
}) {
  const objectSelectItems = useMemo(() => {
    type groupMap = Map<string, {items: SelectItem[]; groups: groupMap}>;
    const groups: groupMap = new Map();
    for (const objectType of objectTypes) {
      let current = {groups: groups} as {
        items: SelectItem[];
        groups: groupMap;
      };
      for (const mod of objectType.module.split("::")) {
        if (!current.groups.has(mod)) {
          current.groups.set(mod, {
            items: [],
            groups: new Map(),
          });
        }
        current = current.groups.get(mod)!;
      }
      current.items.push({
        id: objectType,
        label: objectType.shortName,
        fullLabel: objectType.name,
      });
    }
    const flattenMap = (groups: groupMap): SelectItems["groups"] => {
      return [...groups.entries()].map(([name, group]) => ({
        label: `${name}::`,
        items: group.items,
        groups: group.groups.size ? flattenMap(group.groups) : undefined,
      }));
    };
    return groups.size === 1 && groups.has("default")
      ? groups.get("default")!.items
      : {
          items: [],
          groups: flattenMap(groups),
        };
  }, [objectTypes]);

  return (
    <Select<SchemaObjectType>
      className={className}
      title={
        !Array.isArray(objectSelectItems) ? (
          <>
            <span style={{opacity: 0.65}}>{selectedObjectType.module}::</span>
            {selectedObjectType.shortName}
          </>
        ) : undefined
      }
      items={objectSelectItems}
      selectedItemId={selectedObjectType}
      onChange={(item) => action(item.id)}
      searchable
    />
  );
}
