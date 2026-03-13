'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, Users, UserPlus } from 'lucide-react';
import { BrowseAthletesClient } from '@/app/(parent)/browse/browse-client';
import { FindTrainingClient } from '@/app/(parent)/find-training/find-training-client';
import type { Athlete } from '@/types';

type TabId = 'available' | 'private' | 'partner' | 'group' | 'coaches';

interface AthleteWithNext extends Athlete {
  nextAvailable?: { slot_date: string; start_time: string } | null;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'available', label: 'Available' },
  { id: 'private', label: 'Private' },
  { id: 'partner', label: 'Partner' },
  { id: 'group', label: 'Small Group' },
  { id: 'coaches', label: 'Coaches' },
];

type Props = {
  initialTab: string;
  athletesWithNext: AthleteWithNext[];
  isAdmin: boolean;
  facilities: { id: string; name?: string; school?: string; address?: string | null }[];
  availabilitySessions: Array<{
    id: string;
    scheduled_datetime: string;
    session_type: string | null;
    session_mode: string | null;
    join_policy?: string | null;
    focus_area: string | null;
    current_participants: number | null;
    max_participants: number | null;
    total_price: number | null;
    price_per_participant: number | null;
    athlete_id: string;
    facility_id: string;
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string } | null;
    facilities?: { id: string; name?: string; address?: string } | null;
  }>;
  availabilityDate: string;
  availabilityTime: string;
  availabilityLocation: string;
  availabilityCoach: string;
  coaches: { id: string; first_name?: string; last_name?: string; school?: string }[];
};

export function TrainingClient({
  initialTab,
  athletesWithNext,
  isAdmin,
  facilities,
  availabilitySessions,
  availabilityDate,
  availabilityTime,
  availabilityLocation,
  availabilityCoach,
  coaches,
}: Props) {
  const tab = (['available', 'private', 'partner', 'group', 'coaches'].includes(initialTab) ? initialTab : 'available') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(tab);

  return (
    <>
      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium border-b-2 shrink-0 touch-manipulation ${
              activeTab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'available' && (
        <FindTrainingClient
          facilities={facilities}
          initialSessions={availabilitySessions}
          initialDate={availabilityDate}
          initialTime={availabilityTime}
          initialLocation={availabilityLocation}
          initialCoach={availabilityCoach}
          coaches={coaches}
          searchBasePath="/training"
        />
      )}

      {activeTab === 'private' && (
        <Card>
          <CardContent className="py-8 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Book Private</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Book a 1:1 session with an elite coach. Choose your coach, then pick a time.
            </p>
            <Link href="/browse">
              <Button className="min-h-[48px] touch-manipulation">Browse coaches</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {activeTab === 'partner' && (
        <Card>
          <CardContent className="py-8 text-center">
            <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Find Partner</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Find sessions looking for a partner. Request to join and train with another wrestler.
            </p>
            <Link href="/find-training">
              <Button className="min-h-[48px] touch-manipulation">Find partner sessions</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {activeTab === 'group' && (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Join Small Group</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Join small group sessions. Filter by day, time, and facility.
            </p>
            <Link href="/find-training">
              <Button className="min-h-[48px] touch-manipulation">Find group sessions</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {activeTab === 'coaches' && (
        <BrowseAthletesClient
          initialAthletes={athletesWithNext}
          isAdmin={isAdmin}
          embedded
        />
      )}
    </>
  );
}
