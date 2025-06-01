import { useState } from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  List, 
  ListItem, 
  Divider, 
  Chip,
  IconButton,
  useTheme
} from '@mui/material';
import { 
  Video, 
  Calendar, 
  Clock, 
  Users, 
  Link as LinkIcon, 
  Copy, 
  MoreVertical 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import meetingsData from '../../mocks/meetings.json';

// Custom TabPanel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`meeting-tabpanel-${index}`}
      aria-labelledby={`meeting-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const MeetingsPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const navigate = useNavigate();
  const theme = useTheme();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    console.log(event)
    setTabValue(newValue);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Would add a notification in a real app
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Meetings
        </Typography>
        <Button
          variant="contained"
          startIcon={<Calendar />}
          onClick={() => navigate('/start-meeting')}
        >
          Schedule Meeting
        </Button>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="meeting tabs"
            sx={{
              px: 2,
              '& .MuiTab-root': {
                minHeight: '64px',
                textTransform: 'none',
                fontWeight: 500,
              }
            }}
          >
            <Tab 
              icon={<Calendar />} 
              iconPosition="start" 
              label="Upcoming" 
              id="meeting-tab-0"
              aria-controls="meeting-tabpanel-0"
            />
            <Tab 
              icon={<Clock />} 
              iconPosition="start" 
              label="Previous" 
              id="meeting-tab-1"
              aria-controls="meeting-tabpanel-1"
            />
            <Tab 
              icon={<Video />} 
              iconPosition="start" 
              label="Personal Room" 
              id="meeting-tab-2"
              aria-controls="meeting-tabpanel-2"
            />
          </Tabs>
        </Box>

        {/* Upcoming Meetings Tab */}
        <TabPanel value={tabValue} index={0}>
          <List sx={{ px: 2 }}>
            {meetingsData.upcoming.length > 0 ? (
              meetingsData.upcoming.map((meeting, index) => (
                <Box key={meeting.id}>
                  <ListItem 
                    disablePadding 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      py: 2
                    }}
                  >
                    {/* Date and time */}
                    <Box sx={{ 
                      width: { xs: '100%', sm: '180px' }, 
                      mb: { xs: 2, sm: 0 },
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {formatDate(meeting.startTime)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                        <Clock size={16} style={{ marginRight: '4px' }} />
                        <Typography variant="body2">
                          {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Meeting details */}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                        {meeting.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Users size={16} style={{ color: theme.palette.text.secondary, marginRight: '4px' }} />
                        <Typography variant="body2" color="text.secondary">
                          {meeting.participants.length} participants
                        </Typography>
                      </Box>
                      {meeting.description && (
                        <Typography variant="body2" color="text.secondary">
                          {meeting.description}
                        </Typography>
                      )}
                    </Box>

                    {/* Actions */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: { xs: 'flex-end', sm: 'flex-end' },
                      width: { xs: '100%', sm: 'auto' },
                      mt: { xs: 2, sm: 0 }
                    }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => navigate(meeting.joinUrl)}
                        sx={{ mr: 1 }}
                      >
                        Join
                      </Button>
                      <IconButton size="small">
                        <MoreVertical size={18} />
                      </IconButton>
                    </Box>
                  </ListItem>
                  {index < meetingsData.upcoming.length - 1 && <Divider />}
                </Box>
              ))
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
                No upcoming meetings scheduled
              </Typography>
            )}
          </List>
        </TabPanel>

        {/* Previous Meetings Tab */}
        <TabPanel value={tabValue} index={1}>
          <List sx={{ px: 2 }}>
            {meetingsData.previous.length > 0 ? (
              meetingsData.previous.map((meeting, index) => (
                <Box key={meeting.id}>
                  <ListItem 
                    disablePadding 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      py: 2
                    }}
                  >
                    {/* Date and time */}
                    <Box sx={{ 
                      width: { xs: '100%', sm: '180px' }, 
                      mb: { xs: 2, sm: 0 } 
                    }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {formatDate(meeting.startTime)}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                        <Clock size={16} style={{ marginRight: '4px' }} />
                        <Typography variant="body2">
                          {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Meeting details */}
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                        {meeting.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Users size={16} style={{ color: theme.palette.text.secondary, marginRight: '4px' }} />
                        <Typography variant="body2" color="text.secondary">
                          {meeting.participants.length} participants
                        </Typography>
                      </Box>
                      {meeting.description && (
                        <Typography variant="body2" color="text.secondary">
                          {meeting.description}
                        </Typography>
                      )}
                    </Box>

                    {/* Actions */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: { xs: 'flex-end', sm: 'flex-end' },
                      width: { xs: '100%', sm: 'auto' },
                      mt: { xs: 2, sm: 0 }
                    }}>
                      <Chip 
                        label="Completed" 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(0, 150, 136, 0.1)', 
                          color: 'secondary.main',
                          mr: 1
                        }} 
                      />
                      <IconButton size="small">
                        <MoreVertical size={18} />
                      </IconButton>
                    </Box>
                  </ListItem>
                  {index < meetingsData.previous.length - 1 && <Divider />}
                </Box>
              ))
            ) : (
              <Typography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
                No previous meetings found
              </Typography>
            )}
          </List>
        </TabPanel>

        {/* Personal Meeting Room Tab */}
        <TabPanel value={tabValue} index={2}>
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Your Personal Meeting Room
            </Typography>
            
            <Typography variant="body2" paragraph>
              Your personal meeting room is always available. Use it for quick meetings without scheduling.
            </Typography>
            
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                bgcolor: 'rgba(63, 81, 181, 0.08)', 
                p: 2, 
                borderRadius: 1,
                mb: 3
              }}
            >
              <LinkIcon size={20} style={{ color: theme.palette.primary.main, marginRight: '8px' }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  flexGrow: 1, 
                  fontFamily: 'monospace', 
                  fontWeight: 500 
                }}
              >
                {window.location.origin}/meeting/personal-room
              </Typography>
              <IconButton 
                size="small" 
                onClick={() => copyToClipboard(`${window.location.origin}/meeting/personal-room`)}
                sx={{ color: 'primary.main' }}
              >
                <Copy size={18} />
              </IconButton>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<Video />}
                onClick={() => navigate('/meeting/personal-room')}
              >
                Start Meeting Now
              </Button>
              <Button
                variant="outlined"
                startIcon={<Copy />}
                onClick={() => copyToClipboard(`${window.location.origin}/meeting/personal-room`)}
              >
                Copy Invite Link
              </Button>
            </Box>
          </CardContent>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default MeetingsPage;