import {SchemaObjectType, SchemaScalarType} from "@edgedb/common/schemaData";
import {Repl, ReplHistoryItem} from ".";
import {dbCtx} from "../../../state";
import {instanceCtx} from "../../../state/instance";

export enum CommandOutputKind {
  error,
  help,
  none,
  text,
  table,
}

export type CommandResult =
  | {
      kind: CommandOutputKind.none | CommandOutputKind.help;
    }
  | {
      kind: CommandOutputKind.error;
      msg: string;
    }
  | {
      kind: CommandOutputKind.text;
      content: string;
    }
  | {
      kind: CommandOutputKind.table;
      content: string[][];
    };

export async function handleSlashCommand(
  query: string,
  repl: Repl,
  item: ReplHistoryItem
) {
  const [command, ...args] = query.slice(1).split(" ");

  switch (command) {
    case "h":
    case "help":
    case "?":
      item.setCommandResult({kind: CommandOutputKind.help});
      break;
    case "l":
    case "ls":
    case "lt":
    case "lr":
    case "lm":
    case "la":
    case "lc":
    case "li":
      await handleListCommand(
        repl,
        item,
        {
          undefined: "databases",
          s: "scalars",
          t: "types",
          r: "roles",
          m: "modules",
          a: "aliases",
          c: "casts",
          i: "indexes",
        }[command[1]]!,
        args
      );
      break;

    case "list":
      await handleListCommand(repl, item, args[0], args.slice(1));
      break;
    case "c":
    case "connect": {
      const dbName = args[0];
      const instanceState = instanceCtx.get(repl)!;
      await instanceState.fetchInstanceInfo();

      if (instanceState.databases!.includes(dbName)) {
        item.setCommandResult({kind: CommandOutputKind.none});
        repl.navigation?.(`${dbName}/repl`);
      } else {
        item.setCommandResult({
          kind: CommandOutputKind.error,
          msg: `database '${dbName}' does not exist`,
        });
      }

      break;
    }
    case "retro": {
      item.setCommandResult({kind: CommandOutputKind.none});
      repl.updateSetting("retroMode", !repl.settings.retroMode);
      break;
    }
    default:
      item.setCommandResult({
        kind: CommandOutputKind.error,
        msg: `unknown backslash command: '${query}'`,
      });
  }
}

