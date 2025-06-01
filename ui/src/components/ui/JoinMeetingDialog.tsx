import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography } from '@mui/material'
import { X } from 'lucide-react'
import { useState } from 'react'
import useMeetingStore from '../../store/meetingStore'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

interface DialogProps {
  joinDialogOpen: boolean;
  setJoinDialogOpen: (state:boolean) => void;
}

const JoinMeetingDialog = ({joinDialogOpen, setJoinDialogOpen}:DialogProps) => {
  const [meetingID, setMeetingID] = useState('')
  const [meetingCode, setMeetingCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const user= useAuthStore(state => state.user);
  const {join} = useMeetingStore()
  const setUser = useAuthStore(state => state.setUser)
  // const [joinDialogOpen, setJoinDialogOpen] = useState(false)

  const navigate = useNavigate()
  

  const handleJoinMeeting = async() => {
    console.log('mncouiwo')
    if(isLoading) return
    console.log('sioi0e9')
    const name = user?.name || fullName
    try {
      setIsLoading(true)
      if(!meetingID || !meetingCode) {
        throw new Error('Input meeting ID and Passcode, and Name')
      }
      const meeting = await join(meetingID, meetingCode, name)
      if(meeting) {
        setUser(meeting.currentParticipant)
        console.log('remos', meetingID)
        navigate(`/meeting/${meetingID}`);
      }else {
        console.log('remos', 'eeee', meeting)
      }
    } catch (error: any) {
      throw new Error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
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
            // type="number"
            inputProps={{min:1}}
            fullWidth
            variant="outlined"
            value={meetingCode}
            onChange={(e) => setMeetingCode(e.target.value)}
            placeholder="0010110"
          />
          {!user && (
            <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Display Name"
            type="text"
            fullWidth
            variant="outlined"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ossan"
          />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setJoinDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleJoinMeeting()}
            disabled={!meetingID && !meetingCode  || isLoading}
          >
            {isLoading? <CircularProgress size={24} /> : 'Join Now'}
          </Button>
        </DialogActions>
    </Dialog>
  )
}

export default JoinMeetingDialog