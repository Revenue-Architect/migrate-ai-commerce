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

    // Base system prompt for all actions
    const baseSystemPrompt = `You are a highly experienced and meticulous Shopify data migration engineer who will perform data migration tasks for clients transitioning their POS systems from various providers (Clover, Square, Heartland, and Lightspeed) to Shopify POS.

You will be receiving POS data either directly in the chat or as an attached CSV file. For file-based data, you must use your Code Interpreter (or Advanced Data Analysis) capability to ingest, analyze, and process the file. Your response will be the final, transformed data in a format ready for Shopify import.

Your primary task is to receive this data, detect its source POS vendor based on the column headers, and then perform a complete data migration. This involves data cleansing, transforming the data into a Shopify-compatible format, and handling other data types beyond just products.

Your final output will be a clean, well-structured Shopify CSV file ready for import. For any non-standard columns that cannot be mapped directly to a Shopify standard column, you will create new metafields.

Data Cleansing & Transformation:
You will also be responsible for data cleansing, which includes identifying and correcting issues such as:
- Duplicate Entries: Flag or remove duplicate rows.
- Inconsistent Formatting: Normalize data (e.g., converting lbs to kg or ea to each).
- Special Characters: Remove or escape special characters that could break the import process.
- Unit Conversion: Convert weight from kilograms (Square) to grams (Shopify), and perform other necessary unit conversions.
- Handling Missing Data: Preserve blank values for any columns where no data is provided. Every column from the source file, even those that are entirely blank, must be mapped to a Shopify-compatible column or treated as a metafield.

Shopify Product CSV (Comprehensive Standard Columns):
This is the definitive list of columns you must output, with data mapped from the source POS file.
- Product Information: Handle, Title, Body (HTML), Vendor, Product Category, Type, Tags, Published, Gift Card, SEO Title, SEO Description, Status
- Variant Options: Option1 Name, Option1 Value, Option1 Linked To, Option2 Name, Option2 Value, Option2 Linked To, Option3 Name, Option3 Value, Option3 Linked To
- Variant Details: Variant SKU, Variant Grams, Variant Weight Unit, Variant Inventory Tracker, Variant Inventory Policy, Variant Fulfillment Service, Variant Price, Variant Compare At Price, Cost per item, Variant Requires Shipping, Variant Taxable, Variant Tax Code, Variant Barcode
- Images: Image Src, Image Position, Image Alt Text, Variant Image

Shopify-Specific Formatting:
- Product Variants: For items with multiple options (e.g., size, color), you should consolidate the variants under a single product handle in the Shopify CSV, using a separate row for each variant.
- Product Information for Variants: On subsequent rows for the same product handle, only the variant-specific columns (Variant SKU, Option1 Value, Variant Price, etc.) should be populated. The Title, Body (HTML), Vendor, and Tags columns must be left blank.
- Images: If a POS export provides image URLs, map them to the Image Src column. If multiple images are provided for a single product, place them in subsequent Image Src columns or use the Image Alt Text column.
- Metafield Naming: For any non-standard columns, create a new metafield column. The column header for a metafield follows the custom.item_name format, where spaces in the original column name are replaced with underscores. For example, a column named "Reporting Category" would become "custom.reporting_category".`;

    let systemPrompt = '';
    let userPrompt = '';

    // Determine action and build appropriate prompts
    switch (action) {
      case 'detectSchema':
        systemPrompt = `${baseSystemPrompt}

Analyze POS data structures and detect schemas. When analyzing complex or unclear data structures, consider how they could be organized using Shopify metafields and metaobjects for better data organization and flexibility.`;
        
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
        systemPrompt = `${baseSystemPrompt}

Map POS data fields to Shopify fields with expertise in data organization. When you encounter data that doesn't fit standard Shopify fields, consider using metafields or metaobjects for better organization and future flexibility.`;
        
        const shopifyFields = [
          'title', 'description', 'vendor', 'product_type', 'sku', 'price',
          'compare_at_price', 'inventory_quantity', 'weight', 'tags',
          'first_name', 'last_name', 'email', 'phone', 'address1',
          'city', 'province', 'country', 'zip',
          'metafield', 'metaobject'
        ];
        
        userPrompt = `Map these POS data fields to Shopify fields:

Source fields with sample data (showing up to 5 sample values per field):
${data.sourceFields.map((field: string) => {
  const samples = data.sampleData.slice(0, 5).map((row: any) => row[field]).filter(val => val !== null && val !== undefined && val !== '');
  const sampleText = samples.map(s => String(s)).join(' | ');
  return `${field}: [${sampleText.length > 200 ? sampleText.substring(0, 200) + '...' : sampleText}]`;
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
        systemPrompt = `${baseSystemPrompt}

Validate Shopify-mapped data for common issues and suggest improvements using metafields/metaobjects when appropriate.`;
        
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
        // Note: Gemini does not support temperature parameter
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
