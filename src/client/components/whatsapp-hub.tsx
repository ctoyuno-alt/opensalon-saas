import { useState, useEffect, useMemo } from "preact/hooks";
import { useApp } from "../context";
import {
  MessageCircle, Send, CheckCircle2, AlertCircle, Settings2, Sliders,
  History, Smartphone, Check, Copy, ExternalLink, RefreshCw, Sparkles,
  ShieldCheck, ArrowRight, Zap, BellRing, Receipt
} from "lucide-preact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pagination } from "./pagination";
import type { WhatsAppSettings, WhatsAppLog } from "../types";

export function WhatsAppHub() {
  const {
    whatsappSettings,
    loadWhatsAppSettings,
    updateWhatsAppSettings,
    whatsappLogs,
    whatsappLogsPag,
    loadWhatsAppLogs,
    setWhatsAppLogsPage,
    sendTestWhatsApp,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"settings" | "templates" | "test" | "logs">("templates");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<WhatsAppSettings>>({});
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<
    "template_booking_confirmation" | "template_reminder" | "template_reschedule" | "template_cancellation" | "template_receipt"
  >("template_booking_confirmation");

  // Test message state
  const [testPhone, setTestPhone] = useState("+1 555-0101");
  const [testMessage, setTestMessage] = useState("Hi Jamie, your appointment at OpenSalon is confirmed for tomorrow at 10:00 AM! See you soon.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    waMeUrl: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadWhatsAppSettings();
    loadWhatsAppLogs(1);
  }, []);

  useEffect(() => {
    if (whatsappSettings) {
      setFormData(whatsappSettings);
    }
  }, [whatsappSettings]);

  useEffect(() => {
    if (activeTab === "logs") {
      loadWhatsAppLogs(whatsappLogsPag.page);
    }
  }, [activeTab, whatsappLogsPag.page]);

  const handleSave = async (e?: Event) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateWhatsAppSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to save WhatsApp settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (e: Event) => {
    e.preventDefault();
    if (!testPhone || !testMessage) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestWhatsApp(testPhone, testMessage);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        status: "failed",
        waMeUrl: `https://wa.me/?text=${encodeURIComponent(testMessage)}`,
        error: err.message,
      });
    } finally {
      setSendingTest(false);
    }
  };

  const insertVariable = (variable: string) => {
    const current = (formData[selectedTemplateKey] as string) || "";
    const updated = current + ` {{${variable}}}`;
    setFormData((prev) => ({ ...prev, [selectedTemplateKey]: updated }));
  };

  const templatePreview = useMemo(() => {
    const template = (formData[selectedTemplateKey] as string) || "";
    const mockVars: Record<string, string> = {
      client_name: "Jamie Rivera",
      salon_name: formData.salon_name || "OpenSalon",
      service_name: "Haircut & Styling",
      date: "2026-10-15",
      time: "10:30 AM",
      staff_name: "Alex",
      total: "65.00",
      invoice_id: "INV-104",
      payment_method: "CARD",
    };
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => mockVars[key] || `{{${key}}}`);
  }, [formData, selectedTemplateKey]);

  const totalLogs = whatsappLogsPag.total || whatsappLogs.length;
  const simulatedCount = whatsappLogs.filter((l) => l.status === "simulated").length;
  const sentCount = whatsappLogs.filter((l) => l.status === "sent").length;

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">WhatsApp Communications</h1>
              <p className="text-sm text-muted-foreground">
                Automated appointment confirmations, reminders, rescheduling updates, & POS digital receipts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              (formData.provider === "twilio" && formData.twilio_account_sid) ||
              (formData.provider === "meta" && formData.access_token)
                ? "default"
                : "secondary"
            }
            className="px-3 py-1 text-xs font-semibold gap-1.5"
          >
            {formData.provider === "twilio" && formData.twilio_account_sid ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Twilio WhatsApp Active
              </>
            ) : formData.provider === "meta" && formData.access_token ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Meta Cloud API Active
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Interactive Simulation Mode
              </>
            )}
          </Badge>
          <Button
            size="sm"
            onClick={() => setActiveTab("test")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Quick Message
          </Button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Messages</span>
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold">{totalLogs}</div>
            <p className="text-xs text-muted-foreground mt-1">Logged communication events</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Auto-Triggers</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">
              {[
                formData.auto_send_booking_confirmation,
                formData.auto_send_reschedule,
                formData.auto_send_cancellation,
                formData.auto_send_receipt,
              ].filter(Boolean).length}
              /4
            </div>
            <p className="text-xs text-muted-foreground mt-1">Automated event triggers active</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Simulated / Fallback</span>
              <Smartphone className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">{simulatedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Direct wa.me fallback ready</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Live Dispatches</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold">{sentCount}</div>
            <p className="text-xs text-muted-foreground mt-1">API dispatches via Twilio/Meta</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-1 sm:space-x-2">
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "templates"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders className="h-4 w-4" />
          Automations & Templates
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "settings"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="h-4 w-4" />
          Provider & API Keys
        </button>

        <button
          onClick={() => setActiveTab("test")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "test"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="h-4 w-4" />
          Quick Test Messenger
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "logs"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Message History ({totalLogs})
        </button>
      </div>

      {/* ── TAB 1: Automations & Templates ──────────────────────────── */}
      {activeTab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Automation Triggers & Template Selector */}
          <div className="space-y-6 lg:col-span-7">
            {/* Automatic Triggers Toggles */}
            <Card className="shadow-xs border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  Automated Event Triggers
                </CardTitle>
                <CardDescription>
                  Choose which actions automatically trigger WhatsApp notifications to clients
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                {[
                  {
                    key: "auto_send_booking_confirmation",
                    label: "New Booking Confirmation",
                    desc: "Send instant confirmation when an appointment is booked via admin or public booking (/book)",
                  },
                  {
                    key: "auto_send_reschedule",
                    label: "Appointment Rescheduled",
                    desc: "Notify client when their appointment date, time, or assigned staff changes",
                  },
                  {
                    key: "auto_send_cancellation",
                    label: "Appointment Cancelled",
                    desc: "Send friendly cancellation notice and invite them to rebook",
                  },
                  {
                    key: "auto_send_receipt",
                    label: "Digital POS Receipt",
                    desc: "Send payment confirmation and itemized invoice summary when bill is marked paid",
                  },
                ].map((trigger) => (
                  <label
                    key={trigger.key}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(formData[trigger.key as keyof WhatsAppSettings])}
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked ? 1 : 0;
                        setFormData((prev) => ({ ...prev, [trigger.key]: checked }));
                      }}
                      className="mt-1 h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium leading-none">{trigger.label}</div>
                      <p className="text-xs text-muted-foreground mt-1">{trigger.desc}</p>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* Template Selector & Editor */}
            <Card className="shadow-xs border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600" />
                  Message Template Customizer
                </CardTitle>
                <CardDescription>
                  Personalize the text and insert dynamic variable tags
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "template_booking_confirmation", label: "Booking Confirmation", icon: CheckCircle2 },
                    { key: "template_reminder", label: "24h / 2h Reminder", icon: BellRing },
                    { key: "template_reschedule", label: "Reschedule Update", icon: RefreshCw },
                    { key: "template_cancellation", label: "Cancellation", icon: AlertCircle },
                    { key: "template_receipt", label: "POS Bill / Receipt", icon: Receipt },
                  ].map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => setSelectedTemplateKey(tpl.key as any)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-colors ${
                        selectedTemplateKey === tpl.key
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-background hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <tpl.icon className="h-3 w-3" />
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Template Content</label>
                  <textarea
                    rows={4}
                    value={(formData[selectedTemplateKey] as string) || ""}
                    onInput={(e) => {
                      const val = (e.target as HTMLTextAreaElement).value;
                      setFormData((prev) => ({ ...prev, [selectedTemplateKey]: val }));
                    }}
                    className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs leading-relaxed"
                    placeholder="Enter template message..."
                  />
                </div>

                {/* Variable Tag Chips */}
                <div>
                  <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Click to insert tags:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { tag: "client_name", label: "Client Name" },
                      { tag: "salon_name", label: "Salon Name" },
                      { tag: "service_name", label: "Services" },
                      { tag: "date", label: "Date" },
                      { tag: "time", label: "Time" },
                      { tag: "staff_name", label: "Stylist" },
                      { tag: "total", label: "Total $" },
                      { tag: "invoice_id", label: "Invoice #" },
                      { tag: "payment_method", label: "Payment Mode" },
                    ].map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable(v.tag)}
                        className="px-2 py-1 text-xs bg-muted hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 rounded border border-border/80 transition-colors font-mono"
                      >
                        + {`{{${v.tag}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {saveSuccess && (
                      <span className="text-emerald-600 flex items-center gap-1 font-medium">
                        <Check className="h-3.5 w-3.5" /> Changes saved!
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {saving ? "Saving..." : "Save Automations & Templates"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Interactive Phone Mockup Preview */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start">
            <div className="sticky top-6 w-full max-w-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center flex items-center justify-center gap-1.5">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                Live Client WhatsApp Preview
              </div>

              {/* Smartphone Frame */}
              <div className="relative mx-auto border-4 border-zinc-800 dark:border-zinc-700 rounded-[2.5rem] p-3 bg-zinc-900 shadow-xl overflow-hidden aspect-[9/18] flex flex-col">
                {/* Phone Speaker & Camera Notch */}
                <div className="w-24 h-4 bg-zinc-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-zinc-700 mr-2" />
                  <div className="w-10 h-1 rounded-full bg-zinc-700" />
                </div>

                {/* WhatsApp Chat Header */}
                <div className="bg-emerald-700 text-white px-3 py-2 rounded-t-xl flex items-center gap-2 shadow-xs">
                  <div className="h-7 w-7 rounded-full bg-emerald-600 border border-white/20 flex items-center justify-center font-bold text-xs">
                    {(formData.salon_name || "O").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs truncate">
                      {formData.salon_name || "OpenSalon"}
                    </div>
                    <div className="text-[10px] text-emerald-200">Verified Business Account</div>
                  </div>
                </div>

                {/* WhatsApp Chat Body */}
                <div className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] p-3 overflow-y-auto flex flex-col justify-end space-y-3 rounded-b-xl relative">
                  <div className="text-center">
                    <span className="bg-white/80 dark:bg-zinc-800/80 text-[10px] text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full shadow-2xs">
                      Today
                    </span>
                  </div>

                  {/* WhatsApp Speech Bubble */}
                  <div className="self-start max-w-[88%] bg-white dark:bg-[#1f2c34] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tl-none p-2.5 shadow-xs text-xs relative border border-black/5 dark:border-white/5">
                    <p className="whitespace-pre-wrap leading-relaxed">{templatePreview}</p>
                    <div className="flex items-center justify-end gap-1 mt-1.5 text-[9px] text-zinc-400">
                      <span>10:31 AM</span>
                      <span className="text-emerald-500 font-bold">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground text-center mt-3">
                Shows real-time interpolation of tags when sent to a customer.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Provider & API Configuration ────────────────────────── */}
      {activeTab === "settings" && (
        <div className="max-w-3xl space-y-6">
          <Card className="shadow-xs border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-emerald-600" />
                WhatsApp Service Provider Setup
              </CardTitle>
              <CardDescription>
                Configure Twilio WhatsApp, Meta WhatsApp Cloud API credentials, or Interactive Simulation mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Delivery Provider Mode</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, provider: "twilio" }))}
                      className={`p-3 text-left rounded-lg border text-sm transition-all relative ${
                        formData.provider === "twilio"
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-600"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                        <Smartphone className="h-4 w-4 text-emerald-600" />
                        Twilio WhatsApp
                      </div>
                      <Badge variant="outline" className="mt-1 text-[10px] text-emerald-600 border-emerald-300">
                        Fastest Sandbox Test
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Free sandbox testing. Bypasses Meta Developer phone verification blocks.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, provider: "meta" }))}
                      className={`p-3 text-left rounded-lg border text-sm transition-all ${
                        formData.provider === "meta"
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-600"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        Meta Cloud API
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Direct API dispatch via Meta's Graph API. Requires Facebook Business credentials.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, provider: "simulation" }))}
                      className={`p-3 text-left rounded-lg border text-sm transition-all ${
                        formData.provider === "simulation"
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-600"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5 text-xs sm:text-sm">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Simulation & wa.me
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Zero setup required. Logs messages to history and generates 1-click wa.me links.
                      </p>
                    </button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Salon / Business Display Name</label>
                  <Input
                    value={formData.salon_name || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, salon_name: (e.target as HTMLInputElement).value }))}
                    placeholder="e.g. OpenSalon Studio & Spa"
                  />
                  <p className="text-[11px] text-muted-foreground">Used in template tags as {`{{salon_name}}`}</p>
                </div>

                {formData.provider === "twilio" && (
                  <div className="space-y-4 pt-2">
                    <div className="rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 p-3.5 space-y-2 text-xs text-emerald-950 dark:text-emerald-200">
                      <div className="font-semibold flex items-center gap-1.5 text-sm text-emerald-800 dark:text-emerald-300">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        Twilio WhatsApp Sandbox Setup
                      </div>
                      <ol className="list-decimal pl-4 space-y-2 text-muted-foreground dark:text-emerald-300/90 leading-relaxed">
                        <li>
                          Open your <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-medium text-emerald-700 dark:text-emerald-400">Twilio Console</a> &gt; <strong>Messaging &gt; Try it out &gt; Send a WhatsApp message</strong>.
                        </li>
                        <li>
                          <strong>Crucial Opt-In Step:</strong> From the recipient phone (e.g. your WhatsApp on your mobile), send your unique sandbox keyword (e.g. <code>join &lt;two-words&gt;</code>) to <strong>+1 415 523 8886</strong>.
                          <div className="mt-1 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
                            ⚠️ <strong>ContentSid Required Error:</strong> If the recipient has not sent the join code, WhatsApp blocks outbound freeform text until the 24-hour window is opened by the user.
                          </div>
                        </li>
                        <li>
                          Copy your <strong>Account SID</strong> and <strong>Auth Token</strong> from the Twilio Console dashboard and paste them below.
                        </li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Twilio Account SID</label>
                      <Input
                        value={formData.twilio_account_sid || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, twilio_account_sid: (e.target as HTMLInputElement).value }))}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Twilio Auth Token</label>
                      <Input
                        type="password"
                        value={formData.twilio_auth_token || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, twilio_auth_token: (e.target as HTMLInputElement).value }))}
                        placeholder="Your Twilio Auth Token"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Twilio WhatsApp Sender Number</label>
                      <Input
                        value={formData.twilio_phone_number || "+14155238886"}
                        onChange={(e) => setFormData((p) => ({ ...p, twilio_phone_number: (e.target as HTMLInputElement).value }))}
                        placeholder="+14155238886"
                      />
                      <p className="text-[11px] text-muted-foreground">Default Twilio Sandbox sender is +14155238886. If using an approved production sender, enter it here.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Twilio Content Template SID (Optional)</label>
                      <Input
                        value={formData.twilio_content_sid || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, twilio_content_sid: (e.target as HTMLInputElement).value }))}
                        placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (starts with HX)"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Optional. If provided, messages dispatch via Twilio's approved Content Template. If left blank, freeform text is sent (requires recipient to have joined sandbox).
                      </p>
                    </div>
                  </div>
                )}

                {formData.provider === "meta" && (
                  <div className="space-y-4 pt-2">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 p-3 text-xs text-emerald-900 dark:text-emerald-300">
                      <strong>Meta Developer Setup:</strong> You can find your Phone Number ID and Permanent Access Token inside your Meta App Dashboard under WhatsApp &gt; API Setup.
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Phone Number ID</label>
                      <Input
                        value={formData.phone_number_id || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, phone_number_id: (e.target as HTMLInputElement).value }))}
                        placeholder="e.g. 106543219876543"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Meta Cloud API Permanent Access Token</label>
                      <Input
                        type="password"
                        value={formData.access_token || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, access_token: (e.target as HTMLInputElement).value }))}
                        placeholder="EAAB..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">WhatsApp Business Account ID (WABA ID)</label>
                      <Input
                        value={formData.business_account_id || ""}
                        onChange={(e) => setFormData((p) => ({ ...p, business_account_id: (e.target as HTMLInputElement).value }))}
                        placeholder="e.g. 109876543210987"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between">
                  <div>
                    {saveSuccess && (
                      <span className="text-emerald-600 text-xs flex items-center gap-1 font-medium">
                        <Check className="h-3.5 w-3.5" /> Settings saved successfully!
                      </span>
                    )}
                  </div>
                  <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {saving ? "Saving..." : "Save Provider Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 3: Quick Test Messenger ─────────────────────────────── */}
      {activeTab === "test" && (
        <div className="grid gap-6 lg:grid-cols-12 max-w-4xl">
          <div className="lg:col-span-7">
            <Card className="shadow-xs border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-600" />
                  Send Test WhatsApp Message
                </CardTitle>
                <CardDescription>
                  Verify formatting and API credentials by sending a live or simulated message
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendTest} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Recipient Phone Number (with Country Code)</label>
                    <Input
                      value={testPhone}
                      onChange={(e) => setTestPhone((e.target as HTMLInputElement).value)}
                      placeholder="+1 (555) 0101"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">E.g. +1 555-0101, +44 7911 123456, +91 9876543210</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Message Content</label>
                    <textarea
                      rows={4}
                      value={testMessage}
                      onInput={(e) => setTestMessage((e.target as HTMLTextAreaElement).value)}
                      className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={sendingTest}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                    >
                      {sendingTest ? "Sending..." : "Dispatch Message"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            {testResult ? (
              <Card className="shadow-xs border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Dispatch Result: {testResult.status.toUpperCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {testResult.status === "simulated" ? (
                    <p className="text-muted-foreground">
                      Message logged in <strong>Simulation Mode</strong>. Since API credentials are not yet saved or provider is set to simulation, OpenSalon created a verified log and generated a 1-click WhatsApp Web / App link.
                    </p>
                  ) : testResult.status === "sent" ? (
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Delivered via {formData.provider === "twilio" ? "Twilio WhatsApp API" : "Meta Cloud API"}! Message ID: <code className="font-mono bg-emerald-100 dark:bg-emerald-900/50 px-1 py-0.5 rounded">{testResult.messageId}</code>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-destructive font-medium">
                        Error: {testResult.error}
                      </p>
                      {testResult.error?.includes("ContentSid Required") ? (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2 leading-relaxed">
                          <p className="font-semibold text-amber-800 dark:text-amber-300">
                            Why did this happen?
                          </p>
                          <p>
                            WhatsApp anti-spam policy blocks outbound freeform text until the recipient has opened a 24-hour conversation window by messaging your Twilio Sandbox first.
                          </p>
                          <div className="pt-1">
                            <span className="font-semibold block mb-1">To fix this in 30 seconds:</span>
                            <ol className="list-decimal pl-4 space-y-1">
                              <li>Open WhatsApp on the recipient mobile phone (<strong>{testPhone}</strong>).</li>
                              <li>Send your Twilio Sandbox join code (found in Twilio Console under <em>Try WhatsApp</em>, e.g. <code>join &lt;two-words&gt;</code>) to <strong>+1 415 523 8886</strong>.</li>
                              <li>Wait for Twilio's reply: <em>"You are all set!"</em>.</li>
                              <li>Click <strong>Dispatch Message</strong> again — it will succeed immediately!</li>
                            </ol>
                          </div>
                        </div>
                      ) : formData.provider === "twilio" ? (
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          Tip: In Twilio Sandbox mode, the recipient phone number must first opt-in by sending the sandbox <code>join &lt;code&gt;</code> keyword to <code>+1 415 523 8886</code>.
                        </p>
                      ) : null}
                    </div>
                  )}

                  <div className="pt-2">
                    <a
                      href={testResult.waMeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors w-full justify-center"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in WhatsApp Web / App
                    </a>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xs border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Direct Click-to-Chat</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>
                    Every appointment and customer record in OpenSalon comes equipped with 1-click WhatsApp buttons.
                  </p>
                  <p>
                    Staff members can open chats directly in WhatsApp Desktop, Mobile, or Web with prefilled confirmation text without needing to save client numbers to their personal contact lists.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: Audit Logs & Message History ──────────────────────── */}
      {activeTab === "logs" && (
        <Card className="shadow-xs border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-600" />
                WhatsApp Message History & Audit Trail
              </CardTitle>
              <CardDescription>
                Full record of automated notifications, receipts, and manual dispatches
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadWhatsAppLogs(whatsappLogsPag.page)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {whatsappLogs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No WhatsApp messages logged yet. Try sending a test message or booking an appointment!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-y border-border/60 font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Status & Provider</th>
                      <th className="py-2.5 px-4">Recipient</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Content</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {whatsappLogs.map((log) => {
                      const waLink = `https://wa.me/${log.recipient_phone}?text=${encodeURIComponent(log.content)}`;
                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={
                                  log.status === "sent"
                                    ? "default"
                                    : log.status === "simulated"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="text-[10px] uppercase font-semibold"
                              >
                                {log.status}
                              </Badge>
                              {log.provider && (
                                <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                  {log.provider}
                                </span>
                              )}
                            </div>
                            {log.error_message && (
                              <div className="text-[10px] text-destructive mt-1 max-w-[200px] truncate" title={log.error_message}>
                                {log.error_message}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium whitespace-nowrap">
                            <div>{log.recipient_name || "Client"}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              +{log.recipient_phone}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="capitalize text-muted-foreground">
                              {log.message_type.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs md:max-w-md truncate text-muted-foreground" title={log.content}>
                            {log.content}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                            {log.created_at}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {whatsappLogsPag.total > whatsappLogsPag.limit && (
              <div className="p-3 border-t border-border">
                <Pagination
                  page={whatsappLogsPag.page}
                  limit={whatsappLogsPag.limit}
                  total={whatsappLogsPag.total}
                  onPageChange={setWhatsAppLogsPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
