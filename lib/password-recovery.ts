export const INVALID_RECOVERY_LINK =
  "비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 새 링크를 요청해주세요.";

type RecoveryAuth = {
  exchangeCodeForSession: (
    code: string,
    options?: { flowId?: string },
  ) => Promise<{
    data: {
      session: { user: { id: string } } | null;
      user: { id: string } | null;
      redirectType?: string | null;
    };
    error: unknown;
  }>;
  getUser: () => Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  updateUser: (attributes: { password: string }) => Promise<{ error: unknown }>;
};

export type PasswordRecovery = {
  updatePassword: (password: string) => Promise<void>;
};

// One owner per browser client. Keep settled failures too: an already consumed
// PKCE code must not be exchanged again by StrictMode or a component remount.
export function createPasswordRecovery(auth: RecoveryAuth) {
  const attempts = new Map<string, Promise<PasswordRecovery>>();

  return function initialize(
    code: string | null,
    flowId: string | null = null,
  ): Promise<PasswordRecovery> {
    if (!code) {
      return Promise.reject(new Error(INVALID_RECOVERY_LINK));
    }
    const key = JSON.stringify([code, flowId]);
    const previous = attempts.get(key);
    if (previous) {
      return previous;
    }

    const attempt = (async (): Promise<PasswordRecovery> => {
      let result;
      try {
        result = await auth.exchangeCodeForSession(
          code,
          flowId ? { flowId } : undefined,
        );
      } catch {
        throw new Error(INVALID_RECOVERY_LINK);
      }
      const { data, error } = result;
      // Neither a query parameter nor an existing signed-in session is proof.
      // redirectType comes from the SDK's stored PKCE recovery verifier.
      if (
        error ||
        data.redirectType !== "recovery" ||
        !data.user ||
        data.session?.user.id !== data.user.id
      ) {
        throw new Error(INVALID_RECOVERY_LINK);
      }
      const recoveryUserId = data.user.id;
      let updating = false;
      let completed = false;

      return {
        async updatePassword(password) {
          if (completed) {
            throw new Error(INVALID_RECOVERY_LINK);
          }
          if (updating) {
            throw new Error("비밀번호 변경이 진행 중입니다.");
          }
          updating = true;
          try {
            // Refuse to change another account after a tab/session switch.
            const current = await auth.getUser();
            if (current.error || current.data.user?.id !== recoveryUserId) {
              throw new Error(INVALID_RECOVERY_LINK);
            }
            const { error: updateError } = await auth.updateUser({ password });
            if (updateError) {
              throw updateError;
            }
            completed = true;
          } finally {
            updating = false;
          }
        },
      };
    })();
    attempts.set(key, attempt);
    return attempt;
  };
}
