import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Теперь мы используем этот массив для динамической генерации запроса
const TASK_IDS = ["1", "2", "3"]

export async function GET(request: Request) {
  // Защита от несанкционированного запуска
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]

  // Динамически собираем условия: "1 не true", "2 не true" и т.д.
  // Результат: completed_tasks->>'1'.neq.true,completed_tasks->>'2'.neq.true,...
  const uncompletedTasksQuery = TASK_IDS.map(
    id => `completed_tasks->>'${id}'.neq.true`,
  ).join(",")

  // Собираем итоговое условие: ИЛИ дата не сегодня, ИЛИ какая-то из задач не выполнена
  const orQuery = `last_update_date.neq.${today},${uncompletedTasksQuery}`

  const { data: users, error } = await supabase
    .from("users")
    .select("chat_id, completed_tasks, last_update_date")
    .or(orQuery)

  if (error) {
    console.error("Ошибка Cron Supabase:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Если все молодцы, просто завершаем работу
  if (!users || users.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Все выпили таблетки на этот час",
    })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN

  // Отправляем напоминания только тем, кто отфильтровался
  for (const user of users) {
    const message =
      "🔔 Пора выполнить схему приёма! Зайди в трекер 💊 и отметь пункты."
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${user.chat_id}&text=${encodeURIComponent(message)}`

    try {
      await fetch(telegramUrl)
    } catch (err) {
      console.error(`Ошибка отправки для ${user.chat_id}:`, err)
    }
  }

  return NextResponse.json({ success: true, notified: users.length })
}
