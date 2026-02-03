'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, FileText, CheckCircle2, Upload, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Activity } from '@/lib/utils/generate-activity-feed';

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (!activities.length) {
    return null;
  }

  return (
    <Card className="mb-6 bg-gradient-to-br from-gray-50 to-white border-accent/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-xl">⚡</span>
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.slice(0, 5).map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
          {activities.length > 5 && (
            <p className="text-sm text-gray-500 text-center pt-2">
              +{activities.length - 5} more activities
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const icon = getActivityIcon(activity.type);
  const color = getActivityColor(activity.type);

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white transition-colors">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900">{activity.title}</p>
        {activity.description && (
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">{activity.description}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          {activity.author && `${activity.author} · `}
          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'message':
      return <MessageCircle className="h-4 w-4 text-blue-600" />;
    case 'summary':
      return <FileText className="h-4 w-4 text-purple-600" />;
    case 'action_completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'video_uploaded':
      return <Upload className="h-4 w-4 text-orange-600" />;
    case 'goal_completed':
      return <Target className="h-4 w-4 text-accent" />;
    default:
      return <MessageCircle className="h-4 w-4" />;
  }
}

function getActivityColor(type: Activity['type']) {
  switch (type) {
    case 'message':
      return 'bg-blue-50';
    case 'summary':
      return 'bg-purple-50';
    case 'action_completed':
      return 'bg-green-50';
    case 'video_uploaded':
      return 'bg-orange-50';
    case 'goal_completed':
      return 'bg-accent/10';
    default:
      return 'bg-gray-50';
  }
}
