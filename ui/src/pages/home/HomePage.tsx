import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Grid, 
  Divider,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Video, 
  Calendar, 
  Share2, 
  ChevronRight, 
  CheckCircle,
  Clock
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import meetingsData from '../../mocks/meetings.json';
import announcementsData from '../../mocks/announcements.json';
import JoinMeetingDialog from '../../components/ui/JoinMeetingDialog';

const HomePage = () => {
  const { user } = useAuthStore();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const theme = useTheme();

  // Get next meeting from mock data
  const upcomingMeeting = meetingsData.upcoming[0];
  
  // Parse date for display
  const meetingDate = new Date(upcomingMeeting?.startTime);
  const formattedTime = meetingDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Onboarding steps
  const onboardingSteps = [
    {
      title: 'Create your first meeting',
      description: 'Start a new meeting and invite participants',
      icon: <Video size={24} color={theme.palette.primary.main} />,
      completed: true
    },
    {
      title: 'Schedule a meeting',
      description: 'Plan ahead by scheduling a meeting',
      icon: <Calendar size={24} color={theme.palette.primary.main} />,
      completed: false
    },
    {
      title: 'Share your personal meeting link',
      description: 'Send your personal meeting link to connect instantly',
      icon: <Share2 size={24} color={theme.palette.primary.main} />,
      completed: false
    }
  ];


  useEffect(() => {
    // Auto-advance the onboarding step every 5 seconds
    const interval = setInterval(() => {
      setCurrentStep((prevStep) => (prevStep + 1) % onboardingSteps.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      {/* Welcome section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.name?.split(' ')[0]}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your meetings and updates at a glance
        </Typography>
      </Box>
      
      {/* Quick actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            component={RouterLink}
            to="/start-meeting"
            variant="contained"
            color="primary"
            fullWidth
            startIcon={<Video size={20} />}
            sx={{ p: 1.5, fontWeight: 500 }}
          >
            Start New Meeting
          </Button>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setJoinDialogOpen(true)}
            sx={{ p: 1.5, fontWeight: 500 }}
          >
            Join with Code
          </Button>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Button
            component={RouterLink}
            to="/meetings"
            variant="outlined"
            fullWidth
            startIcon={<Calendar size={20} />}
            sx={{ p: 1.5, fontWeight: 500 }}
          >
            Schedule a Meeting
          </Button>
        </Grid>
      </Grid>
      
      {/* Overview cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Next meeting card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" component="h2">
                  Next Meeting
                </Typography>
                <Chip 
                  label="Upcoming" 
                  size="small" 
                  color="primary" 
                  sx={{ fontWeight: 500 }}
                />
              </Box>
              
              {upcomingMeeting ? (
                <Box>
                  <Typography variant="h5" component="div" sx={{ mb: 1 }}>
                    {upcomingMeeting.title}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                    <Clock size={18} />
                    <Typography variant="body2" sx={{ ml: 1 }}>
                      Today at {formattedTime}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {upcomingMeeting.description}
                  </Typography>
                  
                  <Button
                    component={RouterLink}
                    to={upcomingMeeting.joinUrl}
                    variant="contained"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Join Meeting
                  </Button>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No upcoming meetings scheduled.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Stats card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                At a Glance
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'primary.light',
                      color: 'primary.contrastText',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="h4" component="div">
                      {meetingsData.upcoming.length}
                    </Typography>
                    <Typography variant="body2">
                      Upcoming Meetings
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'secondary.light',
                      color: 'secondary.contrastText',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="h4" component="div">
                      {meetingsData.upcoming.filter(m => 
                        new Date(m.startTime).toDateString() === new Date().toDateString()
                      ).length}
                    </Typography>
                    <Typography variant="body2">
                      Meetings Today
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2">
                  Profile Completion
                </Typography>
                <Typography variant="body2" color="primary">
                  80%
                </Typography>
              </Box>
              <Box
                sx={{
                  height: 8,
                  bgcolor: 'grey.200',
                  borderRadius: 4,
                  mt: 1
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: '80%',
                    bgcolor: 'primary.main',
                    borderRadius: 4
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Onboarding guide */}
      <Card sx={{ mb: 4, overflow: 'hidden' }}>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Getting Started
          </Typography>
          
          <Box sx={{ position: 'relative', minHeight: 130 }}>
            {onboardingSteps.map((step, index) => (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  width: '100%',
                  transition: 'all 0.5s ease',
                  opacity: currentStep === index ? 1 : 0,
                  transform: currentStep === index ? 'translateX(0)' : 'translateX(100%)',
                  display: 'flex',
                  alignItems: 'center',
                  visibility: currentStep === index ? 'visible' : 'hidden'
                }}
              >
                <Box sx={{ mr: 2 }}>
                  {step.icon}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      {step.title}
                    </Typography>
                    {step.completed && (
                      <CheckCircle 
                        size={16} 
                        color={theme.palette.success.main} 
                        style={{ marginLeft: '8px' }} 
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {step.description}
                  </Typography>
                </Box>
                <Button
                  variant="text"
                  endIcon={<ChevronRight size={18} />}
                  size="small"
                >
                  {step.completed ? 'Completed' : 'Get Started'}
                </Button>
              </Box>
            ))}
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            {onboardingSteps.map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: currentStep === index ? 'primary.main' : 'grey.300',
                  mx: 0.5,
                  cursor: 'pointer',
                }}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </Box>
        </CardContent>
      </Card>
      
      {/* Announcements */}
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Announcements & Tips
          </Typography>
          
          <Divider sx={{ mb: 2 }} />
          
          {announcementsData.announcements.map((announcement, index) => (
            <Box key={index}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {announcement.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(announcement.date).toLocaleDateString()}
                </Typography>
              </Box>
              <Typography variant="body2" paragraph>
                {announcement.content}
              </Typography>
              {index < announcementsData.announcements.length - 1 && (
                <Divider sx={{ my: 2 }} />
              )}
            </Box>
          ))}
        </CardContent>
      </Card>
      
      {/* Join meeting dialog
      <Dialog 
        open={joinDialogOpen} 
        onClose={() => setJoinDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2 }}>
          <DialogTitle sx={{ p: 0 }}>Join Meeting</DialogTitle>
          <IconButton onClick={() => setJoinDialogOpen(false)}>
            <X size={18} />
          </IconButton>
        </Box>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the meeting code provided by the meeting organizer
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            id="meetingId"
            label="Meeting ID"
            type="text"
            fullWidth
            variant="outlined"
            value={meetingID}
            onChange={(e) => setMeetingID(e.target.value)}
            placeholder="abc-defg-hij"
          />
          <TextField
            margin="dense"
            id="meetingCode"
            label="Meeting Code"
            type="number"
            fullWidth
            variant="outlined"
            value={meetingCode}
            onChange={(e) => setMeetingCode(e.target.value)}
            placeholder="abc-def-hij"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setJoinDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleJoinMeeting()}
            disabled={!meetingID && !meetingCode || isLoading}
          >
            {isLoading? <CircularProgress size={24} /> : 'Join Now'}
          </Button>
        </DialogActions>
      </Dialog> */}

      <JoinMeetingDialog joinDialogOpen={joinDialogOpen} setJoinDialogOpen={setJoinDialogOpen} />
    </Box>
  );
};

export default HomePage;