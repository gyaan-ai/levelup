'use client';

import { useState, useEffect } from 'react';
import { BrowseAthletesClient } from '@/app/(parent)/browse/browse-client';
import { FindTrainingClient } from '@/app/(parent)/find-training/find-training-client';
import type { Athlete } from '@/types';

type TabId = 'sessions' | 'coaches';

interface AthleteWithNext extends Athlete {
  nextAvailable?: { slot_date: string; start_time: string } | null;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'sessions', label: 'Find sessions' },
  { id: 'coaches', label: 'All coaches' },
];

type Props = {
  initialTab: string;
  athletesWithNext: AthleteWithNext[];
  isAdmin: boolean;
  facilities: { id: string; name?: string; school?: string; address?: string | null }[];
  availabilitySessions: Array<{
    id: string;
    scheduled_datetime: string;
    status?: string | null;
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
    athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string; average_rating?: number | null; review_count?: number | null } | null;
    facilities?: { id: string; name?: string; address?: string } | null;
    session_participants?: Array<{ youth_wrestlers?: { id: string; first_name?: string; last_name?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; photo_url?: string }[] | null } | null>;
  }>;
  availabilityDate: string;
  availabilityTime: string;
  availabilityLocation: string;
  availabilityCoach: string;
  coaches: { id: string; first_name?: string; last_name?: string; school?: string }[];
  preselectedWrestlerId?: string;
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
  preselectedWrestlerId = '',
}: Props) {
  const tab = (initialTab === 'coaches' ? 'coaches' : 'sessions') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(tab);

  // Sync tab state when URL changes (e.g. "View their group sessions" → ?tab=sessions&coach=xxx)
  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

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

      {activeTab === 'sessions' && (
        <FindTrainingClient
          facilities={facilities}
          initialSessions={availabilitySessions}
          initialDate={availabilityDate}
          initialTime={availabilityTime}
          initialLocation={availabilityLocation}
          initialCoach={availabilityCoach}
          coaches={coaches}
          searchBasePath="/training"
          defaultRangeLabel="Next 7 days"
          preselectedWrestlerId={preselectedWrestlerId}
        />
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
