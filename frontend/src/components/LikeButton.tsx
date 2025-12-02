import { useState, useEffect } from 'react';
import { IconButton, Box, Typography, Tooltip } from '@mui/material';
import { Favorite as FavoriteIcon, FavoriteBorder as FavoriteBorderIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useToggleBookLike } from '../hooks/useBookLikes';

interface LikeButtonProps {
  bookId: string;
  initialLiked?: boolean;
  initialCount?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
}

export default function LikeButton({ 
  bookId, 
  initialLiked = false, 
  initialCount = 0, 
  size = 'medium', 
  showCount = true 
}: LikeButtonProps) {
  const { user } = useAuth();
  
  // Track optimistic state separately to show instant feedback
  const [optimisticLiked, setOptimisticLiked] = useState(initialLiked);
  const [optimisticCount, setOptimisticCount] = useState(initialCount);
  const [isOptimistic, setIsOptimistic] = useState(false);

  // Update when props change (from cache updates), but only when not in optimistic state
  useEffect(() => {
    if (!isOptimistic) {
      setOptimisticLiked(initialLiked);
      setOptimisticCount(initialCount);
    } else {
      // If we're in optimistic mode and props have caught up with optimistic state, exit optimistic mode
      if (initialLiked === optimisticLiked && initialCount === optimisticCount) {
        setIsOptimistic(false);
      }
    }
  }, [initialLiked, initialCount, isOptimistic, optimisticLiked, optimisticCount]);
  
  // Use mutation with optimistic updates
  const toggleLike = useToggleBookLike(bookId, user?.id, {
    // Optimistically update local state immediately
    onMutate: () => {
      setIsOptimistic(true);
      setOptimisticLiked(prev => !prev);
      setOptimisticCount(prev => optimisticLiked ? Math.max(0, prev - 1) : prev + 1);
    },
    // On success, stay in optimistic mode until props catch up (handled in useEffect)
    onSuccess: () => {
      // Don't exit optimistic mode here - let useEffect handle it when props update
    },
    // On error, revert immediately
    onError: () => {
      setIsOptimistic(false);
      setOptimisticLiked(initialLiked);
      setOptimisticCount(initialCount);
    },
  });

  const handleToggleLike = async () => {
    if (!user?.id || toggleLike.isPending) return;
    toggleLike.mutate();
  };

  const liked = optimisticLiked;
  const likeCount = optimisticCount;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title={user ? (liked ? 'Unlike' : 'Like') : 'Login to like'}>
        <span>
          <IconButton
            onClick={handleToggleLike}
            disabled={!user || toggleLike.isPending}
            size={size}
            color={liked ? 'error' : 'default'}
            sx={{
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.1)',
              },
            }}
          >
            {liked ? <FavoriteIcon fontSize={size} /> : <FavoriteBorderIcon fontSize={size} />}
          </IconButton>
        </span>
      </Tooltip>
      {showCount && (
        <Typography variant="body2" color="text.secondary">
          {likeCount}
        </Typography>
      )}
    </Box>
  );
}
