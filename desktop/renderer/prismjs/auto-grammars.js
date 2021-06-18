const Prism = require("prismjs");

var reserved_keywords = [
  "__source__",
  "__subject__",
  "__type__",
  "alter",
  "analyze",
  "and",
  "anyarray",
  "anytuple",
  "anytype",
  "begin",
  "case",
  "check",
  "commit",
  "configure",
  "create",
  "deallocate",
  "declare",
  "delete",
  "describe",
  "detached",
  "discard",
  "distinct",
  "do",
  "drop",
  "else",
  "empty",
  "end",
  "execute",
  "exists",
  "explain",
  "extending",
  "fetch",
  "filter",
  "for",
  "function",
  "get",
  "global",
  "grant",
  "group",
  "if",
  "ilike",
  "import",
  "in",
  "insert",
  "introspect",
  "is",
  "like",
  "limit",
  "listen",
  "load",
  "lock",
  "match",
  "module",
  "move",
  "not",
  "notify",
  "offset",
  "optional",
  "or",
  "order",
  "over",
  "partition",
  "policy",
  "prepare",
  "raise",
  "refresh",
  "reindex",
  "release",
  "reset",
  "revoke",
  "rollback",
  "select",
  "set",
  "start",
  "typeof",
  "union",
  "update",
  "variadic",
  "when",
  "window",
  "with",
];

var edgeql_keywords = reserved_keywords.concat([
  "abstract",
  "after",
  "alias",
  "all",
  "allow",
  "annotation",
  "as",
  "asc",
  "assignment",
  "before",
  "by",
  "cardinality",
  "cast",
  "config",
  "constraint",
  "database",
  "ddl",
  "default",
  "deferrable",
  "deferred",
  "delegated",
  "desc",
  "explicit",
  "expression",
  "final",
  "first",
  "from",
  "implicit",
  "index",
  "infix",
  "inheritable",
  "into",
  "isolation",
  "last",
  "link",
  "migration",
  "multi",
  "object",
  "of",
  "on",
  "only",
  "operator",
  "overloaded",
  "postfix",
  "prefix",
  "property",
  "read",
  "rename",
  "repeatable",
  "required",
  "restrict",
  "role",
  "savepoint",
  "scalar",
  "schema",
  "sdl",
  "serializable",
  "session",
  "single",
  "source",
  "superuser",
  "system",
  "target",
  "ternary",
  "then",
  "to",
  "transaction",
  "type",
  "using",
  "verbose",
  "view",
  "write",
]);

var types = [
  "Object",
  "anyenum",
  "anyfloat",
  "anyint",
  "anynumeric",
  "anyreal",
  "anyscalar",
  "anytype",
  "array",
  "bigint",
  "bool",
  "bytes",
  "datetime",
  "decimal",
  "duration",
  "float32",
  "float64",
  "int16",
  "int32",
  "int64",
  "json",
  "local_date",
  "local_datetime",
  "local_time",
  "sequence",
  "str",
  "tuple",
  "uuid",
];

var common_builtins = [
  "Object",
  "anyenum",
  "anyfloat",
  "anyint",
  "anynumeric",
  "anyreal",
  "anyscalar",
  "anytype",
  "array",
  "bigint",
  "bool",
  "bytes",
  "datetime",
  "decimal",
  "duration",
  "exclusive",
  "expression",
  "float32",
  "float64",
  "int16",
  "int32",
  "int64",
  "json",
  "len_value",
  "local_date",
  "local_datetime",
  "local_time",
  "max_ex_value",
  "max_len_value",
  "max_value",
  "min_ex_value",
  "min_len_value",
  "min_value",
  "one_of",
  "regexp",
  "sequence",
  "str",
  "tuple",
  "uuid",
];

