import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const useExpenseChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your expense tracking assistant. I can help you add expenses, view your spending, and analyze your finances. What would you like to do?",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (userMessage: string) => {
    // Add user message
    const newUserMessage: Message = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "expense-chat",
        {
          body: {
            message: userMessage,
            conversationHistory: messages,
          },
        }
      );

      if (functionError) throw functionError;

      // Add assistant response
      const assistantMessage: Message = {
        role: "assistant",
        content: functionData.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If there were tool results (expense added, etc), refresh the page
      if (functionData.toolResults && functionData.toolResults.length > 0) {
        // Trigger a custom event to refresh expenses list
        window.dispatchEvent(new CustomEvent("refreshExpenses"));
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      let errorMessage = "Sorry, I encountered an error. Please try again.";
      
      if (error.message?.includes("429") || error.message?.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please try again in a moment.";
      } else if (error.message?.includes("402") || error.message?.includes("payment")) {
        errorMessage = "AI credits exhausted. Please add credits to continue.";
      }
      
      toast.error(errorMessage);
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, isLoading, sendMessage };
};