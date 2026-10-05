import { useState, useMemo } from "preact/hooks";
import { useApp } from "../context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Plus, Trash2, CreditCard, History, MessageCircle } from "lucide-preact";
import type { InvoiceItem } from "../types";
import { Pagination } from "./pagination";

export function PosBilling() {
  const { clients, services, products, createInvoice, invoices, invoicesPag, setInvoicesPage, clientLookup, sendReceiptWhatsApp } = useApp();
  const [clientId, setClientId] = useState<string>("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18); // GST default 18%
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addService = (val: string) => {
    const s = services.find(x => String(x.id) === val);
    if (!s) return;
    setItems(prev => [...prev, { item_type: "service", item_id: s.id, name: s.name, quantity: 1, price: s.price, total: s.price }]);
  };

  const addProduct = (val: string) => {
    const p = products.find(x => String(x.id) === val);
    if (!p) return;
    setItems(prev => [...prev, { item_type: "product", item_id: p.id, name: p.name, quantity: 1, price: p.price, total: p.price }]);
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

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.total, 0), [items]);
  const tax = useMemo(() => (subtotal - discount) * (taxPercent / 100), [subtotal, discount, taxPercent]);
  const total = useMemo(() => subtotal - discount + tax, [subtotal, discount, tax]);

  const handleCheckout = async () => {
    if (!clientId) return alert("Please select a client.");
    if (items.length === 0) return alert("Please add at least one item to the invoice.");
    
    setIsSubmitting(true);
    try {
      await createInvoice({
        appointment_id: null,
        client_id: parseInt(clientId, 10),
        subtotal, discount, tax, total,
        payment_method: paymentMethod,
        status: "paid", // Auto mark as paid for POS
        items,
      });
      alert("Invoice created successfully!");
      // Reset form
      setClientId("");
      setItems([]);
      setDiscount(0);
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
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6 text-muted-foreground" />
          Billing & POS
        </h1>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="new"><Receipt className="h-4 w-4 mr-2" /> New Sale</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-2" /> Invoice History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="new" className="mt-0">
          <div className="grid gap-6 md:grid-cols-[1fr_350px]">
            {/* Left Side: Items Selection */}
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Items</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>Service</Label>
                      <Select value="" onValueChange={addService}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service to add..." />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} - ${s.price.toFixed(2)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>Product</Label>
                      <Select value="" onValueChange={addProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a product to add..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} - ${p.price.toFixed(2)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Invoice</CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">No items added yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.item_type === "service" ? "Service" : "Product"} - ${item.price.toFixed(2)} x {item.quantity}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="font-semibold">${item.total.toFixed(2)}</div>
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
                <CardHeader>
                  <CardTitle>Checkout Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI / Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="my-4" />
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Discount ($)</span>
                      <Input 
                        type="number" 
                        value={discount} 
                        onChange={e => setDiscount(parseFloat((e.target as HTMLInputElement).value) || 0)} 
                        className="w-20 h-7 text-right"
                      />
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({taxPercent}%)</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>

                    <Separator className="my-2" />
                    
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>

                </CardContent>
                <CardFooter>
                  <Button onClick={handleCheckout} disabled={isSubmitting || items.length === 0 || !clientId} className="w-full">
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Processing..." : `Checkout $${total.toFixed(2)}`}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>View all past transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.identifier}</TableCell>
                        <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{clientLookup.find(c => c.id === inv.client_id)?.name || "Unknown"}</TableCell>
                        <TableCell className="capitalize">{inv.payment_method}</TableCell>
                        <TableCell>${inv.total.toFixed(2)}</TableCell>
                        <TableCell className="capitalize">{inv.status}</TableCell>
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