var edgeql_builtins = common_builtins.concat([
  "abs",
  "advisory_lock",
  "advisory_unlock",
  "advisory_unlock_all",
  "all",
  "any",
  "array_agg",
  "array_get",
  "array_unpack",
  "bytes_get_bit",
  "ceil",
  "contains",
  "count",
  "date_get",
  "datetime_current",
  "datetime_get",
  "datetime_of_statement",
  "datetime_of_transaction",
  "datetime_truncate",
  "duration_to_seconds",
  "duration_truncate",
  "enumerate",
  "find",
  "floor",
  "get_transaction_isolation",
  "get_version",
  "get_version_as_str",
  "json_array_unpack",
  "json_get",
  "json_object_unpack",
  "json_typeof",
  "len",
  "lg",
  "ln",
  "log",
  "max",
  "mean",
  "min",
  "random",
  "re_match",
  "re_match_all",
  "re_replace",
  "re_test",
  "round",
  "sleep",
  "stddev",
  "stddev_pop",
  "str_lower",
  "str_lpad",
  "str_ltrim",
  "str_repeat",
  "str_rpad",
  "str_rtrim",
  "str_title",
  "str_trim",
  "str_upper",
  "sum",
  "time_get",
  "to_bigint",
  "to_datetime",
  "to_decimal",
  "to_duration",
  "to_float32",
  "to_float64",
  "to_int16",
  "to_int32",
  "to_int64",
  "to_json",
  "to_local_date",
  "to_local_datetime",
  "to_local_time",
  "to_str",
  "uuid_generate_v1mc",
  "var",
  "var_pop",
]);

var bool_literals = ["true", "false"];

var operators = [
  "\\!\\=",
  "\\%",
  "\\*",
  "\\+",
  "\\+\\+",
  "\\-",
  "\\/",
  "\\/\\/",
  "\\<",
  "\\<\\=",
  "\\=",
  "\\>",
  "\\>\\=",
  "\\?\\!\\=",
  "\\?\\=",
  "\\?\\?",
  "\\^",
];

