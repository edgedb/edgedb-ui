import {
  ConfigMemory,
  Duration,
  LocalDate,
  LocalDateTime,
  LocalTime,
} from "edgedb";

export const parsers: {[typename: string]: (val: string) => any} = {
  "std::str": (val: string) => val,
  "std::bool": (val: string) => {
    return val !== "";
  },
  "std::int16": (val: string) => {
    if (!/^-?[0-9]+$/.test(val)) {
      throw new Error("Invalid integer");
    }
    const int = parseInt(val, 10);
    if (int < -32768 || int > 32767) {
      throw new Error("Integer out of range");
    }
    return int;
  },
  "std::int32": (val: string) => {
    if (!/^-?[0-9]+$/.test(val)) {
      throw new Error("Invalid integer");
    }
    const int = parseInt(val, 10);
    if (int < -2147483648 || int > 2147483647) {
      throw new Error("Integer out of range");
    }
    return int;
  },
  "std::int64": (val: string) => {
    if (!/^-?[0-9]+$/.test(val)) {
      throw new Error("Invalid integer");
    }
    const int = BigInt(val);
    if (
      int < BigInt("-9223372036854775808") ||
      int > BigInt("9223372036854775807")
    ) {
      throw new Error("Integer out of range");
    }
    return int;
  },
  "std::float32": (val: string) => {
    const float = Number(val);
    if (Number.isNaN(float)) {
      throw new Error("Invalid float");
    }
    return float;
  },
  "std::float64": (val: string) => {
    const float = Number(val);
    if (Number.isNaN(float)) {
      throw new Error("Invalid float");
    }
    return float;
  },
  "std::bigint": (val: string) => {
    try {
      return BigInt(val);
    } catch {
      throw new Error("Invalid bigint");
    }
  },
  "std::decimal": (val: string) => {
    if (!/^-?[0-9]+.[0-9]+([eE][-+]?[0-9]+)?$/.test(val)) {
      throw new Error("Invalid decimal");
    }
    return val;
  },
  "std::uuid": (val: string) => {
    if (
      !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
        val
      )
    ) {
      throw new Error("Invalid uuid");
    }
    return val;
  },
  "std::bytes": (val: string) => {
    const bytes: number[] = [];
    const bytesRegex = /\\[tnr\\]|\\x[0-9a-fA-F]{2}|[\x20-\x5b\x5d-\x7e]/g;
    let lastIndex = 0;
    let match;
    while ((match = bytesRegex.exec(val)) !== null) {
      if (lastIndex !== match.index) {
        throw new Error("Invalid bytes");
      }
      if (match[0].startsWith("\\")) {
        switch (match[0][1]) {
          case "x":
            bytes.push(parseInt(match[0].slice(2), 16));
            break;
          case "t":
            bytes.push(9);
            break;
          case "n":
            bytes.push(10);
            break;
          case "r":
            bytes.push(13);
            break;
          case "\\":
            bytes.push(92);
            break;
        }
      } else {
        bytes.push(match[0].charCodeAt(0));
      }
      lastIndex = match.index + match[0].length;
    }
    return new Uint8Array(bytes);
  },
  "std::datetime": (val: string) => {
    const date = new Date(val);
    const match = val.match(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2})?)$/
    );
    if (Number.isNaN(date.getTime()) || !match) {
      throw new Error(
        "Invalid datetime, expected format: [YYYY]-[MM]-[DD]T[HH]:[MM]:[SS][+|-][HH]:[MM]"
      );
    }
    const year = date.getUTCFullYear();
    if (year < 1 || year > 9999) {
      throw new Error("Year must be between 1 and 9999");
    }
    const fSeconds = (match[1] ?? "").padEnd(6, "0");

    return new LocalDateTime(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      Number(fSeconds.slice(0, 3)),
      Number(fSeconds.slice(3, 6))
    );
  },
  "cal::local_datetime": (val: string) => {
    const [_match, _year, month, day, hour, minute, second, _fSeconds] =
      val.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/
      ) ?? [];
    if (!_match) {
      throw new Error(
        "invalid local datetime, expected format: [YYYY]-[MM]-[DD]T[HH]:[MM]:[SS]"
      );
    }
    const fSeconds = (_fSeconds ?? "").padEnd(6, "0");
    const year = Number(_year);

    if (year < 1 || year > 9999) {
      throw new Error("Year must be between 1 and 9999");
    }

    return new LocalDateTime(
      year,
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(fSeconds.slice(0, 3)),
      Number(fSeconds.slice(3, 6))
    );
  },
  "cal::local_date": (val: string) => {
    const [_match, _year, month, day] =
      val.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    if (!_match) {
      throw new Error("invalid local date, expected format: [YYYY]-[MM]-[DD]");
    }
    const year = Number(_year);

    if (year < 1 || year > 9999) {
      throw new Error("Year must be between 1 and 9999");
    }

    return new LocalDate(year, Number(month), Number(day));
  },
  "cal::local_time": (val: string) => {
    const [_match, hour, minute, second, _fSeconds] =
      val.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/) ?? [];
    if (!_match) {
      throw new Error("invalid local time, expected format: [HH]:[MM]:[SS]");
    }
    const fSeconds = (_fSeconds ?? "").padEnd(6, "0");

    return new LocalTime(
      Number(hour),
      Number(minute),
      Number(second),
      Number(fSeconds.slice(0, 3)),
      Number(fSeconds.slice(3, 6))
    );
  },
  "std::duration": (val: string) => {
    let duration: Duration;
    try {
      duration = Duration.from(val);
    } catch {
      throw new Error("Invalid duration");
    }
    for (const field of ["years", "months", "weeks", "days"]) {
      if ((duration as any)[field] !== 0) {
        throw new Error(`duration cannot contain ${field}`);
      }
    }
    return duration;
  },
  "cfg::memory": (val: string) => {
    const [_match, size, unit] = val.match(/^(\d+)(B|[KMGTP]iB)$/) ?? [];
    if (!_match) {
      throw new Error("invalid config memory");
    }
    let bytes = BigInt(size);
    for (
      let i = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"].indexOf(unit);
      i > 0;
      i--
    ) {
      bytes = bytes * BigInt(1024);
    }
    return new ConfigMemory(bytes);
  },
};
