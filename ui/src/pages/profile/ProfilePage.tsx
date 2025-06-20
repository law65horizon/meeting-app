import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Avatar, 
  Button, 
  TextField, 
  Grid, 
  Divider,
  IconButton,
  Stack
} from '@mui/material';
import { Edit, Camera, Save } from 'lucide-react';
import useAuthStore from '../../store/authStore';

const ProfilePage = () => {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [jobTitle, setJobTitle] = useState('Product Manager');
  const [department, setDepartment] = useState('Product');
  const [timezone, setTimezone] = useState('Pacific Time (UTC-8)');
  
  const handleSave = () => {
    // In a real app, would save to API
    setEditing(false);
  };
  
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Profile
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={user?.avatar}
                  alt={user?.name || 'User'}
                  sx={{ width: 120, height: 120, mb: 2 }}
                />
                <IconButton 
                  sx={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    right: 0, 
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  }}
                >
                  <Camera size={18} />
                </IconButton>
              </Box>
              
              <Typography variant="h5" sx={{ mt: 2, fontWeight: 500 }}>
                {user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {jobTitle} • {department}
              </Typography>
              
              <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                Personal Meeting ID: <br />
                <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  345-678-901
                </Box>
              </Typography>
              
              <Button 
                variant="outlined" 
                sx={{ mt: 3 }}
                fullWidth
              >
                Copy Personal Meeting Link
              </Button>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stats
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Meetings Hosted
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  27
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Meetings Attended
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  42
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Meeting Hours
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  78h 25m
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Average Meeting Length
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  48m
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Profile Information
                </Typography>
                <Button
                  startIcon={editing ? <Save size={18} /> : <Edit size={18} />}
                  onClick={() => editing ? handleSave() : setEditing(true)}
                  variant={editing ? "contained" : "outlined"}
                >
                  {editing ? "Save Changes" : "Edit Profile"}
                </Button>
              </Box>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Full Name"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email Address"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Job Title"
                    fullWidth
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Department"
                    fullWidth
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Time Zone"
                    fullWidth
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 4 }} />
              
              <Typography variant="h6" gutterBottom>
                Meeting Preferences
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Personal Meeting ID"
                    fullWidth
                    value="345-678-901"
                    disabled
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Default Meeting Length"
                    fullWidth
                    value="30"
                    disabled={!editing}
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Default Personal Meeting Passcode"
                    fullWidth
                    value="123456"
                    type="password"
                    disabled={!editing}
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 4 }} />
              
              <Typography variant="h6" gutterBottom>
                Security & Privacy
              </Typography>
              
              <Stack spacing={2}>
                <Button variant="outlined" color="primary" sx={{ alignSelf: 'flex-start' }}>
                  Change Password
                </Button>
                <Button variant="outlined" color="primary" sx={{ alignSelf: 'flex-start' }}>
                  Enable Two-Factor Authentication
                </Button>
                <Button variant="outlined" color="primary" sx={{ alignSelf: 'flex-start' }}>
                  Connected Accounts
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProfilePage;