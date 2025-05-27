// netlify/functions/search-job.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async function(event, context) {
  // Updated CORS headers - allow your specific domain
  const headers = {
    'Access-Control-Allow-Origin': 'https://comtherm-site.webflow.io', // Your specific domain
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
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
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const params = event.httpMethod === 'POST' 
      ? JSON.parse(event.body || '{}')
      : event.queryStringParameters || {};
    
    const jobNumber = params.jobNumber;
    
    if (!jobNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Job number is required (e.g., C13676)' })
      };
    }
    
    console.log(`Searching for job with number: ${jobNumber}`);
    
    // Fetch job data - MAKE SURE TO INCLUDE burner_type
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('job_number, customer_name, filename, created_at, burner_type') // Include burner_type
      .eq('job_number', jobNumber)
      .single();
    
    if (jobError) {
      console.error('Error fetching job:', jobError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Error fetching job data: ${jobError.message}` })
      };
    }
    
    if (!job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `No job found with number: ${jobNumber}` })
      };
    }
    
    // Rest of your existing code...
    // (fetch components, electrical items, group by sheet, etc.)
    
    const { data: components, error: componentsError } = await supabase
      .from('job_components')
      .select('*')
      .eq('job_number', jobNumber)
      .order('sheet_name, part_code', { ascending: true });
    
    if (componentsError) {
      console.error('Error fetching components:', componentsError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Error fetching component data: ${componentsError.message}` })
      };
    }
    
    // Group components by sheet name
    const componentSheets = {};
    if (components && components.length > 0) {
      components.forEach(component => {
        const sheetName = component.sheet_name;
        if (!componentSheets[sheetName]) {
          componentSheets[sheetName] = [];
        }
        componentSheets[sheetName].push(component);
      });
    }
    
    console.log(`Found job ${jobNumber} with ${Object.keys(componentSheets).length} sheets`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        job,
        sheets: componentSheets,
        sheetCount: Object.keys(componentSheets).length,
        totalComponents: components ? components.length : 0
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