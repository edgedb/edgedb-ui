import {useState} from "react";

export function useInitialValue<T>(valueGetter: () => T): T {
  const [value] = useState(valueGetter);

  return value;
}
