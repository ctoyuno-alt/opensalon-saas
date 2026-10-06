import { get, query, run } from "./db.js";

export interface WhatsAppSettings {
  id: number;
  provider: "meta" | "twilio" | "simulation";
  phone_number_id: string;
  access_token: string;
  business_account_id: string;
  sender_phone_number: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  twilio_content_sid: string;
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
  updated_at: string;
}

export interface WhatsAppLog {
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

export interface SendMessageResult {
  success: boolean;
  status: "sent" | "simulated" | "failed";
  messageId?: string;
  error?: string;
  waMeUrl: string;
  content: string;
  recipientPhone: string;
}

import { cleanPhone, createWaMeUrl, interpolateTemplate } from "./whatsapp-helpers.js";
export { cleanPhone, createWaMeUrl, interpolateTemplate };

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const row = await get<WhatsAppSettings>("SELECT * FROM whatsapp_settings WHERE id = 1");
  if (row) return row;

  // Insert default row if missing
  await run("INSERT OR IGNORE INTO whatsapp_settings (id, provider) VALUES (1, 'meta')");
  const fallback = await get<WhatsAppSettings>("SELECT * FROM whatsapp_settings WHERE id = 1");
  if (fallback) return fallback;

  return {
    id: 1,
    provider: "meta",
    phone_number_id: "",
    access_token: "",
    business_account_id: "",
    sender_phone_number: "",
    twilio_account_sid: "",
    twilio_auth_token: "",
    twilio_phone_number: "+14155238886",
    twilio_content_sid: "",
    salon_name: "OpenSalon",
    auto_send_booking_confirmation: 1,
    auto_send_reschedule: 1,
    auto_send_cancellation: 1,
    auto_send_receipt: 1,
    template_booking_confirmation: "Hi {{client_name}}, your appointment at {{salon_name}} for {{service_name}} on {{date}} at {{time}} with {{staff_name}} is confirmed! Total: ${{total}}. See you soon!",
    template_reminder: "Friendly reminder from {{salon_name}}: You have an upcoming appointment for {{service_name}} on {{date}} at {{time}} with {{staff_name}}. Reply YES to confirm.",
    template_reschedule: "Hi {{client_name}}, your appointment at {{salon_name}} has been rescheduled to {{date}} at {{time}} with {{staff_name}}.",
    template_cancellation: "Hi {{client_name}}, your appointment at {{salon_name}} for {{date}} at {{time}} has been cancelled. Please reach out to reschedule!",
    template_receipt: "Thank you for visiting {{salon_name}}, {{client_name}}! Here is your receipt for Invoice #{{invoice_id}}: Total paid ${{total}} via {{payment_method}}.",
    updated_at: new Date().toISOString(),
  };
}

export async function updateWhatsAppSettings(data: Partial<WhatsAppSettings>): Promise<WhatsAppSettings> {
  const fields: string[] = [];
  const values: any[] = [];

  const allowed: (keyof WhatsAppSettings)[] = [
    "provider",
    "phone_number_id",
    "access_token",
    "business_account_id",
    "sender_phone_number",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_phone_number",
    "twilio_content_sid",
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
    await run(`UPDATE whatsapp_settings SET ${fields.join(", ")} WHERE id = 1`, values);
  }

  return getWhatsAppSettings();
}

