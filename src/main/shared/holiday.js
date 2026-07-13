/**
 * 节假日判断模块
 * 通过中国节假日数据源判断今天是否为工作日，支持缓存
 */

import { net } from 'electron'

// 节假日/工作日缓存 { '2024-01-01': true/false }
let holidayCache = {}

/**
 * 判断今天是否为工作日
 * 通过 GitHub 上的中国节假日数据源获取调休信息，带本地缓存
 * 请求失败时 fallback 到周一~周五为工作日的简单判断
 */
export function checkIsWorkday() {
  const today = new Date()
  const year = today.getFullYear()
  const dateStr = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // 命中缓存直接返回
  if (holidayCache[dateStr] !== undefined) {
    return Promise.resolve(holidayCache[dateStr])
  }

  return new Promise((resolve) => {
    const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`
    const request = net.request(url)
    let body = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString()
      })
      response.on('end', () => {
        try {
          const data = JSON.parse(body)
          const dayInfo = data.days.find((d) => d.date === dateStr)
          let isWork
          if (dayInfo) {
            // 节假日数据中有此日期的明确标记
            isWork = !dayInfo.isOffDay
          } else {
            // 不在节假日数据中，按普通周末判断
            const dayOfWeek = today.getDay()
            isWork = dayOfWeek !== 0 && dayOfWeek !== 6
          }
          // 缓存全年节假日数据
          data.days.forEach((d) => {
            holidayCache[d.date] = !d.isOffDay
          })
          const cachedDates = new Set(data.days.map((d) => d.date))
          if (!cachedDates.has(dateStr)) {
            holidayCache[dateStr] = isWork
          }
          resolve(isWork)
        } catch {
          // 解析失败，fallback 到简单的周末判断
          const dayOfWeek = today.getDay()
          resolve(dayOfWeek !== 0 && dayOfWeek !== 6)
        }
      })
    })

    request.on('error', () => {
      // 网络请求失败，fallback 到简单的周末判断
      const dayOfWeek = today.getDay()
      resolve(dayOfWeek !== 0 && dayOfWeek !== 6)
    })

    request.end()
  })
}
