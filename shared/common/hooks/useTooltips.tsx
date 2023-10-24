import {createContext, PropsWithChildren, useState, useContext} from "react";

const GlobalTooltipsContext = createContext<
  [boolean, (showTooltips: boolean) => void]
>(null!);

export function GlobalTooltipsProvider({children}: PropsWithChildren<{}>) {
  const [showTooltips, setShowTooltips] = useState<boolean>(false);

  return (
    <GlobalTooltipsContext.Provider value={[showTooltips, setShowTooltips]}>
      {children}
    </GlobalTooltipsContext.Provider>
  );
}

export function useTooltips() {
  return useContext(GlobalTooltipsContext);
}
