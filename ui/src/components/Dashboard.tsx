import React, { useState, useEffect } from 'react';
import { Plus, Video, Users, Calendar, LogOut } from 'lucide-react';
import { CreateMeetingModal } from './CreateMeetingModal';
import { MeetingCard } from './MeetingCard';
import { ThemeToggle } from './theme-toggle';
import { Button } from './ui/button';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Meeting, User } from '@/types';
import { toast } from 'sonner';
import { start } from '@/lib/webrtc';

interface DashboardProps {
  user: User;
  onStartMeeting: (meetingId: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  onStartMeeting, 
  onLogout 
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.id) return;

    // Query meetings where user is either host or recipient
    const meetingsQuery = query(
      collection(db, 'meetings'),
      where('participants', 'array-contains', user.id)
    );

    const unsubscribe = onSnapshot(
      meetingsQuery, 
      (snapshot) => {
        const meetingsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          scheduledFor: doc.data().scheduledFor?.toDate() || new Date(),
        })) as Meeting[];
        
        setMeetings(meetingsList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching meetings:', error);
        toast.error('Failed to load meetings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user.id]);

  const handleCreateMeeting = async (meetingId: string) => {
    setShowCreateModal(false);
    onStartMeeting(meetingId);
    // start()
  };

  const handleJoinMeeting = (meetingId: string) => {
    onStartMeeting(meetingId);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Video className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-semibold">MeetUp</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-foreground">{user.name}</span>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={onLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Meeting
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-card p-5 rounded-lg shadow">
              <div className="flex items-center">
                <Calendar className="h-6 w-6 text-primary" />
                <div className="ml-5">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Active Meetings
                  </dt>
                  <dd className="text-3xl font-semibold">
                    {meetings.filter(m => m.status === 'active').length}
                  </dd>
                </div>
              </div>
            </div>

            <div className="bg-card p-5 rounded-lg shadow">
              <div className="flex items-center">
                <Users className="h-6 w-6 text-primary" />
                <div className="ml-5">
                  <dt className="text-sm font-medium text-muted-foreground">
                    Pending Meetings
                  </dt>
                  <dd className="text-3xl font-semibold">
                    {meetings.filter(m => m.status === 'pending').length}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onJoin={handleJoinMeeting}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <CreateMeetingModal
          userId={user.id}
          onClose={() => setShowCreateModal(false)}
          onMeetingCreated={handleCreateMeeting}
        />
      )}
    </div>
  );
};