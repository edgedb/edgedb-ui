import {observer} from "mobx-react";
import {Link} from "react-router-dom";

import {BranchGraph} from "@edgedb/common/branchGraph";
import {InfoCards} from "@edgedb/common/components/infoCards";

// import {useModal} from "@edgedb/common/hooks/useModal";
// import Button from "@edgedb/common/ui/button";
// import CreateBranchModal from "@edgedb/studio/components/modals/createBranch";
// import {fetchExampleSchema} from "@edgedb/studio/tabs/dashboard";

import {useAppState} from "src/state/providers";

import styles from "./instancePage.module.scss";

export default observer(function InstancePage() {
  const instanceState = useAppState().instanceState;
  // const navigate = useNavigate();
  // const {openModal} = useModal();

  return (
    <div className={styles.instancePage}>
      <div className={styles.pageWrapper}>
        <div className={styles.header}>Branches</div>
        {instanceState.databases ? (
          <BranchGraph
            className={styles.branchGraph}
            instanceId={instanceState.instanceId!}
            instanceState={instanceState}
            BranchLink={({branchName, ...props}) => (
              <Link to={encodeURIComponent(branchName)} {...props} />
            )}
          />
        ) : null}

        <div className={styles.header}>Tips and Updates</div>
        <InfoCards currentVersion={instanceState.serverVersion} />
      </div>
      {/* <div className={styles.databases}>

        {instanceState.databases &&
        !instanceState.databases.includes("_example") ? (
          <div className={styles.exampleDatabaseCard} onClick={() => {}}>
            <span className={styles.cardHeading}>
              First time using EdgeDB?
            </span>
            <Button
              className={styles.cardButton}
              label={
                instanceState.creatingExampleDB
                  ? "Creating example branch..."
                  : "Create example branch"
              }
              loading={instanceState.creatingExampleDB}
              disabled={instanceState.creatingExampleDB}
              onClick={async () => {
                await instanceState.createExampleDatabase(
                  fetchExampleSchema()
                );
                navigate("/_example");
              }}
            />
          </div>
        ) : null}

        <div
          className={styles.newBranchCard}
          onClick={() => {
            openModal(
              <CreateBranchModal
                instanceState={instanceState}
                navigateToDB={(branchName) => {
                  navigate(`/${encodeURIComponent(branchName)}`);
                }}
              />
            );
          }}
        >
          <span>Create new branch</span>
        </div>
      </div> */}
    </div>
  );
});
