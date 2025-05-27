// netlify/functions/search-job.js
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
    
    // Get the job number from the request
    const jobNumber = params.jobNumber;
    
    if (!jobNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Job number is required (e.g., C13676)' })
      };
    }
    
    console.log(`Searching for job with number: ${jobNumber}`);
    
    // Fetch job data from Supabase
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
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
    
    // Fetch components for this job, grouped by sheet
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
    
    // Fetch electrical items for this job, grouped by sheet
    const { data: electricalItems, error: electricalError } = await supabase
      .from('job_electrical_items')
      .select('*')
      .eq('job_number', jobNumber)
      .order('sheet_name, item_code', { ascending: true });
    
    if (electricalError) {
      console.error('Error fetching electrical items:', electricalError);
      // Don't return error, just log it as electrical items are optional
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
    
    // Group electrical items by sheet name
    const electricalSheets = {};
    if (electricalItems && electricalItems.length > 0) {
      electricalItems.forEach(item => {
        const sheetName = item.sheet_name;
        if (!electricalSheets[sheetName]) {
          electricalSheets[sheetName] = [];
        }
        electricalSheets[sheetName].push(item);
      });
    }
    
    // Combine all sheets (components and electrical)
    const allSheets = { ...componentSheets };
    
    // Add electrical sheets with a different structure
    Object.keys(electricalSheets).forEach(sheetName => {
      if (!allSheets[sheetName]) {
        // If it's a pure electrical sheet (no components)
        allSheets[sheetName] = electricalSheets[sheetName].map(item => ({
          part_code: item.item_code,
          part_description: item.description,
          quantity: item.quantity,
          tags: item.notes,
          type: 'electrical'
        }));
      } else {
        // If it's a mixed sheet, add electrical items to existing components
        electricalSheets[sheetName].forEach(item => {
          allSheets[sheetName].push({
            part_code: item.item_code,
            part_description: item.description,
            quantity: item.quantity,
            tags: item.notes,
            type: 'electrical'
          });
        });
      }
    });
    
    console.log(`Found job ${jobNumber} with ${Object.keys(allSheets).length} sheets`);
    
    // Return the job and sheets data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        job,
        sheets: allSheets,
        sheetCount: Object.keys(allSheets).length,
        totalComponents: components ? components.length : 0,
        totalElectricalItems: electricalItems ? electricalItems.length : 0
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