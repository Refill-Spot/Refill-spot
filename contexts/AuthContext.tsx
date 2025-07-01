"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { authLogger } from "@/lib/logger";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AuthError, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthContextType = {
  user: User | null;
  profile: { username: string; role?: string; is_admin?: boolean } | null;
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
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: {
    username: string;
  }) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string; role?: string; is_admin?: boolean } | null>(null);
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
            .select("username, role, is_admin")
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
              setProfile({ username, role: 'user', is_admin: false });
            }
          }
        } catch (error) {
          authLogger.error("Profile data loading failed", error);
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
        authLogger.error("Authentication initialization failed", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 인증 상태 변경 구독
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        authLogger.debug("Auth state changed", { 
          event, 
          userEmail: session?.user?.email 
        });

        const user = session?.user || null;
        setUser(user);

        if (user) {
          await loadUserData(user);
        } else {
          setProfile(null);
        }

        setLoading(false);

        // 로그인 성공 시 처리 (OAuth 포함)
        if (event === "SIGNED_IN" && user) {
          toast({
            title: "로그인 성공",
            description: "환영합니다!",
          });

          // OAuth 로그인인지 확인 (provider 정보가 있으면 OAuth)
          const isOAuthLogin =
            user.app_metadata?.provider &&
            user.app_metadata.provider !== "email";

          if (isOAuthLogin) {
            // OAuth 로그인의 경우 현재 페이지가 로그인 페이지라면 홈으로 이동
            if (window.location.pathname === "/login") {
              router.push("/");
            }
            // 그렇지 않으면 현재 페이지에서 상태만 업데이트
          } else {
            // 일반 로그인의 경우 홈으로 이동
            router.push("/");
          }
        }

        // 로그아웃 시 처리
        if (event === "SIGNED_OUT") {
          router.push("/");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, loadUserData, router, toast]);

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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        toast({
          title: "로그인 성공",
          description: "환영합니다!",
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
    try {
      await supabase.auth.signOut();
      toast({
        title: "로그아웃 완료",
        description: "안전하게 로그아웃되었습니다.",
      });
      router.push("/");
    } catch (error) {
      console.error("로그아웃 오류:", error);
      toast({
        title: "오류",
        description: "로그아웃 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 프로필 업데이트
  const updateProfile = async (data: { username: string }) => {
    try {
      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", user.id);

      if (!error) {
        setProfile(prev => prev ? { ...prev, username: data.username } : { username: data.username });
        toast({
          title: "프로필 업데이트 완료",
          description: "프로필이 성공적으로 업데이트되었습니다.",
        });
      }

      return { error };
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
