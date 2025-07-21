import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/use-translation';
import { FormattedReview } from '@/types/store';
import { logger } from '@/lib/logger';

interface UseReviewsProps {
  storeId: number;
}

interface ReviewFormData {
  rating: number;
  content: string;
}

export const useReviews = ({ storeId }: UseReviewsProps) => {
  const [reviews, setReviews] = useState<FormattedReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  // 리뷰 목록 조회
  const fetchReviews = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/reviews`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      } else {
        logger.error('리뷰 조회 실패:', response.statusText);
      }
    } catch (error) {
      logger.error('리뷰 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // 리뷰 제출
  const submitReview = useCallback(async (reviewData: ReviewFormData) => {
    if (!user) {
      toast({
        title: '로그인이 필요합니다',
        description: '리뷰를 작성하려면 로그인하세요.',
        variant: 'destructive',
      });
      return false;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData),
      });

      if (response.ok) {
        const data = await response.json();
        
        // 성공 메시지 표시
        toast({
          title: '리뷰가 등록되었습니다',
          description: '소중한 리뷰를 남겨주셔서 감사합니다.',
        });

        // 리뷰 목록 새로고침
        await fetchReviews();
        return true;
      } else {
        const errorData = await response.json();
        toast({
          title: '리뷰 등록 실패',
          description: errorData.message || '리뷰 등록 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      logger.error('리뷰 제출 오류:', error);
      toast({
        title: '리뷰 등록 실패',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, storeId, toast, fetchReviews]);

  // 리뷰 수정
  const updateReview = useCallback(async (reviewData: ReviewFormData) => {
    if (!user) {
      toast({
        title: '로그인이 필요합니다',
        description: '리뷰를 수정하려면 로그인하세요.',
        variant: 'destructive',
      });
      return false;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/reviews`, {
        method: 'POST', // API는 POST로 수정도 처리
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewData),
      });

      if (response.ok) {
        toast({
          title: '리뷰가 수정되었습니다',
          description: '리뷰가 성공적으로 업데이트되었습니다.',
        });

        // 리뷰 목록 새로고침
        await fetchReviews();
        return true;
      } else {
        const errorData = await response.json();
        toast({
          title: '리뷰 수정 실패',
          description: errorData.message || '리뷰 수정 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      logger.error('리뷰 수정 오류:', error);
      toast({
        title: '리뷰 수정 실패',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, storeId, toast, fetchReviews]);

  // 리뷰 삭제
  const deleteReview = useCallback(async () => {
    if (!user) {
      toast({
        title: '로그인이 필요합니다',
        description: '리뷰를 삭제하려면 로그인하세요.',
        variant: 'destructive',
      });
      return false;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/reviews`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: '리뷰가 삭제되었습니다',
          description: '리뷰가 성공적으로 삭제되었습니다.',
        });

        // 리뷰 목록 새로고침
        await fetchReviews();
        return true;
      } else {
        const errorData = await response.json();
        toast({
          title: '리뷰 삭제 실패',
          description: errorData.message || '리뷰 삭제 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      logger.error('리뷰 삭제 오류:', error);
      toast({
        title: '리뷰 삭제 실패',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [user, storeId, toast, fetchReviews]);

  // 내 리뷰 찾기
  const findMyReview = useCallback(() => {
    if (!user) return null;
    return reviews.find(review => review.userId === user.id) || null;
  }, [reviews, user]);

  // 평균 평점 계산
  const averageRating = useCallback(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  // 평점별 분포 계산
  const getRatingDistribution = useCallback(() => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      const rating = Math.floor(review.rating);
      if (rating >= 1 && rating <= 5) {
        distribution[rating as keyof typeof distribution]++;
      }
    });
    return distribution;
  }, [reviews]);

  // 리뷰 좋아요 토글
  const toggleLike = useCallback(async (reviewId: number) => {
    if (!user) {
      toast({
        title: t('login_required'),
        description: t('login_required_like'),
        variant: 'destructive',
      });
      return false;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/like`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: data.liked ? t('review_liked') : t('review_unliked'),
          description: data.message,
        });
        
        // 리뷰 목록 새로고침
        fetchReviews();
        return true;
      } else {
        const errorData = await response.json();
        toast({
          title: '오류 발생',
          description: errorData.error || '좋아요 처리 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      logger.error('좋아요 처리 오류:', error);
      toast({
        title: t('network_error'),
        description: t('network_error'),
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, fetchReviews, t]);

  // 리뷰 신고
  const reportReview = useCallback(async (reviewId: number, reason: string, description?: string) => {
    if (!user) {
      toast({
        title: t('login_required'),
        description: t('login_required_report'),
        variant: 'destructive',
      });
      return false;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, description }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: t('review_reported'),
          description: data.message,
        });
        return true;
      } else {
        const errorData = await response.json();
        toast({
          title: '신고 실패',
          description: errorData.error || '신고 처리 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      logger.error('신고 처리 오류:', error);
      toast({
        title: t('network_error'),
        description: t('network_error'),
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, t]);

  // 컴포넌트 마운트 시 리뷰 조회
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return {
    reviews,
    loading,
    submitting,
    myReview: findMyReview(),
    averageRating: averageRating(),
    ratingDistribution: getRatingDistribution(),
    totalReviews: reviews.length,
    actions: {
      fetchReviews,
      submitReview,
      updateReview,
      deleteReview,
      toggleLike,
      reportReview,
    },
  };
};