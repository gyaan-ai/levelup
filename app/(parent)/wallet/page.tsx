'use client';

import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Clock, CreditCard, Gift, RefreshCcw, Calendar } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { formatEST } from '@/lib/format-date';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type Credit = {
  id: string;
  amount: number;
  remaining?: number;
  reason: string;
  sourceType: string;
  expiresAt: string | null;
  createdAt: string;
};

type LedgerRow = {
  id: string;
  kind: 'grant' | 'debit' | 'reversal';
  amount: number;
  description: string;
  createdAt: string;
  rewardType: string | null;
  sessionId: string | null;
};

type HistoryItem = {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  createdAt: string;
};

function getSourceIcon(sourceType: string) {
  switch (sourceType) {
    case 'cancellation':
    case 'coach_cancellation':
      return <RefreshCcw className="h-4 w-4 text-accent" />;
    case 'refund':
      return <CreditCard className="h-4 w-4 text-blue-500" />;
    case 'promo':
    case 'promotion':
      return <Gift className="h-4 w-4 text-green-500" />;
    case 'reward':
      return <Gift className="h-4 w-4 text-amber-500" />;
    default:
      return <Wallet className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function WalletPage() {
  const { data, error, isLoading } = useSWR<{
    balance: number;
    credits: Credit[];
    history: HistoryItem[];
    ledger?: LedgerRow[];
    rewardsEnabled?: boolean;
  }>('/api/credits', fetcher);

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl py-8 px-4">
        <p className="text-destructive">Failed to load wallet. Please try again.</p>
      </div>
    );
  }

  const { balance = 0, credits = [], history = [], ledger = [], rewardsEnabled = false } = data ?? {};
  const timeline = rewardsEnabled && ledger.length > 0 ? ledger : null;

  return (
    <div className="container max-w-2xl py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <BackLink fallbackHref="/account" label="Back" />
        <h1 className="text-2xl font-bold">My Wallet</h1>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Credit</p>
              <p className="text-4xl font-bold">${balance.toFixed(2)}</p>
            </div>
            <div className="h-14 w-14 rounded-full bg-accent/20 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-accent" />
            </div>
          </div>
          {balance > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Credits are automatically applied at checkout
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active Credits */}
      {credits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Credits</CardTitle>
            <CardDescription>Credits available to use</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {credits.map((credit) => {
              const expiresDate = credit.expiresAt ? new Date(credit.expiresAt) : null;
              const daysUntilExpiry = expiresDate
                ? Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const isExpiringSoon = daysUntilExpiry != null && daysUntilExpiry <= 30;

              return (
                <div
                  key={credit.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-start gap-3">
                    {getSourceIcon(credit.sourceType)}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{credit.reason}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Added {formatEST(new Date(credit.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      {expiresDate && daysUntilExpiry != null && (
                        <div className={`flex items-center gap-2 text-xs ${isExpiringSoon ? 'text-orange-500' : 'text-muted-foreground'}`}>
                          <Clock className="h-3 w-3" />
                          <span>
                            {isExpiringSoon
                              ? `Expires in ${daysUntilExpiry} days`
                              : `Expires ${formatEST(expiresDate, 'MMM d, yyyy')}`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-accent">
                    ${(credit.remaining ?? credit.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
          <CardDescription>
            {timeline ? 'Grants, checkout usage, and adjustments' : 'Recent credit usage'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeline && timeline.length > 0 ? (
            <div className="space-y-2">
              {timeline.map((item) => {
                const positive = item.amount > 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <p className="text-sm">{item.description}</p>
                      {item.rewardType && (
                        <p className="text-xs text-muted-foreground">{item.rewardType.replace(/_/g, ' ')}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatEST(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <span
                      className={`font-medium tabular-nums shrink-0 ${positive ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {positive ? '+' : ''}
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm">{item.description || (item.type === 'credit' ? 'Credit added' : 'Credit used')}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEST(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <span className={`font-medium ${item.type === 'credit' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {item.type === 'credit' ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {balance === 0 && credits.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-medium">No credits yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              If a session is cancelled, you&apos;ll receive credit to use on future bookings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
