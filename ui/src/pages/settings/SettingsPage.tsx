import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Tabs, 
  Tab, 
  Divider, 
  Switch, 
  FormControlLabel, 
  TextField, 
  MenuItem, 
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Stack
} from '@mui/material';

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const SettingsPage = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="settings tabs"
            sx={{
              px: 2,
              '& .MuiTab-root': {
                minHeight: '64px',
                textTransform: 'none',
                fontWeight: 500,
              }
            }}
          >
            <Tab label="General" id="settings-tab-0" />
            <Tab label="Audio & Video" id="settings-tab-1" />
            <Tab label="Notifications" id="settings-tab-2" />
            <Tab label="Background" id="settings-tab-3" />
          </Tabs>
        </Box>

        <CardContent>
          {/* General Settings */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom>
                Language & Region
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Language</InputLabel>
                    <Select
                      value="en"
                      label="Language"
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Español</MenuItem>
                      <MenuItem value="fr">Français</MenuItem>
                      <MenuItem value="de">Deutsch</MenuItem>
                    </Select>
                    <FormHelperText>
                      Choose your preferred language for the interface
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Time Zone</InputLabel>
                    <Select
                      value="utc-8"
                      label="Time Zone"
                    >
                      <MenuItem value="utc-8">Pacific Time (UTC-8)</MenuItem>
                      <MenuItem value="utc-5">Eastern Time (UTC-5)</MenuItem>
                      <MenuItem value="utc">UTC</MenuItem>
                      <MenuItem value="utc+1">Central European Time (UTC+1)</MenuItem>
                    </Select>
                    <FormHelperText>
                      Meeting times will be displayed in this time zone
                    </FormHelperText>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom>
                Theme & Appearance
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Theme</InputLabel>
                    <Select
                      value="light"
                      label="Theme"
                    >
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                      <MenuItem value="system">System Default</MenuItem>
                    </Select>
                    <FormHelperText>
                      Choose your preferred application theme
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Show animations"
                  />
                  <FormHelperText>
                    Enable or disable UI animations
                  </FormHelperText>
                </Grid>
              </Grid>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Security
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Require passcode for personal meetings"
                  />
                  <FormHelperText>
                    Participants will need to enter a passcode to join
                  </FormHelperText>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={<Switch />}
                    label="Enable waiting room"
                  />
                  <FormHelperText>
                    Participants will wait until you admit them
                  </FormHelperText>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button variant="outlined" color="primary">
                    Change Password
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Audio & Video Settings */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              Audio & Video Settings
            </Typography>
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom>
                Audio Settings
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Microphone</InputLabel>
                    <Select
                      value="default"
                      label="Microphone"
                    >
                      <MenuItem value="default">Default Microphone</MenuItem>
                      <MenuItem value="headset">Headset Microphone</MenuItem>
                      <MenuItem value="external">External Microphone</MenuItem>
                    </Select>
                    <FormHelperText>
                      Choose which microphone to use during meetings
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Speaker</InputLabel>
                    <Select
                      value="default"
                      label="Speaker"
                    >
                      <MenuItem value="default">Default Speaker</MenuItem>
                      <MenuItem value="headset">Headset Speaker</MenuItem>
                      <MenuItem value="external">External Speaker</MenuItem>
                    </Select>
                    <FormHelperText>
                      Choose which speaker to use during meetings
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Automatically mute my microphone when joining meetings"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Automatically adjust microphone volume"
                  />
                </Grid>
              </Grid>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Video Settings
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Camera</InputLabel>
                    <Select
                      value="default"
                      label="Camera"
                    >
                      <MenuItem value="default">Default Camera</MenuItem>
                      <MenuItem value="external">External Webcam</MenuItem>
                    </Select>
                    <FormHelperText>
                      Choose which camera to use during meetings
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Video Quality</InputLabel>
                    <Select
                      value="720p"
                      label="Video Quality"
                    >
                      <MenuItem value="480p">480p</MenuItem>
                      <MenuItem value="720p">720p (Recommended)</MenuItem>
                      <MenuItem value="1080p">1080p (Uses more bandwidth)</MenuItem>
                    </Select>
                    <FormHelperText>
                      Higher quality uses more bandwidth and CPU
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Turn off my video when joining meetings"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Always show participant names on their videos"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Enable HD video when available"
                  />
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Notifications Settings */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom>
                Meeting Notifications
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Meeting reminder notifications"
                  />
                  <FormHelperText>
                    Get notified before your scheduled meetings start
                  </FormHelperText>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Meeting invitation notifications"
                  />
                  <FormHelperText>
                    Get notified when you're invited to a meeting
                  </FormHelperText>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="In-meeting notifications"
                  />
                  <FormHelperText>
                    Get notified about chat messages and participant actions during meetings
                  </FormHelperText>
                </Grid>
              </Grid>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Email Notifications
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Send meeting invitations by email"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Send email reminders for upcoming meetings"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Reminder Time</InputLabel>
                    <Select
                      value="15"
                      label="Reminder Time"
                    >
                      <MenuItem value="5">5 minutes before</MenuItem>
                      <MenuItem value="10">10 minutes before</MenuItem>
                      <MenuItem value="15">15 minutes before</MenuItem>
                      <MenuItem value="30">30 minutes before</MenuItem>
                      <MenuItem value="60">1 hour before</MenuItem>
                    </Select>
                    <FormHelperText>
                      How far in advance to send meeting reminders
                    </FormHelperText>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Background Settings */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" gutterBottom>
              Background Settings
            </Typography>
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" gutterBottom>
                Virtual Background
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ width: 120, height: 80, border: '2px solid', borderColor: 'primary.main' }}>
                  <CardContent sx={{ p: 1 }}>
                    <Typography variant="caption">None</Typography>
                  </CardContent>
                </Card>
                
                <Card sx={{ width: 120, height: 80, opacity: 0.7 }}>
                  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
                    <Typography variant="caption">Blur</Typography>
                  </Box>
                </Card>
                
                <Card sx={{ width: 120, height: 80 }}>
                  <Box 
                    sx={{ 
                      height: '100%',
                      backgroundImage: 'url(https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                      backgroundSize: 'cover'
                    }}
                  />
                </Card>
                
                <Card sx={{ width: 120, height: 80 }}>
                  <Box 
                    sx={{ 
                      height: '100%',
                      backgroundImage: 'url(https://images.pexels.com/photos/1261728/pexels-photo-1261728.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                      backgroundSize: 'cover'
                    }}
                  />
                </Card>
              </Stack>
              
              <Button variant="outlined" sx={{ mr: 2 }}>
                Upload New Background
              </Button>
              <Button variant="outlined">
                Browse Gallery
              </Button>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Background Effects
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Enable AI background noise suppression"
                  />
                  <FormHelperText>
                    Automatically reduce background noise during meetings
                  </FormHelperText>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch />}
                    label="Use face enhancement"
                  />
                  <FormHelperText>
                    Subtly improve the appearance of your video
                  </FormHelperText>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch />}
                    label="Use low light adjustment"
                  />
                  <FormHelperText>
                    Automatically adjust video brightness in low light conditions
                  </FormHelperText>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;