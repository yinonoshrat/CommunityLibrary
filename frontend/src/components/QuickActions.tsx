import { Button, Grid } from '@mui/material';
import { Add, Search, Stars, Group } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: <Add />, label: 'הוסף ספר', path: '/books/add' },
    { icon: <Search />, label: 'חפש ספרים', path: '/search' },
    { icon: <Stars />, label: 'המלצות', path: '/recommendations' },
    { icon: <Group />, label: 'המשפחה שלי', path: '/family' },
  ];

  return (
    <Grid container spacing={2}>
      {actions.map((action, index) => (
        <Grid size={{ xs: 6, sm: 3 }} key={index}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={action.icon}
            onClick={() => navigate(action.path)}
            sx={{ py: 1.5 }}
          >
            {action.label}
          </Button>
        </Grid>
      ))}
    </Grid>
  );
}
