export type ActivityType =
  | 'message'
  | 'summary'
  | 'action_completed'
  | 'video_uploaded'
  | 'goal_completed';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  author?: string;
}

interface WorkspaceMessage {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  authorName?: string;
}

interface WorkspaceSession {
  id: string;
  scheduled_datetime?: string;
  summary?: {
    id: string;
    created_at: string;
  } | null;
}

interface WorkspaceAction {
  id: string;
  content: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
}

interface WorkspaceMedia {
  id: string;
  file_name: string;
  created_at: string;
  uploaded_by?: { name?: string } | string | null;
}

interface WorkspaceGoal {
  id: string;
  content: string;
  created_at: string;
  completed_at?: string | null;
}

export interface WorkspaceData {
  messages?: WorkspaceMessage[];
  sessions?: WorkspaceSession[];
  actions?: WorkspaceAction[];
  media?: WorkspaceMedia[];
  goals?: WorkspaceGoal[];
  currentUserId?: string;
}

export function generateActivityFeed(data: WorkspaceData): Activity[] {
  const activities: Activity[] = [];

  const sortedMessages = [...(data.messages || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  sortedMessages.slice(-3).forEach((msg) => {
    activities.push({
      id: `msg-${msg.id}`,
      type: 'message',
      title: 'New message',
      description: truncate(msg.content),
      timestamp: msg.created_at,
      author: msg.authorName,
    });
  });

  (data.sessions || [])
    .filter((session) => session.summary)
    .forEach((session) => {
      if (!session.summary) return;
      activities.push({
        id: `summary-${session.summary.id}`,
        type: 'summary',
        title: 'Session summary posted',
        description: 'Coach documented the session',
        timestamp: session.summary.created_at,
      });
    });

  (data.actions || [])
    .filter((action) => action.status === 'completed' && action.completed_at)
    .forEach((action) => {
      activities.push({
        id: `action-${action.id}`,
        type: 'action_completed',
        title: 'Homework completed',
        description: action.content,
        timestamp: action.completed_at!,
      });
    });

  const sortedMedia = [...(data.media || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  sortedMedia.slice(0, 2).forEach((media) => {
    const uploadedBy =
      typeof media.uploaded_by === 'string'
        ? undefined
        : media.uploaded_by?.name;
    activities.push({
      id: `media-${media.id}`,
      type: 'video_uploaded',
      title: 'New media uploaded',
      description: media.file_name,
      timestamp: media.created_at,
      author: uploadedBy,
    });
  });

  (data.goals || [])
    .filter((goal) => goal.completed_at)
    .forEach((goal) => {
      activities.push({
        id: `goal-${goal.id}`,
        type: 'goal_completed',
        title: 'Goal achieved',
        description: goal.content,
        timestamp: goal.completed_at!,
      });
    });

  return activities.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export interface SectionIndicator {
  count: number;
  hasNew: boolean;
  label?: string;
}

export interface SectionIndicators {
  messages: SectionIndicator;
  summaries: SectionIndicator;
  actions: SectionIndicator;
  videos: SectionIndicator;
  goals: SectionIndicator;
}

export function calculateNewIndicators(
  data: WorkspaceData,
  lastVisitTime?: string
): SectionIndicators {
  const lastVisit = lastVisitTime
    ? new Date(lastVisitTime)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const unreadMessages =
    data.messages?.filter(
      (m) =>
        m.author_id !== data.currentUserId &&
        new Date(m.created_at) > lastVisit
    ).length || 0;

  const newSummaries =
    data.sessions?.filter(
      (s) =>
        s.summary &&
        s.summary.created_at &&
        new Date(s.summary.created_at) > lastVisit
    ).length || 0;

  const pendingActions =
    data.actions?.filter((a) => a.status === 'pending').length || 0;

  const newActions =
    data.actions?.filter(
      (a) =>
        a.status === 'pending' && new Date(a.created_at).getTime() > lastVisit.getTime()
    ).length || 0;

  const newVideos =
    data.media?.filter((m) => new Date(m.created_at) > lastVisit).length || 0;

  const incompleteGoals =
    data.goals?.filter((g) => !g.completed_at).length || 0;

  return {
    messages: {
      count: unreadMessages,
      hasNew: unreadMessages > 0,
      label: unreadMessages > 0 ? `${unreadMessages} new` : undefined,
    },
    summaries: {
      count: newSummaries,
      hasNew: newSummaries > 0,
      label: newSummaries > 0 ? `${newSummaries} new` : undefined,
    },
    actions: {
      count: pendingActions,
      hasNew: newActions > 0,
      label: newActions > 0 ? `${newActions} new` : undefined,
    },
    videos: {
      count: newVideos,
      hasNew: newVideos > 0,
      label: newVideos > 0 ? `${newVideos} new` : undefined,
    },
    goals: {
      count: incompleteGoals,
      hasNew: false,
      label: undefined,
    },
  };
}

function truncate(text: string, length = 80) {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}
