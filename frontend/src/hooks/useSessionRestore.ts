import { useEffect } from "react";
import { getMe } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuthStore } from "../store/authStore";

export function useSessionRestore() {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (status !== "checking" || !token) return;
    const controller = new AbortController();
    getMe(token, controller.signal).then((user) => {
      if (!controller.signal.aborted && useAuthStore.getState().accessToken === token) {
        useAuthStore.getState().signIn(token, user);
      }
    }).catch((cause) => {
      if (controller.signal.aborted || useAuthStore.getState().accessToken !== token) return;
      useAuthStore.getState().verificationFailed(cause instanceof ApiError
        ? cause.message
        : "Could not connect to the Neuebit API. Check your connection and retry.");
    });
    return () => controller.abort();
  }, [status, token]);
}
