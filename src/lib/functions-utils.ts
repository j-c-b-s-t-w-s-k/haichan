import db, { PROJECT_ID } from './db-client'

export async function invokeFunction<T = any>(
  functionName: string, 
  options: { body?: any } = {}
): Promise<{ data: T | null; error: any }> {
  
  // Use SDK if available
  if (db.functions) {
    try {
      return await db.functions.invoke(functionName, options)
    } catch (err) {
      // SDK might throw errors, wrap them
      return { data: null, error: err }
    }
  }

  console.warn(`[functions-utils] Blink functions not available, falling back to fetch for ${functionName}`)

  try {
    // Get token if user is authenticated
    // Note: getValidToken might return null if not authenticated
    let token = null
    try {
        // Check if we have a user first to avoid unnecessary token refresh attempts
        const user = await db.auth.me()
        if (user) {
            token = await db.auth.getValidToken()
        }
    } catch (e) {
        // Ignore auth errors
    }

    const functionUrl = `https://${PROJECT_ID}--${functionName}.functions.blink.new`
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(options.body || {})
    })

    if (!response.ok) {
      const errorText = await response.text()
      try {
        // Try to parse JSON error if possible
        const errorJson = JSON.parse(errorText)
        return { data: null, error: errorJson }
      } catch {
        return { data: null, error: { message: errorText } }
      }
    }

    // Handle empty response
    const text = await response.text()
    if (!text) {
        return { data: {} as T, error: null }
    }

    const data = JSON.parse(text)
    return { data, error: null }

  } catch (err: any) {
    console.error(`[functions-utils] Error invoking ${functionName}:`, err)
    return { data: null, error: err }
  }
}
