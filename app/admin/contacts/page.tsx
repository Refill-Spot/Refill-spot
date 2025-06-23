"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  Clock, 
  XCircle,
  Mail,
  Phone,
  MapPin,
  Store,
  MessageSquare,
  User
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/types/supabase";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

const statusMap = {
  pending: { label: "대기중", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  in_progress: { label: "처리중", color: "bg-blue-100 text-blue-800", icon: MessageSquare },
  completed: { label: "완료", color: "bg-green-100 text-green-800", icon: CheckCircle },
  closed: { label: "종료", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

const typeMap = {
  store_registration: { label: "가게 등록", icon: Store },
  inquiry: { label: "일반 문의", icon: MessageSquare },
  feedback: { label: "피드백", icon: User },
};

export default function AdminContactsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [filters, setFilters] = useState({
    status: "",
    type: "",
    search: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isAdminChecking, setIsAdminChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.status) params.append("status", filters.status);
      if (filters.type) params.append("type", filters.type);

      const response = await fetch(`/api/contact?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("문의사항을 불러오는데 실패했습니다.");
      }

      const data = await response.json();
      
      if (data.success) {
        setContacts(data.data.contacts);
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages,
        }));
      } else {
        throw new Error(data.message || "문의사항을 불러오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("문의사항 조회 오류:", error);
      toast({
        title: "오류",
        description: "문의사항을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateContactStatus = async (contactId: number, status: string) => {
    try {
      const response = await fetch(`/api/contact/${contactId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("상태 업데이트에 실패했습니다.");
      }

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "성공",
          description: "문의사항 상태가 업데이트되었습니다.",
        });
        
        // 목록 새로고침
        fetchContacts();
        
        // 선택된 연락처 업데이트
        if (selectedContact?.id === contactId) {
          setSelectedContact(prev => prev ? { ...prev, status: status as any } : null);
        }
      } else {
        throw new Error(data.message || "상태 업데이트에 실패했습니다.");
      }
    } catch (error) {
      console.error("상태 업데이트 오류:", error);
      toast({
        title: "오류",
        description: "상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 관리자 권한 확인
  const checkAdminStatus = async () => {
    try {
      if (!user) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/auth/check-admin');
      if (!response.ok) {
        throw new Error('권한 확인 실패');
      }

      const data = await response.json();
      if (data.success && data.data.isAdmin) {
        setIsAdmin(true);
      } else {
        router.push('/unauthorized');
        return;
      }
    } catch (error) {
      console.error('관리자 권한 확인 오류:', error);
      router.push('/unauthorized');
      return;
    } finally {
      setIsAdminChecking(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (isAdmin && !isAdminChecking) {
      fetchContacts();
    }
  }, [pagination.page, filters.status, filters.type, isAdmin, isAdminChecking]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR");
  };

  // 로딩 중이거나 관리자가 아닌 경우
  if (isAdminChecking) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#FF5722] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-gray-900">문의사항 관리</h1>
            <div className="ml-auto flex gap-2">
              <Badge variant="outline" className="text-sm">
                총 {pagination.total}건
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 문의사항 목록 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 필터 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  필터
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>상태</Label>
                    <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">전체</SelectItem>
                        <SelectItem value="pending">대기중</SelectItem>
                        <SelectItem value="in_progress">처리중</SelectItem>
                        <SelectItem value="completed">완료</SelectItem>
                        <SelectItem value="closed">종료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>유형</Label>
                    <Select value={filters.type} onValueChange={(value) => handleFilterChange("type", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="전체" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">전체</SelectItem>
                        <SelectItem value="store_registration">가게 등록</SelectItem>
                        <SelectItem value="inquiry">일반 문의</SelectItem>
                        <SelectItem value="feedback">피드백</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>검색</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="이름, 이메일 검색"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 문의사항 리스트 */}
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-[#FF5722] border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-2 text-gray-500">로딩중...</p>
                </div>
              ) : contacts.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">문의사항이 없습니다.</p>
                  </CardContent>
                </Card>
              ) : (
                contacts.map((contact) => {
                  const statusInfo = statusMap[contact.status];
                  const typeInfo = typeMap[contact.type];
                  const StatusIcon = statusInfo.icon;
                  const TypeIcon = typeInfo.icon;

                  return (
                    <Card
                      key={contact.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedContact?.id === contact.id ? "ring-2 ring-[#FF5722]" : ""
                      }`}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <TypeIcon className="w-4 h-4 text-[#FF5722]" />
                              <span className="font-medium">{typeInfo.label}</span>
                              <Badge className={statusInfo.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1">{contact.name}</h3>
                            <p className="text-sm text-gray-600 mb-2">{contact.email}</p>
                            <p className="text-sm text-gray-700 line-clamp-2">{contact.message}</p>
                            {contact.store_name && (
                              <p className="text-sm text-[#FF5722] mt-1">가게: {contact.store_name}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{formatDate(contact.created_at)}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedContact(contact);
                              }}
                              className="mt-2"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  이전
                </Button>
                <span className="flex items-center px-3 text-sm">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  다음
                </Button>
              </div>
            )}
          </div>

          {/* 문의사항 상세 */}
          <div className="lg:col-span-1">
            {selectedContact ? (
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    문의 상세
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">문의 유형</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const TypeIcon = typeMap[selectedContact.type].icon;
                        return <TypeIcon className="w-4 h-4 text-[#FF5722]" />;
                      })()}
                      <span>{typeMap[selectedContact.type].label}</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">상태</Label>
                    <div className="mt-2">
                      <Select
                        value={selectedContact.status}
                        onValueChange={(value) => updateContactStatus(selectedContact.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">대기중</SelectItem>
                          <SelectItem value="in_progress">처리중</SelectItem>
                          <SelectItem value="completed">완료</SelectItem>
                          <SelectItem value="closed">종료</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">연락처 정보</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{selectedContact.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{selectedContact.email}</span>
                      </div>
                      {selectedContact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{selectedContact.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedContact.store_name && (
                    <div>
                      <Label className="text-sm font-medium">가게 정보</Label>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{selectedContact.store_name}</span>
                        </div>
                        {selectedContact.store_address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-sm">{selectedContact.store_address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium">문의 내용</Label>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedContact.message}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 pt-2 border-t">
                    <p>접수: {formatDate(selectedContact.created_at)}</p>
                    <p>수정: {formatDate(selectedContact.updated_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">문의사항을 선택하여 상세 정보를 확인하세요.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}