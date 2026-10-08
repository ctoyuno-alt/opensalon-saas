import { get, query, run } from "./db.js";
import {
  cleanPhone,
  formatToE164,
  formatTo10Digits,
  interpolateTemplate,
  calculateSmsSegments,
} from "./sms-helpers.js";

export interface SmsSettings {
  id: number;
  provider: "simulation" | "twilio" | "fast2sms";
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  fast2sms_api_key: string;
  fast2sms_route: string;
  sender_id: string;
  salon_name: string;
  auto_send_booking_confirmation: number;
  auto_send_reschedule: number;
  auto_send_cancellation: number;
  auto_send_receipt: number;
  template_booking_confirmation: string;
  template_reminder: string;
  template_reschedule: string;
  template_cancellation: string;
  template_receipt: string;
  updated_at?: string;
}

export interface SmsLog {
  id: number;
  recipient_phone: string;
  recipient_name: string;
  message_type: string;
  content: string;
  status: "sent" | "delivered" | "failed" | "simulated";
  provider: string;
  external_id: string;
  error_message: string;
  reference_id: number | null;
  created_at: string;
}

export interface SendSmsResult {
  success: boolean;
  status: "sent" | "simulated" | "failed";
  messageId?: string;
  error?: string;
  content: string;
  recipientPhone: string;
  segments?: number;
}

export { cleanPhone, formatToE164, formatTo10Digits, interpolateTemplate, calculateSmsSegments };

export async function getSmsSettings(): Promise<SmsSettings> {
  const row = await get<SmsSettings>("SELECT * FROM sms_settings WHERE id = 1");
  if (row) return row;

  // Insert default row if missing
  await run("INSERT OR IGNORE INTO sms_settings (id, provider) VALUES (1, 'simulation')");
  const fallback = await get<SmsSettings>("SELECT * FROM sms_settings WHERE id = 1");
  if (fallback) return fallback;

  return {
    id: 1,
    provider: "simulation",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "",
    fast2sms_api_key: "",
    fast2sms_route: "q",
    sender_id: "SALON",
    salon_name: "OpenSalon",
    auto_send_booking_confirmation: 1,
    auto_send_reschedule: 1,
    auto_send_cancellation: 1,
    auto_send_receipt: 1,
    template_booking_confirmation:
      "Hi {{client_name}}, your booking at {{salon_name}} for {{service_name}} on {{date}} at {{time}} is confirmed! Total: ${{total}}.",
    template_reminder:
      "Reminder from {{salon_name}}: You have an appointment for {{service_name}} on {{date}} at {{time}} with {{staff_name}}.",
    template_reschedule:
      "Hi {{client_name}}, your appointment at {{salon_name}} has been rescheduled to {{date}} at {{time}} with {{staff_name}}.",
    template_cancellation:
      "Hi {{client_name}}, your appointment at {{salon_name}} for {{date}} at {{time}} has been cancelled.",
    template_receipt:
      "Thank you for visiting {{salon_name}}, {{client_name}}! Receipt for Invoice #{{invoice_id}}: Paid ${{total}} via {{payment_method}}.",
    updated_at: new Date().toISOString(),
  };
}

export async function updateSmsSettings(data: Partial<SmsSettings>): Promise<SmsSettings> {
  const fields: string[] = [];
  const values: any[] = [];

  const allowed: (keyof SmsSettings)[] = [
    "provider",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_phone_number",
    "fast2sms_api_key",
    "fast2sms_route",
    "sender_id",
    "salon_name",
    "auto_send_booking_confirmation",
    "auto_send_reschedule",
    "auto_send_cancellation",
    "auto_send_receipt",
    "template_booking_confirmation",
    "template_reminder",
    "template_reschedule",
    "template_cancellation",
    "template_receipt",
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    await run(`UPDATE sms_settings SET ${fields.join(", ")} WHERE id = 1`, values);
  }

  return getSmsSettings();
}

