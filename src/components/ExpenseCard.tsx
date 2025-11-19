import { Calendar, Tag, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

interface ExpenseCardProps {
  id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  onDelete?: (id: string) => void;
}

const categoryColors: Record<string, string> = {
  food: "bg-category-food",
  travel: "bg-category-travel",
  bills: "bg-category-bills",
  shopping: "bg-category-shopping",
  other: "bg-category-other",
};

export const ExpenseCard = ({
  id,
  amount,
  category,
  date,
  description,
  onDelete,
}: ExpenseCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card className="p-4 hover:shadow-md transition-all duration-300 border border-border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                categoryColors[category] || categoryColors.other
              )}
            />
            <span className="text-sm font-medium capitalize text-foreground">
              {category}
            </span>
          </div>
          
          <div className="text-2xl font-bold text-foreground mb-2">
            ₹{amount.toLocaleString()}
          </div>

          {description && (
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(date)}
            </div>
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {category}
            </div>
          </div>
        </div>

        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
};