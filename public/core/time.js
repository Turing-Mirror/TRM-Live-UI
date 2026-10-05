// 时间相关的纯函数，直播画面和测试共用

export const pad = (n) => String(n).padStart(2, '0');

/** 现在的时刻，如 21:05。 */
export const clock = (now = new Date()) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

/** "21:00" 到现在的剩余时间；目标早于现在超过半天时算作第二天。格式不对时返回空字符串。 */
export function formatCountdown(target, now = new Date()) {
  const [hours, minutes] = String(target).split(/[:：]/).map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return '';
  const end = new Date(now);
  end.setHours(hours, minutes, 0, 0);
  let seconds = Math.ceil((end - now) / 1000);
  if (seconds < -12 * 3600) seconds += 24 * 3600;
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
