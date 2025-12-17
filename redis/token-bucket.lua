-- Redis Lua Script: Atomic Token Bucket Rate Limiter
-- Prevents race conditions in distributed environments
--
-- KEYS[1]: Bucket key (rl:bucket:{tier}:{apiKey})
-- ARGV[1]: Current timestamp (milliseconds)
-- ARGV[2]: Tokens needed for this request
-- ARGV[3]: Refill rate (tokens per second)
-- ARGV[4]: Bucket capacity (max tokens)
-- ARGV[5]: TTL in seconds for the key

local bucketKey = KEYS[1]
local now = tonumber(ARGV[1])
local tokensNeeded = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local capacity = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

-- Get current bucket state
local bucket = redis.call('HMGET', bucketKey, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

-- Initialize bucket if it doesn't exist
if tokens == nil then
  tokens = capacity
  lastRefill = now
end

-- Calculate tokens to add based on time elapsed
local timePassed = (now - lastRefill) / 1000  -- Convert to seconds
local tokensToAdd = timePassed * refillRate
tokens = math.min(tokens + tokensToAdd, capacity)

-- Check if request can be allowed
local allowed = 0
local newTokens = tokens

if tokens >= tokensNeeded then
  allowed = 1
  newTokens = tokens - tokensNeeded
end

-- Calculate reset time (when bucket will be full again)
local tokensDeficit = capacity - newTokens
local resetInMs = (tokensDeficit / refillRate) * 1000
local resetAt = now + resetInMs

-- Update bucket state
redis.call('HMSET', bucketKey,
  'tokens', newTokens,
  'lastRefill', now
)
redis.call('EXPIRE', bucketKey, ttl)

-- Return: allowed (0/1), remaining tokens, reset timestamp
return {allowed, math.floor(newTokens), math.floor(resetAt)}