export async function listSmsLogs(
  page = 1,
  limit = 20
): Promise<{ logs: SmsLog[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;
  const countRow = await get<{ count: number }>("SELECT COUNT(*) as count FROM sms_logs");
  const total = countRow?.count ?? 0;
  const rows = await query<SmsLog>(
    "SELECT * FROM sms_logs ORDER BY id DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );
  return { logs: rows ?? [], total, page, limit };
}

export async function sendSMSMessage(params: {
  recipientPhone: string;
  recipientName?: string;
  messageType: "booking_confirmation" | "reminder" | "reschedule" | "cancellation" | "receipt" | "test" | "custom";
  content: string;
  referenceId?: number;
}): Promise<SendSmsResult> {
  const { recipientPhone, recipientName = "", messageType, content, referenceId } = params;
  const settings = await getSmsSettings();
  const digits = cleanPhone(recipientPhone);
  const segments = calculateSmsSegments(content).segments;

  if (!digits) {
    return {
      success: false,
      status: "failed",
      error: "Recipient phone number is invalid or empty",
      content,
      recipientPhone,
      segments,
    };
  }

  // 1. Simulation Mode
  if (settings.provider === "simulation") {
    await run(
      "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [digits, recipientName, messageType, content, "simulated", "simulation", referenceId ?? null]
    );

    return {
      success: true,
      status: "simulated",
      content,
      recipientPhone: digits,
      segments,
    };
  }

  // 2. Twilio SMS
  if (settings.provider === "twilio") {
    if (!settings.twilio_account_sid || !settings.twilio_auth_token) {
      await run(
        "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, reference_id, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "simulated", "twilio", referenceId ?? null, "Twilio credentials not configured; simulated."]
      );
      return {
        success: true,
        status: "simulated",
        content,
        recipientPhone: digits,
        segments,
      };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Messages.json`;
      const fromNumber = (settings.twilio_phone_number || "").trim();
      const toNumber = formatToE164(digits);

      const basicAuth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);
      const formParams = new URLSearchParams();
      formParams.append("From", fromNumber);
      formParams.append("To", toNumber);
      formParams.append("Body", content);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formParams.toString(),
      });

      const data = (await response.json()) as any;

      if (response.ok && data.sid) {
        await run(
          "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, external_id, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [digits, recipientName, messageType, content, "sent", "twilio", data.sid, referenceId ?? null]
        );
        return {
          success: true,
          status: "sent",
          messageId: data.sid,
          content,
          recipientPhone: digits,
          segments,
        };
      } else {
        const errorMsg = data?.message || `Twilio error ${data?.code || response.status}`;
        await run(
          "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [digits, recipientName, messageType, content, "failed", "twilio", errorMsg, referenceId ?? null]
        );
        return {
          success: false,
          status: "failed",
          error: errorMsg,
          content,
          recipientPhone: digits,
          segments,
        };
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Network exception sending Twilio SMS";
      await run(
        "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "failed", "twilio", errorMsg, referenceId ?? null]
      );
      return {
        success: false,
        status: "failed",
        error: errorMsg,
        content,
        recipientPhone: digits,
        segments,
      };
    }
  }

  // 3. Fast2SMS (Indian Gateway)
  if (settings.provider === "fast2sms") {
    if (!settings.fast2sms_api_key) {
      await run(
        "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, reference_id, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "simulated", "fast2sms", referenceId ?? null, "Fast2SMS API key not configured; simulated."]
      );
      return {
        success: true,
        status: "simulated",
        content,
        recipientPhone: digits,
        segments,
      };
    }

    try {
      const tenDigitPhone = formatTo10Digits(digits);
      const url = "https://www.fast2sms.com/dev/bulkV2";

      const payload = {
        route: settings.fast2sms_route || "q",
        message: content,
        language: "english",
        flash: 0,
        numbers: tenDigitPhone,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "authorization": settings.fast2sms_api_key.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (response.ok && data.return === true) {
        const requestId = data.request_id || "fast2sms-" + Date.now();
        await run(
          "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, external_id, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [digits, recipientName, messageType, content, "sent", "fast2sms", requestId, referenceId ?? null]
        );
        return {
          success: true,
          status: "sent",
          messageId: requestId,
          content,
          recipientPhone: digits,
          segments,
        };
      } else {
        const errorMsg = Array.isArray(data?.message)
          ? data.message.join(", ")
          : data?.message || `Fast2SMS HTTP ${response.status}`;
        await run(
          "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [digits, recipientName, messageType, content, "failed", "fast2sms", errorMsg, referenceId ?? null]
        );
        return {
          success: false,
          status: "failed",
          error: errorMsg,
          content,
          recipientPhone: digits,
          segments,
        };
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Network exception sending Fast2SMS message";
      await run(
        "INSERT INTO sms_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "failed", "fast2sms", errorMsg, referenceId ?? null]
      );
      return {
        success: false,
        status: "failed",
        error: errorMsg,
        content,
        recipientPhone: digits,
        segments,
      };
    }
  }

  return {
    success: false,
    status: "failed",
    error: `Unknown SMS provider: ${settings.provider}`,
    content,
    recipientPhone: digits,
    segments,
  };
}

export async function sendAppointmentSMSNotification(
  appointmentId: number,
  type: "booking_confirmation" | "reminder" | "reschedule" | "cancellation"
): Promise<SendSmsResult | null> {
  const apt = await get<any>(
    `SELECT a.*, c.name as client_name, c.phone as client_phone, s.name as staff_name
     FROM appointments a
     LEFT JOIN clients c ON a.client_id = c.id
     LEFT JOIN staff s ON a.staff_id = s.id
     WHERE a.id = ?`,
    [appointmentId]
  );

  if (!apt || !apt.client_phone) return null;

  const services = await query<{ name: string; price: number }>(
    `SELECT s.name, aps.price
     FROM appointment_services aps
     JOIN services s ON aps.service_id = s.id
     WHERE aps.appointment_id = ?`,
    [appointmentId]
  );

  const serviceNames = (services && services.length > 0)
    ? services.map((s) => s.name).join(", ")
    : "Salon Service";

  const settings = await getSmsSettings();

  let template = "";
  if (type === "booking_confirmation") template = settings.template_booking_confirmation;
  else if (type === "reminder") template = settings.template_reminder;
  else if (type === "reschedule") template = settings.template_reschedule;
  else if (type === "cancellation") template = settings.template_cancellation;

  const content = interpolateTemplate(template, {
    client_name: apt.client_name || "Valued Customer",
    salon_name: settings.salon_name || "OpenSalon",
    service_name: serviceNames,
    date: apt.scheduled_date,
    time: apt.start_time,
    staff_name: apt.staff_name || "Any Stylist",
    total: Number(apt.total_price || 0).toFixed(2),
    identifier: apt.identifier,
  });

  return sendSMSMessage({
    recipientPhone: apt.client_phone,
    recipientName: apt.client_name,
    messageType: type,
    content,
    referenceId: appointmentId,
  });
}

export async function sendInvoiceReceiptSMSNotification(invoiceId: number): Promise<SendSmsResult | null> {
  const inv = await get<any>(
    `SELECT i.*, c.name as client_name, c.phone as client_phone
     FROM invoices i
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE i.id = ?`,
    [invoiceId]
  );

  if (!inv || !inv.client_phone) return null;

  const settings = await getSmsSettings();
  const content = interpolateTemplate(settings.template_receipt, {
    client_name: inv.client_name || "Valued Customer",
    salon_name: settings.salon_name || "OpenSalon",
    invoice_id: inv.identifier || String(invoiceId),
    total: Number(inv.total || 0).toFixed(2),
    payment_method: (inv.payment_method || "cash").toUpperCase(),
  });

  return sendSMSMessage({
    recipientPhone: inv.client_phone,
    recipientName: inv.client_name,
    messageType: "receipt",
    content,
    referenceId: invoiceId,
  });
}
