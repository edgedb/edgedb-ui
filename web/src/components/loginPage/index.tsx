import styles from "./loginPage.module.scss";

export default function LoginPage() {
  return (
    <div className={styles.loginPage}>
      <form>
        <label>
          <span>User</span>
          <input />
        </label>
        <label>
          <span>Password</span>
          <input type="password" />
        </label>
        <button>Login</button>
      </form>
    </div>
  );
}
