import { useState } from "preact/hooks";
import { useApp } from "../context";
import { Plus, Search, Trash2, MessageCircle } from "lucide-preact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { Pagination } from "./pagination";
import { CreateAppointment } from "./create-appointment";

export function AppointmentList() {
  const {
    appointments, appointmentsPag, setAppointmentsPage,
    appointmentsSearch, setAppointmentsSearch,
    appointmentsStatusFilter, setAppointmentsStatusFilter,
    deleteAppointment, navigate,
  } = useApp();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
        <Button size="sm" className="min-h-11 sm:min-h-0" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Booking
        </Button>
      </div>

      {showCreate && <CreateAppointment onClose={() => setShowCreate(false)} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 sm:h-9"
            placeholder="Search appointments..."
            value={appointmentsSearch}
            onInput={(e) => setAppointmentsSearch((e.target as HTMLInputElement).value)}
          />
        </div>
        <select
          aria-label="Filter appointments by status"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm sm:h-9 sm:w-auto"
          value={appointmentsStatusFilter}
          onChange={(e) => setAppointmentsStatusFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="">All Statuses</option>
          <option value="booked">Booked</option>
          <option value="confirmed">Confirmed</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y lg:hidden">
            {appointments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No appointments found</p>
            )}
            {appointments.map((apt) => (
              <div key={apt.id} className="flex items-stretch">
                <button
                  type="button"
                  className="min-w-0 flex-1 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => navigate(`/appointments/${apt.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{apt.scheduled_date} at {apt.start_time}</p>
                      <p className="break-words font-medium">{apt.client_name || "—"}</p>
                      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                        {apt.staff_name && <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: apt.staff_color || "#7c3aed" }} />}
                        <span className="truncate">{apt.staff_name || "—"}</span>
                      </span>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-primary">{apt.identifier}</span>
                    <div className="flex items-center gap-2">
                      {apt.client_phone && (
                        <a
                          href={`https://wa.me/${apt.client_phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                            `Hi ${apt.client_name || ""}, regarding your appointment at OpenSalon on ${apt.scheduled_date} at ${apt.start_time}:`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${apt.client_name}`}
                          className="flex h-6 w-6 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                      <span className="font-medium">${apt.total_price.toFixed(2)}</span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Delete appointment ${apt.identifier}`}
                  className="flex w-12 shrink-0 items-center justify-center border-l text-muted-foreground transition-colors hover:bg-muted/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => deleteAppointment(apt.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead className="w-24">Date</TableHead>
                <TableHead className="w-16">Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="w-28">Staff</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20 text-right">Price</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No appointments found</TableCell>
                </TableRow>
              )}
              {appointments.map((apt) => (
                <TableRow key={apt.id} className="cursor-pointer" onClick={() => navigate(`/appointments/${apt.id}`)}>
                  <TableCell className="font-medium text-primary">{apt.identifier}</TableCell>
                  <TableCell className="text-xs">{apt.scheduled_date}</TableCell>
                  <TableCell className="text-xs">{apt.start_time}</TableCell>
                  <TableCell>{apt.client_name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {apt.staff_name && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: apt.staff_color || "#7c3aed" }} />}
                      <span className="text-sm">{apt.staff_name || "—"}</span>
                    </span>
                  </TableCell>
                  <TableCell><StatusBadge status={apt.status} /></TableCell>
                  <TableCell className="text-right">${apt.total_price.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {apt.client_phone && (
                        <a
                          href={`https://wa.me/${apt.client_phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                            `Hi ${apt.client_name || ""}, regarding your appointment at OpenSalon on ${apt.scheduled_date} at ${apt.start_time}:`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${apt.client_name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button aria-label={`Delete appointment ${apt.identifier}`} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteAppointment(apt.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      <Pagination pag={appointmentsPag} setPage={setAppointmentsPage} />
    </div>
  );
}
