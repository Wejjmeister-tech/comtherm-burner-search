// netlify/functions/search-burner.js
const { createClient } = require('@supabase/supabase-js');

// Supabase connection details
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function(event, context) {
  // Set CORS headers to allow requests from your Webflow site
  const headers = {
    'Access-Control-Allow-Origin': '*', // Allow all origins for testing, restrict to your domain in production
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Preflight request successful' })
    };
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse the request body or query parameters
    const params = event.httpMethod === 'POST' 
      ? JSON.parse(event.body || '{}')
      : event.queryStringParameters || {};
    
    // Get the serial number from the request
    const serialNumber = params.serialNumber;
    
    if (!serialNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Serial number is required' })
      };
    }
    
    console.log(`Searching for burner with serial number: ${serialNumber}`);
    
    // Fetch burner data from Supabase
    const { data: burner, error: burnerError } = await supabase
      .from('burners')
      .select('*')
      .eq('serial_number', serialNumber)
      .single();
    
    if (burnerError) {
      console.error('Error fetching burner:', burnerError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Error fetching burner data: ${burnerError.message}` })
      };
    }
    
    if (!burner) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `No burner found with serial number: ${serialNumber}` })
      };
    }
    
    // Fetch components for this burner
    const { data: components, error: componentsError } = await supabase
      .from('components')
      .select('*')
      .eq('burner_id', burner.id)
      .order('part_code', { ascending: true });
    
    if (componentsError) {
      console.error('Error fetching components:', componentsError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Error fetching component data: ${componentsError.message}` })
      };
    }
    
    // Return the burner and components data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        burner,
        components: components || []
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Internal server error: ${error.message}` })
    };
  }
};