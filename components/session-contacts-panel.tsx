'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Cake, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactInfoRow } from '@/components/contact-info-row';
import { ageFromDob, formatBirthdayWithCountdown, isBirthdaySoon } from '@/lib/age-from-dob';
import { cn } from '@/lib/utils';

interface Contact {
  participantId: string;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    dateOfBirth: string | null;
    weightClass: string | null;
  } | null;
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
}

interface SessionContactsPanelProps {
  sessionId: string;
  participantCount?: number;
  className?: string;
}

export function SessionContactsPanel({ sessionId, participantCount = 0, className }: SessionContactsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (expanded && !fetched) {
      setLoading(true);
      fetch(`/api/sessions/${sessionId}/contacts`)
        .then((res) => res.json())
        .then((data) => {
          console.log('[v0] contacts data:', data);
          setContacts(data.contacts ?? []);
          setFetched(true);
        })
        .catch(() => {
          setContacts([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [expanded, fetched, sessionId]);

  if (participantCount === 0) {
    return null;
  }

  return (
    <div className={cn('border-t border-border mt-3 pt-3', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full justify-between text-muted-foreground hover:text-foreground h-8 px-2"
      >
        <span className="text-sm">
          {participantCount} registered — {expanded ? 'Hide' : 'Show'} contact info
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No contact info available</p>
          ) : (
            contacts.map((contact) => {
              const athlete = contact.athlete;
              const parent = contact.parent;
              const age = athlete?.dateOfBirth ? ageFromDob(athlete.dateOfBirth) : null;
              const birthdayDisplay = athlete?.dateOfBirth ? formatBirthdayWithCountdown(athlete.dateOfBirth) : null;
              const birthdaySoon = athlete?.dateOfBirth ? isBirthdaySoon(athlete.dateOfBirth, 7) : false;

              return (
                <div key={contact.participantId} className="bg-muted/50 rounded-lg p-3 space-y-1">
                  {/* Athlete info */}
                  {athlete && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {athlete.firstName} {athlete.lastName}
                          {age !== null && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({age}y{athlete.weightClass ? ` · ${athlete.weightClass}` : ''})
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {/* Birthday display */}
                      {birthdayDisplay && (
                        <div className={cn(
                          'flex items-center gap-1.5 text-xs',
                          birthdaySoon ? 'text-[#D4AF37] font-medium' : 'text-muted-foreground'
                        )}>
                          <Cake className="h-3 w-3" />
                          {birthdayDisplay}
                        </div>
                      )}

                      {/* Athlete phone */}
                      {athlete.phone && (
                        <ContactInfoRow
                          label="Athlete"
                          phone={athlete.phone}
                        />
                      )}
                    </>
                  )}

                  {/* Parent info */}
                  {parent && parent.phone && (
                    <ContactInfoRow
                      label="Parent"
                      name={`${parent.firstName} ${parent.lastName}`}
                      phone={parent.phone}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
