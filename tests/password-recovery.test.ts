import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  createPasswordRecovery,
  INVALID_RECOVERY_LINK,
} from "../lib/password-recovery";

type Auth = Parameters<typeof createPasswordRecovery>[0];

function mockAuth() {
  const calls = { exchanges: 0, updates: [] as string[], users: 0, signOut: 0 };
  const state = {
    exchangeError: null as unknown,
    exchangeThrows: false,
    redirectType: "recovery" as string | null,
    hasSession: true,
    currentUser: "recovery-user" as string | null,
    userError: null as unknown,
    updateError: null as unknown,
    flowId: undefined as string | undefined,
  };
  const auth: Auth & { signOut: () => Promise<void> } = {
    async exchangeCodeForSession(_code, options) {
      calls.exchanges++;
      state.flowId = options?.flowId;
      if (state.exchangeThrows) throw new Error("network error");
      return {
        data: {
          session: state.hasSession ? { user: { id: "recovery-user" } } : null,
          user: { id: "recovery-user" },
          redirectType: state.redirectType,
        },
        error: state.exchangeError,
      };
    },
    async getUser() {
      calls.users++;
      return {
        data: { user: state.currentUser ? { id: state.currentUser } : null },
        error: state.userError,
      };
    },
    async updateUser({ password }) {
      calls.updates.push(password);
      return { error: state.updateError };
    },
    async signOut() {
      calls.signOut++;
    },
  };
  return { auth, calls, state };
}

test("arbitrary code cannot turn an existing session into recovery or log it out", async () => {
  const { auth, calls, state } = mockAuth();
  state.exchangeError = new Error("invalid code");
  const initialize = createPasswordRecovery(auth);
  await assert.rejects(initialize("arbitrary"), {
    message: INVALID_RECOVERY_LINK,
  });
  await assert.rejects(initialize("arbitrary"), {
    message: INVALID_RECOVERY_LINK,
  });
  assert.equal(calls.exchanges, 1);
  assert.equal(calls.users, 0);
  assert.deepEqual(calls.updates, []);
  assert.equal(calls.signOut, 0);
});

test("missing code, ordinary sign-in code, and missing session all fail closed", async () => {
  const missing = mockAuth();
  await assert.rejects(createPasswordRecovery(missing.auth)(null));
  assert.equal(missing.calls.exchanges, 0);
  for (const kind of ["ordinary", "missing-session"] as const) {
    const { auth, state, calls } = mockAuth();
    if (kind === "ordinary") state.redirectType = null;
    else state.hasSession = false;
    await assert.rejects(createPasswordRecovery(auth)("code"), {
      message: INVALID_RECOVERY_LINK,
    });
    assert.deepEqual(calls.updates, []);
    assert.equal(calls.signOut, 0);
  }
});

test("StrictMode duplicate initialization shares pending and settled exchange", async () => {
  const { auth, calls } = mockAuth();
  const exchange = auth.exchangeCodeForSession;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  auth.exchangeCodeForSession = async (...args) => {
    await gate;
    return exchange(...args);
  };
  const initialize = createPasswordRecovery(auth);
  const first = initialize("valid-code");
  const second = initialize("valid-code");
  assert.equal(first, second);
  release();
  const recovery = await first;
  assert.equal(await initialize("valid-code"), recovery);
  await recovery.updatePassword("Strong-password-123");
  assert.equal(calls.exchanges, 1);
  assert.deepEqual(calls.updates, ["Strong-password-123"]);
  assert.equal(calls.signOut, 0);
  await assert.rejects(recovery.updatePassword("second-password"));
  assert.equal(calls.updates.length, 1);
});

test("flow ID is passed to the PKCE exchange", async () => {
  const { auth, state } = mockAuth();
  await createPasswordRecovery(auth)("code", "flow-id");
  assert.equal(state.flowId, "flow-id");
});

test("exchange exceptions fail closed and do not retry or log out", async () => {
  const { auth, state, calls } = mockAuth();
  state.exchangeThrows = true;
  const initialize = createPasswordRecovery(auth);
  await assert.rejects(initialize("code"), { message: INVALID_RECOVERY_LINK });
  await assert.rejects(initialize("code"), { message: INVALID_RECOVERY_LINK });
  assert.equal(calls.exchanges, 1);
  assert.equal(calls.signOut, 0);
});

test("update errors remain retryable without consuming the code again", async () => {
  const { auth, state, calls } = mockAuth();
  const recovery = await createPasswordRecovery(auth)("code");
  state.updateError = new Error("password rejected");
  await assert.rejects(
    recovery.updatePassword("rejected"),
    /password rejected/,
  );
  state.updateError = null;
  await recovery.updatePassword("accepted");
  assert.deepEqual(calls.updates, ["rejected", "accepted"]);
  assert.equal(calls.exchanges, 1);
});

test("account switches, sign-out, and user validation errors block updates", async () => {
  for (const currentUser of ["other-user", null, "recovery-user"]) {
    const { auth, state, calls } = mockAuth();
    const recovery = await createPasswordRecovery(auth)("code");
    state.currentUser = currentUser;
    if (currentUser === "recovery-user") state.userError = new Error("expired");
    await assert.rejects(recovery.updatePassword("new-password"), {
      message: INVALID_RECOVERY_LINK,
    });
    assert.deepEqual(calls.updates, []);
  }
});

test("concurrent submissions cannot update twice", async () => {
  const { auth, calls } = mockAuth();
  const recovery = await createPasswordRecovery(auth)("code");
  const first = recovery.updatePassword("first");
  await assert.rejects(recovery.updatePassword("second"), /진행 중/);
  await first;
  assert.deepEqual(calls.updates, ["first"]);
});

test("page keeps recoverable errors separate from form eligibility and has one exchange owner", () => {
  const page = readFileSync("app/reset-password/page.tsx", "utf8");
  const client = readFileSync("lib/supabase/client.ts", "utf8");
  const callback = readFileSync("app/auth/callback/route.ts", "utf8");
  assert.match(page, /recovery && !linkError \? \(/);
  assert.doesNotMatch(
    page,
    /auth\.(signOut|exchangeCodeForSession|updateUser)/,
  );
  assert.match(client, /detectSessionInUrl: false/);
  assert.match(callback, /resetUrl\.searchParams\.set\("sb_flow_id", flowId\)/);
});
