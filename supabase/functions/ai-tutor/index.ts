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

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
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

    const messages = conversation?.messages || [];
    messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

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

    const systemPrompt = `You are Master Mind AI, a friendly and encouraging educational tutor for Ethiopian students. 

Student Context:
- Grade: ${profile?.grade || 'Not specified'}
- Level: ${profile?.level || 1}
- Subject Focus: ${subject || 'General'}
- Strengths: ${learningDna?.strengths?.join(', ') || 'Still learning'}
- Areas to Improve: ${learningDna?.weaknesses?.join(', ') || 'Keep practicing'}

Your role:
1. Answer questions clearly and at the appropriate grade level
2. Use examples relevant to Ethiopian students when possible
3. Encourage the student and celebrate their progress
4. If they're struggling, break down concepts step by step
5. Suggest practice problems when appropriate
6. Be supportive but challenge them to think critically

Keep responses concise but thorough. Use emojis sparingly to keep it friendly. 
If the student asks about something outside education, gently redirect them back to learning.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
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
          subject: subject || 'General',
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
