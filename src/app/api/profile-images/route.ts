import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(request: Request) {
  const { usernames } = await request.json()
  
  if (!usernames || !Array.isArray(usernames)) {
    return NextResponse.json({ error: 'Usernames array is required' }, { status: 400 })
  }

  try {
    const keys = usernames.map(username => `profile_image:${username}`)
    const data = await redis.mget(...keys)
    
    // Create a map of username to image data
    const results = Object.fromEntries(
      usernames.map((username, i) => [username, data[i]])
    )
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Failed to get profile images:', error)
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
  }
} 