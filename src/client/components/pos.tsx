import { useState, useMemo, useEffect } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Receipt, Plus, Trash2, CreditCard, History, MessageCircle,
  Tag, Sparkles, Check, AlertCircle, RefreshCw, Crown
} from "lucide-preact";
import type { InvoiceItem, Coupon, ClientMembership } from "../types";
import { Pagination } from "./pagination";

export function PosBilling() {
  const { clients, services, products, createInvoice, invoices, invoicesPag, setInvoicesPage, clientLookup, sendReceiptWhatsApp } = useApp();
  const [clientId, setClientId] = useState<string>("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18); // GST default 18%
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Split payment state
  const [splitCash, setSplitCash] = useState(0);
  const [splitUpi, setSplitUpi] = useState(0);
  const [splitCard, setSplitCard] = useState(0);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Loyalty points state
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);

  // Client membership lookup & toggle
  const [activePlan, setActivePlan] = useState<ClientMembership | null>(null);
  const [applyMembership, setApplyMembership] = useState(true);

  const selectedClient = useMemo(() => {
    return clients.find((c) => String(c.id) === clientId);
  }, [clients, clientId]);

  useEffect(() => {
    if (clientId) {
      api<{ client_memberships: ClientMembership[] }>("GET", "/api/client-memberships")
        .then((res) => {
          const match = res.client_memberships.find(
            (cm) => String(cm.client_id) === clientId && cm.status === "active"
          );
          setActivePlan(match || null);
          setApplyMembership(true);
        })
        .catch(() => {
          setActivePlan(null);
        });
      
      // Auto-set redeem loyalty points
      if (selectedClient && (selectedClient.loyalty_points || 0) > 0) {
        setLoyaltyPointsToRedeem(Math.min(selectedClient.loyalty_points || 0, 500));
      }
    } else {
      setActivePlan(null);
      setApplyMembership(true);
      setRedeemLoyalty(false);
    }
  }, [clientId, selectedClient]);

  const addService = (val: string) => {
    const s = services.find((x) => String(x.id) === val);
    if (!s) return;
    setItems((prev) => [...prev, { item_type: "service", item_id: s.id, name: s.name, quantity: 1, price: s.price, total: s.price }]);
  };

  const addProduct = (val: string) => {
    const p = products.find((x) => String(x.id) === val);
    if (!p) return;
    setItems((prev) => [...prev, { item_type: "product", item_id: p.id, name: p.name, quantity: 1, price: p.price, total: p.price }]);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].total = newItems[index].price * quantity;
    setItems(newItems);
  };

  const remainingQuota = useMemo(() => {
    if (!activePlan || activePlan.status !== "active") return 0;
    return Math.max(0, (activePlan.services_total || 0) - (activePlan.services_used || 0));
  }, [activePlan]);

  const computedItems = useMemo(() => {
    let quotaAvailable = applyMembership ? remainingQuota : 0;
    const serviceDiscountPct = (applyMembership && activePlan?.service_discount_percent) || 0;
    const productDiscountPct = (applyMembership && activePlan?.product_discount_percent) || 0;

    return items.map((item) => {
      let quotaUnitsCovered = 0;
      let lineDiscount = 0;
      let badge = "";

      if (item.item_type === "service") {
        if (quotaAvailable > 0) {
          quotaUnitsCovered = Math.min(item.quantity, quotaAvailable);
          quotaAvailable -= quotaUnitsCovered;
        }
        const quotaSavings = quotaUnitsCovered * item.price;
        const extraQuantity = item.quantity - quotaUnitsCovered;
        const extraDiscount = extraQuantity > 0 && serviceDiscountPct > 0
          ? extraQuantity * item.price * (serviceDiscountPct / 100)
          : 0;

        lineDiscount = quotaSavings + extraDiscount;

        if (quotaUnitsCovered === item.quantity) {
          badge = "👑 100% Covered by VIP Quota";
        } else if (quotaUnitsCovered > 0) {
          badge = `👑 ${quotaUnitsCovered} Svc Quota Covered`;
        } else if (serviceDiscountPct > 0) {
          badge = `👑 ${serviceDiscountPct}% VIP Discount`;
        }
      } else if (item.item_type === "product") {
        if (productDiscountPct > 0) {
          lineDiscount = item.total * (productDiscountPct / 100);
          badge = `👑 ${productDiscountPct}% VIP Discount`;
        }
      }

      lineDiscount = Math.round(lineDiscount * 100) / 100;
      const netTotal = Math.max(0, Math.round((item.total - lineDiscount) * 100) / 100);

      return {
        ...item,
        quotaUnitsCovered,
        lineDiscount,
        netTotal,
        badge,
      };
    });
  }, [items, applyMembership, remainingQuota, activePlan]);

  const membershipSummary = useMemo(() => {
    const quotaServicesCount = computedItems.reduce((acc, i) => acc + (i.quotaUnitsCovered || 0), 0);
    const quotaCoveredAmount = computedItems
      .filter((i) => i.item_type === "service")
      .reduce((acc, i) => acc + (i.quotaUnitsCovered || 0) * i.price, 0);
    const totalMembershipDiscount = computedItems.reduce((acc, i) => acc + (i.lineDiscount || 0), 0);
    const extraPerksDiscount = Math.max(0, totalMembershipDiscount - quotaCoveredAmount);

    return {
      quotaServicesCount,
      quotaCoveredAmount: Math.round(quotaCoveredAmount * 100) / 100,
      extraPerksDiscount: Math.round(extraPerksDiscount * 100) / 100,
      totalMembershipDiscount: Math.round(totalMembershipDiscount * 100) / 100,
    };
  }, [computedItems]);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.total, 0), [items]);
  
  // 10 loyalty points = ₹1 discount
  const loyaltyDiscount = useMemo(() => {
    if (!redeemLoyalty) return 0;
    return Math.floor(loyaltyPointsToRedeem / 10);
  }, [redeemLoyalty, loyaltyPointsToRedeem]);

  const totalDiscount = useMemo(() => {
    return Math.min(
      subtotal,
      Math.round((membershipSummary.totalMembershipDiscount + discount + couponDiscount + loyaltyDiscount) * 100) / 100
    );
  }, [subtotal, membershipSummary.totalMembershipDiscount, discount, couponDiscount, loyaltyDiscount]);

  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = useMemo(() => Math.round(taxableAmount * (taxPercent / 100) * 100) / 100, [taxableAmount, taxPercent]);
  const total = useMemo(() => Math.max(0, Math.round((taxableAmount + tax) * 100) / 100), [taxableAmount, tax]);

  // Handle coupon validation
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponMessage(null);
    try {
      const res = await api<{ valid: boolean; discount?: number; message?: string; coupon?: Coupon }>(
        "POST",
        "/api/coupons/validate",
        { code: couponCode.trim(), order_amount: subtotal }
      );
      if (res.valid && res.coupon && res.discount !== undefined) {
        setAppliedCoupon(res.coupon);
        setCouponDiscount(res.discount);
        setCouponMessage(`Coupon ${res.coupon.code} applied: ₹${res.discount} OFF`);
      } else {
        setAppliedCoupon(null);
        setCouponDiscount(0);
        setCouponMessage(res.message || "Invalid coupon code");
      }
    } catch (err: any) {
      setCouponMessage("Failed to validate coupon: " + err.message);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
    setCouponMessage(null);
  };

  const handleAutoFillSplit = () => {
    const remaining = Math.max(0, total - splitCash - splitUpi);
    setSplitCard(remaining);
  };

  const handleCheckout = async () => {
    if (!clientId) return alert("Please select a client.");
    if (items.length === 0) return alert("Please add at least one item to the invoice.");

    if (paymentMethod === "split") {
      const splitTotal = splitCash + splitUpi + splitCard;
      if (Math.abs(splitTotal - total) > 0.05) {
        return alert(`Split payments (₹${splitTotal}) must exactly equal invoice total (₹${total}).`);
      }
    }
    
    setIsSubmitting(true);
    try {
      await createInvoice({
        appointment_id: null,
        client_id: parseInt(clientId, 10),
        subtotal,
        discount: totalDiscount,
        tax,
        total,
        payment_method: total === 0 ? "membership" : paymentMethod,
        split_cash: paymentMethod === "split" ? splitCash : paymentMethod === "cash" ? total : 0,
        split_upi: paymentMethod === "split" ? splitUpi : paymentMethod === "upi" ? total : 0,
        split_card: paymentMethod === "split" ? splitCard : paymentMethod === "card" ? total : 0,
        coupon_code: appliedCoupon ? appliedCoupon.code : "",
        coupon_discount: couponDiscount,
        loyalty_points_redeemed: redeemLoyalty ? loyaltyPointsToRedeem : 0,
        loyalty_discount: loyaltyDiscount,
        membership_discount: membershipSummary.totalMembershipDiscount,
        membership_services_deducted: membershipSummary.quotaServicesCount,
        status: "paid",
        items,
      });
      alert(total === 0 ? "Invoice redeemed successfully with membership quota!" : "Invoice processed and paid successfully!");
      // Reset form
      setClientId("");
      setItems([]);
      setDiscount(0);
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponCode("");
      setRedeemLoyalty(false);
      setSplitCash(0);
      setSplitUpi(0);
      setSplitCard(0);
      setActivePlan(null);
      setApplyMembership(true);
    } catch (err: any) {
      alert(err.message || (typeof err === "string" ? err : JSON.stringify(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReceipt = async (invId: number) => {
    try {
      const res = await sendReceiptWhatsApp(invId);
      alert(res.status === "simulated" ? "Simulated WhatsApp receipt logged! (Check WhatsApp tab)" : "WhatsApp receipt dispatched!");
    } catch (e: any) {
      alert("Failed to send WhatsApp receipt: " + e.message);
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6 text-muted-foreground" />
          Billing &amp; Smart POS
        </h1>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Split Payments • Coupons • Loyalty Active
        </Badge>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="new"><Receipt className="h-4 w-4 mr-2" /> New Sale</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-2" /> Invoice History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="mt-0">
          <div className="grid gap-6 md:grid-cols-[1fr_390px]">
            {/* Left Side: Items Selection */}
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Items to Bill</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>Add Salon Service</Label>
                      <Select value="" onValueChange={addService}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service..." />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name} — ₹{s.price.toFixed(2)} ({s.duration} mins)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>Add Retail Product</Label>
                      <Select value="" onValueChange={addProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select retail product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name} — ₹{p.price.toFixed(2)} ({p.stock} in stock)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Current Order Items</CardTitle>
                    <Badge variant="secondary">{items.length} items</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No items added yet. Choose a service or retail product above.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {computedItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                              <span>{item.name}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] py-0 px-1.5 font-medium">
                                  {item.badge}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{item.item_type === "service" ? "Service" : "Product"} • ₹{item.price.toFixed(2)} x {item.quantity}</span>
                              {item.lineDiscount > 0 && (
                                <span className="text-emerald-600 font-semibold">
                                  (Saved ₹{item.lineDiscount.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              {item.lineDiscount > 0 && (
                                <div className="text-xs text-muted-foreground line-through">₹{item.total.toFixed(2)}</div>
                              )}
                              <div className="font-semibold text-sm">₹{item.netTotal.toFixed(2)}</div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Side: Checkout Summary */}
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Checkout &amp; Discounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client Selector */}
                  <div className="space-y-2">
                    <Label>Select Client</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} {c.phone ? `(${c.phone})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Client Membership / Loyalty Info Badge */}
                    {selectedClient && (
                      <div className="p-2.5 rounded-md bg-muted/40 border text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Loyalty Wallet:</span>
                          <strong className="text-amber-600 font-mono">
                            {selectedClient.loyalty_points || 0} pts (≈ ₹{Math.floor((selectedClient.loyalty_points || 0) / 10)})
                          </strong>
                        </div>
                        {activePlan ? (
                          <div className="pt-2 border-t space-y-1.5">
                            <div className="flex items-center justify-between text-emerald-600 font-semibold">
                              <span className="flex items-center gap-1">
                                <Crown className="h-3.5 w-3.5 text-amber-500" /> {activePlan.membership_name}
                              </span>
                              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                {remainingQuota} svcs left
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex justify-between">
                              <span>VIP Perks:</span>
                              <span>{activePlan.service_discount_percent || 0}% extra svcs • {activePlan.product_discount_percent || 0}% retail</span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground pt-1 border-t">
                              <input
                                type="checkbox"
                                checked={applyMembership}
                                onChange={(e) => setApplyMembership((e.target as HTMLInputElement).checked)}
                                className="rounded"
                              />
                              <span className="text-xs">Apply Membership Benefits</span>
                            </label>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Coupon Box */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs">Promotional Coupon</Label>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between p-2 rounded border bg-emerald-50 dark:bg-emerald-950/40 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                          <Tag className="h-3.5 w-3.5" />
                          <span>{appliedCoupon.code}</span>
                          <span>(-₹{couponDiscount})</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleRemoveCoupon} className="h-6 text-xs text-rose-600">
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. COMEBACK200, MONDAY50"
                          value={couponCode}
                          onChange={(e) => setCouponCode((e.target as HTMLInputElement).value.toUpperCase())}
                          className="h-8 font-mono text-xs uppercase"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleApplyCoupon}
                          disabled={isValidatingCoupon || !couponCode.trim()}
                          className="h-8 text-xs"
                        >
                          {isValidatingCoupon ? "Checking..." : "Apply"}
                        </Button>
                      </div>
                    )}
                    {couponMessage && !appliedCoupon && (
                      <p className="text-[11px] text-rose-500 font-medium">{couponMessage}</p>
                    )}
                  </div>

                  {/* Loyalty Points Redemption Toggle */}
                  {selectedClient && (selectedClient.loyalty_points || 0) > 0 && (
                    <div className="p-2.5 rounded-md border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={redeemLoyalty}
                            onChange={(e) => setRedeemLoyalty((e.target as HTMLInputElement).checked)}
                            className="rounded"
                          />
                          <span>Redeem Loyalty Points</span>
                        </label>
                        <span className="text-amber-700 dark:text-amber-300 font-bold">-₹{loyaltyDiscount}</span>
                      </div>
                      {redeemLoyalty && (
                        <div className="flex items-center gap-2 pt-1">
                          <Label className="text-[11px] text-muted-foreground">Points:</Label>
                          <Input
                            type="number"
                            value={loyaltyPointsToRedeem}
                            max={selectedClient.loyalty_points || 0}
                            min={0}
                            step={10}
                            onChange={(e) => setLoyaltyPointsToRedeem(Math.min(selectedClient.loyalty_points || 0, parseInt((e.target as HTMLInputElement).value, 10) || 0))}
                            className="h-7 text-xs font-mono w-24"
                          />
                          <span className="text-[11px] text-muted-foreground">(= ₹{Math.floor(loyaltyPointsToRedeem / 10)} OFF)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="space-y-2 pt-1">
                    <Label>Payment Mode</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI / QR Code</SelectItem>
                        <SelectItem value="card">Credit / Debit Card</SelectItem>
                        <SelectItem value="split">⚡ Split Payment (Cash + UPI + Card)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Split Payment Breakdown */}
                  {paymentMethod === "split" && (
                    <div className="p-3 rounded-lg border bg-muted/30 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Split Distribution</span>
                        <Button variant="ghost" size="sm" onClick={handleAutoFillSplit} className="h-6 text-[11px] text-primary p-1">
                          Auto-Balance Card
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[11px]">Cash (₹)</Label>
                          <Input
                            type="number"
                            value={splitCash}
                            onChange={(e) => setSplitCash(parseFloat((e.target as HTMLInputElement).value) || 0)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">UPI (₹)</Label>
                          <Input
                            type="number"
                            value={splitUpi}
                            onChange={(e) => setSplitUpi(parseFloat((e.target as HTMLInputElement).value) || 0)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Card (₹)</Label>
                          <Input
                            type="number"
                            value={splitCard}
                            onChange={(e) => setSplitCard(parseFloat((e.target as HTMLInputElement).value) || 0)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                        <span>Allocated: ₹{(splitCash + splitUpi + splitCard).toFixed(2)}</span>
                        <span className={Math.abs((splitCash + splitUpi + splitCard) - total) > 0.05 ? "text-rose-500 font-bold" : "text-emerald-600 font-bold"}>
                          Difference: ₹{((splitCash + splitUpi + splitCard) - total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <Separator className="my-2" />
                  
                  {/* Pricing Breakdown */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toFixed(2)}</span>
                    </div>

                    {membershipSummary.quotaCoveredAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Crown className="h-3 w-3 text-amber-500" /> VIP Quota ({membershipSummary.quotaServicesCount} svc{membershipSummary.quotaServicesCount > 1 ? "s" : ""} free)
                        </span>
                        <span>-₹{membershipSummary.quotaCoveredAmount.toFixed(2)}</span>
                      </div>
                    )}

                    {membershipSummary.extraPerksDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Crown className="h-3 w-3 text-amber-500" /> VIP Discount Perks
                        </span>
                        <span>-₹{membershipSummary.extraPerksDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    {discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Manual Discount</span>
                        <span>-₹{discount.toFixed(2)}</span>
                      </div>
                    )}

                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Coupon ({appliedCoupon?.code})</span>
                        <span>-₹{couponDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>Loyalty Points ({loyaltyPointsToRedeem} pts)</span>
                        <span>-₹{loyaltyDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST ({taxPercent}%)</span>
                      <span>₹{tax.toFixed(2)}</span>
                    </div>

                    <Separator className="my-2" />
                    
                    <div className="flex justify-between font-bold text-base text-foreground">
                      <span>Payable Total</span>
                      <span className="text-primary text-lg">₹{total.toFixed(2)}</span>
                    </div>
                  </div>

                </CardContent>
                <CardFooter>
                  <Button onClick={handleCheckout} disabled={isSubmitting || items.length === 0 || !clientId} className="w-full">
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isSubmitting
                      ? "Processing Sale..."
                      : total === 0
                      ? "Complete & Redeem (₹0.00)"
                      : `Complete & Pay ₹${total.toFixed(2)}`}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History &amp; Receipts</CardTitle>
              <CardDescription>View all completed and split payment transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Discounts &amp; Coupon</TableHead>
                    <TableHead>Total Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium font-mono text-xs">{inv.identifier}</TableCell>
                        <TableCell className="text-xs">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {inv.client_name || clientLookup.find((c) => c.id === inv.client_id)?.name || "Walk-in"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {inv.payment_method === "split" ? "Split (Cash+UPI+Card)" : inv.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {inv.membership_discount ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 mr-1 text-[10px]">
                              VIP -₹{inv.membership_discount.toFixed(2)}
                            </Badge>
                          ) : null}
                          {inv.coupon_code ? (
                            <span className="font-mono text-primary font-semibold mr-1">{inv.coupon_code}</span>
                          ) : null}
                          {inv.loyalty_points_redeemed ? (
                            <span className="text-amber-600 font-semibold">{inv.loyalty_points_redeemed} pts</span>
                          ) : (!inv.coupon_code && !inv.loyalty_points_redeemed && !inv.membership_discount ? <span className="text-muted-foreground">—</span> : null)}
                        </TableCell>
                        <TableCell className="font-bold text-sm">₹{inv.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                            {inv.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => handleSendReceipt(inv.id)}
                            title="Send WhatsApp Receipt"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {invoicesPag.total > invoicesPag.limit && (
                <div className="mt-4">
                  <Pagination page={invoicesPag.page} limit={invoicesPag.limit} total={invoicesPag.total} onChange={setInvoicesPage} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
