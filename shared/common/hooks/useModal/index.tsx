import {
  createContext,
  PropsWithChildren,
  useState,
  useContext,
  useRef,
  useLayoutEffect,
} from "react";

const modalContext = createContext<{
  modal: JSX.Element | null;
  openModal: (modal: JSX.Element | null, transition?: boolean) => () => void;
}>(null!);

export function ModalProvider({children}: PropsWithChildren<{}>) {
  const ref = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<JSX.Element | null>(null);
  const [transitionState, setTransitionState] = useState<boolean | null>(null); // true: transition in, false: transition out

  const openModal = (newModal: JSX.Element | null, transition?: boolean) => {
    if (transition) {
      if (newModal) {
        setModal(newModal);
        if (!modal) {
          // transition in
          setTransitionState(true);
        }
        // else changing modal - no transition
      } else {
        if (modal) {
          // transition out
          setTransitionState(false);
        }
        // else still null
      }
    } else {
      setTransitionState(null);
      setModal(newModal);
    }

    return () => {
      setModal((modal) => (modal === newModal ? null : modal));
    };
  };

  useLayoutEffect(() => {
    if (transitionState === true) {
      ref.current?.clientWidth;
      setTransitionState(null);
    } else if (transitionState === false) {
      const target = ref.current?.firstChild;
      if (target) {
        const handler = () => {
          setTransitionState(null);
          setModal(null);
        };
        target.addEventListener("transitionend", handler, {once: true});
        return () => target.removeEventListener("transitionend", handler);
      } else {
        setTransitionState(null);
        setModal(null);
      }
    }
  }, [transitionState]);

  return (
    <modalContext.Provider
      value={{modal: transitionState === false ? null : modal, openModal}}
    >
      {children}
      <div
        ref={ref}
        style={{display: "contents"}}
        className={
          transitionState !== null
            ? transitionState
              ? "MODAL_TRANSITION MODAL_TRANSITION_IN"
              : "MODAL_TRANSITION MODAL_TRANSITION_OUT"
            : undefined
        }
      >
        {modal}
      </div>
    </modalContext.Provider>
  );
}

export function useModal() {
  return useContext(modalContext);
}
