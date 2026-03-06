'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';

const INTEREST_OPTIONS = [
  { value: 'test', label: 'Help test the app' },
  { value: 'early', label: 'Be an early adopter' },
  { value: 'both', label: 'Both — test and adopt early' },
  { value: 'updates', label: 'Just keep me updated' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'other', label: 'Other' },
];

const GRAD_YEARS = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + 2 + i);

const inputClass =
  'mt-1.5 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus-visible:ring-accent';

export function EarlyAccessForm() {
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [wrestlerName, setWrestlerName] = useState('');
  const [schoolClub, setSchoolClub] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [dob, setDob] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [interest, setInterest] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          parent_name: parentName.trim() || undefined,
          parent_phone: parentPhone.trim() || undefined,
          wrestler_name: wrestlerName.trim() || undefined,
          school_club: schoolClub.trim() || undefined,
          graduation_year: graduationYear.trim() ? Number(graduationYear) : undefined,
          dob: dob || undefined,
          weight_class: weightClass.trim() || undefined,
          experience_level: experienceLevel.trim() || undefined,
          interest: interest || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message || "You're on the list!");
        setParentName('');
        setEmail('');
        setParentPhone('');
        setWrestlerName('');
        setSchoolClub('');
        setGraduationYear('');
        setDob('');
        setWeightClass('');
        setExperienceLevel('');
        setInterest('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto text-left">
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Parent */}
        <div className="space-y-4 sm:col-span-2">
          <h3 className="text-lg font-semibold text-white border-b border-white/20 pb-2">Parent / Guardian</h3>
        </div>
        <div>
          <Label htmlFor="early-parent-name" className="text-white/90">Parent name *</Label>
          <Input
            id="early-parent-name"
            type="text"
            placeholder="Full name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            required
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="early-email" className="text-white/90">Email *</Label>
          <Input
            id="early-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="early-phone" className="text-white/90">Cell phone</Label>
          <Input
            id="early-phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>

        {/* Wrestler */}
        <div className="space-y-4 sm:col-span-2 mt-2">
          <h3 className="text-lg font-semibold text-white border-b border-white/20 pb-2">Wrestler</h3>
        </div>
        <div>
          <Label htmlFor="early-wrestler-name" className="text-white/90">Wrestler name *</Label>
          <Input
            id="early-wrestler-name"
            type="text"
            placeholder="Full name"
            value={wrestlerName}
            onChange={(e) => setWrestlerName(e.target.value)}
            required
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="early-dob" className="text-white/90">Date of birth</Label>
          <Input
            id="early-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="early-school" className="text-white/90">School / club</Label>
          <Input
            id="early-school"
            type="text"
            placeholder="School or club name"
            value={schoolClub}
            onChange={(e) => setSchoolClub(e.target.value)}
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="early-grad-year" className="text-white/90">Graduation year</Label>
          <select
            id="early-grad-year"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            disabled={status === 'loading'}
            className={`w-full mt-1.5 rounded-md border bg-white/10 border-white/30 text-white focus:ring-accent focus:border-accent min-h-[40px] px-3 ${inputClass}`}
          >
            <option value="" className="bg-gray-900 text-white">Select year</option>
            {GRAD_YEARS.map((y) => (
              <option key={y} value={y} className="bg-gray-900">Class of {y}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="early-weight" className="text-white/90">Weight class</Label>
          <Input
            id="early-weight"
            type="text"
            placeholder="e.g. 120, 132"
            value={weightClass}
            onChange={(e) => setWeightClass(e.target.value)}
            disabled={status === 'loading'}
            className={inputClass}
          />
        </div>
        <div>
          <Label htmlFor="early-experience" className="text-white/90">Experience level</Label>
          <select
            id="early-experience"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            disabled={status === 'loading'}
            className={`w-full mt-1.5 rounded-md border bg-white/10 border-white/30 text-white focus:ring-accent focus:border-accent min-h-[40px] px-3 ${inputClass}`}
          >
            {EXPERIENCE_OPTIONS.map((opt) => (
              <option key={opt.value || 'blank'} value={opt.value} className="bg-gray-900">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Interest */}
        <div className="sm:col-span-2">
          <Label className="text-white/90 mb-2 block">I want to</Label>
          <div className="space-y-2">
            {INTEREST_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer text-white/90 hover:text-white">
                <input
                  type="radio"
                  name="interest"
                  value={opt.value}
                  checked={interest === opt.value}
                  onChange={(e) => setInterest(e.target.value)}
                  disabled={status === 'loading'}
                  className="rounded-full border-white/40 bg-white/10 text-accent focus:ring-accent"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <p className={`mt-6 text-sm ${status === 'success' ? 'text-accent' : 'text-red-300'}`}>
          {message}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        variant="premium"
        disabled={status === 'loading'}
        className="mt-6 w-full gold-glow-hover"
      >
        {status === 'loading' ? (
          'Joining…'
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Get Early Access
          </>
        )}
      </Button>
    </form>
  );
}
