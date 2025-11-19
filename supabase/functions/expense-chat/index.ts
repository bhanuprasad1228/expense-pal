import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    console.log("Received message:", message);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    console.log("User ID:", userId);

    // Build system prompt
    const systemPrompt = `You are an intelligent expense tracking assistant. Help users manage their expenses naturally.

Current date: ${new Date().toISOString().split('T')[0]}

Available actions you can perform:
1. ADD_EXPENSE - Record a new expense
2. VIEW_EXPENSES - Show expenses (all, by date, by category)
3. UPDATE_EXPENSE - Modify an existing expense
4. DELETE_EXPENSE - Remove an expense
5. ANALYTICS - Calculate totals and provide insights

When users want to add an expense, extract:
- amount (number)
- category (food, travel, bills, shopping, other)
- date (default to today)
- description (optional)

Respond in a friendly, conversational tone. Use the tools provided to interact with the database.`;

    // Prepare messages
    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    // Define tools for expense operations
    const tools = [
      {
        type: "function",
        function: {
          name: "add_expense",
          description: "Add a new expense to the database",
          parameters: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Amount spent" },
              category: {
                type: "string",
                enum: ["food", "travel", "bills", "shopping", "other"],
                description: "Expense category",
              },
              date: {
                type: "string",
                description: "Date in YYYY-MM-DD format (default: today)",
              },
              description: { type: "string", description: "Optional description" },
            },
            required: ["amount", "category"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_expenses",
          description: "Retrieve expenses based on filters",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Filter by category" },
              startDate: { type: "string", description: "Start date YYYY-MM-DD" },
              endDate: { type: "string", description: "End date YYYY-MM-DD" },
              limit: { type: "number", description: "Number of results" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "calculate_total",
          description: "Calculate total expenses for a period",
          parameters: {
            type: "object",
            properties: {
              period: {
                type: "string",
                enum: ["today", "week", "month", "all"],
                description: "Time period",
              },
              category: { type: "string", description: "Specific category" },
            },
            required: ["period"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "delete_expense",
          description: "Delete an expense by ID",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string", description: "Expense ID to delete" },
            },
            required: ["id"],
          },
        },
      },
    ];

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI response:", JSON.stringify(aiResponse));

    const choice = aiResponse.choices[0];
    let finalResponse = choice.message.content;
    let toolResults = [];

    // Handle tool calls
    if (choice.message.tool_calls && userId) {
      for (const toolCall of choice.message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`Executing tool: ${functionName}`, args);

        let result;
        try {
          switch (functionName) {
            case "add_expense": {
              const { data, error } = await supabase.from("expenses").insert({
                user_id: userId,
                amount: args.amount,
                category: args.category,
                date: args.date || new Date().toISOString().split('T')[0],
                description: args.description || null,
              }).select().single();

              if (error) throw error;
              result = { success: true, expense: data };
              break;
            }

            case "get_expenses": {
              let query = supabase
                .from("expenses")
                .select("*")
                .eq("user_id", userId)
                .order("date", { ascending: false });

              if (args.category) query = query.eq("category", args.category);
              if (args.startDate) query = query.gte("date", args.startDate);
              if (args.endDate) query = query.lte("date", args.endDate);
              if (args.limit) query = query.limit(args.limit);

              const { data, error } = await query;
              if (error) throw error;
              result = { expenses: data };
              break;
            }

            case "calculate_total": {
              let query = supabase
                .from("expenses")
                .select("amount, category")
                .eq("user_id", userId);

              const today = new Date();
              if (args.period === "today") {
                query = query.eq("date", today.toISOString().split('T')[0]);
              } else if (args.period === "week") {
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                query = query.gte("date", weekAgo.toISOString().split('T')[0]);
              } else if (args.period === "month") {
                const monthAgo = new Date(today);
                monthAgo.setMonth(today.getMonth() - 1);
                query = query.gte("date", monthAgo.toISOString().split('T')[0]);
              }

              if (args.category) query = query.eq("category", args.category);

              const { data, error } = await query;
              if (error) throw error;

              const total = data.reduce((sum, exp) => sum + exp.amount, 0);
              const byCategory = data.reduce((acc: Record<string, number>, exp: any) => {
                acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
                return acc;
              }, {} as Record<string, number>);

              result = { total, byCategory, count: data.length };
              break;
            }

            case "delete_expense": {
              const { error } = await supabase
                .from("expenses")
                .delete()
                .eq("id", args.id)
                .eq("user_id", userId);

              if (error) throw error;
              result = { success: true };
              break;
            }

            default:
              result = { error: "Unknown function" };
          }
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error);
          result = { error: error instanceof Error ? error.message : String(error) };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          function_name: functionName,
          result,
        });
      }

      // Get final response after tool execution
      const followUpMessages = [
        ...messages,
        choice.message,
        ...toolResults.map(tr => ({
          role: "tool",
          tool_call_id: tr.tool_call_id,
          content: JSON.stringify(tr.result),
        })),
      ];

      const followUpResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: followUpMessages,
          }),
        }
      );

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        finalResponse = followUpData.choices[0].message.content;
      }
    }

    return new Response(
      JSON.stringify({
        response: finalResponse,
        toolResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});