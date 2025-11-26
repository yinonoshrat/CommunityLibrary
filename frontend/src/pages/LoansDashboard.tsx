import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Alert
} from '@mui/material';
import LoanCard from '../components/LoanCard';
import ReturnBookDialog from '../components/ReturnBookDialog';
import Navbar from '../components/Navbar';

interface Loan {
  id: string;
  status: string;
  request_date?: string;
  actual_return_date?: string;
  notes?: string;
  family_books?: {
    book_catalog: {
      title?: string;
      title_hebrew?: string;
      author?: string;
      author_hebrew?: string;
      cover_image_url?: string;
    };
  };
  books?: {
    title?: string;
    title_hebrew?: string;
    author?: string;
    author_hebrew?: string;
    cover_image_url?: string;
  };
  borrower_family?: {
    name: string;
    phone: string;
    whatsapp?: string;
  };
  owner_family?: {
    name: string;
    phone: string;
    whatsapp?: string;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`loans-tabpanel-${index}`}
      aria-labelledby={`loans-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function LoansDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [lentLoans, setLentLoans] = useState<Loan[]>([]);
  const [borrowedLoans, setBorrowedLoans] = useState<Loan[]>([]);
  const [historyLoans, setHistoryLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Get user info from localStorage
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const familyId = user?.family_id;

  useEffect(() => {
    if (familyId) {
      fetchLoans();
    }
  }, [familyId]);

  const fetchLoans = async () => {
    if (!familyId) return;

    setLoading(true);
    setError('');

    try {
      // Fetch books we lent out (active)
      const lentResponse = await fetch(
        `/api/loans?ownerFamilyId=${familyId}&status=active`
      );
      const lentData = await lentResponse.json();

      // Fetch books we borrowed (active)
      const borrowedResponse = await fetch(
        `/api/loans?borrowerFamilyId=${familyId}&status=active`
      );
      const borrowedData = await borrowedResponse.json();

      // Fetch history (returned loans - both lent and borrowed)
      const historyLentResponse = await fetch(
        `/api/loans?ownerFamilyId=${familyId}&status=returned`
      );
      const historyLentData = await historyLentResponse.json();

      const historyBorrowedResponse = await fetch(
        `/api/loans?borrowerFamilyId=${familyId}&status=returned`
      );
      const historyBorrowedData = await historyBorrowedResponse.json();

      if (lentResponse.ok && borrowedResponse.ok) {
        setLentLoans(lentData.loans || []);
        setBorrowedLoans(borrowedData.loans || []);
        
        // Combine history from both lent and borrowed
        const allHistory = [
          ...(historyLentData.loans || []),
          ...(historyBorrowedData.loans || [])
        ].sort((a, b) => {
          const dateA = new Date(a.actual_return_date || a.request_date || 0);
          const dateB = new Date(b.actual_return_date || b.request_date || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setHistoryLoans(allHistory);
      } else {
        setError('שגיאה בטעינת ההשאלות');
      }
    } catch (err) {
      console.error('Error fetching loans:', err);
      setError('שגיאה בטעינת ההשאלות');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleReturnClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setReturnDialogOpen(true);
  };

  const handleReturnSuccess = () => {
    fetchLoans(); // Refresh the loans list
  };

  if (loading) {
    return (
      <>
        <Navbar user={user} />
        <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Navbar user={user} />
      <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 } }}>
        <Box mb={4}>
          <Typography variant="h4" component="h1" gutterBottom>
            ניהול השאלות
          </Typography>
          <Typography variant="body1" color="text.secondary">
            כאן תוכלו לנהל את ההשאלות - ספרים שהשאלתם ושאלתם
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="loan tabs">
            <Tab label={`ספרים שהשאלנו (${lentLoans.length})`} />
            <Tab label={`ספרים ששאלנו (${borrowedLoans.length})`} />
            <Tab label={`היסטוריה (${historyLoans.length})`} />
          </Tabs>
        </Box>

        {/* Books We Lent Tab */}
        <TabPanel value={tabValue} index={0}>
          {lentLoans.length === 0 ? (
            <Alert severity="info">אין ספרים מושאלים כרגע</Alert>
          ) : (
            lentLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                type="lent"
                onReturn={handleReturnClick}
              />
            ))
          )}
        </TabPanel>

        {/* Books We Borrowed Tab */}
        <TabPanel value={tabValue} index={1}>
          {borrowedLoans.length === 0 ? (
            <Alert severity="info">אין ספרים שאולים כרגע</Alert>
          ) : (
            borrowedLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} type="borrowed" />
            ))
          )}
        </TabPanel>

        {/* History Tab */}
        <TabPanel value={tabValue} index={2}>
          {historyLoans.length === 0 ? (
            <Alert severity="info">אין היסטוריית השאלות</Alert>
          ) : (
            historyLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} type="history" />
            ))
          )}
        </TabPanel>

        {/* Return Book Dialog */}
        {selectedLoan && (
          <ReturnBookDialog
            open={returnDialogOpen}
            onClose={() => setReturnDialogOpen(false)}
            loan={selectedLoan}
            onSuccess={handleReturnSuccess}
          />
        )}
      </Container>
    </>
  );
}
