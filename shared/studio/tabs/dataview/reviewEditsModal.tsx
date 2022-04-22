import {observer} from "mobx-react-lite";

import {DataView} from "./state";

import {useModal} from "@edgedb/common/hooks/useModal";
import {Modal, ModalOverlay} from "@edgedb/common/ui/modal";

interface ReviewEditsModalProps {
  state: DataView;
}

export const ReviewEditsModal = observer(function ReviewEditsModal({
  state,
}: ReviewEditsModalProps) {
  const {openModal} = useModal();

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <Modal title="Review Edits" close={() => openModal(null)}>
        <pre>{JSON.stringify(state.edits, null, 2)}</pre>
      </Modal>
    </ModalOverlay>
  );
});
