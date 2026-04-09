import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  // Защита от несанкционированного запуска
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]

  // Ищем пользователей
  const { data: users, error } = await supabase
    .from("users")
    .select("chat_id, last_taken_date")
    .neq("last_taken_date", today)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Если таких пользователей нет, просто завершаем работу
  if (!users || users.length === 0) {
    return NextResponse.json({ success: true, message: "Все выпили таблетки" })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN

  // Отправляем уведомления
  for (const user of users) {
    const message = "🔔 Пора выпить таблетку! Зайди на сайт и отметь прием."
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${user.chat_id}&text=${encodeURIComponent(message)}`

    try {
      await fetch(telegramUrl)
    } catch (err) {
      console.error(`Ошибка отправки для ${user.chat_id}:`, err)
    }
  }

  return NextResponse.json({ success: true, notified: users.length })
}
