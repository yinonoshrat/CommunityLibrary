import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { Book, Repeat, HourglassEmpty, Groups } from '@mui/icons-material';

interface QuickStatsProps {
  booksCount: number;
  activeLoansCount: number;
  pendingRequestsCount: number;
  familiesCount: number;
}

export default function QuickStats({
  booksCount,
  activeLoansCount,
  pendingRequestsCount,
  familiesCount,
}: QuickStatsProps) {
  const stats = [
    { icon: <Book fontSize="large" />, value: booksCount, label: 'ספרים בקטלוג' },
    { icon: <Repeat fontSize="large" />, value: activeLoansCount, label: 'השאלות פעילות' },
    { icon: <HourglassEmpty fontSize="large" />, value: pendingRequestsCount, label: 'בקשות ממתינות' },
    { icon: <Groups fontSize="large" />, value: familiesCount, label: 'משפחות בקהילה' },
  ];

  return (
    <Grid container spacing={2}>
      {stats.map((stat, index) => (
        <Grid size={{ xs: 6, sm: 3 }} key={index}>
          <Card>
            <CardContent>
              <Box display="flex" flexDirection="column" alignItems="center">
                <Box color="primary.main" mb={1}>
                  {stat.icon}
                </Box>
                <Typography variant="h4" component="div">
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {stat.label}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
