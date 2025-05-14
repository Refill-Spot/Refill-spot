"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Utensils, Pizza } from "lucide-react"

export default function AuthPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // 로그인 폼 상태
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    remember: false,
  })

  // 회원가입 폼 상태
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  })

  // 로그인 폼 핸들러
  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target
    setLoginForm({
      ...loginForm,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  // 회원가입 폼 핸들러
  const handleRegisterChange = (e) => {
    const { name, value, type, checked } = e.target
    setRegisterForm({
      ...registerForm,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  // 로그인 제출
  const handleLoginSubmit = (e) => {
    e.preventDefault()
    setIsLoading(true)

    // 실제 구현에서는 API 호출
    setTimeout(() => {
      setIsLoading(false)
      router.push("/")
    }, 1500)
  }

  // 회원가입 제출
  const handleRegisterSubmit = (e) => {
    e.preventDefault()
    setIsLoading(true)

    // 실제 구현에서는 API 호출
    setTimeout(() => {
      setIsLoading(false)
      router.push("/")
    }, 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <div className="bg-[#FF5722] p-3 rounded-full">
              <Utensils className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#FF5722]">Refill Spot</h1>
          <p className="text-gray-500 mt-1">무한리필 식당을 찾아보세요</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="register">회원가입</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <form onSubmit={handleLoginSubmit}>
                <CardHeader>
                  <CardTitle>로그인</CardTitle>
                  <CardDescription>계정 정보를 입력하여 로그인하세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={loginForm.email}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">비밀번호</Label>
                      <Link href="/forgot-password" className="text-sm text-[#2196F3] hover:underline">
                        비밀번호 찾기
                      </Link>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      name="remember"
                      checked={loginForm.remember}
                      onCheckedChange={(checked) => setLoginForm({ ...loginForm, remember: !!checked })}
                    />
                    <Label htmlFor="remember" className="text-sm">
                      로그인 상태 유지
                    </Label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full bg-[#FF5722] hover:bg-[#E64A19]" disabled={isLoading}>
                    {isLoading ? "로그인 중..." : "로그인"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <form onSubmit={handleRegisterSubmit}>
                <CardHeader>
                  <CardTitle>회원가입</CardTitle>
                  <CardDescription>새 계정을 만들어 무한리필 식당을 찾아보세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">사용자 이름</Label>
                    <Input
                      id="username"
                      name="username"
                      placeholder="사용자 이름"
                      value={registerForm.username}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">이메일</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={registerForm.email}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">비밀번호</Label>
                    <Input
                      id="register-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={registerForm.password}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">비밀번호 확인</Label>
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={registerForm.confirmPassword}
                      onChange={handleRegisterChange}
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="terms"
                      name="agreeTerms"
                      checked={registerForm.agreeTerms}
                      onCheckedChange={(checked) => setRegisterForm({ ...registerForm, agreeTerms: !!checked })}
                      required
                    />
                    <Label htmlFor="terms" className="text-sm">
                      <span>이용약관 및 </span>
                      <Link href="/privacy" className="text-[#2196F3] hover:underline">
                        개인정보 처리방침
                      </Link>
                      <span>에 동의합니다</span>
                    </Label>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full bg-[#FF5722] hover:bg-[#E64A19]"
                    disabled={isLoading || !registerForm.agreeTerms}
                  >
                    {isLoading ? "가입 중..." : "회원가입"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Pizza className="h-4 w-4 text-[#FF5722]" />
            <span>맛있는 무한리필 식당을 찾는 가장 쉬운 방법</span>
          </div>
        </div>
      </div>
    </div>
  )
}
