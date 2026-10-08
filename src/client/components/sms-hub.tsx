import { useState, useEffect, useMemo } from "preact/hooks";
import { useApp } from "../context";
import {
  MessageSquare, Send, CheckCircle2, AlertCircle, Settings2, Sliders,
  History, Smartphone, Check, Copy, RefreshCw, Sparkles,
  ShieldCheck, ArrowRight, Zap, BellRing, Receipt, Info, Radio
} from "lucide-preact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pagination } from "./pagination";
import type { SmsSettings, SmsLog } from "../types";

export function SmsHub() {
  const {
    smsSettings,
    loadSmsSettings,
    updateSmsSettings,
    smsLogs,
    smsLogsPag,
    loadSmsLogs,
    setSmsLogsPage,
    sendTestSms,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"settings" | "templates" | "test" | "logs">("templates");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<SmsSettings>>({});
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<
    "template_booking_confirmation" | "template_reminder" | "template_reschedule" | "template_cancellation" | "template_receipt"
  >("template_booking_confirmation");

  // Test message state
  const [testPhone, setTestPhone] = useState("+91 98765 43210");
  const [testMessage, setTestMessage] = useState(
    "Hi Jamie, your booking at OpenSalon for Haircut & Styling on Oct 15 at 10:30 AM is confirmed! Total: ₹65.00."
  );
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    messageId?: string;
    error?: string;
    segments?: number;
  } | null>(null);

  useEffect(() => {
    loadSmsSettings();
    loadSmsLogs(1);
  }, []);

  useEffect(() => {
    if (smsSettings) {
      setFormData(smsSettings);
    }
  }, [smsSettings]);

  useEffect(() => {
    if (activeTab === "logs") {
      loadSmsLogs(smsLogsPag.page);
    }
  }, [activeTab, smsLogsPag.page]);

  const handleSave = async (e?: Event) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateSmsSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to save SMS settings: " + err.message);
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
      const res = await sendTestSms(testPhone, testMessage);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        status: "failed",
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

  // SMS character length and segment metrics
  const currentTemplateText = (formData[selectedTemplateKey] as string) || "";
  const smsLengthMetrics = useMemo(() => {
    const chars = currentTemplateText.length;
    // Standard GSM 7-bit is 160 chars / segment (or 153 for multi-part).
    const maxSingle = 160;
    const maxMulti = 153;
    const segments = chars === 0 ? 1 : chars <= maxSingle ? 1 : Math.ceil(chars / maxMulti);
    return { chars, segments, maxSingle };
  }, [currentTemplateText]);

  const templatePreview = useMemo(() => {
    const template = currentTemplateText;
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
  }, [currentTemplateText, formData.salon_name]);

  const templateOptions = [
    { key: "template_booking_confirmation", label: "Booking Confirmation", desc: "Sent automatically when an appointment is booked" },
    { key: "template_reminder", label: "Appointment Reminder", desc: "Friendly automated appointment reminder" },
    { key: "template_reschedule", label: "Reschedule Notice", desc: "Triggered whenever an appointment date or time is shifted" },
    { key: "template_cancellation", label: "Cancellation Notice", desc: "Dispatched if an appointment is cancelled" },
    { key: "template_receipt", label: "Invoice & Payment Receipt", desc: "Sent when an invoice is marked paid at checkout" },
  ];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SMS Gateway &amp; Marketing Hub</h1>
              <p className="text-sm text-muted-foreground">
                Multi-channel transactional SMS for appointments, billing receipts, and client reminders.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="px-3 py-1 bg-blue-50/50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200">
            <Radio className="h-3 w-3 mr-1.5 animate-pulse text-blue-600" />
            Provider: {formData.provider === "simulation" ? "Simulation (Free Test)" : formData.provider === "twilio" ? "Twilio SMS" : "Fast2SMS (India)"}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200">
            <Sparkles className="h-3 w-3 mr-1 text-emerald-500" /> Multi-Channel Active
          </Badge>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-border/60 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "templates"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders className="h-4 w-4" /> Message Templates
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "settings"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="h-4 w-4" /> Gateway Settings
        </button>
        <button
          onClick={() => setActiveTab("test")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "test"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="h-4 w-4" /> Test Dispatcher
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "logs"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" /> SMS Delivery Logs
        </button>
      </div>

      {/* Tab 1: Message Templates */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Template Selector & Editor */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Select Notification Type</CardTitle>
                <CardDescription>Customize the SMS text sent automatically for salon events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templateOptions.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setSelectedTemplateKey(t.key as any)}
                      className={`text-left p-3 rounded-lg border text-sm transition-all ${
                        selectedTemplateKey === t.key
                          ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 font-medium"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-semibold text-foreground">{t.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{t.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Template Text
                    </label>
                    <div className="text-xs font-mono text-muted-foreground">
                      <span className={smsLengthMetrics.chars > 160 ? "text-amber-600 font-semibold" : ""}>
                        {smsLengthMetrics.chars} chars
                      </span>{" "}
                      •{" "}
                      <span className="font-semibold text-blue-600">
                        {smsLengthMetrics.segments} SMS segment{smsLengthMetrics.segments > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={(formData[selectedTemplateKey] as string) || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [selectedTemplateKey]: (e.target as HTMLTextAreaElement).value,
                      }))
                    }
                    className="w-full text-sm p-3 rounded-md border border-input bg-background font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Write template message..."
                  />
                </div>

                {/* Variable Chips */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground">Insert Dynamic Variables:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: "client_name", label: "Client Name" },
                      { key: "salon_name", label: "Salon Name" },
                      { key: "service_name", label: "Service Name" },
                      { key: "date", label: "Date" },
                      { key: "time", label: "Time" },
                      { key: "staff_name", label: "Stylist" },
                      { key: "total", label: "Amount (₹)" },
                      { key: "invoice_id", label: "Invoice #" },
                      { key: "payment_method", label: "Payment Mode" },
                    ].map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className="text-xs px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border/80 transition-colors flex items-center gap-1 font-mono"
                      >
                        <span>+</span> {`{{${v.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save Template
                  </Button>
                </div>

                {saveSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>Templates saved and updated in database!</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Realistic Phone SMS Mockup */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start">
            <div className="w-full max-w-[340px] rounded-[38px] p-3 border-4 border-muted-foreground/30 bg-muted/20 shadow-2xl">
              <div className="rounded-[28px] bg-slate-950 text-white overflow-hidden border border-slate-800 flex flex-col h-[520px]">
                {/* Phone Top Speaker & Notch */}
                <div className="pt-3 pb-2 px-6 flex items-center justify-between text-[11px] text-slate-400 font-medium border-b border-slate-900 bg-slate-950">
                  <span>9:41 AM</span>
                  <div className="w-16 h-4 bg-slate-900 rounded-full" />
                  <span>5G • 100%</span>
                </div>

                {/* SMS Sender Bar */}
                <div className="p-3 text-center border-b border-slate-900 bg-slate-900/40">
                  <div className="w-9 h-9 mx-auto rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-sm mb-1">
                    {formData.sender_id?.slice(0, 2) || "OS"}
                  </div>
                  <div className="text-xs font-semibold text-slate-200">
                    {formData.sender_id || formData.salon_name || "OpenSalon"}
                  </div>
                  <div className="text-[10px] text-slate-500">SMS / Text Message</div>
                </div>

                {/* Message Bubble Container */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-950 flex flex-col justify-end">
                  <div className="text-center text-[10px] text-slate-500">Today 9:41 AM</div>
                  <div className="max-w-[85%] bg-slate-800 text-slate-100 p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow-sm">
                    {templatePreview || "Message preview will appear here..."}
                  </div>
                </div>

                {/* Bottom Input Mock */}
                <div className="p-2 border-t border-slate-900 bg-slate-950 text-slate-600 text-[11px] flex items-center justify-between px-3">
                  <span>Text Message</span>
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px]">
                    ↑
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Live Phone Preview: rendered with simulated client and appointment details.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Gateway Configuration */}
      {activeTab === "settings" && (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">1. Choose SMS Gateway Provider</CardTitle>
              <CardDescription>
                Select your preferred SMS dispatch service or use the built-in free simulator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Simulation Mode */}
                <div
                  onClick={() => setFormData({ ...formData, provider: "simulation" })}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    formData.provider === "simulation"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Simulation Mode</span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">Free</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Logs all outgoing SMS messages directly in the dashboard without requiring any external API keys or credits.
                  </p>
                </div>

                {/* Twilio SMS */}
                <div
                  onClick={() => setFormData({ ...formData, provider: "twilio" })}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    formData.provider === "twilio"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Twilio SMS</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px]">Global</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enterprise global SMS gateway. Reuses your Twilio Account SID and Auth Token to dispatch live SMS worldwide.
                  </p>
                </div>

                {/* Fast2SMS (India) */}
                <div
                  onClick={() => setFormData({ ...formData, provider: "fast2sms" })}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    formData.provider === "fast2sms"
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">Fast2SMS (India)</span>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">₹0.20 / SMS</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cost-effective Indian SMS gateway supporting instant quick route (no DLT approval required for quick route testing).
                  </p>
                </div>
              </div>

              {/* Provider Specific Inputs */}
              {formData.provider === "twilio" && (
                <div className="p-4 rounded-xl border bg-muted/20 space-y-3 mt-4">
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" /> Twilio Credentials
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Account SID</label>
                      <Input
                        value={formData.twilio_account_sid || ""}
                        onChange={(e) => setFormData({ ...formData, twilio_account_sid: (e.target as HTMLInputElement).value })}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Auth Token</label>
                      <Input
                        type="password"
                        value={formData.twilio_auth_token || ""}
                        onChange={(e) => setFormData({ ...formData, twilio_auth_token: (e.target as HTMLInputElement).value })}
                        placeholder="••••••••••••••••••••"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Twilio From Number</label>
                      <Input
                        value={formData.twilio_phone_number || ""}
                        onChange={(e) => setFormData({ ...formData, twilio_phone_number: (e.target as HTMLInputElement).value })}
                        placeholder="+14155238886"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.provider === "fast2sms" && (
                <div className="p-4 rounded-xl border bg-muted/20 space-y-3 mt-4">
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-600" /> Fast2SMS API Configuration
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">API Authorization Key</label>
                      <Input
                        type="password"
                        value={formData.fast2sms_api_key || ""}
                        onChange={(e) => setFormData({ ...formData, fast2sms_api_key: (e.target as HTMLInputElement).value })}
                        placeholder="Fast2SMS API Key"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Route</label>
                      <Input
                        value={formData.fast2sms_route || "q"}
                        onChange={(e) => setFormData({ ...formData, fast2sms_route: (e.target as HTMLInputElement).value })}
                        placeholder="q (Quick route) or dlt / otp"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* General Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Salon Name (in SMS)</label>
                  <Input
                    value={formData.salon_name || ""}
                    onChange={(e) => setFormData({ ...formData, salon_name: (e.target as HTMLInputElement).value })}
                    placeholder="OpenSalon"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">SMS Sender Header / ID</label>
                  <Input
                    value={formData.sender_id || ""}
                    onChange={(e) => setFormData({ ...formData, sender_id: (e.target as HTMLInputElement).value.toUpperCase() })}
                    placeholder="SALON"
                    maxLength={11}
                    className="h-8 text-xs uppercase font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Automated Event Triggers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">2. Automated SMS Triggers</CardTitle>
              <CardDescription>
                Configure which salon events automatically send an SMS to clients.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  key: "auto_send_booking_confirmation",
                  title: "Booking Confirmation SMS",
                  desc: "Send an instant confirmation text when a new appointment is booked.",
                },
                {
                  key: "auto_send_reschedule",
                  title: "Reschedule Notification SMS",
                  desc: "Send an updated text message when an appointment date or time is moved.",
                },
                {
                  key: "auto_send_cancellation",
                  title: "Cancellation Notice SMS",
                  desc: "Send a polite cancellation alert if an appointment is cancelled.",
                },
                {
                  key: "auto_send_receipt",
                  title: "POS Bill Payment Receipt SMS",
                  desc: "Send a digital billing receipt with total paid and invoice ID upon checkout.",
                },
              ].map((trigger) => (
                <label
                  key={trigger.key}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!(formData[trigger.key as keyof SmsSettings] as number)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [trigger.key]: (e.target as HTMLInputElement).checked ? 1 : 0,
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">{trigger.title}</div>
                    <div className="text-xs text-muted-foreground">{trigger.desc}</div>
                  </div>
                </label>
              ))}

              <div className="flex justify-end pt-3">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save All Gateway Settings
                </Button>
              </div>

              {saveSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>Gateway settings saved successfully!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}

      {/* Tab 3: Test Dispatcher */}
      {activeTab === "test" && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Live SMS Test Dispatcher</CardTitle>
              <CardDescription>
                Send a live or simulated SMS to verify delivery to any recipient number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendTest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Recipient Mobile Number</label>
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone((e.target as HTMLInputElement).value)}
                    placeholder="+91 98765 43210 or 10-digit mobile"
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Accepts international (+...) or standard 10-digit mobile numbers.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Message Content</label>
                  <textarea
                    rows={4}
                    value={testMessage}
                    onChange={(e) => setTestMessage((e.target as HTMLInputElement).value)}
                    className="w-full text-sm p-3 rounded-md border border-input bg-background font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-muted-foreground flex justify-between font-mono">
                    <span>Length: {testMessage.length} characters</span>
                    <span>Segments: {Math.ceil(testMessage.length / 153) || 1} SMS</span>
                  </div>
                </div>

                <Button type="submit" disabled={sendingTest || !testPhone || !testMessage} className="w-full gap-2">
                  {sendingTest ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendingTest ? "Sending Test SMS..." : "Send Test SMS"}
                </Button>
              </form>

              {testResult && (
                <div
                  className={`mt-4 p-4 rounded-xl border text-xs space-y-1.5 ${
                    testResult.success
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 text-rose-900 dark:text-rose-200"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5 text-sm">
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>
                      {testResult.status === "simulated"
                        ? "Test SMS Simulated Successfully"
                        : testResult.status === "sent"
                        ? "Test SMS Dispatched Live"
                        : "SMS Dispatch Failed"}
                    </span>
                  </div>
                  {testResult.messageId && (
                    <div className="font-mono text-[11px]">Tracking ID: {testResult.messageId}</div>
                  )}
                  {testResult.error && (
                    <div className="text-rose-600 dark:text-rose-400 font-medium">{testResult.error}</div>
                  )}
                  <p className="text-[11px] opacity-80 pt-1">
                    Check the Delivery Logs tab to view complete message audit records.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Delivery History & Logs */}
      {activeTab === "logs" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">SMS Delivery Audit Log</CardTitle>
              <CardDescription>Real-time delivery history of all outbound SMS communications.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSmsLogs(smsLogsPag.page)}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {smsLogs.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No SMS messages logged yet. Send a test message or book an appointment to see logs.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-2.5 font-semibold">Status</th>
                        <th className="p-2.5 font-semibold">Type</th>
                        <th className="p-2.5 font-semibold">Recipient</th>
                        <th className="p-2.5 font-semibold">Gateway</th>
                        <th className="p-2.5 font-semibold">Content</th>
                        <th className="p-2.5 font-semibold">Tracking ID</th>
                        <th className="p-2.5 font-semibold">Date &amp; Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {smsLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/20">
                          <td className="p-2.5">
                            <Badge
                              variant="outline"
                              className={
                                log.status === "sent"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : log.status === "simulated"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }
                            >
                              {log.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-2.5 capitalize font-medium">{log.message_type.replace(/_/g, " ")}</td>
                          <td className="p-2.5 font-mono">
                            <div>{log.recipient_phone}</div>
                            {log.recipient_name && (
                              <div className="text-[10px] text-muted-foreground">{log.recipient_name}</div>
                            )}
                          </td>
                          <td className="p-2.5 uppercase font-mono text-[11px]">{log.provider}</td>
                          <td className="p-2.5 max-w-xs truncate" title={log.content}>
                            {log.content}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                            {log.external_id || (log.error_message ? <span className="text-rose-500">{log.error_message}</span> : "—")}
                          </td>
                          <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {smsLogsPag.total > smsLogsPag.limit && (
                  <Pagination
                    page={smsLogsPag.page}
                    limit={smsLogsPag.limit}
                    total={smsLogsPag.total}
                    onChange={setSmsLogsPage}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