var shared_grammar = {
  comment: /#.*/,

  string: [
    {
      // bytes
      pattern: /b(['"])(?:\\['"]|[\n\r]|.)*?\1/,
      greedy: true,
      inside: {
        valuetype: /^b(?=['"])/,
        escaped: [/\\[\\'"bfnrt]/, /\\x[0-9a-fA-F]{2}/],
      },
    },
    {
      // raw
      pattern: /r(['"])(?:\\['"]|[\n\r]|.)*?\1/,
      greedy: true,
      inside: {
        valuetype: /^r(?=['"])/,
      },
    },
    {
      // regular str
      pattern: /(['"])(?:\\['"]|[\n\r]|.)*?\1/,
      greedy: true,
      inside: {
        escaped: [
          /\\(?=\s*\n)/,
          /\\[\\'"bfnrt]/,
          /\\x[0-7][0-9a-fA-F]/,
          /\\u[0-9a-fA-F]{4}/,
          /\\U[0-9a-fA-F]{8}/,
        ],
      },
    },
    {
      pattern: /(\$([A-Za-z\200-\377_][0-9]*)*\$)(?:[\n\r]|.)*?\1/,
      greedy: true,
    },
  ],

  code: /`.+?`|\.<|\.>/,

  number: [
    {
      pattern: /(\W)((?:\d+(?:\.\d+)?(?:[eE](?:[+\-])?[0-9]+))|(?:\d+\.\d+))n?/,
      lookbehind: true,
      inside: {
        valuetype: /[n]/,
      },
    },
    {
      pattern: /(\W)\d+n?/,
      lookbehind: true,
      inside: {
        valuetype: /[n]/,
      },
    },
  ],

  definition: {
    pattern: /:=|->/,
    alias: "punctuation",
  },

  boolean: RegExp("\\b(?:" + bool_literals.join("|") + ")\\b", "i"),

  builtin: RegExp("\\b(?:" + common_builtins.join("|") + ")\\b"),
};

var shared_synopsis_grammar = {
  "synopsis-text": {
    pattern: /#([^\n]*)/,
    greedy: true,

    inside: {
      "synopsis-placeholder": /<[\w\-]+>/,
    },
  },

  "synopsis-placeholder": /<[\w\-]+>/,

  string: {
    pattern: /(['"])(?:\\['"]|[\n\r]|.)*?\1/,
    greedy: true,
  },

  optional: [/\[|\]|\{|\}/, /\.\.\./, /,/],

  group: /[{}|]/,
};

Prism.languages.edgeql = Object.assign({}, shared_grammar, {
  operator: RegExp(operators.join("|")),

  linkprop: /@\w+/,

  variable: /\$[\w\d]+/,

  keyword: RegExp(
    "\\b(?:(?:named\\s+only)|(?:as\\s+text)|" +
      edgeql_keywords.join("|") +
      ")\\b",
    "i"
  ),

  builtin: RegExp("\\b(?:" + edgeql_builtins.join("|") + ")\\b"),
});

// sdl and edgeql are compatible gramamrs
Prism.languages.sdl = Prism.languages.edgeql;

Prism.languages["edgeql-synopsis"] = Object.assign(
  {},
  shared_synopsis_grammar,
  {
    keyword: RegExp("\\b(?:[A-Z]{2,})\\b", "i"),
  }
);

// sdl and edgeql are compatible gramamrs
Prism.languages["sdl-synopsis"] = Prism.languages["edgeql-synopsis"];
Prism.languages["cli-synopsis"] = Prism.languages["edgeql-synopsis"];

// eql:function signature highlighter
var func_common = {
  type: [
    RegExp("\\b(?:" + types.join("|") + ")\\b(?!:)"),
    /\\b(?:anytype)\\b(?!:)/,
  ],
  "module-prefix": {
    pattern: /[\w]+::/,
    greedy: true,

    inside: {
      module: /[\w]+/,
      modseparator: /::/,
    },
  },
};
Prism.languages.eql_function = {
  "module-prefix": func_common["module-prefix"],
  funcname: /[\w]+(?=\()/,
  funcparams: {
    pattern: /\(.*(?=\)\s*->)/,
    greedy: true,
    inside: {
      parenthesis: /\(/,
      funcarg: {
        pattern: /\w[^:]*:\s[^,]*?(,\s*|$)/,
        inside: {
          string: shared_grammar["string"],
          number: shared_grammar["number"],
          boolean: RegExp("\\b(?:" + bool_literals.join("|") + ")\\b", "i"),

          keyword: RegExp(
            "\\b(?:variadic|named only|set of|optional)\\b",
            "i"
          ),

          equals: /=/,

          type: func_common["type"],
          composite: /[<>]/,

          "module-prefix": func_common["module-prefix"],
          argname: /[\w]+/,
        },
      },
    },
  },
  funcreturn: {
    pattern: /\)\s*->.*/,
    greedy: true,
    inside: {
      parenthesis: /\)/,
      return: /->/,
      type: func_common["type"],
      composite: /[<>]/,
      keyword: RegExp("\\b(?:variadic|named only|set of|optional)\\b", "i"),
    },
  },
};

// eql:op signature highlighter
var op_str = {
  qual: "variadic|named only|set of|optional",
  type: types.join("|") + "anytype",
};
Prism.languages.eql_operator = {
  opdecl: {
    pattern: /[\w]+:(?!:)/,
    inside: {
      opname: /[\w]+/,
      colon: /:/,
    },
  },
  opparam: {
    pattern: RegExp(
      "\\b((" +
        op_str.qual +
        ")\\s*)?" +
        "(" +
        op_str.type +
        "|type)\\b(\\<[^-\\s]+\\>(?=\\s))?",
      "i"
    ),
    greedy: true,
    inside: {
      keyword: RegExp("\\b(?:" + op_str.qual + ")\\b", "i"),
      generictype: /\btype\b/,
      type: RegExp("\\b(?:" + op_str.type + ")\\b"),
      composite: /[<>]/,
    },
  },
  opreturn: {
    pattern: /->.*/,
    greedy: true,
    inside: {
      return: /->/,
      "module-prefix": func_common["module-prefix"],
      type: func_common["type"],
      composite: /[<>]/,
      keyword: RegExp("\\b(?:" + op_str.qual + ")\\b", "i"),
    },
  },
  "module-prefix": func_common["module-prefix"],
  oppsymbol: /\S+/,
};
