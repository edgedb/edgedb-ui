import {createContext, PropsWithChildren, useState, useContext} from "react";

const modalContext = createContext<{
  modal: JSX.Element | null;
  openModal: (modal: JSX.Element | null) => () => void;
}>(null!);

export function ModalProvider({children}: PropsWithChildren<{}>) {
  const [modal, _openModal] = useState<JSX.Element | null>(null);

  const openModal = (newModal: JSX.Element | null) => {
    _openModal(newModal);

    return () => {
      _openModal((modal) => (modal === newModal ? null : modal));
    };
  };

  return (
    <modalContext.Provider value={{modal, openModal}}>
      {children}
      {modal}
    </modalContext.Provider>
  );
}

export function useModal() {
  return useContext(modalContext);
}
