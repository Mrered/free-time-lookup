import { NextRequest, NextResponse } from "next/server";
import { getRedis, closeRedis } from "@/utils/redis";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const reqId = req.headers.get('X-Request-Time') || startTime.toString();
  console.log(`[RESTORE-BACKUP][${reqId}] ========== 开始获取备份数据 ==========`);
  let redis;
  
  try {
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 正在获取Redis连接...`);
    
    // 优先检查备份存在性以避免不必要的操作
    redis = await getRedis();
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接成功, 开始检查备份`);
    
    // 检查备份是否存在
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 检查备份是否存在...`);
    const backupExists = await redis.exists("backup_excel_data");
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份检查结果: ${backupExists ? '存在' : '不存在'}`);
    
    if (!backupExists) {
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 未找到备份数据，返回404`);
      await closeRedis();
      return NextResponse.json({ message: "未找到备份数据" }, { status: 404 });
    }
    
    // 获取备份数据和时间戳（分开获取，避免一次获取大量数据）
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 开始获取备份时间戳...`);
    const timestampStart = Date.now();
    const backupTimestamp = await redis.get("backup_timestamp");
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 获取备份时间戳成功，耗时: ${Date.now() - timestampStart}ms`);
    
    // 获取备份数据
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 开始获取备份数据...`);
    const dataStart = Date.now();
    
    let backupData;
    try {
      backupData = await redis.get("backup_excel_data");
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 获取备份数据成功，耗时: ${Date.now() - dataStart}ms，大小: ${backupData ? (backupData.length / 1024).toFixed(2) : 0}KB`);
    } catch (dataErr) {
      const error = dataErr instanceof Error ? dataErr : new Error(String(dataErr));
      console.error(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 获取备份数据失败:`, error);
      await closeRedis();
      throw new Error(`获取备份数据失败: ${error.message}`);
    }
    
    if (!backupData) {
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据为空，返回404`);
      await closeRedis();
      return NextResponse.json({ message: "备份数据为空" }, { status: 404 });
    }
    
    // 检查数据格式，确保是有效的JSON
    console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 验证备份数据格式...`);
    let parsedData;
    try {
      // 如果backupData已经是字符串形式的JSON，尝试解析它确保它是有效的
      parsedData = JSON.parse(backupData);
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据是有效的JSON格式，包含${Array.isArray(parsedData) ? parsedData.length : 0}条记录`);
    } catch (parseErr) {
      const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      console.error(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据格式无效，非JSON格式:`, error);
      await closeRedis();
      return NextResponse.json({ 
        message: "备份数据格式无效，无法恢复" 
      }, { status: 400 });
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[RESTORE-BACKUP][${reqId}][${totalTime}ms] ========== 备份数据获取成功 ==========`);
    
    try {
      // 尝试关闭Redis连接，避免连接泄漏
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
      await closeRedis();
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
    } catch (closeErr) {
      const error = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
      console.warn(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, error);
    }
    
    // 直接返回备份数据给前端，不写入数据库
    return NextResponse.json({ 
      message: "备份数据获取成功", 
      timestamp: backupTimestamp,
      formattedTime: backupTimestamp ? new Date(backupTimestamp).toLocaleString('zh-CN') : null,
      processingTime: totalTime,
      recordCount: Array.isArray(parsedData) ? parsedData.length : 0,
      dataSize: backupData.length,
      data: parsedData // 直接返回解析后的数据
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errTime = Date.now() - startTime;
    console.error(`[RESTORE-BACKUP][${reqId}][${errTime}ms] ========== 获取备份数据失败 ==========`);
    console.error(`[RESTORE-BACKUP][${reqId}][${errTime}ms] 错误详情:`, error);
    console.error(`[RESTORE-BACKUP][${reqId}][${errTime}ms] 错误堆栈:`, error.stack);
    
    try {
      // 尝试关闭Redis连接，避免连接泄漏
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
      await closeRedis();
      console.log(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
    } catch (closeErr) {
      const closeError = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
      console.warn(`[RESTORE-BACKUP][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, closeError);
    }
    
    return NextResponse.json({ 
      message: "获取备份数据失败: " + error.message,
      errorStack: error.stack,
      processingTime: errTime
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const reqId = req.headers.get('X-Request-Time') || startTime.toString();
  console.log(`[BACKUP-STATUS][${reqId}] ========== 开始检查备份状态 ==========`);
  let redis;
  
  try {
    console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 正在获取Redis连接...`);
    redis = await getRedis();
    console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] Redis连接成功, 开始读取备份状态`);
    
    // 获取备份时间戳
    console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 开始获取备份时间戳...`);
    const timestampStart = Date.now();
    const backupTimestamp = await redis.get("backup_timestamp");
    console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 获取时间戳完成，耗时: ${Date.now() - timestampStart}ms`);
    
    // 检查备份数据是否存在
    console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 检查备份数据是否存在...`);
    const existsStart = Date.now();
    const backupExists = await redis.exists("backup_excel_data");
    console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 检查备份数据完成，耗时: ${Date.now() - existsStart}ms，结果: ${backupExists ? '存在' : '不存在'}`);
    
    // 如果存在，获取备份数据大小
    let backupSize = 0;
    if (backupExists) {
      console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 获取备份数据大小...`);
      try {
        // 使用strLen替代获取整个数据，效率更高
        const sizeStart = Date.now();
        backupSize = await redis.strLen("backup_excel_data");
        console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 获取备份数据大小完成，耗时: ${Date.now() - sizeStart}ms，大小: ${(backupSize / 1024).toFixed(2)}KB`);
      } catch (sizeErr) {
        const error = sizeErr instanceof Error ? sizeErr : new Error(String(sizeErr));
        console.warn(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 获取备份大小失败，将其视为0:`, error);
      }
    }
    
    // 检查是否有备份
    const hasBackup = !!backupTimestamp && backupExists;
    
    const totalTime = Date.now() - startTime;
    console.log(`[BACKUP-STATUS][${reqId}][${totalTime}ms] ========== 备份状态检查完成 ==========`);
    console.log(`[BACKUP-STATUS][${reqId}][${totalTime}ms] 备份状态: ${hasBackup ? "有备份" : "无备份"}，时间:`, backupTimestamp);
    
    try {
      // 尝试关闭Redis连接，避免连接泄漏
      console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
      await closeRedis();
      console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
    } catch (closeErr) {
      const error = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
      console.warn(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, error);
    }
    
    return NextResponse.json({ 
      hasBackup, 
      timestamp: backupTimestamp,
      formattedTime: backupTimestamp ? new Date(backupTimestamp).toLocaleString('zh-CN') : null,
      processingTime: totalTime,
      dataSize: backupSize
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errTime = Date.now() - startTime;
    console.error(`[BACKUP-STATUS][${reqId}][${errTime}ms] ========== 备份状态检查失败 ==========`);
    console.error(`[BACKUP-STATUS][${reqId}][${errTime}ms] 错误详情:`, error);
    console.error(`[BACKUP-STATUS][${reqId}][${errTime}ms] 错误堆栈:`, error.stack);
    
    try {
      // 尝试关闭Redis连接，避免连接泄漏
      console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
      await closeRedis();
      console.log(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
    } catch (closeErr) {
      const closeError = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
      console.warn(`[BACKUP-STATUS][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, closeError);
    }
    
    return NextResponse.json({ 
      message: "获取备份状态失败: " + error.message,
      errorStack: error.stack,
      hasBackup: false,
      processingTime: errTime
    }, { status: 500 });
  }
} 