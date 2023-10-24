import {createContext, PropsWithChildren, useState, useContext} from "react";

const GlobalTooltipsContext = createContext<
  [boolean, React.Dispatch<React.SetStateAction<boolean>>]
>(null!);

export function GlobalTooltipsProvider({children}: PropsWithChildren<{}>) {
  const [showTooltips, setShowTooltips] = useState(true);

  return (
    <GlobalTooltipsContext.Provider value={[showTooltips, setShowTooltips]}>
      {children}
    </GlobalTooltipsContext.Provider>
  );
}

export function useTooltips() {
  const context = useContext(GlobalTooltipsContext);

  if (!context) {
    throw new Error(
      "useTooltips must be used within a GlobalTooltipsProvider"
    );
  }

  return context;
}
