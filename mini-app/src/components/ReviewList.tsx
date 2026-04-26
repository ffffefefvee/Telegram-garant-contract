import React, { useState, useEffect } from 'react';
import { Review } from '../../types';
import { ReviewCard } from './ReviewCard';
import './ReviewList.css';

interface ReviewListProps {
  userId: string;
  limit?: number;
  onReviewClick?: (review: Review) => void;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  userId,
  limit = 10,
  onReviewClick,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  } | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      // В реальном приложении здесь будет API вызов
      // const response = await api.get(`/reviews/user/${userId}?limit=${limit}`);
      // setReviews(response.reviews);
      // setStats(response);
      
      // Mock data для демонстрации
      setReviews([
        {
          id: '1',
          authorId: 'author1',
          targetId: userId,
          type: 'buyer_to_seller',
          rating: 5,
          comment: 'Отличный продавец! Быстрая отправка, товар как в описании.',
          status: 'published',
          createdAt: new Date().toISOString(),
          helpfulCount: 3,
          notHelpfulCount: 0,
          isAnonymous: false,
          author: {
            id: 'author1',
            telegramId: 123456,
            telegramFirstName: 'Иван',
            telegramUsername: 'ivan123',
            balance: 0,
            reputationScore: 85,
            completedDeals: 10,
          },
        } as any,
      ]);

      setStats({
        total: 15,
        averageRating: 4.8,
        ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 11 },
      });
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHelpful = async (reviewId: string, isHelpful: boolean) => {
    try {
      // В реальном приложении здесь будет API вызов
      // await api.post(`/reviews/${reviewId}/helpful`, { isHelpful });
      
      setReviews(reviews.map(r => 
        r.id === reviewId 
          ? { ...r, helpfulCount: r.helpfulCount + (isHelpful ? 1 : 0) }
          : r
      ));
    } catch (error) {
      console.error('Failed to mark review helpful:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="review-list-loading">
        <div className="spinner"></div>
        <p>Загрузка отзывов...</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="review-list-empty">
        <p>Пока нет отзывов</p>
      </div>
    );
  }

  return (
    <div className="review-list">
      {stats && (
        <div className="review-stats">
          <div className="stats-average">
            <div className="average-value">{stats.averageRating}</div>
            <div className="average-stars">
              {'★'.repeat(Math.round(stats.averageRating))}
              {'☆'.repeat(5 - Math.round(stats.averageRating))}
            </div>
            <div className="average-total">{stats.total} отзывов</div>
          </div>

          <div className="stats-distribution">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = stats.ratingDistribution[rating] || 0;
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              
              return (
                <div key={rating} className="distribution-row">
                  <span className="distribution-rating">{rating} ★</span>
                  <div className="distribution-bar">
                    <div 
                      className="distribution-fill" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="distribution-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="reviews">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onHelpful={handleHelpful}
          />
        ))}
      </div>
    </div>
  );
};
