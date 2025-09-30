import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    // Determine action and build appropriate prompts
    switch (action) {
      case 'detectSchema':
        systemPrompt = `You are a Shopify data migration expert. Analyze POS data structures and detect schemas. 
When analyzing complex or unclear data structures, consider how they could be organized using Shopify metafields and metaobjects for better data organization and flexibility.`;
        
        userPrompt = `Analyze this POS data and detect the schema:

Sample data: ${JSON.stringify(data.sampleData, null, 2)}
Fields: ${data.fields.join(', ')}

Respond in JSON format:
{
  "fields": [
    {
      "name": "field_name",
      "type": "string|number|date|email|phone|currency|boolean",
      "confidence": 0-100,
      "sampleValues": ["val1", "val2", "val3"]
    }
  ],
  "detectedSource": "square|lightspeed|revel|heartland|magento|woocommerce|teamworks|unknown",
  "confidence": 0-100
}

Consider:
- Common POS field patterns like SKU, product names, prices, customer info
- Complex data that could benefit from metafields or metaobjects
- Custom attributes that don't fit standard Shopify fields`;
        break;

      case 'suggestMappings':
        systemPrompt = `You are a Shopify data migration expert. Map POS data fields to Shopify fields with expertise in data organization.
When you encounter data that doesn't fit standard Shopify fields, consider using metafields or metaobjects for better organization and future flexibility.`;
        
        const shopifyFields = [
          'title', 'description', 'vendor', 'product_type', 'sku', 'price',
          'compare_at_price', 'inventory_quantity', 'weight', 'tags',
          'first_name', 'last_name', 'email', 'phone', 'address1',
          'city', 'province', 'country', 'zip',
          'metafield', 'metaobject'
        ];
        
        userPrompt = `Map these POS data fields to Shopify fields:

Source fields with sample data:
${data.sourceFields.slice(0, 20).map((field: string) => {
  const samples = data.sampleData.slice(0, 2).map((row: any) => row[field]).filter(Boolean);
  const sampleText = samples.join(', ');
  return `${field}: [${sampleText.length > 100 ? sampleText.substring(0, 100) + '...' : sampleText}]`;
}).join('\n')}

Available Shopify fields: ${shopifyFields.join(', ')}
Detected POS system: ${data.detectedSource}

Respond in JSON format:
[
  {
    "sourceField": "source_field_name",
    "suggestedMapping": "shopify_field_name",
    "confidence": 0-100,
    "reasoning": "explanation for this mapping"
  }
]

Consider as a Shopify migration expert:
- Field names and their semantic meaning
- Sample data content and format
- Common POS to Shopify mapping patterns
- Data types and validation requirements
- Use "metafield" for custom attributes that don't fit standard fields
- Use "metaobject" for complex structured data that needs custom organization
- Prioritize data integrity and future extensibility`;
        break;

      case 'validateData':
        systemPrompt = `You are a Shopify data migration expert. Validate Shopify-mapped data for common issues and suggest improvements using metafields/metaobjects when appropriate.`;
        
        userPrompt = `Validate this Shopify-mapped data:

Sample mapped data: ${JSON.stringify(data.mappedSample, null, 2)}

Field mappings:
${data.mappings.map((m: any) => `${m.sourceField} -> ${m.targetField}`).join('\n')}

Check for:
- Required Shopify fields (title, sku for products; email for customers)
- Valid email formats
- Positive prices and quantities
- Duplicate SKUs
- Missing critical data
- Format issues
- Opportunities to use metafields for custom data
- Complex data that could benefit from metaobjects

Respond in JSON:
{
  "isValid": boolean,
  "errors": [
    {
      "field": "field_name",
      "type": "required|format|duplicate|invalid",
      "message": "description",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ],
  "warnings": [
    {
      "field": "field_name",
      "message": "warning description"
    }
  ]
}`;
        break;

      default:
        throw new Error('Invalid action');
    }

    console.log(`Processing ${action} request`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log(`AI response received for ${action}`);
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return new Response(
        JSON.stringify({ success: true, result }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Failed to extract JSON from AI response');

  } catch (error) {
    console.error('Error in analyze-data-migration:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
