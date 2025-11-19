import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ChatMessage";
import { ExpenseCard } from "@/components/ExpenseCard";
import { QuickActions } from "@/components/QuickActions";
import { useExpenseChat } from "@/hooks/useExpenseChat";
import { LogOut, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { messages, isLoading, sendMessage } = useExpenseChat();
  const [inputValue, setInputValue] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setExpenses(data || []);

      // Calculate total
      const total = (data || []).reduce((sum, exp) => sum + exp.amount, 0);
      setTotalSpent(total);
    } catch (error: any) {
      console.error("Error loading expenses:", error);
    }
  };

  useEffect(() => {
    loadExpenses();

    // Listen for refresh events from the chat
    const handleRefresh = () => loadExpenses();
    window.addEventListener("refreshExpenses", handleRefresh);
    return () => window.removeEventListener("refreshExpenses", handleRefresh);
  }, []);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleQuickAction = (action: string) => {
    sendMessage(action);
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast.success("Expense deleted successfully");
      loadExpenses();
    } catch (error: any) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Expense Tracker</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Assistant</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Chat Section */}
          <div className="flex flex-col h-[calc(100vh-180px)]">
            <div className="bg-card rounded-lg shadow-sm border border-border flex flex-col h-full">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Chat Assistant</h2>
                <p className="text-sm text-muted-foreground">
                  Ask me anything about your expenses
                </p>
              </div>

              <ScrollArea className="flex-1 p-4">
                {messages.map((msg, idx) => (
                  <ChatMessage key={idx} role={msg.role} content={msg.content} />
                ))}
                {isLoading && (
                  <div className="flex gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100" />
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200" />
                  </div>
                )}
              </ScrollArea>

              <div className="p-4 border-t border-border space-y-3">
                <QuickActions onAction={handleQuickAction} />
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="flex flex-col h-[calc(100vh-180px)]">
            <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-4">
              <h3 className="text-sm text-muted-foreground mb-1">Recent Total</h3>
              <p className="text-3xl font-bold text-foreground">
                ₹{totalSpent.toLocaleString()}
              </p>
            </div>

            <div className="bg-card rounded-lg shadow-sm border border-border flex flex-col flex-1 overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground">Recent Expenses</h2>
                <p className="text-sm text-muted-foreground">Your latest transactions</p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {expenses.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No expenses yet. Start by adding one!
                    </p>
                  ) : (
                    expenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        {...expense}
                        onDelete={handleDeleteExpense}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;