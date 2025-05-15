"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { User, AuthError } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";

type AuthContextType = {
  user: User | null;
  profile: { username: string } | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    options?: { username?: string }
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    username: string;
  }) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const supabase = supabaseBrowser;

  // 사용자 정보 및 프로필 로드
  const loadUserData = useCallback(
    async (user: User | null) => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .single();

          if (!error && data) {
            setProfile(data);
          } else {
            // 프로필이 없는 경우 기본 프로필 생성
            const username =
              user.email?.split("@")[0] ||
              `user_${Math.random().toString(36).substring(2, 10)}`;
            const { error: createError } = await supabase
              .from("profiles")
              .insert({
                id: user.id,
                username,
              });

            if (!createError) {
              setProfile({ username });
            }
          }
        } catch (error) {
          console.error("프로필 데이터 로드 오류:", error);
        }
      } else {
        setProfile(null);
      }
    },
    [supabase]
  );

  // 초기 사용자 상태 확인
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        // 현재 세션 확인
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          await loadUserData(session.user);
        }
      } catch (error) {
        console.error("인증 초기화 오류:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 인증 상태 변경 구독
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user || null;
        setUser(user);
        await loadUserData(user);
        setLoading(false);

        // 인증 상태 변경 시 라우터 새로고침
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          router.refresh();
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, loadUserData, router]);

  // 회원가입
  const signUp = async (
    email: string,
    password: string,
    options?: { username?: string }
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
          title: t("signup_success"),
          description: t("email_verification_sent"),
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        toast({
          title: t("login_success"),
          description: t("welcome_back"),
        });
        router.push("/");
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
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // 깃허브 로그인
  const signInWithGithub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // 로그아웃
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: t("logout_success"),
        description: t("logged_out_message"),
      });
      router.push("/");
    } catch (error) {
      console.error("로그아웃 오류:", error);
      toast({
        title: t("logout_error"),
        description: t("logout_error_description"),
        variant: "destructive",
      });
    }
  };

  // 프로필 업데이트
  const updateProfile = async (data: { username: string }) => {
    if (!user) {
      return { error: new Error("로그인이 필요합니다.") };
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", user.id);

      if (!error) {
        setProfile(data);
        toast({
          title: t("profile_updated"),
          description: t("profile_updated_description"),
        });
      }

      return { error: error as unknown as Error | null };
    } catch (err) {
      console.error("프로필 업데이트 오류:", err);
      return { error: err as Error };
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithGithub,
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
