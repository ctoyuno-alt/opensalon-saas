import { useState, useEffect } from "preact/hooks";
import { api } from "../api";
import type { GrowthInsights, InactiveClientAlert } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, Users, Clock, Award, DollarSign, Flame, AlertCircle,
  MessageCircle, Send, Copy, Check, RefreshCw, Sparkles, ChevronRight,
  Calendar, Gift, Tag, Zap
} from "lucide-preact";

export function GrowthDashboard() {
  const [data, setData] = useState<GrowthInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [directSendingId, setDirectSendingId] = useState<number | null>(null);
  const [sentSuccessId, setSentSuccessId] = useState<number | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await api<GrowthInsights>("GET", "/api/growth/insights");
      setData(res);
    } catch (err) {
      console.error("Failed to load growth insights", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleSendWhatsAppOffer = async (client: InactiveClientAlert) => {
    if (!client.phone) {
      alert(`Client ${client.name} has no phone number on record.`);
      return;
    }
    setDirectSendingId(client.id);
    try {
      const res = await api<{ result: { status: string; waMeUrl: string } }>("POST", "/api/whatsapp/send-test", {
        phone: client.phone,
        message: client.suggested_message,
      });
      setSentSuccessId(client.id);
      setTimeout(() => setSentSuccessId(null), 4000);
      if (res.result.status === "simulated" && res.result.waMeUrl) {
        window.open(res.result.waMeUrl, "_blank");
      }
    } catch (err: any) {
      // Fallback: open WhatsApp Web / wa.me link directly
      if (client.whatsapp_url) {
        window.open(client.whatsapp_url, "_blank");
      } else {
        alert("Failed to dispatch WhatsApp: " + (err.message || "Unknown error"));
      }
    } finally {
      setDirectSendingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Crunching salon growth analytics...</p>
        </div>
      </div>
    );
  }

  const inactive = data?.inactive_clients || [];
  const slowHours = data?.slow_hours || [];
  const leaderboard = data?.stylist_leaderboard || [];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Salon Growth Engine</h1>
            <Badge variant="outline" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Zap className="h-3 w-3 mr-1 fill-emerald-500 text-emerald-500" /> Live Revenue Booster
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated churn recovery, off-peak slot utilization, and stylist commission performance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInsights} disabled={loading} className="self-start md:self-auto gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh Insights
        </Button>
      </div>

      {/* Top Growth KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-rose-500 bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Clients at Risk</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{inactive.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No visit in 45+ days. Ready for 1-click WhatsApp comeback blast.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repeat Client Rate</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data?.repeat_client_rate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Clients with &gt;1 salon visit. Healthy industry benchmark is 60%+.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active VIP Members</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-500">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data?.total_members || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active Gold/Silver VIP package holders driving recurring revenue.
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Ticket Size</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₹{data?.avg_ticket_size || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Avg revenue per invoice. Loyalty &amp; upsells lift this by ~25%.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Inactive Client Comeback Engine */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b bg-muted/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-rose-500" />
              <CardTitle className="text-lg">Inactive Client Comeback Engine</CardTitle>
              <Badge variant="secondary" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                Churn Prevention
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Clients who haven't visited in 45+ days. Send high-converting WhatsApp comeback incentives in 1 click.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              Offer Code: <span className="font-bold text-primary ml-1">COMEBACK200</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {inactive.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Check className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-medium">No inactive clients detected!</p>
              <p className="text-xs">All registered clients have visited recently.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Client</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Visits &amp; Spend</TableHead>
                    <TableHead>Recommended Winback Offer</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactive.map((client) => {
                    const isSending = directSendingId === client.id;
                    const isSuccess = sentSuccessId === client.id;

                    return (
                      <TableRow key={client.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <div className="font-medium">{client.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{client.phone || "No phone"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/40">
                            {client.days_since_last_visit} days ago
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-0.5">{client.last_visit_date}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold">₹{client.total_spent}</div>
                          <div className="text-xs text-muted-foreground">{client.total_visits} past visits</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-primary flex items-center gap-1">
                            <Gift className="h-3.5 w-3.5 text-primary" /> {client.suggested_discount}
                          </div>
                          <p className="text-xs text-muted-foreground italic truncate max-w-md mt-0.5">
                            "{client.suggested_message}"
                          </p>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => copyToClipboard(client.suggested_message, `msg-${client.id}`)}
                            >
                              {copiedCode === `msg-${client.id}` ? (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              disabled={isSending || !client.phone}
                              onClick={() => handleSendWhatsAppOffer(client)}
                              className={`h-8 px-3 text-xs gap-1.5 ${
                                isSuccess
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-[#25D366] hover:bg-[#1EBE5D] text-white"
                              }`}
                            >
                              {isSuccess ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Dispatched!
                                </>
                              ) : isSending ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending...
                                </>
                              ) : (
                                <>
                                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp Offer
                                </>
                              )}
                            </Button>
                          </div>
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

      {/* Grid: Off-Peak Hours Optimizer & Stylist Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Off-Peak Slot Optimizer */}
        <Card className="border shadow-sm flex flex-col">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">Off-Peak Capacity Optimizer</CardTitle>
              </div>
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/40">
                Slow-Hour Fill
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Fill empty salon chairs on slow weekdays using targeted promotional flash deals.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            {slowHours.map((slot, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{slot.slot_label}</span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {slot.historical_bookings} Bookings Avg
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">{slot.recommended_deal}</span>
                    <span>• Lift: <strong className="text-emerald-600">{slot.estimated_lift}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-xs">
                    {slot.promo_code}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-2"
                    onClick={() =>
                      copyToClipboard(
                        `🌟 Special Salon Flash Deal! Book during ${slot.slot_label} and enjoy ${slot.recommended_deal} with code ${slot.promo_code}! Book online now.`,
                        slot.promo_code
                      )
                    }
                  >
                    {copiedCode === slot.promo_code ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy Blast
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Stylist Commission & Performance Leaderboard */}
        <Card className="border shadow-sm flex flex-col">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-500" />
                <CardTitle className="text-lg">Stylist &amp; Commission Leaderboard</CardTitle>
              </div>
              <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40">
                Staff Incentives
              </Badge>
            </div>
            <CardDescription className="mt-1">
              Track revenue generated, retail product sales, and commission earned per stylist.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No active stylist data found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Stylist</TableHead>
                      <TableHead>Appointments</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead className="text-right">Commission Earned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((stylist) => {
                      const rankBadge =
                        stylist.rank === 1 ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-900 font-bold text-xs shadow-sm">
                            🥇
                          </span>
                        ) : stylist.rank === 2 ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-slate-900 font-bold text-xs shadow-sm">
                            🥈
                          </span>
                        ) : stylist.rank === 3 ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-white font-bold text-xs shadow-sm">
                            🥉
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground ml-2">#{stylist.rank}</span>
                        );

                      return (
                        <TableRow key={stylist.staff_id} className="hover:bg-muted/40 transition-colors">
                          <TableCell>{rankBadge}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: stylist.staff_color || "#7c3aed" }}
                              />
                              <div>
                                <div className="font-semibold text-sm leading-tight">{stylist.staff_name}</div>
                                <div className="text-xs text-muted-foreground">{stylist.staff_title}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-sm">{stylist.completed_appointments}</span>
                            <span className="text-xs text-muted-foreground ml-1">done</span>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">₹{stylist.total_sales.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">
                              ₹{stylist.service_revenue.toFixed(0)} Svc • ₹{stylist.product_revenue.toFixed(0)} Prod
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-xs">
                              ₹{stylist.commission_earned.toFixed(2)}
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
      </div>
    </div>
  );
}