export async function listWhatsAppLogs(page = 1, limit = 20): Promise<{ logs: WhatsAppLog[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;
  const countRow = await get<{ count: number }>("SELECT COUNT(*) as count FROM whatsapp_logs");
  const total = countRow?.count ?? 0;
  const rows = await query<WhatsAppLog>(
    "SELECT * FROM whatsapp_logs ORDER BY id DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );
  return { logs: rows ?? [], total, page, limit };
}

export async function sendWhatsAppMessage(params: {
  recipientPhone: string;
  recipientName?: string;
  messageType: "booking_confirmation" | "reminder" | "reschedule" | "cancellation" | "receipt" | "test" | "custom";
  content: string;
  referenceId?: number;
}): Promise<SendMessageResult> {
  const { recipientPhone, recipientName = "", messageType, content, referenceId } = params;
  const settings = await getWhatsAppSettings();
  const digits = cleanPhone(recipientPhone);
  const waMeUrl = createWaMeUrl(recipientPhone, content);

  if (!digits) {
    return {
      success: false,
      status: "failed",
      error: "Recipient phone number is invalid or empty",
      waMeUrl,
      content,
      recipientPhone,
    };
  }

  // Simulation mode
  if (settings.provider === "simulation") {
    await run(
      "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [digits, recipientName, messageType, content, "simulated", "simulation", referenceId ?? null]
    );

    return {
      success: true,
      status: "simulated",
      waMeUrl,
      content,
      recipientPhone: digits,
    };
  }

  // Send via Twilio WhatsApp API
  if (settings.provider === "twilio") {
    if (!settings.twilio_account_sid || !settings.twilio_auth_token) {
      await run(
        "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "simulated", "twilio", referenceId ?? null]
      );
      return {
        success: true,
        status: "simulated",
        waMeUrl,
        content,
        recipientPhone: digits,
      };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Messages.json`;
      const rawFrom = (settings.twilio_phone_number || "+14155238886").trim();
      const fromNumber = rawFrom.startsWith("whatsapp:")
        ? rawFrom
        : `whatsapp:${rawFrom.startsWith("+") ? rawFrom : `+${rawFrom}`}`;
      const toNumber = `whatsapp:+${digits}`;

      const basicAuth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);
      const formParams = new URLSearchParams();
      formParams.append("From", fromNumber);
      formParams.append("To", toNumber);

      if (settings.twilio_content_sid?.trim()) {
        formParams.append("ContentSid", settings.twilio_content_sid.trim());
        formParams.append("ContentVariables", JSON.stringify({ "1": content }));
      } else {
        formParams.append("Body", content);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formParams.toString(),
      });

      const data = await response.json() as any;

      if (response.ok && data.sid) {
        await run(
          "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, external_id, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [digits, recipientName, messageType, content, "sent", "twilio", data.sid, referenceId ?? null]
        );
        return {
          success: true,
          status: "sent",
          messageId: data.sid,
          waMeUrl,
          content,
          recipientPhone: digits,
        };
      } else {
        let errorMsg = data?.message || `Twilio error ${data?.code || response.status}`;
        if (errorMsg.includes("ContentSid Required")) {
          errorMsg = "ContentSid Required: Recipient phone has not joined Twilio Sandbox (send 'join <code-word>' to +1 415 523 8886) or an approved ContentSid is required.";
        }
        await run(
          "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [digits, recipientName, messageType, content, "failed", "twilio", errorMsg, referenceId ?? null]
        );
        return {
          success: false,
          status: "failed",
          error: errorMsg,
          waMeUrl,
          content,
          recipientPhone: digits,
        };
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Network exception sending Twilio WhatsApp message";
      await run(
        "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "failed", "twilio", errorMsg, referenceId ?? null]
      );
      return {
        success: false,
        status: "failed",
        error: errorMsg,
        waMeUrl,
        content,
        recipientPhone: digits,
      };
    }
  }

  // Meta Cloud API unconfigured check
  if (!settings.access_token || !settings.phone_number_id) {
    await run(
      "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [digits, recipientName, messageType, content, "simulated", "meta", referenceId ?? null]
    );

    return {
      success: true,
      status: "simulated",
      waMeUrl,
      content,
      recipientPhone: digits,
    };
  }

  // Send via Meta WhatsApp Cloud API
  try {
    const url = `https://graph.facebook.com/v20.0/${settings.phone_number_id}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "text",
        text: { preview_url: false, body: content },
      }),
    });

    const data = await response.json() as any;

    if (response.ok && data.messages?.[0]?.id) {
      const messageId = data.messages[0].id;
      await run(
        "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, external_id, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "sent", "meta", messageId, referenceId ?? null]
      );
      return {
        success: true,
        status: "sent",
        messageId,
        waMeUrl,
        content,
        recipientPhone: digits,
      };
    } else {
      const errorMsg = data?.error?.message || `HTTP ${response.status}: Failed to send WhatsApp message`;
      await run(
        "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [digits, recipientName, messageType, content, "failed", "meta", errorMsg, referenceId ?? null]
      );
      return {
        success: false,
        status: "failed",
        error: errorMsg,
        waMeUrl,
        content,
        recipientPhone: digits,
      };
    }
  } catch (err: any) {
    const errorMsg = err?.message || "Network exception sending WhatsApp message";
    await run(
      "INSERT INTO whatsapp_logs (recipient_phone, recipient_name, message_type, content, status, provider, error_message, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [digits, recipientName, messageType, content, "failed", "meta", errorMsg, referenceId ?? null]
    );
    return {
      success: false,
      status: "failed",
      error: errorMsg,
      waMeUrl,
      content,
      recipientPhone: digits,
    };
  }
}

export async function sendAppointmentNotification(
  appointmentId: number,
  type: "booking_confirmation" | "reminder" | "reschedule" | "cancellation"
): Promise<SendMessageResult | null> {
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

  const settings = await getWhatsAppSettings();

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

  return sendWhatsAppMessage({
    recipientPhone: apt.client_phone,
    recipientName: apt.client_name,
    messageType: type,
    content,
    referenceId: appointmentId,
  });
}

export async function sendInvoiceReceiptNotification(invoiceId: number): Promise<SendMessageResult | null> {
  const inv = await get<any>(
    `SELECT i.*, c.name as client_name, c.phone as client_phone
     FROM invoices i
     LEFT JOIN clients c ON i.client_id = c.id
     WHERE i.id = ?`,
    [invoiceId]
  );

  if (!inv || !inv.client_phone) return null;

  const settings = await getWhatsAppSettings();
  const content = interpolateTemplate(settings.template_receipt, {
    client_name: inv.client_name || "Valued Customer",
    salon_name: settings.salon_name || "OpenSalon",
    invoice_id: inv.identifier || String(invoiceId),
    total: Number(inv.total || 0).toFixed(2),
    payment_method: (inv.payment_method || "cash").toUpperCase(),
  });

  return sendWhatsAppMessage({
    recipientPhone: inv.client_phone,
    recipientName: inv.client_name,
    messageType: "receipt",
    content,
    referenceId: invoiceId,
  });
}
