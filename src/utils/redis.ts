import { createClient, RedisClientType } from "redis";

// 添加全局连接实例，避免重复创建连接
let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionPromise: Promise<RedisClientType> | null = null;

// 获取Redis客户端的函数，增加了重试和同步机制
export async function getRedis(maxRetries = 3): Promise<RedisClientType> {
  // 如果已有连接且是开放状态，直接返回
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  
  // 如果已经有连接过程在进行，等待该过程完成
  if (isConnecting && connectionPromise) {
    try {
      return await connectionPromise;
    } catch (err) {
      console.error("[Redis] 等待现有连接失败，重新创建连接", err);
      // 继续尝试创建新连接
    }
  }
  
  // 标记正在连接
  isConnecting = true;
  let retries = 0;
  let lastError: Error | null = null;
  
  // 创建连接的函数，支持重试
  const createConnection = async (): Promise<RedisClientType> => {
    try {
      console.log(`[Redis] 创建新连接... (尝试 ${retries + 1}/${maxRetries})`);
      
      // 如果已有实例但已关闭，尝试清理
      if (redisClient && !redisClient.isOpen) {
        try {
          console.log("[Redis] 清理旧连接");
          redisClient.removeAllListeners();
          redisClient = null;
        } catch (cleanupErr) {
          console.warn("[Redis] 清理旧连接失败", cleanupErr);
        }
      }
      
      // 创建新连接
      const client = createClient({ 
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            console.log(`[Redis] 重连策略: 尝试 ${retries}`);
            if (retries > 10) {
              console.error(`[Redis] 重连失败: 达到最大重试次数`);
              return new Error('最大重连尝试次数已达到');
            }
            // 指数退避: 100ms, 200ms, 400ms...
            return Math.min(retries * 100, 3000);
          }
        }
      }) as RedisClientType;
      
      // 添加事件处理器
      client.on('error', (err) => {
        console.error('[Redis] 连接错误:', err);
        if (client === redisClient) {
          redisClient = null;
        }
      });
      
      client.on('connect', () => {
        console.log('[Redis] 已连接到服务器');
      });
      
      client.on('ready', () => {
        console.log('[Redis] 客户端已就绪');
      });
      
      client.on('reconnecting', () => {
        console.log('[Redis] 正在重连...');
      });
      
      client.on('end', () => {
        console.log('[Redis] 连接已结束');
        if (client === redisClient) {
          redisClient = null;
        }
      });
      
      // 连接到Redis
      await client.connect();
      console.log("[Redis] 连接成功");
      
      redisClient = client;
      return client;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[Redis] 连接失败 (尝试 ${retries + 1}/${maxRetries}):`, err);
      throw lastError;
    }
  };
  
  // 使用Promise进行连接
  connectionPromise = (async () => {
    while (retries < maxRetries) {
      try {
        const client = await createConnection();
        isConnecting = false;
        connectionPromise = null;
        return client;
      } catch (err) {
        retries++;
        if (retries >= maxRetries) {
          isConnecting = false;
          connectionPromise = null;
          throw new Error(`无法连接到Redis，已尝试${maxRetries}次: ${String(lastError) || "未知错误"}`);
        }
        // 等待一段时间再重试
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }
    // 不应该到达这里，但为了类型安全
    throw new Error("连接Redis失败");
  })();
  
  return connectionPromise;
}

// 添加断开连接的方法，修改为更安全的实现
export async function closeRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }
  
  if (!redisClient.isOpen) {
    redisClient = null;
    return;
  }
  
  try {
    console.log("[Redis] 关闭连接");
    const client = redisClient;
    redisClient = null; // 先将全局引用置为null，避免其他请求使用正在关闭的连接
    await client.quit();
    console.log("[Redis] 连接已正常关闭");
  } catch (err) {
    console.warn("[Redis] 关闭连接时出错:", err);
    // 确保即使出错，全局变量也会重置
    redisClient = null;
  }
} 