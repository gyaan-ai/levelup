import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function TestPage() {
  // Get tenant slug from headers (set by middleware)
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug') || 'nc-united';
  
  // Create Supabase client
  const supabase = await createClient(tenantSlug);
  
  // Query facilities table
  const { data: facilities, error } = await supabase
    .from('facilities')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Supabase Connection Test</CardTitle>
          <CardDescription>
            Testing connection to Supabase for tenant: <strong>{tenantSlug}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                <h3 className="font-semibold text-destructive mb-2">Error</h3>
                <p className="text-sm text-destructive">{error.message}</p>
                <details className="mt-2">
                  <summary className="text-sm cursor-pointer">Error Details</summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(error, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <h3 className="font-semibold text-green-800 mb-2">✅ Connection Successful!</h3>
                <p className="text-sm text-green-700">
                  Successfully connected to Supabase and queried the facilities table.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-3">
                  Facilities ({facilities?.length || 0})
                </h3>
                
                {facilities && facilities.length > 0 ? (
                  <div className="space-y-2">
                    {facilities.map((facility) => (
                      <div
                        key={facility.id}
                        className="p-3 border rounded-md bg-muted/50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{facility.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {facility.school}
                            </p>
                            {facility.address && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {facility.address}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {facility.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-dashed rounded-md text-center">
                    <p className="text-muted-foreground mb-2">No facilities found in the database.</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Run the seed script to add test facilities.
                    </p>
                    <div className="bg-muted p-3 rounded text-left">
                      <p className="text-xs font-mono mb-2">To add facilities, run this SQL in Supabase:</p>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
{`INSERT INTO public.facilities (name, school) VALUES
  ('UNC Wrestling Room', 'UNC'),
  ('NC State Wrestling Room', 'NC State');`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              
              <details className="mt-4">
                <summary className="text-sm cursor-pointer font-medium">
                  Raw Data (JSON)
                </summary>
                <pre className="mt-2 text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(facilities, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
