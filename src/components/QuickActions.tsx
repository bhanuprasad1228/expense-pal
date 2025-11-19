import { Calendar, PieChart, Plus, TrendingUp } from "lucide-react";
import { Button } from "./ui/button";

interface QuickActionsProps {
  onAction: (action: string) => void;
}

export const QuickActions = ({ onAction }: QuickActionsProps) => {
  const actions = [
    {
      icon: Plus,
      label: "Add Expense",
      action: "I want to add an expense",
      variant: "default" as const,
    },
    {
      icon: Calendar,
      label: "Today's Expenses",
      action: "Show me today's expenses",
      variant: "outline" as const,
    },
    {
      icon: TrendingUp,
      label: "This Month",
      action: "How much did I spend this month?",
      variant: "outline" as const,
    },
    {
      icon: PieChart,
      label: "By Category",
      action: "Show expenses by category",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant}
          size="sm"
          onClick={() => onAction(action.action)}
          className="flex items-center gap-2"
        >
          <action.icon className="w-4 h-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
};