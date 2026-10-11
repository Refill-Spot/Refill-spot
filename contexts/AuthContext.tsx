"use client";

import { useToast } from "@/components/ui/use-toast";
import { authLogger } from "@/lib/logger";
import { useStoreStore } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getSafeReturnUrl } from "@/lib/utils";
import { AuthError, User } from "@supabase/supabase-js";

interface Profile {
  id?: string;
  username: string;
  role?: string;
  is_admin?: boolean;
  avatar_url?: string;
  bio?: string;
}
import { useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    options?: { username?: string },
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    username?: string;
    bio?: string;
  }) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getAuthReturnUrl() {
  try {
    const returnUrl = new URLSearchParams(window.location.search).get(
      "returnUrl",
    );
    const destination = new URL(
      getSafeReturnUrl(returnUrl, "/"),
      window.location.origin,
    );
    const isAuthPage = [
      "/login",
      "/register",
      "/forgot-password",
      "/auth/callback",
    ].some(
      (path) =>
        destination.pathname === path ||
        destination.pathname.startsWith(`${path}/`),
    );
    if (
      destination.origin !== window.location.origin ||
      destination.pathname.startsWith("//") ||
      isAuthPage
    ) {
      return "/";
    }
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return "/";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const authVersionRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const signingOutRef = useRef(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = supabaseBrowser;

  // 사용자 정보 및 프로필 로드
  const loadUserData = useCallback(
    async (user: User, version: number) => {
      const isCurrent = () =>
        mountedRef.current &&
        authVersionRef.current === version &&
        userIdRef.current === user.id;
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const loadProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, role, is_admin, avatar_url, bio")
          .eq("id", user.id)
          .abortSignal(controller.signal)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          return {
            ...data,
            id: user.id,
            avatar_url: data.avatar_url ?? undefined,
            bio: data.bio ?? undefined,
          };
        }
        if (!isCurrent() || controller.signal.aborted) return null;

        // 기존 신규 계정의 프로필 생성은 유지하되 실제 저장된 값만 사용한다.
        const username =
          user.email?.split("@")[0] ||
          `user_${Math.random().toString(36).substring(2, 10)}`;
        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .insert({ id: user.id, username })
          .select("username, role, is_admin, avatar_url, bio")
          .abortSignal(controller.signal)
          .single();

        if (createError) throw createError;
        return createdProfile
          ? {
              ...createdProfile,
              id: user.id,
              avatar_url: createdProfile.avatar_url ?? undefined,
              bio: createdProfile.bio ?? undefined,
            }
          : null;
      };

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort();
            reject(new Error("Profile loading timeout"));
          }, 5000);
        });
        const profileData = await Promise.race([loadProfile(), timeoutPromise]);
        if (isCurrent()) setProfile(profileData);
      } catch (error) {
        authLogger.error("Profile data loading failed", error);
        // 다른 계정의 권한이나 저장되지 않은 임시 프로필을 유지하지 않는다.
        if (isCurrent()) setProfile(null);
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    },
    [supabase],
  );

  // 세션 이벤트는 재검증 신호일 뿐 사용자 신원의 근거가 아니다.
  useEffect(() => {
    mountedRef.current = true;
    const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

    // INITIAL_SESSION도 전달되므로 별도의 중복 초기화 요청은 필요하지 않다.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        const version = ++authVersionRef.current;
        if (event === "SIGNED_OUT") {
          useStoreStore.getState().setFavoritesOwner(null);
          userIdRef.current = null;
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        if (signingOutRef.current) return;

        // 계정 전환을 알게 되면 이전 계정의 프로필을 즉시 숨긴다.
        if (session?.user.id !== userIdRef.current) {
          useStoreStore.getState().setFavoritesOwner(null);
          userIdRef.current = null;
          setUser(null);
          setProfile(null);
        }
        setLoading(true);

        const refreshUser = async () => {
          const isCurrent = () =>
            mountedRef.current &&
            authVersionRef.current === version &&
            !signingOutRef.current;
          if (!isCurrent()) return;

          try {
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser();
            if (!isCurrent()) return;
            if (error || !user) {
              useStoreStore.getState().setFavoritesOwner(null);
              userIdRef.current = null;
              setUser(null);
              setProfile(null);
              return;
            }

            if (userIdRef.current !== user.id) setProfile(null);
            useStoreStore.getState().setFavoritesOwner(user.id);
            userIdRef.current = user.id;
            setUser(user);
            await loadUserData(user, version);
            if (!isCurrent()) return;

            const isOAuthLogin =
              user.app_metadata?.provider &&
              user.app_metadata.provider !== "email";
            if (
              event === "SIGNED_IN" &&
              isOAuthLogin &&
              window.location.pathname === "/login"
            ) {
              router.replace(getAuthReturnUrl());
            }
          } catch (error) {
            authLogger.error("Authentication verification failed", error);
            if (isCurrent()) {
              useStoreStore.getState().setFavoritesOwner(null);
              userIdRef.current = null;
              setUser(null);
              setProfile(null);
            }
          } finally {
            if (isCurrent()) setLoading(false);
          }
        };

        // Supabase 인증 락을 잡은 콜백 안에서 다른 인증 API를 기다리지 않는다.
        const timer = setTimeout(() => {
          pendingTimers.delete(timer);
          void refreshUser();
        }, 0);
        pendingTimers.add(timer);
      },
    );

    return () => {
      mountedRef.current = false;
      ++authVersionRef.current;
      useStoreStore.getState().setFavoritesOwner(null);
      for (const timer of pendingTimers) clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
  }, [supabase, loadUserData, router]);

  // 회원가입
  const signUp = async (
    email: string,
    password: string,
    options?: { username?: string },
  ) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: options,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (!error && data.user) {
        toast({
          title: "회원가입 성공",
          description: "이메일을 확인하여 계정을 인증해주세요.",
        });
      }

      return { error };
    } catch (err) {
      console.error("회원가입 오류:", err);
      const error = err as AuthError;
      return { error };
    }
  };

  // 로그인
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && (!data.user || !data.session)) {
        return { error: new AuthError("로그인 세션을 확인할 수 없습니다.") };
      }

      return { error };
    } catch (err) {
      console.error("로그인 오류:", err);
      const error = err as AuthError;
      return { error };
    }
  };

  // 구글 로그인
  const signInWithGoogle = async () => {
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("returnUrl", getAuthReturnUrl());

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        console.error("구글 로그인 오류:", error);
        toast({
          title: "로그인 오류",
          description: "구글 로그인 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("구글 로그인 오류:", error);
      toast({
        title: "로그인 오류",
        description: "구글 로그인 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 카카오 로그인
  const signInWithKakao = async () => {
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("returnUrl", getAuthReturnUrl());

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        console.error("카카오 로그인 오류:", error);
        toast({
          title: "로그인 오류",
          description: "카카오 로그인 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("카카오 로그인 오류:", error);
      toast({
        title: "로그인 오류",
        description: "카카오 로그인 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 로그아웃
  const signOut = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    ++authVersionRef.current;
    useStoreStore.getState().setFavoritesOwner(null);
    try {
      authLogger.debug("로그아웃 시작");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      if (!mountedRef.current) return;

      useStoreStore.getState().setFavoritesOwner(null);
      userIdRef.current = null;
      setUser(null);
      setProfile(null);
      setLoading(false);

      toast({
        title: "로그아웃 완료",
        description: "안전하게 로그아웃되었습니다.",
      });

      const currentPath = window.location.pathname;
      const protectedPaths = [
        "/admin",
        "/profile",
        "/favorites",
        "/my-reviews",
      ];
      const isProtectedPage = protectedPaths.some(
        (path) => currentPath === path || currentPath.startsWith(`${path}/`),
      );
      if (isProtectedPage) {
        router.replace("/");
      }
      router.refresh();
    } catch (error) {
      authLogger.error("로그아웃 오류:", error);
      // SDK의 인증 상태 이벤트를 유지하고 오류를 호출자에게 전달한다.
      if (mountedRef.current) {
        useStoreStore.getState().setFavoritesOwner(userIdRef.current);
        setLoading(false);
        if (userIdRef.current === null) router.refresh();
        toast({
          title: "오류",
          description: "로그아웃 처리 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      signingOutRef.current = false;
    }
  };

  // 프로필 업데이트
  const updateProfile = async (data: { username?: string; bio?: string }) => {
    const version = authVersionRef.current;
    try {
      if (!user || userIdRef.current !== user.id || signingOutRef.current) {
        throw new Error("로그인이 필요합니다.");
      }

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", user.id)
        .select("username, role, is_admin, avatar_url, bio")
        .single();

      if (error) throw new Error(error.message);
      if (!updatedProfile)
        throw new Error("프로필 업데이트를 확인할 수 없습니다.");

      if (
        mountedRef.current &&
        authVersionRef.current === version &&
        userIdRef.current === user.id
      ) {
        setProfile({
          ...updatedProfile,
          id: user.id,
          avatar_url: updatedProfile.avatar_url ?? undefined,
          bio: updatedProfile.bio ?? undefined,
        });
        toast({
          title: "프로필 업데이트 완료",
          description: "프로필이 성공적으로 업데이트되었습니다.",
        });
      }

      return { error: null };
    } catch (err) {
      console.error("프로필 업데이트 오류:", err);
      const error = err as Error;
      return { error };
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithKakao,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
