import type { Metadata } from 'next';
import { BackLink } from '@/components/back-link';
import { GuildIndependentContractorAgreement } from '@/components/guild-independent-contractor-agreement';
import { PrintPageButton } from '@/components/print-page-button';

export const metadata: Metadata = {
  title: 'Independent Contractor Agreement | The Guild',
  description: 'The Guild Independent Contractor Agreement for coaches.',
};

export default function CoachAgreementPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <BackLink
              fallbackHref="/signup/coach"
              label="Back to coach application"
              className="text-primary underline-offset-4 hover:underline"
            />
          </p>
          <PrintPageButton />
        </div>
        <GuildIndependentContractorAgreement />
      </div>
    </div>
  );
}
