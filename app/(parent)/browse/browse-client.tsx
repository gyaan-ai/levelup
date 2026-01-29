'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Star, User } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { EliteWrestlerBadge } from '@/components/elite-wrestler-badge';
import { Athlete } from '@/types';

interface BrowseAthletesClientProps {
  initialAthletes: Athlete[];
}

const WEIGHT_CLASSES = ['125', '133', '141', '149', '157', '165', '174', '184', '197', '285'];

const SCHOOL_COLORS: Record<string, { bg: string; text: string }> = {
  'UNC': { bg: 'bg-blue-600', text: 'text-white' },
  'NC State': { bg: 'bg-red-600', text: 'text-white' },
  'NCSU': { bg: 'bg-red-600', text: 'text-white' },
  'North Carolina State': { bg: 'bg-red-600', text: 'text-white' },
};

export function BrowseAthletesClient({ initialAthletes }: BrowseAthletesClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedWeight, setSelectedWeight] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Get unique schools from athletes
  const schools = useMemo(() => {
    const uniqueSchools = Array.from(new Set(initialAthletes.map(a => a.school))).sort();
    return uniqueSchools;
  }, [initialAthletes]);

  // Filter athletes
  const filteredAthletes = useMemo(() => {
    return initialAthletes.filter(athlete => {
      // Search filter
      const fullName = `${athlete.first_name} ${athlete.last_name}`.toLowerCase();
      const matchesSearch = searchQuery === '' || fullName.includes(searchQuery.toLowerCase());

      // School filter
      const matchesSchool = selectedSchool === 'all' || athlete.school === selectedSchool;

      // Weight class filter
      const matchesWeight = selectedWeight === 'all' || athlete.weight_class === selectedWeight;

      return matchesSearch && matchesSchool && matchesWeight;
    });
  }, [initialAthletes, searchQuery, selectedSchool, selectedWeight]);

  const getSchoolBadgeColor = (school: string) => {
    const normalizedSchool = school.trim();
    return SCHOOL_COLORS[normalizedSchool] || { bg: 'bg-gray-600', text: 'text-white' };
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link 
        href="/dashboard" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold mb-2 text-primary">Browse Elite Coaches</h1>
        <p className="text-muted-foreground">
          Find the perfect NCAA coach to refine your technique
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* School Filter */}
          <div className="flex-1">
            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
              <SelectTrigger>
                <SelectValue placeholder="All Schools" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map(school => (
                  <SelectItem key={school} value={school}>
                    {school}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weight Class Filter */}
          <div className="flex-1">
            <Select value={selectedWeight} onValueChange={setSelectedWeight}>
              <SelectTrigger>
                <SelectValue placeholder="All Weights" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weights</SelectItem>
                {WEIGHT_CLASSES.map(weight => (
                  <SelectItem key={weight} value={weight}>
                    {weight} lbs
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredAthletes.length} {filteredAthletes.length === 1 ? 'coach' : 'coaches'}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Skeleton className="w-24 h-24 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty States */}
      {!loading && initialAthletes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No athletes available yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Check back soon! We&apos;re working on getting more college athletes on the platform.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && initialAthletes.length > 0 && filteredAthletes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No athletes match your filters</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Try adjusting your search criteria or filters to find more athletes.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedSchool('all');
                setSelectedWeight('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Athlete Grid */}
      {!loading && filteredAthletes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAthletes.map((athlete) => {
            const schoolColors = getSchoolBadgeColor(athlete.school);
            const rating = athlete.average_rating || 0;
            const displayRating = rating > 0 ? rating.toFixed(1) : 'New';

            return (
              <Link key={athlete.id} href={`/athlete/${athlete.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      {athlete.photo_url ? (
                        <img
                          src={athlete.photo_url}
                          alt={`${athlete.first_name} ${athlete.last_name}`}
                          className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-primary/20">
                          <User className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold truncate">
                          {athlete.first_name} {athlete.last_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <EliteWrestlerBadge size="sm" />
                          <SchoolLogo school={athlete.school} size="sm" />
                          <Badge
                            className={`${schoolColors.bg} ${schoolColors.text} text-xs`}
                          >
                            {athlete.school}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {athlete.year && `${athlete.year}`}
                      {athlete.year && athlete.weight_class && ' | '}
                      {athlete.weight_class && `${athlete.weight_class} lbs`}
                    </div>

                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-accent text-accent" />
                      <span className="font-medium">{displayRating}</span>
                      {rating > 0 && athlete.total_sessions > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({athlete.total_sessions} {athlete.total_sessions === 1 ? 'session' : 'sessions'})
                        </span>
                      )}
                    </div>

                    <Button className="w-full" variant="outline">
                      View Profile
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

