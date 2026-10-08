import { useState, useEffect } from "preact/hooks";
import { useApp } from "../context";
import {
  Users, Clock, DollarSign, Sparkles, Plus, Trash2, Pencil, CheckCircle2,
  AlertCircle, ChevronLeft, ChevronRight, LogIn, LogOut, Calendar, Award,
  Check, X, RefreshCw, Briefcase, Phone, Mail
} from "lucide-preact";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreateStaff } from "./create-staff";
import type { Staff, AttendanceStatus, StaffAttendanceRecord } from "../types";

export function StaffList() {
  const {
    staffMembers, deleteStaff, updateStaff, currentUser,
    attendanceSummary, selectedAttendanceDate, setSelectedAttendanceDate,
    loadAttendance, clockInStaff, clockOutStaff, updateAttendanceRecord, bulkMarkAttendance,
    staffCommissions, loadStaffCommissions,
    staffPortalData, loadStaffPortalData,
  } = useApp();

  const [activeTab, setActiveTab] = useState("directory");
  const [showCreate, setShowCreate] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Manual attendance edit modal
  const [editingAttendance, setEditingAttendance] = useState<StaffAttendanceRecord | null>(null);
  const [attStatus, setAttStatus] = useState<AttendanceStatus>("present");
  const [attClockIn, setAttClockIn] = useState("");
  const [attClockOut, setAttClockOut] = useState("");
  const [attNotes, setAttNotes] = useState("");

  // Commission filter
  const [commissionStaffFilter, setCommissionStaffFilter] = useState<string>("all");

  // Portal view staff selection
  const [portalStaffId, setPortalStaffId] = useState<number>(() => {
    if (currentUser?.staff_id) return currentUser.staff_id;
    return staffMembers[0]?.id || 1;
  });

  // Initial loads
  useEffect(() => {
    loadAttendance(selectedAttendanceDate);
  }, [selectedAttendanceDate, loadAttendance]);

  useEffect(() => {
    if (activeTab === "commissions") {
      const sId = commissionStaffFilter === "all" ? undefined : Number(commissionStaffFilter);
      loadStaffCommissions(sId);
    }
  }, [activeTab, commissionStaffFilter, loadStaffCommissions]);

  useEffect(() => {
    if (activeTab === "portal" && portalStaffId) {
      loadStaffPortalData(portalStaffId, selectedAttendanceDate);
    }
  }, [activeTab, portalStaffId, selectedAttendanceDate, loadStaffPortalData]);

  // Date navigation helpers
  const handleDateShift = (days: number) => {
    const current = new Date(selectedAttendanceDate);
    current.setDate(current.getDate() + days);
    const nextDate = current.toISOString().split("T")[0];
    setSelectedAttendanceDate(nextDate);
  };

  const handleSetToday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    setSelectedAttendanceDate(todayStr);
  };

  // Staff Edit Save
  const handleSaveStaffEdit = async () => {
    if (!editingStaff) return;
    await updateStaff(editingStaff.id, {
      name: editingStaff.name,
      title: editingStaff.title,
      email: editingStaff.email,
      phone: editingStaff.phone,
      color: editingStaff.color,
      base_salary: editingStaff.base_salary,
      commission_percent: editingStaff.commission_percent,
    });
    setEditingStaff(null);
  };

  // Attendance Edit Save
  const handleSaveAttendance = async () => {
    if (!editingAttendance) return;
    await updateAttendanceRecord({
      staff_id: editingAttendance.staff_id,
      work_date: selectedAttendanceDate,
      status: attStatus,
      clock_in: attClockIn,
      clock_out: attClockOut,
      notes: attNotes,
    });
    setEditingAttendance(null);
  };

  const openEditAttendance = (rec: StaffAttendanceRecord) => {
    setEditingAttendance(rec);
    setAttStatus(rec.status === "not_marked" ? "present" : rec.status);
    setAttClockIn(rec.clock_in || "");
    setAttClockOut(rec.clock_out || "");
    setAttNotes(rec.notes || "");
  };

  // Quick 1-click status cycle for attendance roster
  const handleCycleStatus = async (rec: StaffAttendanceRecord) => {
    const statusOrder: AttendanceStatus[] = ["present", "late", "half_day", "absent", "on_leave"];
    const currentIndex = statusOrder.indexOf(rec.status as AttendanceStatus);
    const nextStatus = currentIndex === -1 || currentIndex === statusOrder.length - 1 ? statusOrder[0] : statusOrder[currentIndex + 1];

    await updateAttendanceRecord({
      staff_id: rec.staff_id,
      work_date: selectedAttendanceDate,
      status: nextStatus,
      clock_in: rec.clock_in,
      clock_out: rec.clock_out,
      notes: rec.notes,
    });
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium">Present</Badge>;
      case "late":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">Late</Badge>;
      case "half_day":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-medium">Half Day</Badge>;
      case "absent":
        return <Badge variant="destructive" className="font-medium">Absent</Badge>;
      case "on_leave":
        return <Badge className="bg-purple-500 hover:bg-purple-600 text-white font-medium">On Leave</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-dashed">Not Marked</Badge>;
    }
  };

  // Commission KPIs
  const totalCommissionEarned = staffCommissions.reduce((acc, c) => acc + c.commission_amount, 0);
  const totalServiceSales = staffCommissions.filter(c => c.item_type === "service").reduce((acc, c) => acc + c.item_price, 0);
  const totalProductSales = staffCommissions.filter(c => c.item_type === "product").reduce((acc, c) => acc + c.item_price, 0);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Staff &amp; Attendance Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your salon team, track daily attendance &amp; time clocks, and review commissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" /> Add Staff Member
          </Button>
        </div>
      </div>

      {showCreate && <CreateStaff onClose={() => setShowCreate(false)} />}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto h-auto p-1 bg-muted/60">
          <TabsTrigger value="directory" className="gap-2 py-2">
            <Users className="h-4 w-4" />
            <span>Team Directory</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 py-2">
            <Clock className="h-4 w-4" />
            <span>Time Clock &amp; Roster</span>
          </TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2 py-2">
            <DollarSign className="h-4 w-4" />
            <span>Commissions</span>
          </TabsTrigger>
          <TabsTrigger value="portal" className="gap-2 py-2">
            <Sparkles className="h-4 w-4" />
            <span>Stylist Portal</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: TEAM DIRECTORY ────────────────────────────────────────── */}
        <TabsContent value="directory" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staffMembers.map((s) => (
              <Card key={s.id} className="relative overflow-hidden transition-all hover:shadow-md border-muted">
                <div className="h-2 w-full" style={{ backgroundColor: s.color }} />
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm ring-2 ring-white/50"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base truncate">{s.name}</h3>
                        {!s.active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground truncate">{s.title || "Stylist"}</p>
                      
                      <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Comm: {s.commission_percent ?? 10}%
                        </Badge>
                        {s.base_salary ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                            ₹{s.base_salary}/mo
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t text-xs space-y-1 text-muted-foreground">
                    {s.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span>{s.email}</span>
                      </div>
                    )}
                    {s.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{s.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {s.appointment_count || 0} bookings handled
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingStaff(s)}
                        title="Edit profile"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {s.active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-600"
                          onClick={() => updateStaff(s.id, { active: 0 })}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs text-emerald-600 border-emerald-300"
                          onClick={() => updateStaff(s.id, { active: 1 })}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteStaff(s.id)}
                        title="Delete staff"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {staffMembers.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="font-medium">No staff members found</p>
                <p className="text-xs text-muted-foreground mt-1">Add your stylists, technicians, or therapists to get started</p>
                <Button size="sm" onClick={() => setShowCreate(true)} className="mt-4">
                  Add First Staff Member
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 2: TIME CLOCK & ATTENDANCE ROSTER ─────────────────────────── */}
        <TabsContent value="attendance" className="space-y-4">
          {/* Date Selector & Bulk Actions Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleDateShift(-1)} className="h-9 px-2.5">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedAttendanceDate}
                  onChange={(e) => setSelectedAttendanceDate((e.target as HTMLInputElement).value)}
                  className="h-9 w-38 font-medium text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => handleDateShift(1)} className="h-9 px-2.5">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSetToday} className="h-9 text-xs">
                Today
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                onClick={() => bulkMarkAttendance(selectedAttendanceDate, "present")}
              >
                <Check className="h-3.5 w-3.5" /> Mark All Present
              </Button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {attendanceSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="p-3 text-center border-muted">
                <p className="text-xs text-muted-foreground">Total Team</p>
                <p className="text-xl font-bold mt-0.5">{attendanceSummary.total_staff}</p>
              </Card>
              <Card className="p-3 text-center border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Present</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{attendanceSummary.present_count}</p>
              </Card>
              <Card className="p-3 text-center border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Late</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">{attendanceSummary.late_count}</p>
              </Card>
              <Card className="p-3 text-center border-blue-200 bg-blue-50/40 dark:bg-blue-950/20">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Half Day</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">{attendanceSummary.half_day_count}</p>
              </Card>
              <Card className="p-3 text-center border-rose-200 bg-rose-50/40 dark:bg-rose-950/20">
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">Absent</p>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">{attendanceSummary.absent_count}</p>
              </Card>
              <Card className="p-3 text-center border-purple-200 bg-purple-50/40 dark:bg-purple-950/20">
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">On Leave</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300 mt-0.5">{attendanceSummary.on_leave_count}</p>
              </Card>
            </div>
          )}

          {/* Daily Attendance Roster Table */}
          <Card>
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Daily Attendance Roster ({selectedAttendanceDate})</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Click status badge to quickly cycle through statuses
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Work Hours</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceSummary?.records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No active staff members registered.
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceSummary?.records.map((rec) => (
                      <TableRow key={rec.staff_id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0"
                              style={{ backgroundColor: rec.staff_color || "#7c3aed" }}
                            >
                              {rec.staff_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm leading-tight">{rec.staff_name}</p>
                              <p className="text-xs text-muted-foreground">{rec.staff_title || "Stylist"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleCycleStatus(rec)}
                            title="Click to cycle status"
                            className="cursor-pointer focus:outline-none"
                          >
                            {getStatusBadge(rec.status)}
                          </button>
                        </TableCell>
                        <TableCell>
                          {rec.clock_in ? (
                            <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                              {rec.clock_in}
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                              onClick={() => clockInStaff(rec.staff_id)}
                            >
                              <LogIn className="h-3 w-3 mr-1" /> In
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {rec.clock_out ? (
                            <Badge variant="outline" className="font-mono text-xs bg-muted/30">
                              {rec.clock_out}
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                              onClick={() => clockOutStaff(rec.staff_id)}
                            >
                              <LogOut className="h-3 w-3 mr-1" /> Out
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-xs">
                            {rec.total_hours > 0 ? `${rec.total_hours} hrs` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {rec.notes || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => openEditAttendance(rec)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: COMMISSIONS & PAYOUTS ─────────────────────────────────── */}
        <TabsContent value="commissions" className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Filter by Stylist:</Label>
              <select
                value={commissionStaffFilter}
                onChange={(e) => setCommissionStaffFilter((e.target as HTMLSelectElement).value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Stylists &amp; Staff</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.title || "Stylist"})</option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                const sId = commissionStaffFilter === "all" ? undefined : Number(commissionStaffFilter);
                loadStaffCommissions(sId);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {/* Commission Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Total Commissions</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">₹{totalCommissionEarned.toFixed(2)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Service Volume</p>
              <p className="text-2xl font-bold mt-1">₹{totalServiceSales.toFixed(2)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Product Sales Volume</p>
              <p className="text-2xl font-bold mt-1">₹{totalProductSales.toFixed(2)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Items Handled</p>
              <p className="text-2xl font-bold mt-1">{staffCommissions.length}</p>
            </Card>
          </div>

          {/* Commission Transactions Table */}
          <Card>
            <CardHeader className="py-4 px-5">
              <CardTitle className="text-base font-semibold">
                Commission Payout Log (Auto-accrued from Invoices)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Stylist</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Item Sold / Service</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Commission Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffCommissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No commission transactions recorded yet. Commissions auto-accrue whenever invoices are marked paid in POS.
                      </TableCell>
                    </TableRow>
                  ) : (
                    staffCommissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="font-medium text-xs">{c.staff_name || `Staff #${c.staff_id}`}</TableCell>
                        <TableCell className="font-mono text-xs text-primary font-semibold">
                          #{c.invoice_id}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{c.item_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {c.item_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">₹{c.item_price.toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.commission_percent}%</TableCell>
                        <TableCell className="text-right font-bold text-sm text-emerald-600">
                          ₹{c.commission_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: STYLIST PORTAL ────────────────────────────────────────── */}
        <TabsContent value="portal" className="space-y-4">
          {/* Stylist Selector */}
          <div className="flex items-center justify-between bg-card p-3 rounded-xl border shadow-sm">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Stylist Workspace:</Label>
              <select
                value={portalStaffId}
                onChange={(e) => setPortalStaffId(Number((e.target as HTMLSelectElement).value))}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.title || "Stylist"})</option>
                ))}
              </select>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
              Personalized Staff Workspace
            </Badge>
          </div>

          {staffPortalData && (
            <div className="grid gap-6 md:grid-cols-3">
              {/* Left Column: Time Clock Widget */}
              <Card className="md:col-span-1 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow-sm"
                      style={{ backgroundColor: staffPortalData.staff.color }}
                    >
                      {staffPortalData.staff.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{staffPortalData.staff.name}</CardTitle>
                      <CardDescription>{staffPortalData.staff.title || "Stylist"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-muted/40 p-4 border text-center space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Today's Shift Status</p>
                    <div className="flex justify-center">
                      {staffPortalData.todayAttendance
                        ? getStatusBadge(staffPortalData.todayAttendance.status)
                        : <Badge variant="outline">Not Clocked In</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="bg-background rounded-lg p-2 border">
                        <span className="text-muted-foreground block text-[10px]">CLOCK IN</span>
                        <span className="font-mono font-semibold">{staffPortalData.todayAttendance?.clock_in || "—"}</span>
                      </div>
                      <div className="bg-background rounded-lg p-2 border">
                        <span className="text-muted-foreground block text-[10px]">CLOCK OUT</span>
                        <span className="font-mono font-semibold">{staffPortalData.todayAttendance?.clock_out || "—"}</span>
                      </div>
                    </div>
                    {staffPortalData.todayAttendance?.total_hours ? (
                      <p className="text-xs text-muted-foreground font-medium pt-1">
                        Clocked: <span className="text-foreground font-bold">{staffPortalData.todayAttendance.total_hours} hrs</span>
                      </p>
                    ) : null}
                  </div>

                  {/* Big 1-Click Clock Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5"
                      onClick={() => clockInStaff(staffPortalData.staff.id)}
                    >
                      <LogIn className="h-4 w-4" /> Clock In
                    </Button>
                    <Button
                      variant="outline"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 gap-1.5"
                      onClick={() => clockOutStaff(staffPortalData.staff.id)}
                    >
                      <LogOut className="h-4 w-4" /> Clock Out
                    </Button>
                  </div>

                  {/* Monthly Summary */}
                  <div className="pt-2 border-t space-y-2 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Days Worked This Month:</span>
                      <span className="font-semibold text-foreground">{staffPortalData.monthAttendanceSummary.days_present} days</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total Month Hours:</span>
                      <span className="font-semibold text-foreground">{staffPortalData.monthAttendanceSummary.total_hours} hrs</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Commissions Earned:</span>
                      <span className="font-bold text-emerald-600">₹{staffPortalData.monthCommissions.total_commission.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column: Today's Appointments Schedule */}
              <Card className="md:col-span-2 shadow-sm">
                <CardHeader className="py-4 px-5">
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      My Appointments Schedule Today
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {staffPortalData.todayAppointments.length} bookings
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffPortalData.todayAppointments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/50 mb-1.5" />
                            <p className="font-medium text-sm">No bookings scheduled for today</p>
                            <p className="text-xs text-muted-foreground">You are currently clear for walk-ins</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        staffPortalData.todayAppointments.map((apt: any) => (
                          <TableRow key={apt.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {apt.start_time} - {apt.end_time}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {apt.client_name || "Guest Client"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {apt.client_phone || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  apt.status === "completed"
                                    ? "default"
                                    : apt.status === "confirmed"
                                    ? "outline"
                                    : "secondary"
                                }
                                className="capitalize text-[10px]"
                              >
                                {apt.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs">
                              ₹{Number(apt.total_price || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── MODAL: EDIT STAFF DETAILS ───────────────────────────────────────── */}
      {editingStaff && (
        <Dialog open onOpenChange={() => setEditingStaff(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Staff Profile: {editingStaff.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: (e.target as HTMLInputElement).value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Title / Role</Label>
                <Input
                  value={editingStaff.title || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, title: (e.target as HTMLInputElement).value })}
                  placeholder="e.g. Senior Stylist"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingStaff.email || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, email: (e.target as HTMLInputElement).value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={editingStaff.phone || ""}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: (e.target as HTMLInputElement).value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editingStaff.commission_percent ?? 10}
                    onChange={(e) => setEditingStaff({ ...editingStaff, commission_percent: Number((e.target as HTMLInputElement).value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Base Salary (₹/month)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingStaff.base_salary ?? 0}
                    onChange={(e) => setEditingStaff({ ...editingStaff, base_salary: Number((e.target as HTMLInputElement).value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingStaff(null)}>Cancel</Button>
              <Button onClick={handleSaveStaffEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MODAL: EDIT ATTENDANCE RECORD ──────────────────────────────────── */}
      {editingAttendance && (
        <Dialog open onOpenChange={() => setEditingAttendance(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Attendance: {editingAttendance.staff_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus((e.target as HTMLSelectElement).value as AttendanceStatus)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Clock In Time</Label>
                  <Input
                    type="time"
                    value={attClockIn}
                    onChange={(e) => setAttClockIn((e.target as HTMLInputElement).value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Clock Out Time</Label>
                  <Input
                    type="time"
                    value={attClockOut}
                    onChange={(e) => setAttClockOut((e.target as HTMLInputElement).value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input
                  value={attNotes}
                  onChange={(e) => setAttNotes((e.target as HTMLInputElement).value)}
                  placeholder="Optional attendance note or reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAttendance(null)}>Cancel</Button>
              <Button onClick={handleSaveAttendance}>Save Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
