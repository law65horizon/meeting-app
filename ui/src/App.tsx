import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { AuthForm } from "./components/AuthForm";
import { Dashboard } from "./components/Dashboard";
import { ThemeToggle } from "./components/theme-toggle";
import { closeConnection, start } from "./lib/webrtc";
import { useAuth } from "./hooks/useAuth";
import {
  signIn,
  createUser,
  logout,
  joinMeeting,
  onMeetingUpdate,
  auth,
} from "./lib/firebase";
import {getDoc, doc} from 'firebase/firestore'
import type { Participant, ChatMessage, User } from "./types";
import MeetingForum from "./components/MeetingForum";

function App() {
  const { user: firebaseUser, loading } = useAuth();
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<User | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants_data, setParticipants_data] = useState<Participant[]>([]);

  useEffect(() => {
    const path = window.location.pathname;
    const meetingId = path.split('/join/')[1];
    if (meetingId && firebaseUser) {
      handleStartMeeting(meetingId);
    }
  }, [firebaseUser]);

  const handleAuth = useCallback(
    async (data: { email: string; password: string; name?: string }) => {
      try {
        let authUser;
        if (authMode === "signup") {
          authUser = await createUser(data.email, data.password);
          toast.success("Account created successfully!");
        } else {
          authUser = await signIn(data.email, data.password);
          toast.success("Signed in successfully!");
        }
        const path = window.location.pathname;
        const meetingId = path.split("/join/")[1];
        if (meetingId) {
          handleStartMeeting(meetingId);
        }
      } catch (error: any) {
        toast.error(error.message);
      }
    },
    [authMode]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      closeConnection(false);
      setIsInCall(false);
      toast.success("Logged out successfully");
    } catch (error: any) {
      toast.error("Failed to logout: " + error.message);
    }
  }, [closeConnection]);

  const handleStartMeeting = useCallback(
    async (meetingId: string) => {
      try {
        if (!firebaseUser) {
          throw new Error("Please sign in to join the meeting");
        }
        const meetingData = await joinMeeting(meetingId, firebaseUser.uid);
        setCurrentMeetingId(meetingId);
        setIsInitiator(meetingData.hostId === firebaseUser.uid);
        const exe = meetingData.participants_data;
        exe.forEach((item: any) => {
          item.isMuted = isMuted;
          item.isVideoOff = isVideoOff;
          item.isScreenSharing = isScreenSharing;
          if (item.id === firebaseUser.uid) {
            item.local = true;
          }
        });
        setParticipants_data(exe);
        console.log(firebaseUser.uid)
        const stream = await start(meetingId, firebaseUser.uid);
        if (stream) {
          setIsInCall(true);
          setLocalStream(stream); // Keep the stream
          toast.success("Joined meeting successfully");
        } else {
          throw new Error("Failed to access media devices");
        }
      } catch (error: any) {
        toast.error("Failed to join meeting: " + error.message);
        console.log(error.message)
      }
    },
    [firebaseUser, isMuted, isVideoOff, isScreenSharing]
  );

  useEffect(() => {
    if (!currentMeetingId || !isInCall) return;

    const unsubscribe = onMeetingUpdate(currentMeetingId, (data) => {
      // console.log('App.tsx meeting update:', data);
      if (data.participants_data) {
        const updatedParticipants = data.participants_data.map((item: any) => ({
          ...item,
          isMuted: item.id === firebaseUser?.uid ? isMuted : item.isMuted ?? false,
          isVideoOff: item.id === firebaseUser?.uid ? isVideoOff : item.isVideoOff ?? false,
          isScreenSharing: item.id === firebaseUser?.uid ? isScreenSharing : item.isScreenSharing ?? false,
          local: item.id === firebaseUser?.uid,
        }));
        console.log('Updating participants_data:', updatedParticipants);
        setParticipants_data(updatedParticipants);
      }else{
        console.log('wwwwhowo')
      }
    });

    return () => unsubscribe();
  }, [currentMeetingId, isInCall, firebaseUser, isMuted, isVideoOff, isScreenSharing]);

  // const handleStartMeeting = useCallback(
  //   async (meetingId: string) => {
  //     try {
  //       if (!firebaseUser) {
  //         throw new Error("Please sign in to join the meeting");
  //       }
  //       const meetingData = await joinMeeting(meetingId, firebaseUser.uid);
  //       setCurrentMeetingId(meetingId);
  //       setIsInitiator(meetingData.hostId === firebaseUser.uid);
  //       const exe = meetingData.participants_data;
  //       exe.forEach((item: any) => {
  //         item.isMuted = isMuted;
  //         item.isVideoOff = isVideoOff;
  //         item.isScreenSharing = isScreenSharing;
  //         if (item.id === firebaseUser.uid) {
  //           item.local = true;
  //         }
  //       });
  //       console.log('Updated participants_data:', exe);
  //       setParticipants_data(exe);
  //       const stream = await start();
  //       if (stream) {
  //         setIsInCall(true);
  //         setLocalStream(stream);
  //         toast.success("Joined meeting successfully");
  //       } else {
  //         throw new Error("Failed to access media devices");
  //       }
  //       // Fetch updated meeting data to ensure all participants are included
  //       const updatedMeeting = await getDoc(doc(db, "meetings", meetingId));
  //       if (updatedMeeting.exists()) {
  //         const updatedData = updatedMeeting.data();
  //         setParticipants_data(updatedData.participants_data);
  //       }
  //     } catch (error: any) {
  //       toast.error("Failed to join meeting: " + error.message);
  //     }
  //   },
  //   [firebaseUser, isMuted, isVideoOff, isScreenSharing]
  // );

  const handleToggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
      toast.info(!isMuted ? "Microphone muted" : "Microphone unmuted");
    }
    else console.warn('no local stream')
  }, [localStream, isMuted]);

  const handleToggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
      toast.info(!isVideoOff ? "Camera turned off" : "Camera turned on");
    }
  }, [localStream, isVideoOff]);

  const handleToggleScreenShare = useCallback(() => {
    setIsScreenSharing((prev) => !prev);
    toast.info(
      !isScreenSharing ? "Screen sharing started" : "Screen sharing stopped"
    );
  }, [isScreenSharing]);

  const handleToggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const handleLeaveCall = useCallback(() => {
    closeConnection(isInitiator);
    setIsInCall(false);
    setCurrentMeetingId(null);
    setOtherParticipant(null);
    toast.info("Left the meeting");
    window.location.href = "/";
  }, [closeConnection, isInitiator]);

  const handleSendMessage = useCallback(
    (content: string) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: firebaseUser?.uid || "",
        senderName: firebaseUser?.email?.split("@")[0] || "Anonymous",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    [firebaseUser]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <AuthForm
          mode={authMode}
          onSubmit={handleAuth}
          onToggleMode={() =>
            setAuthMode(authMode === "signin" ? "signup" : "signin")
          }
        />
      </div>
    );
  }

  if (!isInCall && !window.location.pathname.includes("/join/")) {
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || "",
      name:
        firebaseUser.displayName ||
        firebaseUser.email?.split("@")[0] ||
        "Anonymous",
    };
    return (
      <Dashboard
        user={user}
        onStartMeeting={handleStartMeeting}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <MeetingForum
      isChatOpen={isChatOpen}
      isMuted={isMuted}
      isVideoOff={isVideoOff}
      participants={participants_data}
      isScreenSharing={isScreenSharing}
      meetingId={currentMeetingId || ""}
      pendingRequests={[]}
      onToggleMute={handleToggleMute}
      onToggleVideo={handleToggleVideo}
      onToggleScreenShare={handleToggleScreenShare}
      onToggleChat={handleToggleChat}
      handleSendMessage={handleSendMessage}
      localStream={localStream}
      onLeaveCall={handleLeaveCall}
      onApproveRequest={() => {}}
      onRejectRequest={() => {}}
      messages={messages}
    />
  );
}

export default App;