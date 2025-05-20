// netlify/functions/debug.js
exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  
  try {
    // Return environment information (without revealing sensitive values)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Debug function working correctly',
        environment: {
          supabaseUrl: process.env.SUPABASE_URL ? 'Set (value hidden)' : 'Not set',
          supabaseKey: process.env.SUPABASE_SERVICE_KEY ? 'Set (value hidden)' : 'Not set',
          nodeVersion: process.version,
          functionName: context.functionName,
          functionVersion: context.functionVersion,
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Debug error: ${error.message}` })
    };
  }
};
