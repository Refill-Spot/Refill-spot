"use client";

import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { authLogger } from "@/lib/logger";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getSafeReturnUrl } from "@/lib/utils";
import { AuthError, User } from "@supabase/supabase-js";
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
  const [initialized, setInitialized] = useState(false);
  const loadingUserRef = useRef<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const supabase = supabaseBrowser;

  // 사용자 정보 및 프로필 로드
  const loadUserData = useCallback(
    async (user: User | null) => {
      if (!user) {
        authLogger.debug("사용자 없음, 프로필 초기화");
        setProfile(null);
        return;
      }

      // 이미 같은 사용자에 대해 로딩 중이면 스킵
      if (loadingUserRef.current === user.id) {
        authLogger.debug("프로필 이미 로딩 중, 스킵", { userId: user.id });
        return;
      }

      loadingUserRef.current = user.id;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          authLogger.warn("프로필 로딩 타임아웃, fallback 사용", { userId: user.id });
          reject(new Error("Profile loading timeout"));
        }, 5000); // 5초로 단축
      });

      try {
        authLogger.debug("프로필 데이터 로딩 시작", { userId: user.id });
        
        const loadProfile = async () => {
          authLogger.debug("프로필 쿼리 시작", { 
            userId: user.id,
            hasSupabaseClient: !!supabase
          });
          
          // 먼저 간단한 연결 테스트
          try {
            await supabase.from("profiles").select("count").limit(1);
            authLogger.debug("Supabase 연결 테스트 성공");
          } catch (connectionError) {
            authLogger.error("Supabase 연결 실패", connectionError);
            return createFallbackProfile();
          }
          
          try {
            const { data, error } = await supabase
              .from("profiles")
              .select("username, role, is_admin")
              .eq("id", user.id)
              .single();

            authLogger.debug("프로필 쿼리 결과", { 
              hasData: !!data, 
              error: error?.message,
              errorCode: error?.code 
            });

            if (!error && data) {
              authLogger.debug("프로필 데이터 로딩 성공", data);
              return { ...data, id: user.id };
            } else if (error?.code === 'PGRST116') {
              // 프로필이 없는 경우 (not found)
              authLogger.debug("프로필 없음, 기본 프로필 생성 시작");
              return await createDefaultProfile();
            } else {
              // 다른 에러인 경우 기본 프로필 반환
              authLogger.warn("프로필 쿼리 에러, 기본 프로필 사용", error);
              return createFallbackProfile();
            }
          } catch (queryError) {
            authLogger.error("프로필 쿼리 예외 발생", queryError);
            return createFallbackProfile();
          }
        };

        const createDefaultProfile = async () => {
          const username = user.email?.split("@")[0] || `user_${Math.random().toString(36).substring(2, 10)}`;
          
          authLogger.debug("프로필 생성 시도", { username, userId: user.id });
          
          try {
            const { error: createError } = await supabase
              .from("profiles")
              .insert({
                id: user.id,
                username,
              });

            const newProfile = { id: user.id, username, role: 'user' as const, is_admin: false };
            
            if (!createError) {
              authLogger.debug("기본 프로필 생성 성공", newProfile);
            } else {
              authLogger.error("기본 프로필 생성 실패, fallback 사용", createError);
            }
            
            return newProfile;
          } catch (insertError) {
            authLogger.error("프로필 생성 예외 발생", insertError);
            return createFallbackProfile();
          }
        };

        const createFallbackProfile = () => {
          const username = user.email?.split("@")[0] || `user_${Math.random().toString(36).substring(2, 10)}`;
          return { id: user.id, username, role: 'user' as const, is_admin: false };
        };

        // 타임아웃과 경쟁하여 프로필 로딩
        try {
          const profileData = await Promise.race([loadProfile(), timeoutPromise]);
          setProfile(profileData as any);
          authLogger.debug("프로필 설정 완료", { userId: user.id });
        } catch (timeoutError) {
          authLogger.warn("타임아웃으로 인한 fallback 프로필 사용", { userId: user.id });
          const fallbackUsername = user.email?.split("@")[0] || `user_${Math.random().toString(36).substring(2, 10)}`;
          setProfile({ username: fallbackUsername, role: 'user', is_admin: false });
        }
        
        // 프로필 로딩 완료 시 완료 토스트 (소셜 로그인의 경우)
        if (user.app_metadata?.provider && user.app_metadata.provider !== "email") {
          setTimeout(() => {
            toast({
              title: "설정 완료",
              description: "계정 설정이 완료되었습니다!",
            });
          }, 500);
        }
        
      } catch (error) {
        authLogger.error("Profile data loading failed", error);
        // 에러가 발생해도 기본 프로필은 설정 (사용자 경험 우선)
        const fallbackUsername =
          user.email?.split("@")[0] ||
          `user_${Math.random().toString(36).substring(2, 10)}`;
        setProfile({ username: fallbackUsername, role: 'user', is_admin: false });
      } finally {
        loadingUserRef.current = null;
      }
    },
    [supabase, toast]
  );

  // 초기 사용자 상태 확인
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      if (!mounted) return;
      
      setLoading(true);
      try {
        authLogger.debug("인증 초기화 시작");
        
        // 현재 사용자 확인 (서버 인증)
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (user && !authError) {
          authLogger.debug("초기 사용자 확인됨", { userId: user.id, email: user.email });
          setUser(user);
          try {
            await loadUserData(user);
          } catch (error) {
            authLogger.error("초기 프로필 로딩 실패:", error);
          }
        } else {
          authLogger.debug("초기 사용자 없음");
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        if (!mounted) return;
        authLogger.error("Authentication initialization failed", error);
        setUser(null);
        setProfile(null);
      } finally {
        if (mounted) {
          // 최소 100ms 로딩 시간으로 깜빡임 방지 (단축)
          setTimeout(() => {
            if (mounted) {
              setLoading(false);
              setInitialized(true);
              authLogger.debug("인증 초기화 완료");
            }
          }, 100);
        }
      }
    };

    initAuth();

    // 인증 상태 변경 구독
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        authLogger.debug("Auth state changed", { 
          event, 
          userEmail: session?.user?.email,
          hasSession: !!session,
          hasUser: !!session?.user
        });

        const user = session?.user || null;
        setUser(user);

        if (user && mounted) {
          try {
            await loadUserData(user);
          } catch (error) {
            authLogger.error("loadUserData 오류:", error);
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        } else if (mounted) {
          setProfile(null);
          setLoading(false);
        }

        // 로그인 성공 시 처리 (OAuth 포함)
        if (event === "SIGNED_IN" && user) {
          authLogger.info("SIGNED_IN 이벤트 처리");
          
          // OAuth 로그인인지 확인 (provider 정보가 있으면 OAuth)
          const isOAuthLogin =
            user.app_metadata?.provider &&
            user.app_metadata.provider !== "email";

          // 리다이렉트 처리 - OAuth 로그인만 여기서 처리
          const currentPath = window.location.pathname;
          
          if (isOAuthLogin && (currentPath === "/login" || currentPath === "/onboarding")) {
            // OAuth 로그인의 경우 프로필 처리 중임을 알림
            toast({
              title: "로그인 성공",
              description: "프로필을 설정하고 있습니다...",
            });
            
            // OAuth 콜백에서 온 경우 returnUrl 확인
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('returnUrl');
            const safeReturnUrl = getSafeReturnUrl(returnUrl, '/');
            
            authLogger.debug("OAuth 로그인 후 리다이렉트", { returnUrl, safeReturnUrl });
            
            // 약간의 지연 후 리다이렉트 (프로필 설정 완료 기다림)
            setTimeout(() => {
              router.push(safeReturnUrl);
            }, 1000);
          } else if (!isOAuthLogin) {
            // 일반 로그인의 경우 토스트만 표시, 리다이렉트는 로그인 페이지에서 처리
            console.log('🔄 일반 로그인 - AuthContext에서 리다이렉트 건너뛰기');
          }
        }

        // 로그아웃 시 상태 초기화 처리
        if (event === "SIGNED_OUT") {
          authLogger.info("SIGNED_OUT 이벤트 처리");
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
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
        // 토스트는 onAuthStateChange에서 처리되므로 여기서는 제거
        // 리다이렉트도 onAuthStateChange에서 처리됨
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
      // 현재 페이지의 returnUrl 파라미터를 콜백에 전달
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('returnUrl');
      
      let redirectTo = `${window.location.origin}/auth/callback`;
      if (returnUrl) {
        redirectTo += `?returnUrl=${encodeURIComponent(returnUrl)}`;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
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
      // 현재 페이지의 returnUrl 파라미터를 콜백에 전달
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('returnUrl');
      
      let redirectTo = `${window.location.origin}/auth/callback`;
      if (returnUrl) {
        redirectTo += `?returnUrl=${encodeURIComponent(returnUrl)}`;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo,
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
      authLogger.debug("로그아웃 시작");
      
      // 1. 먼저 현재 세션 정보 확인
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      authLogger.debug("현재 세션 정보", currentSession);
      
      // 2. 로그아웃 시도 (기본 로그아웃)
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        authLogger.error("로그아웃 에러:", error);
        throw error;
      }
      
      authLogger.info("로그아웃 성공");
      
      // 3. 상태 강제 초기화 (onAuthStateChange가 호출되지 않을 수 있으므로)
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      toast({
        title: "로그아웃 완료",
        description: "안전하게 로그아웃되었습니다.",
      });
      
      // 4. 페이지 리다이렉트 처리
      const currentPath = window.location.pathname;
      const protectedPaths = ['/admin', '/profile', '/favorites'];
      const isProtectedPage = protectedPaths.some(path => currentPath.startsWith(path));
      
      if (isProtectedPage) {
        router.push("/");
      }
      
    } catch (error) {
      authLogger.error("로그아웃 오류:", error);
      
      // 완전 실패시 강제 초기화
      setUser(null);
      setProfile(null);
      setLoading(false);
      
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
