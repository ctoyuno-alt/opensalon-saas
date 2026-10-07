import { useState, useEffect } from "preact/hooks";
import { api } from "../api";
import { useApp } from "../context";
import type { Membership, ClientMembership, Coupon, LoyaltyTransaction } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Crown, Award, Tag, Sparkles, Plus, Check, Clock, Users,
  Gift, RefreshCw, AlertCircle, Percent, DollarSign, Calendar
} from "lucide-preact";

export function MembershipsHub() {
  const { clients } = useApp();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [clientMemberships, setClientMemberships] = useState<ClientMembership[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [isNewCouponOpen, setIsNewCouponOpen] = useState(false);
  const [isAdjustPointsOpen, setIsAdjustPointsOpen] = useState(false);

  // Form states
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: 4999,
    duration_days: 365,
    service_discount_percent: 15,
    product_discount_percent: 10,
    included_services_count: 12,
    bonus_loyalty_points: 500,
    active: 1,
  });

  const [enrollForm, setEnrollForm] = useState({
    client_id: "",
    membership_id: "",
  });

  const [newCoupon, setNewCoupon] = useState({
    code: "",
    description: "",
    discount_type: "flat" as "flat" | "percent",
    discount_value: 100,
    min_order_amount: 500,
    valid_until: "",
    usage_limit: 100,
    is_active: 1,
  });

  const [adjustForm, setAdjustForm] = useState({
    client_id: "",
    points: 100,
    notes: "VIP customer appreciation reward",
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mRes, cmRes, cRes, lRes] = await Promise.all([
        api<{ memberships: Membership[] }>("GET", "/api/memberships"),
        api<{ client_memberships: ClientMembership[] }>("GET", "/api/client-memberships"),
        api<{ coupons: Coupon[] }>("GET", "/api/coupons"),
        api<{ transactions: LoyaltyTransaction[] }>("GET", "/api/loyalty/transactions"),
      ]);
      setMemberships(mRes.memberships || []);
      setClientMemberships(cmRes.client_memberships || []);
      setCoupons(cRes.coupons || []);
      setLoyaltyTransactions(lRes.transactions || []);
    } catch (err) {
      console.error("Error loading memberships & loyalty:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreatePlan = async (e: any) => {
    e.preventDefault();
    if (!newPlan.name) return alert("Please specify a membership name.");
    try {
      await api("POST", "/api/memberships", newPlan);
      setIsNewPlanOpen(false);
      setNewPlan({
        name: "",
        description: "",
        price: 4999,
        duration_days: 365,
        service_discount_percent: 15,
        product_discount_percent: 10,
        included_services_count: 12,
        bonus_loyalty_points: 500,
        active: 1,
      });
      loadAll();
    } catch (err: any) {
      alert("Failed to create plan: " + err.message);
    }
  };

  const handleEnrollClient = async (e: any) => {
    e.preventDefault();
    if (!enrollForm.client_id || !enrollForm.membership_id) {
      return alert("Please select both a client and a membership package.");
    }
    try {
      await api("POST", "/api/client-memberships", {
        client_id: parseInt(enrollForm.client_id, 10),
        membership_id: parseInt(enrollForm.membership_id, 10),
      });
      setIsEnrollOpen(false);
      setEnrollForm({ client_id: "", membership_id: "" });
      alert("Client enrolled successfully! Included quota and bonus points allocated.");
      loadAll();
    } catch (err: any) {
      alert("Failed to enroll client: " + err.message);
    }
  };

  const handleCreateCoupon = async (e: any) => {
    e.preventDefault();
    if (!newCoupon.code) return alert("Coupon code is required.");
    try {
      await api("POST", "/api/coupons", newCoupon);
      setIsNewCouponOpen(false);
      setNewCoupon({
        code: "",
        description: "",
        discount_type: "flat",
        discount_value: 100,
        min_order_amount: 500,
        valid_until: "",
        usage_limit: 100,
        is_active: 1,
      });
      loadAll();
    } catch (err: any) {
      alert("Failed to create coupon: " + err.message);
    }
  };

  const handleAdjustPoints = async (e: any) => {
    e.preventDefault();
    if (!adjustForm.client_id) return alert("Please select a client.");
    try {
      await api("POST", "/api/loyalty/adjust", {
        client_id: parseInt(adjustForm.client_id, 10),
        points: parseInt(String(adjustForm.points), 10),
        notes: adjustForm.notes,
      });
      setIsAdjustPointsOpen(false);
      alert("Points updated successfully!");
      loadAll();
    } catch (err: any) {
      alert("Failed to adjust points: " + err.message);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 text-white shadow-sm">
              <Crown className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Memberships &amp; Loyalty Hub</h1>
            <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
              Retention &amp; Quotas
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tiered subscription packages, service usage quotas, promotional discount codes, and client loyalty points.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setIsEnrollOpen(true)} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
            <Award className="h-4 w-4" /> Enroll Client
          </Button>
        </div>
      </div>

      <Tabs defaultValue="packages" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="packages">
            <Crown className="h-4 w-4 mr-2" /> Membership Packages ({memberships.length})
          </TabsTrigger>
          <TabsTrigger value="active-members">
            <Users className="h-4 w-4 mr-2" /> Enrolled Clients ({clientMemberships.length})
          </TabsTrigger>
          <TabsTrigger value="coupons">
            <Tag className="h-4 w-4 mr-2" /> Coupons &amp; Offers ({coupons.length})
          </TabsTrigger>
          <TabsTrigger value="loyalty">
            <Sparkles className="h-4 w-4 mr-2" /> Loyalty Ledger ({loyaltyTransactions.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Membership Packages */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Define subscription tiers with included services and automatic discounts on checkout.
            </p>
            <Button size="sm" variant="outline" onClick={() => setIsNewPlanOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Package
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {memberships.map((plan) => (
              <Card key={plan.id} className="relative overflow-hidden border shadow-sm hover:border-amber-400/60 transition-all flex flex-col justify-between">
                <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500/20 to-transparent w-24 h-24 rounded-bl-full pointer-events-none" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-1.5">
                      <Crown className="h-4 w-4 text-amber-500" />
                      {plan.name}
                    </CardTitle>
                    <Badge variant={plan.active ? "default" : "secondary"}>
                      {plan.active ? "Active" : "Archived"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs line-clamp-2 mt-1">
                    {plan.description || "Comprehensive salon membership tier."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">₹{plan.price.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">/ {plan.duration_days} days</span>
                  </div>

                  <div className="space-y-2 text-xs border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Included Services Quota:</span>
                      <strong className="text-foreground">{plan.included_services_count} services</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Service Discount:</span>
                      <strong className="text-emerald-600 font-bold">{plan.service_discount_percent}% OFF</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Product Retail Discount:</span>
                      <strong className="text-emerald-600 font-bold">{plan.product_discount_percent}% OFF</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Bonus Loyalty Points:</span>
                      <strong className="text-amber-600 font-bold">+{plan.bonus_loyalty_points} pts</strong>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t pt-3 flex justify-between">
                  <span className="text-xs text-muted-foreground">Valid for {Math.round(plan.duration_days / 30)} months</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => {
                      setEnrollForm((prev) => ({ ...prev, membership_id: String(plan.id) }));
                      setIsEnrollOpen(true);
                    }}
                  >
                    Enroll Client
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: Enrolled Clients */}
        <TabsContent value="active-members">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-muted/20 pb-4">
              <div>
                <CardTitle className="text-lg">Active Member Quotas &amp; Subscriptions</CardTitle>
                <CardDescription>
                  Real-time quota tracking. Quotas automatically deduct when services are billed at POS.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsEnrollOpen(true)} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="h-4 w-4" /> Enroll Client
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {clientMemberships.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No client memberships enrolled yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Client</TableHead>
                        <TableHead>Package Plan</TableHead>
                        <TableHead>Validity Period</TableHead>
                        <TableHead>Services Quota</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientMemberships.map((cm) => {
                        const remaining = Math.max(0, cm.services_total - cm.services_used);
                        const percent = Math.min(100, Math.round((cm.services_used / cm.services_total) * 100));

                        return (
                          <TableRow key={cm.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <div className="font-medium text-sm">{cm.client_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{cm.client_phone || "No phone"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/40 font-medium">
                                <Crown className="h-3 w-3 mr-1 text-amber-500" /> {cm.membership_name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-mono">
                                <div>From: {cm.start_date}</div>
                                <div>To: {cm.end_date}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 w-44">
                                <div className="flex justify-between text-xs font-medium">
                                  <span>{cm.services_used} of {cm.services_total} used</span>
                                  <span className="text-emerald-600 font-bold">{remaining} left</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full transition-all"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={cm.status === "active" ? "default" : "secondary"}>
                                {cm.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Coupons & Promotional Offers */}
        <TabsContent value="coupons">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-muted/20 pb-4">
              <div>
                <CardTitle className="text-lg">Coupons &amp; Flash Deals</CardTitle>
                <CardDescription>
                  Promotional codes for off-peak hours, winback offers, and first-time client welcome discounts.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsNewCouponOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Create Coupon
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {coupons.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No coupons found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Coupon Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Min Spend</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell>
                            <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                              {coupon.code}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs">
                            {coupon.description || "Promotional offer"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold">
                              {coupon.discount_type === "percent" ? `${coupon.discount_value}% OFF` : `₹${coupon.discount_value} FLAT OFF`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            ₹{coupon.min_order_amount}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {coupon.times_used} / {coupon.usage_limit || "∞"} used
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={coupon.is_active ? "default" : "secondary"}>
                              {coupon.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Loyalty Ledger */}
        <TabsContent value="loyalty">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-muted/20 pb-4">
              <div>
                <CardTitle className="text-lg">Loyalty Program Ledger</CardTitle>
                <CardDescription>
                  Points accrual (1 pt per ₹10 spent), POS redemptions, and VIP bonus allocations.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setIsAdjustPointsOpen(true)} className="gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" /> Reward / Adjust Points
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loyaltyTransactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No loyalty transactions recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead className="text-right">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loyaltyTransactions.map((tx) => (
                        <TableRow key={tx.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {tx.created_at?.split("T")[0] || tx.created_at || "Recent"}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {tx.client_name || `Client #${tx.client_id}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {tx.transaction_type.replace("_", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold font-mono text-sm ${tx.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground max-w-sm truncate">
                            {tx.notes || "Loyalty update"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: Create Membership Plan */}
      <Dialog open={isNewPlanOpen} onOpenChange={setIsNewPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Membership Package</DialogTitle>
            <DialogDescription>Define a new tiered plan with included service quota and perks.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePlan} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input
                placeholder="e.g. PLATINUM ALL-ACCESS"
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: (e.target as HTMLInputElement).value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  value={newPlan.price}
                  onChange={(e) => setNewPlan({ ...newPlan, price: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Validity (Days)</Label>
                <Input
                  type="number"
                  value={newPlan.duration_days}
                  onChange={(e) => setNewPlan({ ...newPlan, duration_days: parseInt((e.target as HTMLInputElement).value, 10) || 365 })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Service Disc (%)</Label>
                <Input
                  type="number"
                  value={newPlan.service_discount_percent}
                  onChange={(e) => setNewPlan({ ...newPlan, service_discount_percent: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Product Disc (%)</Label>
                <Input
                  type="number"
                  value={newPlan.product_discount_percent}
                  onChange={(e) => setNewPlan({ ...newPlan, product_discount_percent: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Included Services</Label>
                <Input
                  type="number"
                  value={newPlan.included_services_count}
                  onChange={(e) => setNewPlan({ ...newPlan, included_services_count: parseInt((e.target as HTMLInputElement).value, 10) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bonus Loyalty Pts</Label>
                <Input
                  type="number"
                  value={newPlan.bonus_loyalty_points}
                  onChange={(e) => setNewPlan({ ...newPlan, bonus_loyalty_points: parseInt((e.target as HTMLInputElement).value, 10) || 0 })}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewPlanOpen(false)}>Cancel</Button>
              <Button type="submit">Save Package</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Enroll Client */}
      <Dialog open={isEnrollOpen} onOpenChange={setIsEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Client in Membership</DialogTitle>
            <DialogDescription>Assign a subscription package, service quotas, and bonus loyalty points.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEnrollClient} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={enrollForm.client_id} onValueChange={(val) => setEnrollForm({ ...enrollForm, client_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Membership Package</Label>
              <Select value={enrollForm.membership_id} onValueChange={(val) => setEnrollForm({ ...enrollForm, membership_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose package..." />
                </SelectTrigger>
                <SelectContent>
                  {memberships.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} — ₹{m.price} ({m.included_services_count} services)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEnrollOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">Enroll &amp; Activate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Create Coupon */}
      <Dialog open={isNewCouponOpen} onOpenChange={setIsNewCouponOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Promotional Coupon</DialogTitle>
            <DialogDescription>Create discount codes that clients can redeem at checkout.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCoupon} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Coupon Code</Label>
              <Input
                placeholder="e.g. FESTIVE20"
                className="font-mono uppercase"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: (e.target as HTMLInputElement).value.toUpperCase() })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={newCoupon.discount_type}
                  onValueChange={(val: any) => setNewCoupon({ ...newCoupon, discount_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Min Order Spend (₹)</Label>
                <Input
                  type="number"
                  value={newCoupon.min_order_amount}
                  onChange={(e) => setNewCoupon({ ...newCoupon, min_order_amount: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Uses (Limit)</Label>
                <Input
                  type="number"
                  value={newCoupon.usage_limit}
                  onChange={(e) => setNewCoupon({ ...newCoupon, usage_limit: parseInt((e.target as HTMLInputElement).value, 10) || 100 })}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewCouponOpen(false)}>Cancel</Button>
              <Button type="submit">Create Coupon</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Reward / Adjust Loyalty Points */}
      <Dialog open={isAdjustPointsOpen} onOpenChange={setIsAdjustPointsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reward / Adjust Loyalty Points</DialogTitle>
            <DialogDescription>Manually credit points to a client's loyalty wallet.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustPoints} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={adjustForm.client_id} onValueChange={(val) => setAdjustForm({ ...adjustForm, client_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} — Current Pts: {c.loyalty_points || 0}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Points to Credit (+ or -)</Label>
              <Input
                type="number"
                value={adjustForm.points}
                onChange={(e) => setAdjustForm({ ...adjustForm, points: parseInt((e.target as HTMLInputElement).value, 10) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Reason / Note</Label>
              <Input
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: (e.target as HTMLInputElement).value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdjustPointsOpen(false)}>Cancel</Button>
              <Button type="submit">Update Points</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
