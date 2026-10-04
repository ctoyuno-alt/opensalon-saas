import { useState, useEffect, useMemo } from "preact/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, CheckCircle2, User, Scissors } from "lucide-preact";

export function PublicBooking() {
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>("");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/public/services").then(r => r.json()).then(d => {
      if (d.services) setServices(d.services);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedServiceId || !date) return;
    fetch(`/api/public/availability?date=${date}&service_id=${selectedServiceId}`)
      .then(r => r.json())
      .then(d => {
        setAvailableSlots(d.slots || []);
        setSelectedTime("");
      })
      .catch(console.error);
  }, [selectedServiceId, date]);

  const handleBook = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone,
          service_id: parseInt(selectedServiceId, 10),
          date, time: selectedTime
        })
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setStep(4);
      } else {
        alert("Booking failed. The slot may have been taken.");
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-12">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-2xl mb-2">Booking Confirmed!</CardTitle>
          <CardDescription className="text-base">
            Thank you, {name}. We look forward to seeing you on {new Date(date).toLocaleDateString()} at {selectedTime}.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 p-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Scissors className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">OpenSalon Booking</h1>
        <p className="text-muted-foreground">Book your appointment online instantly</p>
      </div>

      <Card className="w-full max-w-xl shadow-lg border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle>
            {step === 1 && "Step 1: Select a Service"}
            {step === 2 && "Step 2: Choose Date & Time"}
            {step === 3 && "Step 3: Your Details"}
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <Label>What would you like to book?</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue placeholder="Choose a service..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} - ${s.price} ({s.duration} mins)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Input 
                  type="date" 
                  value={date} 
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setDate((e.target as HTMLInputElement).value)}
                  className="h-12"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Available Times</Label>
                {availableSlots.length === 0 ? (
                  <div className="p-4 bg-muted rounded-md text-center text-muted-foreground">
                    No slots available on this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableSlots.map(time => (
                      <Button
                        key={time}
                        type="button"
                        variant={selectedTime === time ? "default" : "outline"}
                        onClick={() => setSelectedTime(time)}
                        className="w-full"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <form id="booking-form" onSubmit={handleBook} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={name} onChange={e => setName((e.target as HTMLInputElement).value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={e => setEmail((e.target as HTMLInputElement).value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input type="tel" required value={phone} onChange={e => setPhone((e.target as HTMLInputElement).value)} />
              </div>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between border-t bg-muted/20 p-4">
          <Button 
            variant="outline" 
            onClick={() => setStep(step - 1)} 
            disabled={step === 1 || isSubmitting}
          >
            Back
          </Button>
          
          {step < 3 ? (
            <Button 
              onClick={() => setStep(step + 1)} 
              disabled={(step === 1 && !selectedServiceId) || (step === 2 && !selectedTime)}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" form="booking-form" disabled={isSubmitting}>
              {isSubmitting ? "Confirming..." : "Confirm Booking"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
