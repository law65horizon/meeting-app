import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Grid, 
  Paper, 
  Card, 
  CardContent, 
  Divider, 
  IconButton, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import { 
  Video, 
  Calendar, 
  Users, 
  Clock, 
  Copy, 
  Link as LinkIcon,
  PlusCircle,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import useAuthStore from '../../store/authStore';
import useMeetingStore from '../../store/meetingStore';
import CreateMeetingDialog from '../../components/ui/CreateMeetingDialog';

const StartMeetingPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | null>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const {create} = useMeetingStore()
  
  const personalMeetingUrl = `${window.location.origin}/meeting/personal-room`;
  
  const handleStartInstantMeeting = async() => {
    if(isLoading) return
    try {
      const passcode: number = Math.floor(100000 + Math.random() * 900000); // 6-digit number
      setIsLoading(true)
      const meetingId = await create(isPrivate, passcode, participants)
      navigate(`/meeting/${meetingId}`);
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  };
  
  const handleScheduleMeeting = () => {
    // In a real app, would save the meeting to API
    console.log({
      title: meetingTitle,
      date: meetingDate,
      startTime,
      endTime,
      participants,
      isRecurring,
      description
    });
    
    setScheduleDialogOpen(false);
    // Navigate to the meetings page to show scheduled meetings
    navigate('/meetings');
  };
  
  const handleAddParticipant = () => {
    if (newParticipant && !participants.includes(newParticipant)) {
      setParticipants([...participants, newParticipant]);
      setNewParticipant('');
    }
  };
  
  const handleRemoveParticipant = (email: string) => {
    setParticipants(participants.filter(p => p !== email));
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Would add a notification in a real app
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Start or Schedule a Meeting
      </Typography>
      
      <Grid container spacing={3}>
        {/* Instant meeting card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Video color="#3f51b5" size={24} style={{ marginRight: 8 }} />
                <Typography variant="h6">
                  Start an Instant Meeting
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Start a meeting and invite people to join right away using your personal meeting room.
              </Typography>
              
              <Box sx={{ flexGrow: 1 }} />
              
              <Button
                variant="contained"
                size="large"
                startIcon={<Video />}
                onClick={() => setCreateDialogOpen(true)}
                sx={{ mb: 2 }}
                disabled={isLoading}
              >
                {isLoading? <CircularProgress size={24} /> : 'Start Meeting Now'}
              </Button>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                Your Personal Meeting ID
              </Typography>
              
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'rgba(63, 81, 181, 0.04)',
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace', 
                    fontWeight: 500,
                    flexGrow: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {personalMeetingUrl}
                </Typography>
                <IconButton 
                  size="small" 
                  color="primary"
                  onClick={() => copyToClipboard(personalMeetingUrl)}
                >
                  <Copy size={18} />
                </IconButton>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Schedule meeting card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Calendar color="#3f51b5" size={24} style={{ marginRight: 8 }} />
                <Typography variant="h6">
                  Schedule a Meeting
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Plan ahead by scheduling a meeting and inviting participants. They will receive notification emails.
              </Typography>
              
              <Box
                sx={{
                  p: 3,
                  backgroundColor: 'rgba(63, 81, 181, 0.04)',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  mb: 3
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Calendar size={20} style={{ marginRight: 8 }} />
                  <Typography variant="body2">
                    Set a date, time, and invite participants
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Users size={20} style={{ marginRight: 8 }} />
                  <Typography variant="body2">
                    Participants will receive email invitations
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Clock size={20} style={{ marginRight: 8 }} />
                  <Typography variant="body2">
                    Set up recurring meetings for regular events
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ flexGrow: 1 }} />
              
              <Button
                variant="outlined"
                size="large"
                startIcon={<Calendar />}
                onClick={() => setScheduleDialogOpen(true)}
              >
                Schedule Meeting
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Recent/favorite meetings section */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Access
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={500} gutterBottom>
                      Weekly Team Sync
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                      <Clock size={16} style={{ marginRight: 4 }} />
                      <Typography variant="caption">
                        Every Monday 10:00 AM
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 2 }}>
                      <Users size={16} style={{ marginRight: 4 }} />
                      <Typography variant="caption">
                        5 participants
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', mt: 'auto' }}>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ flexGrow: 1 }}
                        onClick={() => navigate('/meeting/m1')}
                      >
                        Join
                      </Button>
                      <IconButton size="small" color="primary" sx={{ ml: 1 }}>
                        <LinkIcon size={18} />
                      </IconButton>
                    </Box>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4} lg={3}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={500} gutterBottom>
                      Product Planning
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                      <Clock size={16} style={{ marginRight: 4 }} />
                      <Typography variant="caption">
                        Today 2:00 PM
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 2 }}>
                      <Users size={16} style={{ marginRight: 4 }} />
                      <Typography variant="caption">
                        3 participants
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', mt: 'auto' }}>
                      <Button
                        variant="contained"
                        size="small"
                        sx={{ flexGrow: 1 }}
                        onClick={() => navigate('/meeting/m2')}
                      >
                        Join
                      </Button>
                      <IconButton size="small" color="primary" sx={{ ml: 1 }}>
                        <LinkIcon size={18} />
                      </IconButton>
                    </Box>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4} lg={3}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      borderRadius: 2,
                      border: '1px dashed',
                      borderColor: 'divider',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <IconButton
                      color="primary"
                      sx={{ mb: 1 }}
                      onClick={() => setScheduleDialogOpen(true)}
                    >
                      <PlusCircle size={24} />
                    </IconButton>
                    <Typography variant="body2" color="text.secondary">
                      Schedule New Meeting
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Schedule meeting dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2 }}>
          <DialogTitle sx={{ p: 0 }}>Schedule a Meeting</DialogTitle>
          <IconButton onClick={() => setScheduleDialogOpen(false)}>
            <X size={18} />
          </IconButton>
        </Box>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Meeting Title"
                fullWidth
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="e.g., Weekly Team Sync"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date"
                  value={meetingDate}
                  onChange={(newValue) => setMeetingDate(newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                }
                label="Recurring meeting"
              />
            </Grid>
            
            {isRecurring && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Recurrence</InputLabel>
                  <Select
                    value="weekly"
                    label="Recurrence"
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Participants
              </Typography>
              
              <Box sx={{ display: 'flex', mb: 2 }}>
                <TextField
                  label="Add by email"
                  fullWidth
                  size="small"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  placeholder="email@example.com"
                />
                <Button 
                  variant="contained" 
                  sx={{ ml: 1 }}
                  onClick={handleAddParticipant}
                >
                  Add
                </Button>
              </Box>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                {participants.length > 0 ? (
                  participants.map((email, index) => (
                    <Box 
                      key={index} 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        mb: index < participants.length - 1 ? 1 : 0 
                      }}
                    >
                      <Typography variant="body2">{email}</Typography>
                      <IconButton 
                        size="small" 
                        onClick={() => handleRemoveParticipant(email)}
                      >
                        <X size={16} />
                      </IconButton>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No participants added yet. Add participants by email.
                  </Typography>
                )}
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Meeting Description (Optional)"
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add any details about this meeting..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setScheduleDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleScheduleMeeting}
            disabled={!meetingTitle}
          >
            Schedule Meeting
          </Button>
        </DialogActions>
      </Dialog>

      <CreateMeetingDialog 
        setJoinDialogOpen={setCreateDialogOpen}  
        joinDialogOpen={createDialogOpen} 
        meetingTitle={meetingTitle}
        isPrivate={isPrivate}
        setIsPrivate={setIsPrivate}
        setMeetingTitle={setMeetingTitle}
        setDescription={setDescription}
        description={description}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />
    </Box>
  );
};

export default StartMeetingPage;