import { useState, useEffect } from 'react';
import { IconButton, Box, Typography, Tooltip } from '@mui/material';
import { Favorite as FavoriteIcon, FavoriteBorder as FavoriteBorderIcon } from '@mui/icons-material';
import { apiCall } from '../utils/apiCall';
import { useAuth } from '../contexts/AuthContext';

interface LikeButtonProps {
  bookId: string;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
}

export default function LikeButton({ bookId, size = 'medium', showCount = true }: LikeButtonProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLikes();
  }, [bookId]);

  const loadLikes = async () => {
    try {
      const data = await apiCall(`/api/books/${bookId}/likes`);
      setLikeCount(data.count || 0);
      setLiked(data.likes?.some((like: any) => like.user_id === user?.id) || false);
    } catch (err) {
      console.error('Error loading likes:', err);
    }
  };

  const handleToggleLike = async () => {
    if (!user?.id || loading) return;

    try {
      setLoading(true);
      const data = await apiCall(`/api/books/${bookId}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
        }),
      });

      // Update UI based on server response
      if (data.liked === true) {
        setLiked(true);
        setLikeCount(prev => prev + 1);
      } else if (data.liked === false) {
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title={liked ? 'הסר מהמועדפים' : 'הוסף למועדפים'}>
        <IconButton
          onClick={handleToggleLike}
          disabled={loading}
          size={size}
          color={liked ? 'error' : 'default'}
          sx={{
            transition: 'transform 0.2s',
            '&:hover': {
              transform: 'scale(1.1)',
            },
          }}
        >
          {liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
      </Tooltip>
      
      {showCount && likeCount > 0 && (
        <Typography variant="body2" color="text.secondary">
          {likeCount}
        </Typography>
      )}
    </Box>
  );
}
