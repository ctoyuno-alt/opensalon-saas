import { get, query, run } from "./db.js";

export interface AttendanceRecord {
  id?: number;
  staff_id: number;
  staff_name: string;
  staff_title: string;
  staff_color: string;
  work_date: string;
  status: "present" | "late" | "half_day" | "absent" | "on_leave" | "not_marked";
  clock_in: string;
  clock_out: string;
  total_hours: number;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayAttendanceSummary {
  date: string;
  total_staff: number;
  present_count: number;
  late_count: number;
  half_day_count: number;
  absent_count: number;
  on_leave_count: number;
  not_marked_count: number;
  records: AttendanceRecord[];
}

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function getCurrentTimeString(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

function calculateHours(clockIn: string, clockOut: string): number {
  if (!clockIn || !clockOut) return 0;
  const [inH, inM] = clockIn.split(":").map(Number);
  const [outH, outM] = clockOut.split(":").map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 0;
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  if (outMinutes <= inMinutes) return 0;
  return Math.round(((outMinutes - inMinutes) / 60) * 100) / 100;
}

export async function getDayAttendance(workDate?: string): Promise<DayAttendanceSummary> {
  const date = workDate || getTodayString();

  const rows = await query<any>(
    `SELECT 
       s.id as staff_id,
       s.name as staff_name,
       s.title as staff_title,
       s.color as staff_color,
       s.active as staff_active,
       a.id as attendance_id,
       a.work_date,
       a.status,
       a.clock_in,
       a.clock_out,
       a.total_hours,
       a.notes,
       a.created_at,
       a.updated_at
     FROM staff s
     LEFT JOIN staff_attendance a ON s.id = a.staff_id AND a.work_date = ?
     WHERE s.active = 1
     ORDER BY s.name ASC`,
    [date]
  );

  let presentCount = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let onLeaveCount = 0;
  let notMarkedCount = 0;

  const records: AttendanceRecord[] = (rows || []).map((r) => {
    const rawStatus = r.status || "not_marked";
    let status: AttendanceRecord["status"] = rawStatus;

    if (status === "present") presentCount++;
    else if (status === "late") lateCount++;
    else if (status === "half_day") halfDayCount++;
    else if (status === "absent") absentCount++;
    else if (status === "on_leave") onLeaveCount++;
    else notMarkedCount++;

    return {
      id: r.attendance_id || undefined,
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      staff_title: r.staff_title || "",
      staff_color: r.staff_color || "#7c3aed",
      work_date: date,
      status,
      clock_in: r.clock_in || "",
      clock_out: r.clock_out || "",
      total_hours: Number(r.total_hours || 0),
      notes: r.notes || "",
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });

  return {
    date,
    total_staff: records.length,
    present_count: presentCount,
    late_count: lateCount,
    half_day_count: halfDayCount,
    absent_count: absentCount,
    on_leave_count: onLeaveCount,
    not_marked_count: notMarkedCount,
    records,
  };
}

export async function clockIn(params: {
  staff_id: number;
  date?: string;
  time?: string;
}): Promise<AttendanceRecord> {
  const date = params.date || getTodayString();
  const time = params.time || getCurrentTimeString();

  const existing = await get<any>(
    "SELECT * FROM staff_attendance WHERE staff_id = ? AND work_date = ?",
    [String(params.staff_id), date]
  );

  // Consider late if clocking in after 09:30 AM
  const defaultStatus = time > "09:30" ? "late" : "present";

  if (existing) {
    const newStatus = existing.status === "not_marked" || !existing.status ? defaultStatus : existing.status;
    const hours = calculateHours(time, existing.clock_out || "");
    await run(
      `UPDATE staff_attendance 
       SET clock_in = ?, status = ?, total_hours = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [time, newStatus, String(hours), String(existing.id)]
    );
  } else {
    await run(
      `INSERT INTO staff_attendance (staff_id, work_date, status, clock_in, clock_out, total_hours, notes)
       VALUES (?, ?, ?, ?, '', 0, '')`,
      [String(params.staff_id), date, defaultStatus, time]
    );
  }

  const updatedDay = await getDayAttendance(date);
  return updatedDay.records.find((r) => r.staff_id === params.staff_id)!;
}

export async function clockOut(params: {
  staff_id: number;
  date?: string;
  time?: string;
}): Promise<AttendanceRecord> {
  const date = params.date || getTodayString();
  const time = params.time || getCurrentTimeString();

  const existing = await get<any>(
    "SELECT * FROM staff_attendance WHERE staff_id = ? AND work_date = ?",
    [String(params.staff_id), date]
  );

  if (existing) {
    const hours = calculateHours(existing.clock_in || "", time);
    await run(
      `UPDATE staff_attendance 
       SET clock_out = ?, total_hours = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [time, String(hours), String(existing.id)]
    );
  } else {
    await run(
      `INSERT INTO staff_attendance (staff_id, work_date, status, clock_in, clock_out, total_hours, notes)
       VALUES (?, ?, 'present', '', ?, 0, '')`,
      [String(params.staff_id), date, time]
    );
  }

  const updatedDay = await getDayAttendance(date);
  return updatedDay.records.find((r) => r.staff_id === params.staff_id)!;
}

export async function upsertAttendance(record: {
  staff_id: number;
  work_date: string;
  status: string;
  clock_in?: string;
  clock_out?: string;
  total_hours?: number;
  notes?: string;
}): Promise<AttendanceRecord> {
  const { staff_id, work_date, status, clock_in = "", clock_out = "", notes = "" } = record;
  const hours = record.total_hours !== undefined ? record.total_hours : calculateHours(clock_in, clock_out);

  const existing = await get<any>(
    "SELECT id FROM staff_attendance WHERE staff_id = ? AND work_date = ?",
    [String(staff_id), work_date]
  );

  if (existing) {
    await run(
      `UPDATE staff_attendance 
       SET status = ?, clock_in = ?, clock_out = ?, total_hours = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [status, clock_in, clock_out, String(hours), notes, String(existing.id)]
    );
  } else {
    await run(
      `INSERT INTO staff_attendance (staff_id, work_date, status, clock_in, clock_out, total_hours, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(staff_id), work_date, status, clock_in, clock_out, String(hours), notes]
    );
  }

  const updatedDay = await getDayAttendance(work_date);
  return updatedDay.records.find((r) => r.staff_id === staff_id)!;
}

export async function bulkMarkAttendance(
  workDate: string,
  status: string,
  staffIds?: number[]
): Promise<DayAttendanceSummary> {
  const date = workDate || getTodayString();
  const activeStaff = await query<{ id: number }>("SELECT id FROM staff WHERE active = 1");

  const targetIds = staffIds && staffIds.length > 0 ? staffIds : (activeStaff || []).map((s) => s.id);

  for (const sId of targetIds) {
    const existing = await get<any>(
      "SELECT id FROM staff_attendance WHERE staff_id = ? AND work_date = ?",
      [String(sId), date]
    );
    if (existing) {
      await run("UPDATE staff_attendance SET status = ?, updated_at = datetime('now') WHERE id = ?", [
        status,
        String(existing.id),
      ]);
    } else {
      await run(
        "INSERT INTO staff_attendance (staff_id, work_date, status, clock_in, clock_out, total_hours, notes) VALUES (?, ?, ?, '', '', 0, '')",
        [String(sId), date, status]
      );
    }
  }

  return getDayAttendance(date);
}

export async function getStaffPortalData(staffId: number, selectedDate?: string) {
  const date = selectedDate || getTodayString();
  const staff = await get<any>("SELECT * FROM staff WHERE id = ?", [String(staffId)]);
  if (!staff) return null;

  // Today's attendance
  const daySummary = await getDayAttendance(date);
  const todayAttendance = daySummary.records.find((r) => r.staff_id === staffId) || null;

  // Today's scheduled appointments for this staff
  const todayAppointments = await query<any>(
    `SELECT a.*, c.name as client_name, c.phone as client_phone
     FROM appointments a
     LEFT JOIN clients c ON a.client_id = c.id
     WHERE a.staff_id = ? AND a.scheduled_date = ?
     ORDER BY a.start_time ASC`,
    [String(staffId), date]
  );

  // Month commissions summary (first day of current month to today)
  const monthStart = `${date.substring(0, 7)}-01`;
  const commSummary = await get<any>(
    `SELECT 
       COALESCE(SUM(commission_amount), 0) as total_commission,
       COALESCE(SUM(CASE WHEN item_type = 'service' THEN item_price ELSE 0 END), 0) as total_service_sales,
       COALESCE(SUM(CASE WHEN item_type = 'product' THEN item_price ELSE 0 END), 0) as total_product_sales,
       COUNT(*) as total_items
     FROM staff_commissions
     WHERE staff_id = ? AND created_at >= ?`,
    [String(staffId), monthStart]
  );

  // Recent 20 commission transactions
  const commissionsList = await query<any>(
    `SELECT sc.*, i.identifier as invoice_identifier
     FROM staff_commissions sc
     LEFT JOIN invoices i ON sc.invoice_id = i.id
     WHERE sc.staff_id = ?
     ORDER BY sc.created_at DESC
     LIMIT 20`,
    [String(staffId)]
  );

  // Month attendance summary
  const monthAtt = await get<any>(
    `SELECT 
       COUNT(CASE WHEN status IN ('present', 'late', 'half_day') THEN 1 END) as days_present,
       COALESCE(SUM(total_hours), 0) as total_hours
     FROM staff_attendance
     WHERE staff_id = ? AND work_date >= ?`,
    [String(staffId), monthStart]
  );

  return {
    staff,
    todayAttendance,
    todayAppointments: todayAppointments || [],
    monthCommissions: {
      total_commission: Number(commSummary?.total_commission || 0),
      total_service_sales: Number(commSummary?.total_service_sales || 0),
      total_product_sales: Number(commSummary?.total_product_sales || 0),
      total_items: Number(commSummary?.total_items || 0),
    },
    commissionsList: commissionsList || [],
    monthAttendanceSummary: {
      days_present: Number(monthAtt?.days_present || 0),
      total_hours: Number(monthAtt?.total_hours || 0),
    },
  };
}
