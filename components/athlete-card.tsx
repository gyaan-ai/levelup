import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { SchoolLogo } from '@/components/school-logo';
import { GuildMasterBadge } from '@/components/guild-master-badge';
import { Athlete } from '@/types';

interface AthleteCardProps {
  athlete: Athlete;
}

export function AthleteCard({ athlete }: AthleteCardProps) {
  return (
    <Card>
      <CardHeader>
        {athlete.photo_url && (
          <img 
            src={athlete.photo_url} 
            alt={`${athlete.first_name} ${athlete.last_name}`}
            className="w-full h-48 object-cover rounded-md mb-4"
          />
        )}
        <CardTitle>{athlete.first_name} {athlete.last_name}</CardTitle>
        <CardDescription className="flex items-center gap-2 flex-wrap">
          <GuildMasterBadge size="sm" />
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
          <Button>View Master Profile</Button>
        </div>
      </CardContent>
    </Card>
  );
}