async function handleListCommand(
  repl: Repl,
  item: ReplHistoryItem,
  type: string,
  _args: string[]
) {
  const args: string[] = [];
  const _flags = new Set<string>();
  for (const arg of _args) {
    if (arg.startsWith("-")) {
      for (const flag of arg.slice(1).split("")) {
        _flags.add(flag);
      }
    } else {
      args.push(arg);
    }
  }

  function getFlags(wantedFlags: string[]): boolean[] | null {
    const hasFlags = wantedFlags.map((f) => _flags.delete(f));
    if (_flags.size) {
      item.setCommandResult({
        kind: CommandOutputKind.error,
        msg: `unknown flags: ${[..._flags].map((f) => `'-f'`).join(", ")}`,
      });
      return null;
    }
    return hasFlags;
  }

  const instanceState = instanceCtx.get(repl)!;
  const dbState = dbCtx.get(repl)!;

  switch (type) {
    case "databases":
      {
        await instanceState.fetchInstanceInfo();

        item.setCommandResult({
          kind: CommandOutputKind.text,
          content: `List of databases:\n${instanceState
            .databases!.map((name) => `  ${name}`)
            .join("\n")}`,
        });
      }
      break;
    case "scalars":
    case "types": {
      const flags = getFlags(["s", "I"]);
      if (flags) {
        const [system, caseInsensitive] = flags;
        const pattern = args[0];

        await dbState.fetchSchemaData();

        let types = dbState.schemaData
          ? [
              ...(type === "scalars"
                ? dbState.schemaData.scalars.values()
                : dbState.schemaData.objects.values()),
            ].filter((type) => type.builtin === system)
          : [];
        if (pattern) {
          const regex = new RegExp(pattern, caseInsensitive ? "i" : undefined);
          types = types.filter((type) => regex.test(type.name));
        }
        types.sort((a, b) => a.name.localeCompare(b.name));
        if (types.length === 0) {
          item.setCommandResult({
            kind: CommandOutputKind.text,
            content: pattern
              ? `No ${
                  type === "scalars" ? "scalar" : "object"
                } types found matching '${args[0]}'`
              : `No ${system ? "system" : "user-defined"} ${
                  type === "scalars" ? "scalar" : "object"
                } types found`,
          });
        } else {
          if (type === "scalars") {
            item.setCommandResult({
              kind: CommandOutputKind.table,
              content: [
                ["Name", "Extending", "Kind"],
                ...(types as SchemaScalarType[]).map((type) => [
                  type.name,
                  type.bases.map((b) => b.name).join(", "),
                  type.enum_values ? "enum" : "normal",
                ]),
              ],
            });
          } else {
            item.setCommandResult({
              kind: CommandOutputKind.table,
              content: [
                ["Name", "Extending"],
                ...(types as SchemaObjectType[]).map((type) => [
                  type.name,
                  type.ancestors.map((b) => b.name).join(", "),
                ]),
              ],
            });
          }
        }
      }
      break;
    }
    case "roles":
    case "modules": {
      const flags = getFlags(["I"]);
      if (flags) {
        const [caseInsensitive] = flags;
        const pattern = args[0];

        let names = (
          await dbState.connection.query(
            `select names := ${
              type === "roles" ? "sys::Role.name" : "schema::Module.name"
            } order by names`
          )
        ).result as string[];

        if (pattern) {
          const regex = new RegExp(pattern, caseInsensitive ? "i" : undefined);
          names = names.filter((name) => regex.test(name));
        }

        if (names.length === 0) {
          item.setCommandResult({
            kind: CommandOutputKind.text,
            content: `No ${type} found matching '${args[0]}'`,
          });
        } else {
          item.setCommandResult({
            kind: CommandOutputKind.text,
            content: `List of ${type}:\n${names
              .map((name) => `  ${name}`)
              .join("\n")}`,
          });
        }
      }
      break;
    }
    case "casts": {
      const flags = getFlags(["I"]);
      if (flags) {
        const [caseInsensitive] = flags;
        const pattern = args[0];

        let casts = (
          await dbState.connection.query(
            `select schema::Cast {
              from_type_name := .from_type.name,
              to_type_name := .to_type.name,
              kind := (
                'implicit' if .allow_implicit else
                'assignment' if .allow_assignment else
                'regular'
              ),
              volatility,
            }
            order by .kind then .from_type.name then .to_type.name`
          )
        ).result as {
          from_type_name: string;
          to_type_name: string;
          kind: string;
          volatility: string;
        }[];

        if (pattern) {
          const regex = new RegExp(pattern, caseInsensitive ? "i" : undefined);
          casts = casts.filter(
            (cast) =>
              regex.test(cast.from_type_name) || regex.test(cast.to_type_name)
          );
        }

        if (casts.length === 0) {
          item.setCommandResult({
            kind: CommandOutputKind.text,
            content: `No casts found matching '${args[0]}'`,
          });
        } else {
          item.setCommandResult({
            kind: CommandOutputKind.table,
            content: [
              ["From Type", "To Type", "Kind", "Volatility"],
              ...casts.map((cast) => [
                cast.from_type_name,
                cast.to_type_name,
                cast.kind,
                cast.volatility,
              ]),
            ],
          });
        }
      }
      break;
    }
    case "aliases": {
      const flags = getFlags(["s", "I", "v"]);
      if (flags) {
        const [system, caseInsensitive, verbose] = flags;
        const pattern = args[0];

        let aliases = dbState.schemaData
          ? [...dbState.schemaData?.aliases.values()].filter(
              (type) => type.builtin === system
            )
          : [];

        if (pattern) {
          const regex = new RegExp(pattern, caseInsensitive ? "i" : undefined);
          aliases = aliases.filter((alias) => regex.test(alias.name));
        }
        aliases.sort((a, b) => a.name.localeCompare(b.name));
        if (aliases.length === 0) {
          item.setCommandResult({
            kind: CommandOutputKind.text,
            content: pattern
              ? `No aliases found matching '${args[0]}'`
              : `No ${system ? "system" : "user-defined"} aliases found`,
          });
        } else {
          item.setCommandResult({
            kind: CommandOutputKind.table,
            content: verbose
              ? [
                  ["Name", "Class", "Expression"],
                  ...aliases.map((alias) => [
                    alias.name,
                    alias.type.schemaType,
                    alias.expr,
                  ]),
                ]
              : [
                  ["Name", "Class"],
                  ...aliases.map((alias) => [
                    alias.name,
                    alias.type.schemaType,
                  ]),
                ],
          });
        }
      }
      break;
    }
    case "indexes": {
      const flags = getFlags(["s", "I"]); // TODO: add verbose
      if (flags) {
        const [system, caseInsensitive] = flags;
        const pattern = args[0];

        let indexes = dbState.schemaData
          ? [...dbState.schemaData?.objects.values()]
              .flatMap((type) => [type, ...Object.values(type.links)])
              .filter((type) => type.builtin === system)
              .flatMap((source) =>
                source.indexes.map((index) => ({
                  name:
                    source.schemaType === "Pointer"
                      ? `${source.source!.name}.${source.name}`
                      : source.name,
                  expr: index.expr,
                }))
              )
          : [];

        if (pattern) {
          const regex = new RegExp(pattern, caseInsensitive ? "i" : undefined);
          indexes = indexes.filter((index) => regex.test(index.name));
        }
        indexes.sort((a, b) => a.name.localeCompare(b.name));
        if (indexes.length === 0) {
          item.setCommandResult({
            kind: CommandOutputKind.text,
            content: pattern
              ? `No indexes found matching '${args[0]}'`
              : `No explicit indexes found`,
          });
        } else {
          item.setCommandResult({
            kind: CommandOutputKind.table,
            content: [
              ["Index On", "Subject"],
              ...indexes.map((index) => [index.expr, index.name]),
            ],
          });
        }
      }
      break;
    }
    default:
      item.setCommandResult({
        kind: CommandOutputKind.error,
        msg: `unknown list command: '\\list ${type}'`,
      });
  }
}
