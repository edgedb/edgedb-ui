import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";

import Button from "@edgedb/common/ui/button";
import {ModalTextField} from "@edgedb/common/ui/modal";

import {serverUrl, setAuthToken} from "src/state/models/app";
import {SCRAMAuth} from "src/utils/scram";

import styles from "./loginPage.module.scss";
import {ArrowRight} from "@edgedb/studio/icons";
import {Logo} from "../header";

export default function LoginPage() {
  const [error, setError] = useState<Error | null>(null);
  const {register, handleSubmit, formState, setFocus} = useForm<{
    username: string;
    password: string;
  }>({mode: "onChange"});

  useEffect(() => {
    setFocus("username");
  }, []);

  const onSubmit = handleSubmit(async ({username, password}) => {
    setError(null);
    try {
      const authToken = await SCRAMAuth(serverUrl, username, password);
      setAuthToken(username, authToken);
    } catch (err) {
      setError(err as Error);
      console.error(err);
    }
  });

  return (
    <div className={styles.loginPage}>
      <Logo className={styles.title} />
      <form className={styles.loginForm} onSubmit={onSubmit}>
        <ModalTextField
          label="Username"
          {...register("username", {
            required: "Username is required",
          })}
          error={formState.errors.username?.message}
        />
        <ModalTextField
          label="Password"
          type="password"
          {...register("password", {
            required: "Password is required",
          })}
          error={formState.errors.password?.message}
        />
        <Button
          className={styles.loginButton}
          loading={formState.isSubmitting}
          disabled={!formState.isValid || formState.isSubmitting}
          label={"Login"}
          icon={<ArrowRight className={styles.loginButtonIcon} />}
          onClick={onSubmit}
        />
        {error ? (
          <div className={styles.loginError}>
            <span>{error.name}:</span> {error.message}
          </div>
        ) : null}
      </form>
    </div>
  );
}
