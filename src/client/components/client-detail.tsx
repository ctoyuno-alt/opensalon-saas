import { useState } from "preact/hooks";
import { useApp } from "../context";
import { ArrowLeft, Trash2, Save, Mail, Phone, Plus, MessageCircle } from "lucide-preact";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { CreateAppointment } from "./create-appointment";

export function ClientDetail() {
  const { selectedClient: client, selectedClientAppointments: appointments, navigate, updateClient, deleteClient } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client?.name || "");
  const [email, setEmail] = useState(client?.email || "");
  const [phone, setPhone] = useState(client?.phone || "");
  const [notes, setNotes] = useState(client?.notes || "");
  const [showCreate, setShowCreate] = useState(false);

  if (!client) return null;

  const handleSave = async () => {
    await updateClient(client.id, { name, email, phone, notes });
    setEditing(false);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="min-w-0 flex-1 text-2xl font-bold">{client.name}</h1>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Book appointment
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 sm:flex-none" onClick={() => deleteClient(client.id)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {showCreate && (
        <CreateAppointment
          defaultClientId={client.id}
          onClose={() => setShowCreate(false)}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Details</CardTitle>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            ) : (
              <Button size="sm" onClick={handleSave}><Save className="mr-1 h-3.5 w-3.5" /> Save</Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={(e) => setEmail((e.target as HTMLInputElement).value)} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone((e.target as HTMLInputElement).value)} /></div>
                <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes((e.target as HTMLTextAreaElement).value)} /></div>
              </>
            ) : (
              <>
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {client.phone}
                    </div>
                    <a
                      href={`https://wa.me/${client.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                        `Hi ${client.name}, this is OpenSalon:`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-600/20 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                )}
                {client.notes && <p className="text-sm text-muted-foreground">{client.notes}</p>}
                
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Loyalty Wallet:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                      ✨ {client.loyalty_points || 0} pts
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Lifetime Visits:</span>
                    <span className="font-semibold">{client.total_visits || 0} visits</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Lifetime Spend:</span>
                    <span className="font-semibold text-emerald-600">₹{(client.total_spent || 0).toLocaleString()}</span>
                  </div>
                  {client.last_visit_date ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last Visit:</span>
                      <span className="font-medium text-foreground">{client.last_visit_date}</span>
                    </div>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground pt-1">Client since {new Date(client.created_at).toLocaleDateString()}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Appointment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y lg:hidden">
              {appointments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No appointments yet</p>}
              {appointments.map((apt) => (
                <button
                  key={apt.id}
                  type="button"
                  className="w-full p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => navigate(`/appointments/${apt.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{apt.scheduled_date} at {apt.start_time}</p>
                      <p className="font-medium">{apt.service_names || "—"}</p>
                      {apt.latest_note && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{apt.latest_note}</p>}
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {apt.staff_name && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: apt.staff_color || "#7c3aed" }} />}
                      <span>{apt.staff_name || "—"}</span>
                    </span>
                    <span className="font-medium">${apt.total_price.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden lg:block">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visit</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No appointments yet</TableCell></TableRow>
                )}
                {appointments.map((apt) => (
                  <TableRow key={apt.id} className="cursor-pointer" onClick={() => navigate(`/appointments/${apt.id}`)}>
                    <TableCell className="min-w-52">
                      <p className="text-xs text-muted-foreground">{apt.scheduled_date} at {apt.start_time}</p>
                      <p className="font-medium">{apt.service_names || "—"}</p>
                      {apt.latest_note && <p className="mt-1 line-clamp-2 max-w-md text-xs text-muted-foreground">{apt.latest_note}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {apt.staff_name && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: apt.staff_color || "#7c3aed" }} />}
                        <span className="text-sm">{apt.staff_name || "—"}</span>
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={apt.status} /></TableCell>
                    <TableCell className="text-right">${apt.total_price.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
