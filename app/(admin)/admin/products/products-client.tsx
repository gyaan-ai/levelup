'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Plus, DollarSign, Users, TrendingUp } from 'lucide-react';

export type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  parent_price: number;
  athlete_payout: number;
  stripe_fee_percent: number;
  stripe_fee_fixed: number;
  min_participants: number;
  max_participants: number;
  active: boolean;
  display_order: number;
};

interface ProductsClientProps {
  products: Product[];
}

function calculateFees(product: Product, participants: number = 1) {
  const totalParentPrice = product.parent_price * participants;
  const totalAthletePayout = product.athlete_payout * participants;
  const stripeFee = Math.round((totalParentPrice * product.stripe_fee_percent + product.stripe_fee_fixed) * 100) / 100;
  const guildNet = Math.round((totalParentPrice - totalAthletePayout - stripeFee) * 100) / 100;
  
  return {
    totalParentPrice,
    totalAthletePayout,
    stripeFee,
    guildNet,
  };
}

export function ProductsClient({ products }: ProductsClientProps) {
  const router = useRouter();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_price: '',
    athlete_payout: '',
    min_participants: '1',
    max_participants: '1',
    active: true,
  });

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      parent_price: product.parent_price.toString(),
      athlete_payout: product.athlete_payout.toString(),
      min_participants: product.min_participants.toString(),
      max_participants: product.max_participants.toString(),
      active: product.active,
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      parent_price: '',
      athlete_payout: '',
      min_participants: '1',
      max_participants: '1',
      active: true,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        parent_price: parseFloat(formData.parent_price),
        athlete_payout: parseFloat(formData.athlete_payout),
        min_participants: parseInt(formData.min_participants),
        max_participants: parseInt(formData.max_participants),
        active: formData.active,
      };

      const url = editingProduct 
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      
      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to save product');
        return;
      }

      setIsDialogOpen(false);
      router.refresh();
    } catch (e) {
      console.error('Save error:', e);
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      
      if (res.ok) {
        router.refresh();
      }
    } catch (e) {
      console.error('Toggle error:', e);
    }
  };

  // Calculate preview fees
  const previewFees = formData.parent_price && formData.athlete_payout
    ? calculateFees(
        {
          ...({} as Product),
          parent_price: parseFloat(formData.parent_price) || 0,
          athlete_payout: parseFloat(formData.athlete_payout) || 0,
          stripe_fee_percent: 0.029,
          stripe_fee_fixed: 0.30,
        },
        parseInt(formData.max_participants) || 1
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? 's' : ''} configured
        </p>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const fees = calculateFees(product, product.max_participants);
          
          return (
            <Card key={product.id} className={!product.active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {product.name}
                      {!product.active && <Badge variant="secondary">Inactive</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {product.description || product.slug}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {product.min_participants === product.max_participants
                    ? `${product.min_participants} participant${product.min_participants !== 1 ? 's' : ''}`
                    : `${product.min_participants}–${product.max_participants} participants`
                  }
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Parent pays</span>
                    <span className="font-medium">${product.parent_price.toFixed(2)}/person</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coach receives</span>
                    <span className="font-medium">${product.athlete_payout.toFixed(2)}/person</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t bg-muted/30 -mx-6 px-6 py-3 -mb-6 rounded-b-lg">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Per session ({product.max_participants} participant{product.max_participants !== 1 ? 's' : ''})
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total revenue</p>
                      <p className="font-bold text-lg">${fees.totalParentPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Coach payout</p>
                      <p className="font-medium">${fees.totalAthletePayout.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stripe fee</p>
                      <p className="font-medium text-destructive">-${fees.stripeFee.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Guild net</p>
                      <p className="font-bold text-primary">${fees.guildNet.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mt-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue per 1:1
            </CardDescription>
            <CardTitle className="text-2xl">
              ${products.find(p => p.slug === 'private')?.parent_price.toFixed(2) || '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Revenue per partner (2 people)
            </CardDescription>
            <CardTitle className="text-2xl">
              ${((products.find(p => p.slug === 'partner')?.parent_price || 0) * 2).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue per small group (5 people)
            </CardDescription>
            <CardTitle className="text-2xl">
              ${((products.find(p => p.slug === 'small-group')?.parent_price || 0) * 5).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              Configure pricing and participant limits for this session type.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="1:1 Private Session"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="private"
                  disabled={!!editingProduct}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="One-on-one instruction..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_price">Parent Price (per person)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="parent_price"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={formData.parent_price}
                    onChange={(e) => setFormData({ ...formData, parent_price: e.target.value })}
                    placeholder="60.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="athlete_payout">Coach Payout (per person)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="athlete_payout"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={formData.athlete_payout}
                    onChange={(e) => setFormData({ ...formData, athlete_payout: e.target.value })}
                    placeholder="50.00"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_participants">Min Participants</Label>
                <Input
                  id="min_participants"
                  type="number"
                  min="1"
                  value={formData.min_participants}
                  onChange={(e) => setFormData({ ...formData, min_participants: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_participants">Max Participants</Label>
                <Input
                  id="max_participants"
                  type="number"
                  min="1"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Active (visible to athletes and parents)</Label>
            </div>

            {/* Fee Preview */}
            {previewFees && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Fee Preview (max participants)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total revenue: <span className="font-medium">${previewFees.totalParentPrice.toFixed(2)}</span></div>
                  <div>Coach payout: <span className="font-medium">${previewFees.totalAthletePayout.toFixed(2)}</span></div>
                  <div>Stripe fee: <span className="font-medium text-destructive">-${previewFees.stripeFee.toFixed(2)}</span></div>
                  <div>Guild net: <span className="font-bold text-primary">${previewFees.guildNet.toFixed(2)}</span></div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.slug || !formData.parent_price}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
