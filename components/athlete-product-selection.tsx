'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';

type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parent_price: number;
  athlete_payout: number;
  min_participants: number;
  max_participants: number;
  active: boolean;
};

type AthleteProduct = {
  product_id: string;
  enabled: boolean;
};

export function AthleteProductSelection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [athleteProducts, setAthleteProducts] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/athletes/products');
        const data = await res.json();
        
        if (data.products) {
          setProducts(data.products);
        }
        if (data.athleteProducts) {
          const map = new Map<string, boolean>();
          data.athleteProducts.forEach((ap: AthleteProduct) => {
            map.set(ap.product_id, ap.enabled);
          });
          setAthleteProducts(map);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleProduct = async (productId: string, enabled: boolean) => {
    setSaving(productId);
    try {
      const res = await fetch('/api/athletes/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, enabled }),
      });
      
      if (res.ok) {
        setAthleteProducts(prev => {
          const newMap = new Map(prev);
          newMap.set(productId, enabled);
          return newMap;
        });
      }
    } catch (err) {
      console.error('Failed to toggle product:', err);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Session Types You Offer</CardTitle>
        <CardDescription>
          Select which session types you want to offer to parents. Only enabled sessions will appear in your booking page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((product) => {
          const isEnabled = athleteProducts.get(product.id) ?? true; // Default to enabled
          const isSaving = saving === product.id;
          
          return (
            <div
              key={product.id}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                isEnabled ? 'bg-background' : 'bg-muted/30'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={product.id} className="font-medium cursor-pointer">
                    {product.name}
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {product.min_participants === product.max_participants
                      ? product.min_participants
                      : `${product.min_participants}-${product.max_participants}`}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {product.description}
                </p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span>
                    Parent pays: <span className="font-medium">${product.parent_price.toFixed(2)}</span>/person
                  </span>
                  <span>
                    You receive: <span className="font-medium text-primary">${product.athlete_payout.toFixed(2)}</span>/person
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id={product.id}
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleProduct(product.id, checked)}
                  disabled={isSaving}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
