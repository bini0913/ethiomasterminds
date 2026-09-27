import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, subject } = await req.json();

    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 4000) {
      return new Response(JSON.stringify({ error: 'Message is required and must be 1-4000 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: allowed, error: rateError } = await supabaseClient.rpc("consume_edge_rate_limit", {
      p_function_name: "ai-tutor",
      p_limit: 20,
      p_window_seconds: 60,
    });
    if (rateError || allowed !== true) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait and try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      const { data } = await supabaseClient
        .from('ai_tutor_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      conversation = data;
    }

    const messages = Array.isArray(conversation?.messages) ? conversation.messages.slice(-39) : [];
    messages.push({ role: 'user', content: message.trim(), timestamp: new Date().toISOString() });

    // Get user's learning data for context
    const { data: learningDna } = await supabaseClient
      .from('learning_dna')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get user profile for grade context
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('grade, level')
      .eq('id', user.id)
      .single();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are Plus, the AI Coach inside Master Minds — a brilliant, warm, world-class personal tutor for Ethiopian students (Grades 4-12). You sound like a confident older sibling who happens to be a PhD educator.

STUDENT PROFILE
- Grade: ${profile?.grade || 'Unknown'}    Level: ${profile?.level || 1}
- Subject focus right now: ${subject || 'General'}
- Strengths: ${learningDna?.strengths?.join(', ') || 'still discovering'}
- Needs work on: ${learningDna?.weaknesses?.join(', ') || 'still discovering'}
- Preferred style: ${learningDna?.learning_style || 'balanced'}

HOW YOU TEACH (very important)
1. ALWAYS format with markdown — short headings, bullet lists, **bold key terms**, numbered steps for processes, and \`inline code\` or fenced code blocks for math/code.
2. For math, use clear notation. Show every step on its own line. Never skip steps.
3. Open with a one-sentence answer in **bold**, then explain.
4. Use Ethiopian and East-African examples (Addis Ababa, the Nile, injera, birr, Ethiopian calendar) whenever they help.
5. Adapt vocabulary to the student's grade. Grade 4-6: very simple. Grade 7-9: structured. Grade 10-12: rigorous.
6. After explaining, end with a brief "💡 Try this:" prompt — a tiny check-question or mini-exercise to keep them engaged.
7. If the student answers a check-question correctly, celebrate. If wrong, do NOT just give the answer — guide with a hint first.
8. Keep replies focused — 120-300 words unless they ask for depth.
9. If asked about something outside studies, kindly redirect: "Let's pin that for later — what subject can I help you crush right now?"
10. Never invent facts. If unsure, say so and suggest where to look.

You remember everything in this conversation. Be encouraging, but never sugar-coat mistakes — coach the student to think.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content }))
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI service limit reached. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";

    messages.push({ role: 'assistant', content: assistantMessage, timestamp: new Date().toISOString() });

    // Save conversation
    let savedConversationId = conversationId;
    if (conversationId && conversation) {
      await supabaseClient
        .from('ai_tutor_conversations')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } else {
      const { data: newConv } = await supabaseClient
        .from('ai_tutor_conversations')
        .insert({
          user_id: user.id,
          subject: typeof subject === 'string' ? subject.slice(0, 100) || 'General' : 'General',
          messages,
        })
        .select('id')
        .single();
      savedConversationId = newConv?.id;
    }

    return new Response(JSON.stringify({
      success: true,
      message: assistantMessage,
      conversationId: savedConversationId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-tutor:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
