import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { SchoolLogo } from '@/components/school-logo';
import { CoachSessionBadge } from '@/components/coach-session-badge';
import { ProfileImage } from '@/components/profile-image';
import { Athlete } from '@/types';

interface AthleteCardProps {
  athlete: Athlete;
}

export function AthleteCard({ athlete }: AthleteCardProps) {
  return (
    <Card>
      <CardHeader>
        <ProfileImage
          src={athlete.photo_url}
          alt={`${athlete.first_name} ${athlete.last_name}`}
          focusX={athlete.photo_focus_x}
          focusY={athlete.photo_focus_y}
          rounded="lg"
          className="w-full h-48 mb-4"
          fallbackIconClassName="h-12 w-12 text-muted-foreground"
        />
        <CardTitle>{athlete.first_name} {athlete.last_name}</CardTitle>
        <CardDescription className="flex items-center gap-2 flex-wrap">
          <CoachSessionBadge totalSessions={athlete.total_sessions ?? 0} size="sm" />
          <SchoolLogo school={athlete.school} size="sm" />
          {athlete.school} • {athlete.year || 'College Wrestler'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {athlete.bio && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
            {athlete.bio}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              ⭐ {athlete.average_rating.toFixed(1)} ({athlete.total_sessions} sessions)
            </p>
          </div>
          <Button asChild>
          <Link href={`/athlete/${athlete.id}`}>View Profile</Link>
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}





