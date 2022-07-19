import {ErrorPage} from "@edgedb/studio/components/errorPage";
import styles from "./loginPage.module.scss";

export default function LoginPage() {
  return (
    <div className={styles.loginPage}>
      <ErrorPage
        className={styles.loginMessage}
        title="Authentication Required"
      >
        To authenticate, open the UI with the terminal command:
        <pre>edgedb ui</pre>
      </ErrorPage>
    </div>
  );
}
