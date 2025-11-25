import {
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  BookmarkAdded,
  SwapHoriz,
  RateReview,
  CheckCircle,
} from '@mui/icons-material';

interface ActivityItem {
  id: string;
  type: 'book_added' | 'loan_requested' | 'loan_returned' | 'review_added';
  message: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'book_added':
        return <BookmarkAdded color="primary" />;
      case 'loan_requested':
        return <SwapHoriz color="secondary" />;
      case 'loan_returned':
        return <CheckCircle color="success" />;
      case 'review_added':
        return <RateReview color="info" />;
      default:
        return <BookmarkAdded />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          פעילות אחרונה
        </Typography>
        {activities.length === 0 ? (
          <Box py={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              אין פעילות אחרונה
            </Typography>
          </Box>
        ) : (
          <List>
            {activities.map((activity) => (
              <ListItem key={activity.id} disablePadding sx={{ mb: 1 }}>
                <ListItemIcon>{getIcon(activity.type)}</ListItemIcon>
                <ListItemText
                  primary={activity.message}
                  secondary={activity.timestamp}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
