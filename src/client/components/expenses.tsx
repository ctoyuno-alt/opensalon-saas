import { useState } from "preact/hooks";
import { useApp } from "../context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ReceiptText, Plus, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-preact";
import { Pagination } from "./pagination";

export function Expenses() {
  const { expenses, expensesPag, setExpensesPage, createExpense, deleteExpense, invoices } = useApp();
  
  const [showCreate, setShowCreate] = useState(false);
  const [category, setCategory] = useState("supplies");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createExpense({ category, amount: parseFloat(amount), description, expense_date: date });
      setShowCreate(false);
      setAmount("");
      setDescription("");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      await deleteExpense(id);
    }
  };

  // Simple Report calculation (based on loaded invoices and expenses)
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, inv) => sum + inv.total, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const profit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ReceiptText className="h-6 w-6 text-muted-foreground" />
          Expenses & Reports
        </h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplies">Supplies</SelectItem>
                    <SelectItem value="rent">Rent & Utilities</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input id="amount" type="number" step="0.01" required value={amount} onChange={(e) => setAmount((e.target as HTMLInputElement).value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" required value={date} onChange={(e) => setDate((e.target as HTMLInputElement).value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Input id="desc" value={description} onChange={(e) => setDescription((e.target as HTMLInputElement).value)} />
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Expense"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (Loaded Invoices)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses (Loaded)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              ${profit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
          <CardDescription>View and manage your business expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No expenses recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{new Date(exp.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{exp.category}</TableCell>
                    <TableCell>{exp.description}</TableCell>
                    <TableCell className="font-semibold">${exp.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {expensesPag.total > expensesPag.limit && (
            <div className="mt-4">
              <Pagination page={expensesPag.page} limit={expensesPag.limit} total={expensesPag.total} onChange={setExpensesPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
