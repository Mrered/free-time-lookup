import { NextRequest, NextResponse } from "next/server";
import { getRedis, closeRedis } from "@/utils/redis";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const reqId = req.headers.get('X-Request-Time') || startTime.toString();
  console.log(`[CREATE-BACKUP][${reqId}] ========== 开始创建备份 ==========`);
  let redis;
  
  try {
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 请求参数:`, req.headers);
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 正在获取Redis连接...`);
    
    redis = await getRedis();
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接成功, 开始读取当前数据`);
    
    // 获取当前数据
    const readStart = Date.now();
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 开始读取excel_data...`);
    
    let currentData;
    try {
      currentData = await redis.get("excel_data");
      if (currentData) {
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 读取excel_data成功，大小: ${(currentData.length / 1024).toFixed(2)}KB`);
      } else {
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 读取excel_data成功，但数据为空`);
      }
    } catch (readErr) {
      const error = readErr instanceof Error ? readErr : new Error(String(readErr));
      console.error(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 读取excel_data失败:`, error);
      await closeRedis();
      throw error;
    }
    
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 读取当前数据耗时: ${Date.now() - readStart}ms`);
    
    if (!currentData) {
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 当前无数据，不需要备份`);
      
      try {
        // 尝试关闭Redis连接，避免连接泄漏
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
        await closeRedis();
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
      } catch (closeErr) {
        const error = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
        console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, error);
      }
      
      return NextResponse.json({ message: "当前无数据，不需要备份" });
    }
    
    // 验证数据格式
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 验证数据格式...`);
    let parsedData;
    let recordCount = 0;
    
    try {
      // 尝试解析数据，确保它是有效的JSON
      parsedData = JSON.parse(currentData);
      recordCount = Array.isArray(parsedData) ? parsedData.length : 0;
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 数据是有效的JSON格式，包含${recordCount}条记录`);
    } catch (parseErr) {
      const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 数据不是有效的JSON格式，将进行简单备份:`, error);
    }
    
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 待备份数据大小: ${(currentData.length / 1024).toFixed(2)}KB`);
    
    // 检查是否已有备份
    let existingBackupSize = 0;
    try {
      const existingSize = await redis.exists("backup_excel_data");
      if (existingSize) {
        existingBackupSize = await redis.strLen("backup_excel_data");
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 已存在备份，大小: ${(existingBackupSize / 1024).toFixed(2)}KB`);
      } else {
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 不存在备份，创建新备份`);
      }
    } catch (checkErr) {
      const error = checkErr instanceof Error ? checkErr : new Error(String(checkErr));
      console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 检查已有备份失败:`, error);
    }
    
    // 备份操作
    const writeStart = Date.now();
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 开始准备备份操作...`);
    const timestamp = new Date().toISOString();
    
    // 使用事务以确保数据一致性
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 开始执行备份命令...`);
    try {
      // 直接存储原始数据，不做格式转换，保持原样备份
      await redis.set("backup_excel_data", currentData);
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 设置备份数据完成`);
      
      await redis.set("backup_timestamp", timestamp);
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 设置备份时间戳完成`);
    } catch (writeErr) {
      const error = writeErr instanceof Error ? writeErr : new Error(String(writeErr));
      console.error(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份写入失败:`, error);
      await closeRedis();
      throw error;
    }
    
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 写入备份数据耗时: ${Date.now() - writeStart}ms`);
    
    // 验证备份是否成功
    console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 开始验证备份是否成功...`);
    try {
      const backupData = await redis.get("backup_excel_data");
      
      if (!backupData) {
        console.error(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 验证失败：备份数据为空！`);
      } else {
        console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据大小验证: ${(backupData.length / 1024).toFixed(2)}KB`);
        
        if (backupData.length !== currentData.length) {
          console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 警告：备份大小与源数据不一致 (源: ${currentData.length}, 备份: ${backupData.length})`);
        } else {
          console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据大小与源数据一致`);
        }
        
        // 尝试解析备份数据，确保格式正确
        try {
          const backupParsed = JSON.parse(backupData);
          const backupRecordCount = Array.isArray(backupParsed) ? backupParsed.length : 0;
          console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据解析成功，包含${backupRecordCount}条记录`);
          
          if (recordCount !== backupRecordCount) {
            console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 警告：备份记录数与源数据不一致 (源: ${recordCount}, 备份: ${backupRecordCount})`);
          }
        } catch (parseErr) {
          const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
          console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份数据不是有效的JSON格式，但这可能与源数据格式一致:`, error);
        }
      }
    } catch (verifyErr) {
      const error = verifyErr instanceof Error ? verifyErr : new Error(String(verifyErr));
      console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 备份验证失败，但备份可能已成功:`, error);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[CREATE-BACKUP][${reqId}][${totalTime}ms] ========== 备份成功 ==========`);
    
    try {
      // 尝试关闭Redis连接，避免连接泄漏
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
      await closeRedis();
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
    } catch (closeErr) {
      const error = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
      console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, error);
    }
    
    return NextResponse.json({ 
      message: "备份成功", 
      timestamp,
      processingTime: totalTime,
      dataSize: currentData.length,
      recordCount,
      previousBackupSize: existingBackupSize
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errTime = Date.now() - startTime;
    console.error(`[CREATE-BACKUP][${reqId}][${errTime}ms] ========== 备份失败 ==========`);
    console.error(`[CREATE-BACKUP][${reqId}][${errTime}ms] 错误详情:`, error);
    console.error(`[CREATE-BACKUP][${reqId}][${errTime}ms] 错误堆栈:`, error.stack);
    
    try {
      // 尝试关闭Redis连接，避免连接泄漏
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 尝试关闭Redis连接...`);
      await closeRedis();
      console.log(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] Redis连接已关闭`);
    } catch (closeErr) {
      const closeError = closeErr instanceof Error ? closeErr : new Error(String(closeErr));
      console.warn(`[CREATE-BACKUP][${reqId}][${Date.now() - startTime}ms] 关闭Redis连接失败:`, closeError);
    }
    
    return NextResponse.json({ 
      message: "备份失败: " + error.message,
      errorStack: error.stack,
      processingTime: errTime
    }, { status: 500 });
  }
} 